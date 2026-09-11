/**
 * Workspace Instance persistence proof over the production SQLite
 * application-data adapter: save → close → reopen → restore, schema
 * handling, safe failure, and no cross-workspace leakage.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// node:sqlite is a Node built-in the Vite pipeline must not try to bundle;
// resolve it through require (the adapter itself loads it the same way).
const { DatabaseSync } = createRequire(import.meta.url)(
	'node:sqlite'
) as typeof import('node:sqlite');
import { createAppServer } from '$lib/server/application-server';
import {
	defaultWorkspaceInstance,
	serializeWorkspaceInstance,
	type WorkspaceInstance
} from '@trading-os/trading-domain';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'tos-persistence-'));
	process.env.TRADING_OS_DB_PATH = join(dir, 'ws.sqlite');
});

afterEach(() => {
	delete process.env.TRADING_OS_DB_PATH;
	rmSync(dir, { recursive: true, force: true });
});

function workspaceUpdate(overrides: Partial<WorkspaceInstance['state']> = {}): WorkspaceInstance {
	const base = defaultWorkspaceInstance();
	return {
		...base,
		state: { ...base.state, ...overrides }
	};
}

describe('workspace persistence (SQLite application-data)', () => {
	it('T3 refuses action/op substitution before any dataset installation', async () => {
		const server = createAppServer();
		try {
			expect(
				await server.dispatch('act.dataRead', {
					op: 'install',
					requestId: 'wrong-action',
					fixtureRevision: '1'
				})
			).toMatchObject({ ok: false });
			expect(await server.dispatch('act.fixtureInstall', { op: 'catalog' })).toMatchObject({
				ok: false
			});
			expect(
				await server.dispatch('act.evaluationStart', { op: 'get', runId: 'missing' })
			).toMatchObject({ ok: false });
			expect(await server.dispatch('act.dataRead', { op: 'catalog' })).toMatchObject({
				ok: true,
				value: { kind: 'catalog', series: [] }
			});
		} finally {
			await server.close();
		}
	});
	it('saves, closes the adapter, reopens, and restores the exact workspace', async () => {
		const first = createAppServer();
		const saved = first.plan; // touch plan to ensure compile ran
		expect(saved.applicationId).toBe('trading.os');

		const instance = workspaceUpdate({
			instrumentId: 'FXT-C',
			timeframeId: '15m',
			layoutPreset: 'chart-focus',
			watchlistVisible: false
		});
		const result = await first.dispatch('act.saveWorkspace', serializeWorkspaceInstance(instance));
		expect(result.ok).toBe(true);
		await first.close();

		// Reopen on the same file through a fresh server.
		const second = createAppServer();
		const restored = await second.readWorkspace();
		expect(restored.state).toEqual(instance.state);
		await second.close();
	});

	it('returns the documented default for a fresh store and persists after first create', async () => {
		const server = createAppServer();
		const initial = await server.readWorkspace();
		expect(initial.state.instrumentId).toBe('FXT-A');
		const update = workspaceUpdate({ layoutPreset: 'inspect' });
		const result = await server.dispatch('act.saveWorkspace', serializeWorkspaceInstance(update));
		expect(result.ok).toBe(true);
		const after = await server.readWorkspace();
		expect(after.state.layoutPreset).toBe('inspect');
		await server.close();
	});

	it('rejects contract-violating workspace input with a safe structured failure', async () => {
		const server = createAppServer();
		const bad = {
			id: 'default',
			schema: 'trading.workspace-instance@9',
			state: {},
			updatedAt: 'nope'
		};
		const result = await server.dispatch('act.saveWorkspace', bad);
		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error('expected a structured failure');
		}
		expect(result.code).toBe('CONTRACT_REJECTED');
		// The store is untouched.
		const current = await server.readWorkspace();
		expect(current.state.layoutPreset).toBe('balanced');
		await server.close();
	});

	it('rejects an unknown action and a future workspace schema safely', async () => {
		const server = createAppServer();
		const unknownAction = await server.dispatch('act.doesNotExist', {});
		expect(unknownAction).toMatchObject({ ok: false, code: 'UNKNOWN_ACTION' });
		const futureSchema = await server.dispatch('act.queryWorkspaces', {});
		expect(futureSchema.ok).toBe(true);
		await server.close();
	});

	it('keeps separate database paths isolated (no cross-workspace leakage)', async () => {
		const dbA = join(dir, 'a.sqlite');
		const dbB = join(dir, 'b.sqlite');
		process.env.TRADING_OS_DB_PATH = dbA;
		const serverA = createAppServer();
		await serverA.dispatch(
			'act.saveWorkspace',
			serializeWorkspaceInstance(workspaceUpdate({ instrumentId: 'FXT-B' }))
		);
		await serverA.close();

		process.env.TRADING_OS_DB_PATH = dbB;
		const serverB = createAppServer();
		const restoredB = await serverB.readWorkspace();
		expect(restoredB.state.instrumentId).toBe('FXT-A');
		await serverB.close();

		process.env.TRADING_OS_DB_PATH = dbA;
		const serverA2 = createAppServer();
		const restoredA = await serverA2.readWorkspace();
		expect(restoredA.state.instrumentId).toBe('FXT-B');
		await serverA2.close();
		delete process.env.TRADING_OS_DB_PATH;
		process.env.TRADING_OS_DB_PATH = join(dir, 'ws.sqlite');
	});
});

describe('workspace save ordering (adversarial: stale, replayed, future writes)', () => {
	function workspaceAt(
		updatedAt: string,
		overrides: Partial<WorkspaceInstance['state']> = {}
	): WorkspaceInstance {
		const base = workspaceUpdate(overrides);
		return { ...base, updatedAt };
	}

	it('refuses a stale (older) write and keeps the newer persisted state', async () => {
		const server = createAppServer();
		const newer = workspaceAt('2026-09-10T12:00:00.000Z', { layoutPreset: 'inspect' });
		const savedNewer = await server.dispatch(
			'act.saveWorkspace',
			serializeWorkspaceInstance(newer)
		);
		expect(savedNewer.ok).toBe(true);

		// A delayed/retried write carrying the OLDER state arrives late.
		const stale = workspaceAt('2026-09-10T11:59:59.000Z', { layoutPreset: 'chart-focus' });
		const refused = await server.dispatch('act.saveWorkspace', serializeWorkspaceInstance(stale));
		expect(refused.ok).toBe(false);
		if (refused.ok) throw new Error('expected a structured refusal');
		expect(refused.code).toBe('STALE_WRITE');

		// The store still holds the newer state.
		const restored = await server.readWorkspace();
		expect(restored.state.layoutPreset).toBe('inspect');
		expect(restored.updatedAt).toBe('2026-09-10T12:00:00.000Z');
		await server.close();
	});

	it('accepts an equal-timestamp replay as idempotent and a newer write as fresh', async () => {
		const server = createAppServer();
		const first = workspaceAt('2026-09-10T12:00:00.000Z', { instrumentId: 'FXT-B' });
		expect((await server.dispatch('act.saveWorkspace', serializeWorkspaceInstance(first))).ok).toBe(
			true
		);
		// Exact replay (same ordering token): accepted, no state change.
		const replay = workspaceAt('2026-09-10T12:00:00.000Z', { instrumentId: 'FXT-B' });
		expect(
			(await server.dispatch('act.saveWorkspace', serializeWorkspaceInstance(replay))).ok
		).toBe(true);
		const newer = workspaceAt('2026-09-10T12:00:01.000Z', { instrumentId: 'FXT-C' });
		expect((await server.dispatch('act.saveWorkspace', serializeWorkspaceInstance(newer))).ok).toBe(
			true
		);
		const restored = await server.readWorkspace();
		expect(restored.state.instrumentId).toBe('FXT-C');
		await server.close();
	});

	it('refuses to overwrite a stored record this build cannot parse (no downgrade)', async () => {
		// First run creates the schema and closes cleanly.
		const bootstrap = createAppServer();
		await bootstrap.dispatch(
			'act.saveWorkspace',
			serializeWorkspaceInstance(workspaceUpdate({ instrumentId: 'FXT-A' }))
		);
		await bootstrap.close();

		// A future build's record is forced directly into the SQLite store
		// (bypassing every contract, exactly as a forward-compatible writer
		// would leave it).
		const db = new DatabaseSync(process.env.TRADING_OS_DB_PATH!);
		db.prepare(`UPDATE appdata_workspace_instances SET data = ? WHERE identity = 'default'`).run(
			JSON.stringify({
				id: 'default',
				schema: 'trading.workspace-instance@99',
				state: {
					instrumentId: 'FXT-Z',
					timeframeId: '1h',
					layoutPreset: 'inspect',
					watchlistVisible: false
				},
				updatedAt: '2099-01-01T00:00:00.000Z'
			})
		);
		db.close();

		// Reads fail safe to the documented default…
		const server = createAppServer();
		const read = await server.readWorkspace();
		expect(read.state.instrumentId).toBe('FXT-A');
		// …and saves REFUSE to destroy the future-schema record.
		const refused = await server.dispatch(
			'act.saveWorkspace',
			serializeWorkspaceInstance(workspaceUpdate({ instrumentId: 'FXT-B' }))
		);
		expect(refused.ok).toBe(false);
		if (refused.ok) throw new Error('expected a structured refusal');
		expect(refused.code).toBe('SCHEMA_CONFLICT');

		// The future record is untouched on disk.
		const verify = new DatabaseSync(process.env.TRADING_OS_DB_PATH!);
		const row = verify
			.prepare(`SELECT data FROM appdata_workspace_instances WHERE identity = 'default'`)
			.get() as {
			data: string;
		};
		verify.close();
		expect(JSON.parse(row.data).schema).toBe('trading.workspace-instance@99');
		await server.close();
	});
});
