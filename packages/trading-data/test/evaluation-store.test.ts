import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { migrationsFromResources } from '@victframework/appdata-sqlite';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import {
	createCalculationRegistry,
	evaluateMethod,
	evaluationIdentity
} from '../../trading-capabilities/src/evaluator.ts';
import {
	originalProvenance,
	canonicalEvaluation,
	type EvaluationRepository,
	type MethodRepository,
	type EvaluationRun
} from '@trading-os/trading-domain';
import {
	anchor,
	hash,
	request,
	spec,
	version,
	seriesInput
} from '../../trading-capabilities/test/evaluation-helpers.ts';
import {
	createSqliteEvaluationRepository,
	EVALUATION_MIGRATIONS
} from '../src/evaluation-store.ts';
import { createSqliteMethodRepository, METHOD_MIGRATIONS } from '../src/method-store.ts';
import { deterministicFixture } from '../src/evaluation-fixture.ts';
const { DatabaseSync } = createRequire(import.meta.url)(
	'node:sqlite'
) as typeof import('node:sqlite');
const t2 = [migrationsFromResources([], 1), ...METHOD_MIGRATIONS],
	migrations = [...t2, ...EVALUATION_MIGRATIONS],
	now = '2026-09-11T00:00:00.000Z';
let dir: string, path: string, repo: EvaluationRepository, methods: MethodRepository;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'tos-t3-store-'));
	path = join(dir, 'test.sqlite');
	methods = createSqliteMethodRepository(path, migrations);
	repo = createSqliteEvaluationRepository(path, migrations);
});
afterEach(() => {
	repo.close();
	methods.close();
	rmSync(dir, { recursive: true, force: true });
});
function sql(work: (db: InstanceType<typeof DatabaseSync>) => void) {
	const db = new DatabaseSync(path);
	try {
		work(db);
	} finally {
		db.close();
	}
}
function frozen() {
	const v = version();
	methods.transaction((tx) => {
		tx.insertMethod({
			schema: 'trading.method@1',
			id: v.methodId,
			name: v.content.name,
			description: '',
			createdAt: now,
			updatedAt: now,
			versionCount: 1,
			draftRevision: 1,
			hasDraft: false,
			origin: originalProvenance()
		});
		tx.insertVersion(v);
	});
	return v;
}
function queued(): EvaluationRun {
	const v = frozen();
	repo.ingest('install', '1', [spec()], now);
	const input = seriesInput(),
		req = request(input, v),
		identity = evaluationIdentity(
			v,
			req,
			[input.series],
			createAuthoringCatalog(),
			createCalculationRegistry()
		);
	return repo.createRun({
		schema: 'trading.evaluation-run@1',
		id: 'run-1',
		request: req,
		identity,
		inputFingerprint: hash(canonicalEvaluation(identity)),
		methodName: v.content.name,
		versionNumber: v.number,
		status: 'queued',
		revision: 1,
		createdAt: now,
		startedAt: null,
		finishedAt: null,
		resultFingerprint: null,
		failureCode: null
	});
}
function result() {
	const c = evaluateMethod(
			version(),
			request(),
			[seriesInput()],
			createAuthoringCatalog(),
			createCalculationRegistry()
		),
		canonical = canonicalEvaluation(c);
	return {
		content: c,
		canonical,
		inputFingerprint: hash(canonicalEvaluation(c.identity)),
		fingerprint: hash(canonical)
	};
}
describe('market storage and immutable ingestion', () => {
	it('imports, reads bounded bars, retries exactly and survives reopen', () => {
		const receipt = repo.ingest('install', '1', [spec()], now);
		expect(repo.ingest('install', '1', [spec()], now)).toEqual(receipt);
		const s = repo.listSeries()[0]!;
		expect(
			repo.readBars({ seriesId: s.id, start: anchor, end: anchor + 3 * 900000, limit: 3 })
		).toHaveLength(3);
		expect(() =>
			repo.readBars({ seriesId: s.id, start: anchor, end: s.coverage.end, limit: 3 })
		).toThrow();
		repo.close();
		repo = createSqliteEvaluationRepository(path, migrations);
		expect(repo.getIngestion('install')).toEqual(receipt);
		expect(repo.getSeries(s.id)).toEqual(s);
	});
	it('refuses conflicting retries and permits new receipts for identical content', () => {
		repo.ingest('install', '1', [spec()], now);
		expect(() => repo.ingest('install', '1', [spec([1, 2, 3])], now)).toThrow('different');
		repo.ingest('another', '1', [spec()], now);
		expect(repo.listSeries()).toHaveLength(1);
	});
	it.each(['ohlc', 'duplicate', 'unordered', 'volume', 'infinite', 'negative-zero', 'timeframe'])(
		'refuses invalid %s atomically',
		(kind) => {
			const s = spec();
			let bad: unknown = s;
			if (kind === 'ohlc') bad = { ...s, bars: [{ ...s.bars[0], high: -1 }] };
			if (kind === 'duplicate') bad = { ...s, bars: [s.bars[0], s.bars[0]] };
			if (kind === 'unordered') bad = { ...s, bars: [s.bars[1], s.bars[0]] };
			if (kind === 'volume') bad = { ...s, bars: [{ ...s.bars[0], volume: -1 }] };
			if (kind === 'infinite') bad = { ...s, bars: [{ ...s.bars[0], close: Infinity }] };
			if (kind === 'negative-zero') bad = { ...s, bars: [{ ...s.bars[0], volume: -0 }] };
			if (kind === 'timeframe') bad = { ...s, timeframe: '1D' };
			expect(() => repo.ingest('bad', '1', [bad as typeof s], now)).toThrow();
			expect(repo.listSeries()).toEqual([]);
		}
	);
	it('records gaps and does not fill them', () => {
		const s = spec();
		repo.ingest('gaps', '1', [{ ...s, bars: s.bars.filter((_, i) => i !== 2) }], now);
		const stored = repo.listSeries()[0]!;
		expect(stored.health).toEqual({
			state: 'gaps',
			gaps: [{ start: anchor + 2 * 900000, end: anchor + 3 * 900000, missingBars: 1 }]
		});
		expect(
			repo.readBars({ seriesId: stored.id, start: anchor, end: stored.coverage.end, limit: 10 })
		).toHaveLength(5);
	});
	it('rolls back all bars and receipts on a partial insert failure', () => {
		sql((db) =>
			db.exec(
				"CREATE TRIGGER injected BEFORE INSERT ON appdata_market_series BEGIN SELECT RAISE(ABORT,'test failure'); END;"
			)
		);
		expect(() => repo.ingest('fail', '1', [spec()], now)).toThrow();
		sql((db) => {
			expect(db.prepare('SELECT count(*) AS n FROM appdata_market_bars').get()!.n).toBe(0);
		});
		expect(repo.getIngestion('fail')).toBeNull();
	});
	it('SQL protects series/bars/receipts from updates, deletes and later appends', () => {
		repo.ingest('install', '1', [spec()], now);
		sql((db) => {
			for (const table of ['market_series', 'market_bars', 'market_ingestions'])
				for (const op of [`UPDATE appdata_${table} SET data=data`, `DELETE FROM appdata_${table}`])
					expect(() => db.exec(op)).toThrow('immutable');
			expect(() =>
				db
					.prepare('INSERT INTO appdata_market_bars VALUES(?,?,?,?)')
					.run(repo.listSeries()[0]!.id, 0, '{}', 'bad')
			).toThrow('immutable');
		});
	});
	it('cross-checks indexed columns and bar content digests', () => {
		repo.ingest('install', '1', [spec()], now);
		const id = repo.listSeries()[0]!.id;
		sql((db) => {
			db.exec('DROP TRIGGER market_bars_no_update');
			db.prepare('UPDATE appdata_market_bars SET time=time+1 WHERE series_id=?').run(id);
		});
		expect(() =>
			repo.readBars({ seriesId: id, start: anchor, end: anchor + 7 * 900000, limit: 10 })
		).toThrow('verified');
		sql((db) => {
			db.exec('DROP TRIGGER market_series_no_update');
			db.exec("UPDATE appdata_market_series SET instrument='OTHER'");
		});
		expect(() => repo.listSeries()).toThrow('verified');
	});
	it('migrates a genuine T2 database preserving its immutable Method', () => {
		repo.close();
		methods.close();
		const second = join(dir, 't2.sqlite'),
			old = createSqliteMethodRepository(second, t2);
		const v = version();
		old.transaction((tx) => {
			tx.insertMethod({
				schema: 'trading.method@1',
				id: v.methodId,
				name: v.content.name,
				description: '',
				createdAt: now,
				updatedAt: now,
				versionCount: 1,
				draftRevision: 1,
				hasDraft: false,
				origin: originalProvenance()
			});
			tx.insertVersion(v);
		});
		old.close();
		repo = createSqliteEvaluationRepository(second, migrations);
		methods = createSqliteMethodRepository(second, migrations);
		expect(methods.transaction((tx) => tx.getVersion(v.id))).toEqual(v);
		expect(repo.listSeries()).toEqual([]);
	});
	it('fixture timeframes aggregate the same underlying bars and have enough weekly history', () => {
		const values = deterministicFixture(),
			base = values[0]!,
			week = values[2]!;
		expect(week.bars).toHaveLength(40);
		expect(week.bars[0]!.open).toBe(base.bars[0]!.open);
		expect(week.bars[0]!.close).toBe(base.bars[671]!.close);
		expect(week.bars[0]!.high).toBe(Math.max(...base.bars.slice(0, 672).map((b) => b.high)));
		expect(values[4]!.bars.length).toBe(base.bars.length - 3);
		expect(hash(JSON.stringify(values))).toBe(hash(JSON.stringify(deterministicFixture())));
	});
});
describe('evaluation envelopes and atomic immutable results', () => {
	it('reconciles duplicate starts and rejects conflicting request identities', () => {
		const r = queued();
		expect(repo.createRun(r)).toEqual(r);
		expect(() =>
			repo.createRun({ ...r, request: { ...r.request, end: r.request.end - 900000 } })
		).toThrow();
	});
	it('persists exact deterministic bytes across close/reopen', () => {
		queued();
		const active = repo.transition('run-1', 1, 'running', now),
			value = result();
		repo.complete(active.id, active.revision, value, now);
		repo.close();
		repo = createSqliteEvaluationRepository(path, migrations);
		expect(repo.getResult(value.fingerprint)).toEqual(value);
		expect(repo.getRun(active.id)!.status).toBe('succeeded');
		sql((db) => {
			expect(() => db.exec('UPDATE appdata_evaluation_results SET canonical=canonical')).toThrow();
			expect(() => db.exec('DELETE FROM appdata_evaluation_results')).toThrow();
			expect(() => db.exec('DELETE FROM appdata_evaluation_runs')).toThrow();
		});
	});
	it('rolls back result insertion when completion transition fails', () => {
		queued();
		repo.transition('run-1', 1, 'running', now);
		sql((db) =>
			db.exec(
				"CREATE TRIGGER injected BEFORE UPDATE ON appdata_evaluation_runs WHEN NEW.status='succeeded' BEGIN SELECT RAISE(ABORT,'test failure'); END;"
			)
		);
		const value = result();
		expect(() => repo.complete('run-1', 2, value, now)).toThrow();
		expect(repo.getResult(value.fingerprint)).toBeNull();
		expect(repo.getRun('run-1')!.status).toBe('running');
	});
	it('recovers queued/running records once without replaying calculations', () => {
		queued();
		repo.transition('run-1', 1, 'running', now);
		expect(repo.recover(now)).toBe(1);
		expect(repo.recover(now)).toBe(0);
		expect(repo.getRun('run-1')!.status).toBe('interrupted');
		expect(() => repo.transition('run-1', 3, 'running', now)).toThrow();
	});
	it('rejects CAS failure and indexed run identity corruption', () => {
		queued();
		expect(() => repo.transition('run-1', 99, 'running', now)).toThrow('changed');
		sql((db) => {
			db.exec('DROP TRIGGER evaluation_run_transition');
			db.exec("UPDATE appdata_evaluation_runs SET input_fingerprint='bad'");
		});
		expect(() => repo.getRun('run-1')).toThrow('verified');
	});
	it('T2 AV-2 rejects method, draft, version and profile column disagreement', () => {
		const v = frozen();
		methods.transaction((tx) => {
			tx.putDraft(
				{
					schema: 'trading.method-draft@1',
					provenance: originalProvenance(),
					methodId: v.methodId,
					revision: 1,
					updatedAt: now,
					content: v.content
				},
				null
			);
			tx.insertProfile({
				schema: 'trading.workspace-profile@1',
				workspaceId: 'default',
				revision: 1,
				methodVersionId: v.id,
				updatedAt: now
			});
		});
		sql((db) => {
			db.exec('UPDATE appdata_method_drafts SET revision=2');
			db.exec('DROP TRIGGER workspace_profile_no_update');
			db.exec('UPDATE appdata_workspace_profiles SET revision=2');
		});
		expect(() => methods.transaction((tx) => tx.getDraft(v.methodId))).toThrow('malformed');
		expect(() => methods.transaction((tx) => tx.getProfile('default'))).toThrow('malformed');
		sql((db) => db.exec("PRAGMA foreign_keys=OFF; UPDATE appdata_methods SET id='wrong'"));
		expect(() => methods.transaction((tx) => tx.getMethod('wrong'))).toThrow('malformed');
		sql((db) => {
			db.exec('DROP TRIGGER method_version_no_update');
			db.prepare('UPDATE appdata_method_versions SET number=2 WHERE id=?').run(v.id);
		});
		expect(() => methods.transaction((tx) => tx.getVersion(v.id))).toThrow('malformed');
	});
});
