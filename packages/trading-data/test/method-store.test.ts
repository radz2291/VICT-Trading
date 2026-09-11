import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createSqliteApplicationData,
	migrationsFromResources,
	openAppDatabase,
	applyApplicationDataMigrations
} from '@victframework/appdata-sqlite';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import {
	createMethodService,
	type MethodResult,
	type MethodDetail,
	type MethodRepository
} from '@trading-os/trading-domain';
import { createSqliteMethodRepository, METHOD_MIGRATIONS } from '../src/method-store.ts';
import { breakoutFixture, reversionFixture } from '../../trading-capabilities/test/fixtures.ts';
const { DatabaseSync } = createRequire(import.meta.url)(
	'node:sqlite'
) as typeof import('node:sqlite');
const migrations = [migrationsFromResources([], 1), ...METHOD_MIGRATIONS];
let dir: string, path: string, repo: MethodRepository;
let service: ReturnType<typeof createMethodService>;
const catalog = createAuthoringCatalog();
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'tos-t2-'));
	path = join(dir, 'methods.sqlite');
	repo = createSqliteMethodRepository(path, migrations);
	service = createMethodService(repo, catalog);
});
afterEach(() => {
	repo.close();
	rmSync(dir, { recursive: true, force: true });
});
function detail(result: MethodResult): MethodDetail {
	if (!result.ok || result.value.kind !== 'detail') throw new Error(JSON.stringify(result));
	return result.value.detail;
}
async function saved(fixture = breakoutFixture) {
	const created = detail(
		await service.execute({ op: 'create', requestId: crypto.randomUUID(), name: fixture.name })
	);
	return detail(
		await service.execute({
			op: 'save',
			requestId: crypto.randomUUID(),
			methodId: created.method.id,
			expectedRevision: created.draft!.revision,
			content: fixture
		})
	);
}
async function frozen(fixture = breakoutFixture) {
	const d = await saved(fixture);
	return detail(
		await service.execute({
			op: 'freeze',
			requestId: crypto.randomUUID(),
			methodId: d.method.id,
			expectedRevision: d.draft!.revision
		})
	);
}
describe('Method persistence and application use cases', () => {
	it('creates a lineage and draft atomically, then restores saved content after close/reopen', async () => {
		const d = await saved();
		repo.close();
		repo = createSqliteMethodRepository(path, migrations);
		service = createMethodService(repo, catalog);
		expect(detail(await service.execute({ op: 'get', methodId: d.method.id }))).toEqual(d);
	});
	it('preserves immutable versions, canonical content, provenance and profile selection after close/reopen', async () => {
		const d = await frozen();
		const v = d.versions[0]!;
		const result = await service.execute({
			op: 'assign',
			requestId: 'assign',
			workspaceId: 'default',
			expectedRevision: 0,
			versionId: v.id
		});
		expect(result.ok).toBe(true);
		repo.close();
		repo = createSqliteMethodRepository(path, migrations);
		service = createMethodService(repo, catalog);
		expect(detail(await service.execute({ op: 'get', methodId: d.method.id }))).toEqual(d);
		const p = await service.execute({ op: 'profile', workspaceId: 'default' });
		expect(p).toMatchObject({
			ok: true,
			value: { profile: { methodVersionId: v.id, revision: 1 } }
		});
	});
	it('refuses stale draft saves and never mutates the winning content', async () => {
		const d = await saved();
		const command = {
			op: 'save',
			methodId: d.method.id,
			expectedRevision: d.draft!.revision,
			content: { ...d.draft!.content, name: 'Winner' }
		};
		expect((await service.execute({ ...command, requestId: 'winner' })).ok).toBe(true);
		expect(
			await service.execute({ ...command, requestId: 'stale', content: reversionFixture })
		).toMatchObject({ ok: false, code: 'CONFLICT' });
		expect(
			detail(await service.execute({ op: 'get', methodId: d.method.id })).draft!.content.name
		).toBe('Winner');
	});
	it('retries freeze idempotently after its draft is consumed and refuses reused keys with other input', async () => {
		const d = await saved();
		const command = {
			op: 'freeze',
			methodId: d.method.id,
			expectedRevision: d.draft!.revision,
			requestId: 'freeze'
		};
		const first = await service.execute(command);
		expect(await service.execute(command)).toEqual(first);
		expect(detail(first).versions).toHaveLength(1);
		expect(await service.execute({ ...command, expectedRevision: 999 })).toMatchObject({
			ok: false,
			code: 'IDEMPOTENCY_CONFLICT'
		});
	});
	it('handles simultaneous freeze requests with one version and one exact receipt', async () => {
		const d = await saved();
		const c = {
			op: 'freeze',
			methodId: d.method.id,
			expectedRevision: d.draft!.revision,
			requestId: 'concurrent'
		};
		const results = await Promise.all([service.execute(c), service.execute(c)]);
		expect(results[0]).toEqual(results[1]);
		expect(detail(results[0]!).versions).toHaveLength(1);
	});
	it('serializes concurrent saves across independent connections with exactly one winner', async () => {
		const d = await saved();
		const other = createSqliteMethodRepository(path, migrations);
		try {
			const second = createMethodService(other, catalog);
			const command = {
				op: 'save',
				methodId: d.method.id,
				expectedRevision: d.draft!.revision,
				content: reversionFixture
			};
			const results = await Promise.all([
				service.execute({ ...command, requestId: 'one' }),
				second.execute({ ...command, requestId: 'two' })
			]);
			expect(results.filter((r) => r.ok)).toHaveLength(1);
			expect(results.filter((r) => !r.ok)).toEqual([expect.objectContaining({ code: 'CONFLICT' })]);
		} finally {
			other.close();
		}
	});
	it('rolls back version, consumed draft, method counter and idempotency receipt on partial failure', async () => {
		const d = await saved();
		const db = new DatabaseSync(path);
		db.exec(
			"CREATE TRIGGER fail_receipt BEFORE INSERT ON appdata_method_requests WHEN NEW.key = 'rollback' BEGIN SELECT RAISE(ABORT, 'injected secret path'); END;"
		);
		const c = {
			op: 'freeze',
			methodId: d.method.id,
			expectedRevision: d.draft!.revision,
			requestId: 'rollback'
		};
		const result = await service.execute(c);
		expect(result).toMatchObject({ ok: false, code: 'PERSISTENCE_FAILED' });
		expect(JSON.stringify(result)).not.toContain('injected');
		expect(detail(await service.execute({ op: 'get', methodId: d.method.id }))).toEqual(d);
		db.exec('DROP TRIGGER fail_receipt');
		db.close();
		expect(detail(await service.execute(c)).versions).toHaveLength(1);
	});
	it('refuses direct SQL update and deletion of immutable versions and profile revisions', async () => {
		const d = await frozen();
		await service.execute({
			op: 'assign',
			requestId: 'profile',
			workspaceId: 'w',
			versionId: d.versions[0]!.id,
			expectedRevision: 0
		});
		const db = new DatabaseSync(path);
		for (const table of ['appdata_method_versions', 'appdata_workspace_profiles']) {
			expect(() => db.exec(`UPDATE ${table} SET data = '{}'`)).toThrow();
			expect(() => db.exec(`DELETE FROM ${table}`)).toThrow();
		}
		db.close();
		expect(repo).not.toHaveProperty('updateVersion');
	});
	it('revises in the same lineage with monotonic draft revisions and sequential version numbers', async () => {
		const d = await frozen();
		const v = d.versions[0]!;
		const r = detail(await service.execute({ op: 'revise', requestId: 'revise', versionId: v.id }));
		expect(r.method.id).toBe(d.method.id);
		expect(r.draft!.revision).toBeGreaterThan(d.method.draftRevision);
		expect(r.draft!.provenance).toMatchObject({ kind: 'revision', sourceVersionId: v.id });
		const next = detail(
			await service.execute({
				op: 'freeze',
				requestId: 'second',
				methodId: r.method.id,
				expectedRevision: r.draft!.revision
			})
		);
		expect(next.versions.map((x) => x.number)).toEqual([1, 2]);
		expect(next.versions[1]!.fingerprint).toBe(v.fingerprint);
	});
	it('prevents ABA stale writes when an older version starts a new revision', async () => {
		const d = await frozen();
		const r = detail(
			await service.execute({ op: 'revise', requestId: 'revise', versionId: d.versions[0]!.id })
		);
		expect(
			await service.execute({
				op: 'save',
				requestId: 'stale',
				methodId: d.method.id,
				expectedRevision: 1,
				content: reversionFixture
			})
		).toMatchObject({ ok: false, code: 'CONFLICT' });
		expect(detail(await service.execute({ op: 'get', methodId: r.method.id })).draft).toEqual(
			r.draft
		);
	});
	it('refuses revision creation when a draft already exists', async () => {
		const d = await frozen();
		await service.execute({ op: 'revise', requestId: 'first', versionId: d.versions[0]!.id });
		expect(
			await service.execute({ op: 'revise', requestId: 'second', versionId: d.versions[0]!.id })
		).toMatchObject({ ok: false, code: 'CONFLICT' });
	});
	it('clones into a new lineage with pinned source provenance and no source mutation', async () => {
		const d = await frozen();
		const c = detail(
			await service.execute({
				op: 'clone',
				requestId: 'clone',
				versionId: d.versions[0]!.id,
				name: 'Independent study'
			})
		);
		expect(c.method.id).not.toBe(d.method.id);
		expect(c.versions).toEqual([]);
		expect(c.draft!.provenance).toMatchObject({
			kind: 'clone',
			sourceMethodId: d.method.id,
			sourceFingerprint: d.versions[0]!.fingerprint
		});
		expect(detail(await service.execute({ op: 'get', methodId: d.method.id }))).toEqual(d);
	});
	it('keeps Methods and independently revisioned workspace references isolated', async () => {
		const a = await frozen(),
			b = await frozen(reversionFixture);
		await service.execute({
			op: 'assign',
			requestId: 'a',
			workspaceId: 'one',
			expectedRevision: 0,
			versionId: a.versions[0]!.id
		});
		await service.execute({
			op: 'assign',
			requestId: 'b',
			workspaceId: 'two',
			expectedRevision: 0,
			versionId: b.versions[0]!.id
		});
		await service.execute({
			op: 'assign',
			requestId: 'remove',
			workspaceId: 'one',
			expectedRevision: 1,
			versionId: null
		});
		expect(await service.execute({ op: 'profile', workspaceId: 'two' })).toMatchObject({
			value: { profile: { revision: 1, methodVersionId: b.versions[0]!.id } }
		});
		expect(detail(await service.execute({ op: 'get', methodId: a.method.id })).versions).toEqual(
			a.versions
		);
		expect(
			await service.execute({
				op: 'assign',
				requestId: 'stale',
				workspaceId: 'one',
				expectedRevision: 1,
				versionId: null
			})
		).toMatchObject({ ok: false, code: 'CONFLICT' });
	});
	it('rejects missing version references and does not create a profile on failure', async () => {
		expect(
			await service.execute({
				op: 'assign',
				requestId: 'missing',
				workspaceId: 'one',
				expectedRevision: 0,
				versionId: 'missing'
			})
		).toMatchObject({ ok: false, code: 'NOT_FOUND' });
		expect(await service.execute({ op: 'profile', workspaceId: 'one' })).toMatchObject({
			value: { profile: null }
		});
	});
	it('saves unsupported capability revisions for recovery but refuses freezing', async () => {
		const c = {
			...breakoutFixture,
			capabilities: breakoutFixture.capabilities.map((x) => ({ ...x, revision: '999' }))
		};
		const d = await saved(c);
		expect(
			await service.execute({
				op: 'freeze',
				requestId: 'unsupported',
				methodId: d.method.id,
				expectedRevision: d.draft!.revision
			})
		).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
	});
	it('fails closed on malformed or future records without overwriting them', async () => {
		const d = await saved();
		const db = new DatabaseSync(path);
		const raw = JSON.stringify({ ...d.draft, schema: 'trading.method-draft@99' });
		db.prepare('UPDATE appdata_method_drafts SET data = ?').run(raw);
		expect(await service.execute({ op: 'get', methodId: d.method.id })).toMatchObject({
			ok: false,
			code: 'UNSUPPORTED_SCHEMA'
		});
		expect(
			await service.execute({
				op: 'save',
				requestId: 'bad',
				methodId: d.method.id,
				expectedRevision: d.draft!.revision,
				content: reversionFixture
			})
		).toMatchObject({ ok: false, code: 'UNSUPPORTED_SCHEMA' });
		expect(db.prepare('SELECT data FROM appdata_method_drafts').get()?.data).toBe(raw);
		db.close();
	});
	it('migrates the existing public VICT v1 foundation and retains unrelated workspace rows', () => {
		const p = join(dir, 'old.sqlite');
		const foundation = createSqliteApplicationData({ path: p, resources: [] });
		foundation.close();
		const db = new DatabaseSync(p);
		db.exec(
			"CREATE TABLE appdata_workspace_instances(identity TEXT PRIMARY KEY, data TEXT); INSERT INTO appdata_workspace_instances VALUES ('default', 'unchanged');"
		);
		db.close();
		const upgraded = createSqliteMethodRepository(p, migrations);
		upgraded.close();
		const check = new DatabaseSync(p);
		expect(
			check
				.prepare('SELECT version FROM vict_appdata_migrations ORDER BY version')
				.all()
				.map((r) => r.version)
		).toEqual([1, 2, 3]);
		expect(check.prepare('SELECT data FROM appdata_workspace_instances').get()?.data).toBe(
			'unchanged'
		);
		check.close();
	});
	it('refuses future physical schemas before product writes', () => {
		const p = join(dir, 'future.sqlite');
		const db = new DatabaseSync(p);
		db.exec(
			"CREATE TABLE vict_appdata_migrations(version INTEGER PRIMARY KEY, id TEXT, name TEXT, applied_at TEXT); INSERT INTO vict_appdata_migrations VALUES (99, 'future', 'future', 'now');"
		);
		db.close();
		expect(() => createSqliteMethodRepository(p, migrations)).toThrow(/newer|unsupported/);
	});
	it('rolls back a failed migration and its migration bookkeeping together', () => {
		const p = join(dir, 'migration-failure.sqlite');
		const open = openAppDatabase(p);
		expect(() =>
			applyApplicationDataMigrations(
				open,
				[
					{
						id: 'bad',
						version: 1,
						name: 'bad',
						statements: ['CREATE TABLE appdata_probe(id TEXT)', 'INVALID SQL']
					}
				],
				() => 'now'
			)
		).toThrow();
		expect(
			open.db.prepare("SELECT name FROM sqlite_master WHERE name = 'appdata_probe'").get()
		).toBeUndefined();
		expect(open.db.prepare('SELECT * FROM vict_appdata_migrations').all()).toEqual([]);
		open.close();
	});
	it('restores in a genuinely new Node process, with no in-memory state transferred', async () => {
		const d = await frozen();
		repo.close();
		const script = `import { createSqliteMethodRepository, METHOD_MIGRATIONS } from ${JSON.stringify(new URL('../src/method-store.ts', import.meta.url).href)}; import { migrationsFromResources } from '@victframework/appdata-sqlite'; const r = createSqliteMethodRepository(process.argv[1], [migrationsFromResources([], 1), ...METHOD_MIGRATIONS]); console.log(JSON.stringify(r.transaction(tx => ({ method: tx.getMethod(process.argv[2]), versions: tx.listVersions(process.argv[2]) })))); r.close();`;
		const child = spawnSync(
			process.execPath,
			['--experimental-transform-types', '--input-type=module', '-e', script, path, d.method.id],
			{ encoding: 'utf8' }
		);
		expect({ status: child.status, stderr: child.status === 0 ? '' : child.stderr }).toEqual({
			status: 0,
			stderr: ''
		});
		const restored = JSON.parse(child.stdout);
		expect(restored.method).toEqual(d.method);
		expect(restored.versions).toEqual(d.versions);
		repo = createSqliteMethodRepository(path, migrations);
	});
});
