import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { migrationsFromResources } from '@victframework/appdata-sqlite';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import {
	originalProvenance,
	type EvaluationRepository,
	type MethodRepository
} from '@trading-os/trading-domain';
import {
	createSqliteEvaluationRepository,
	EVALUATION_MIGRATIONS
} from '@trading-os/trading-data/evaluation-store';
import {
	createSqliteMethodRepository,
	METHOD_MIGRATIONS
} from '@trading-os/trading-data/method-store';
import { createCalculationRegistry } from '@trading-os/trading-capabilities/calculations';
import { createEvaluationService } from '../evaluation-service';
import {
	spec,
	version,
	request
} from '../../../../../../packages/trading-capabilities/test/evaluation-helpers';
let dir: string, repo: EvaluationRepository, methods: MethodRepository;
const now = '2026-09-11T00:00:00.000Z',
	grants = ['market.read', 'market.write', 'evaluation.write'];
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'tos-t3-service-'));
	const path = join(dir, 'test.sqlite'),
		migrations = [migrationsFromResources([], 1), ...METHOD_MIGRATIONS, ...EVALUATION_MIGRATIONS];
	methods = createSqliteMethodRepository(path, migrations);
	repo = createSqliteEvaluationRepository(path, migrations);
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
	repo.ingest('tiny', '1', [spec()], now);
});
afterEach(() => {
	repo.close();
	methods.close();
	rmSync(dir, { recursive: true, force: true });
});
it('uses real VICT runtime, queued lifecycle, duplicate reconciliation and exact rerun', async () => {
	const events: { capabilityId: string; type: string }[] = [];
	const service = createEvaluationService(repo, methods, createAuthoringCatalog(), {
		grants,
		onGovernedEvent: (e) => events.push(e)
	});
	const cmd = { op: 'start', requestId: 'run-a', request: request() } as const;
	const [a, b] = await Promise.all([service.execute(cmd), service.execute(cmd)]);
	expect(a.ok).toBe(true);
	expect(b.ok).toBe(true);
	if (!a.ok || a.value.kind !== 'run') throw new Error(JSON.stringify(a));
	expect(a.value.run.status).toBe('queued');
	await service.drain();
	const saved = repo.getRun('run-a')!;
	expect(saved.status).toBe('succeeded');
	const first = repo.getResult(saved.resultFingerprint!)!;
	expect(
		events.some((e) => e.capabilityId === 'trading.evaluate' && e.type === 'node.started')
	).toBe(true);
	await service.execute({ ...cmd, requestId: 'run-b' });
	await service.drain();
	expect(repo.getRun('run-b')!.resultFingerprint).toBe(first.fingerprint);
	expect(await service.execute(cmd)).toEqual({
		ok: true,
		value: { kind: 'run', run: saved, result: first }
	});
	expect(
		(await service.execute({ ...cmd, request: { ...cmd.request, end: cmd.request.end - 900000 } }))
			.ok
	).toBe(false);
});
it('runtime denies missing grants before handlers and writes', async () => {
	const service = createEvaluationService(repo, methods, createAuthoringCatalog(), { grants: [] });
	const r = await service.execute({ op: 'start', requestId: 'denied', request: request() });
	expect(r).toMatchObject({ ok: false, code: 'DENIED' });
	expect(repo.getRun('denied')).toBeNull();
	expect(await service.execute({ op: 'catalog' })).toMatchObject({ ok: false, code: 'DENIED' });
});
it('concurrent different starts cannot bypass the two-job bound during runtime awaits', async () => {
	const service = createEvaluationService(repo, methods, createAuthoringCatalog(), { grants });
	const responses = await Promise.all(
		['one', 'two', 'three'].map((requestId) =>
			service.execute({ op: 'start', requestId, request: request() })
		)
	);
	expect(responses.filter((r) => r.ok)).toHaveLength(2);
	expect(responses.filter((r) => !r.ok)).toMatchObject([{ code: 'LIMIT_EXCEEDED' }]);
	await service.drain();
});
it('injected calculation failure persists truthful failure without internal error prose', async () => {
	const normal = createCalculationRegistry(),
		broken = createCalculationRegistry(
			normal.pins.map((p) => {
				const c = normal.resolve(p.capabilityId, p.definitionRevision, p.calculationRevision)!;
				return c.capabilityId === 'analysis.range'
					? {
							...c,
							calculate: () => {
								throw new Error('SECRET C:\\internal.sqlite raw SQL');
							}
						}
					: c;
			})
		);
	const service = createEvaluationService(repo, methods, createAuthoringCatalog(), {
		grants,
		registry: broken
	});
	await service.execute({ op: 'start', requestId: 'failed', request: request() });
	await service.drain();
	const r = await service.execute({ op: 'get', runId: 'failed' });
	expect(r).toMatchObject({
		ok: true,
		value: {
			kind: 'run',
			run: { status: 'failed', failureCode: 'CALCULATION_FAILED' },
			result: null
		}
	});
	expect(JSON.stringify(r)).not.toContain('SECRET');
});
it('missing calculation revision preserves safe server diagnostics', async () => {
	const service = createEvaluationService(repo, methods, createAuthoringCatalog(), {
		grants,
		registry: createCalculationRegistry([])
	});
	expect(
		await service.execute({ op: 'start', requestId: 'unsupported', request: request() })
	).toMatchObject({
		ok: false,
		code: 'UNSUPPORTED_CALCULATION',
		diagnostics: [{ instanceId: 'analysis' }]
	});
});
it('bounds range and rejects malformed/future commands without persistence', async () => {
	const service = createEvaluationService(repo, methods, createAuthoringCatalog(), { grants });
	for (const value of [
		{ op: 'catalog', extra: true },
		{ op: 'start', requestId: 'bad', request: { ...request(), schema: 'future' } },
		{ op: 'start', requestId: 'bad', request: { ...request(), bindings: [] } }
	])
		expect((await service.execute(value)).ok).toBe(false);
	expect(repo.listRuns(null)).toEqual([]);
});
