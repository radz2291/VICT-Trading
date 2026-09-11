import { it, expect, vi, afterEach } from 'vitest';
import { createEvaluationWorkspace } from '../evaluation-workspace.svelte';
import { createEvaluationClient } from '../evaluation-client';
import {
	EVALUATION_ERRORS,
	type EvaluationClient,
	type EvaluationResponse,
	type EvaluationRun,
	canonicalEvaluation
} from '@trading-os/trading-domain';
import {
	request,
	version,
	hash,
	seriesInput
} from '../../../../../packages/trading-capabilities/test/evaluation-helpers';
import { createAuthoringCatalog } from '@trading-os/trading-capabilities';
import {
	createCalculationRegistry,
	evaluateMethod
} from '@trading-os/trading-capabilities/calculations';
const failure: EvaluationResponse = {
	ok: false,
	code: 'PERSISTENCE_FAILED',
	message: EVALUATION_ERRORS.PERSISTENCE_FAILED,
	diagnostics: []
};
function run(id = 'run', status: EvaluationRun['status'] = 'succeeded'): EvaluationRun {
	const content = evaluateMethod(
		version(),
		request(),
		[seriesInput()],
		createAuthoringCatalog(),
		createCalculationRegistry()
	);
	return {
		schema: 'trading.evaluation-run@1',
		id,
		request: request(),
		identity: content.identity,
		inputFingerprint: hash(canonicalEvaluation(content.identity)),
		methodName: version().content.name,
		versionNumber: 1,
		status,
		revision: status === 'queued' ? 1 : 3,
		createdAt: '2026-09-11T00:00:00.000Z',
		startedAt: status === 'queued' ? null : '2026-09-11T00:00:00.000Z',
		finishedAt: status === 'queued' || status === 'running' ? null : '2026-09-11T00:00:01.000Z',
		resultFingerprint: status === 'succeeded' ? hash(canonicalEvaluation(content)) : null,
		failureCode: status === 'failed' ? 'CALCULATION_FAILED' : null
	};
}
function success(id = 'run'): EvaluationResponse {
	const content = evaluateMethod(
			version(),
			request(),
			[seriesInput()],
			createAuthoringCatalog(),
			createCalculationRegistry()
		),
		canonical = canonicalEvaluation(content);
	return {
		ok: true,
		value: {
			kind: 'run',
			run: run(id),
			result: {
				content,
				canonical,
				fingerprint: hash(canonical),
				inputFingerprint: hash(canonicalEvaluation(content.identity))
			}
		}
	};
}
afterEach(() => vi.useRealTimers());
it('exact uncertain retry keeps the same request and never exposes an old result', async () => {
	const execute = vi
		.fn<EvaluationClient['execute']>()
		.mockResolvedValueOnce(success())
		.mockResolvedValueOnce(failure)
		.mockResolvedValueOnce(success('second'));
	const service = createEvaluationWorkspace({ execute });
	await service.openRun('run');
	expect(service.result).not.toBeNull();
	await service.start(request());
	expect(service.result).toBeNull();
	expect(service.state).toBe('failed');
	await service.retry();
	expect(execute.mock.calls[2]![0]).toEqual(execute.mock.calls[1]![0]);
	service.dispose();
});
it('stale/out-of-order get responses cannot replace the selected run', async () => {
	let finish!: (r: EvaluationResponse) => void;
	const execute = vi
		.fn<EvaluationClient['execute']>()
		.mockImplementationOnce(() => new Promise((r) => (finish = r)))
		.mockResolvedValueOnce(success('new'));
	const s = createEvaluationWorkspace({ execute });
	const old = s.openRun('old');
	await s.openRun('new');
	finish(success('old'));
	await old;
	expect(s.run!.id).toBe('new');
	s.dispose();
});
it('queued/running state polls persisted truth and clears background activity on completion', async () => {
	vi.useFakeTimers();
	const queued = run('run', 'queued'),
		execute = vi
			.fn<EvaluationClient['execute']>()
			.mockResolvedValueOnce({ ok: true, value: { kind: 'run', run: queued, result: null } })
			.mockResolvedValueOnce({ ok: true, value: { kind: 'runs', runs: [run()] } })
			.mockResolvedValueOnce(success());
	const s = createEvaluationWorkspace({ execute });
	await s.start(request());
	expect(s.activeRuns).toHaveLength(1);
	await vi.advanceTimersByTimeAsync(300);
	expect(s.activeRuns).toHaveLength(0);
	expect(s.run!.status).toBe('succeeded');
	s.dispose();
});
it('configuration selection creates neither a run nor an active mode', () => {
	const execute = vi.fn<EvaluationClient['execute']>();
	const s = createEvaluationWorkspace({ execute });
	s.configure(version());
	expect(execute).not.toHaveBeenCalled();
	expect(s.activeRuns).toEqual([]);
	expect(s.run).toBeNull();
	s.dispose();
});
it('confirmed invalid input can be corrected with a new request', async () => {
	const execute = vi.fn<EvaluationClient['execute']>().mockResolvedValue({
		ok: false,
		code: 'INCOMPATIBLE_BINDING',
		message: EVALUATION_ERRORS.INCOMPATIBLE_BINDING,
		diagnostics: []
	});
	const s = createEvaluationWorkspace({ execute });
	await s.start(request());
	await s.start(request());
	expect(execute).toHaveBeenCalledTimes(2);
	s.dispose();
});
it('chart errors clear older data and stale chart responses are discarded', async () => {
	let finish!: (r: EvaluationResponse) => void;
	const execute = vi
		.fn<EvaluationClient['execute']>()
		.mockImplementationOnce(() => new Promise((r) => (finish = r)))
		.mockResolvedValueOnce(failure);
	const s = createEvaluationWorkspace({ execute }),
		a = s.loadChart(seriesInput().series.id, 0, 1);
	await s.loadChart(seriesInput().series.id, 1, 2);
	finish({ ok: true, value: { kind: 'bars', ...seriesInput() } });
	await a;
	expect(s.chartState).toBe('failed');
	expect(s.chartBars).toEqual([]);
	s.dispose();
});
it('HTTP action matching and safe server diagnostics survive catalog divergence', async () => {
	const send = vi.fn<typeof fetch>().mockResolvedValue(
		new Response(
			JSON.stringify({
				ok: false,
				code: 'UNSUPPORTED_CALCULATION',
				message: 'SQL SECRET',
				diagnostics: [
					{ code: 'UNSUPPORTED_CALCULATION', instanceId: 'analysis', message: 'SECRET' }
				]
			})
		)
	);
	const c = createEvaluationClient(send),
		r = await c.execute({ op: 'start', requestId: 'request', request: request() });
	expect(JSON.parse(String(send.mock.calls[0]![1]!.body)).actionId).toBe('act.evaluationStart');
	expect(r).toMatchObject({
		ok: false,
		code: 'UNSUPPORTED_CALCULATION',
		diagnostics: [{ instanceId: 'analysis' }]
	});
	expect(JSON.stringify(r)).not.toContain('SECRET');
});
it('HTTP rejects malformed/oversized/mismatched responses safely', async () => {
	for (const text of ['not-json', JSON.stringify(success('wrong')), ' '.repeat(12000001)]) {
		const c = createEvaluationClient(vi.fn<typeof fetch>().mockResolvedValue(new Response(text)));
		expect(await c.execute({ op: 'get', runId: 'expected' })).toMatchObject({
			ok: false,
			code: 'PERSISTENCE_FAILED'
		});
	}
});
it('HTTP verifies exact canonical fingerprints before accepting completed evidence', async () => {
	const valid = success();
	const c = createEvaluationClient(
		vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(valid)))
	);
	expect((await c.execute({ op: 'get', runId: 'run' })).ok).toBe(true);
	const corrupt = JSON.parse(JSON.stringify(valid));
	corrupt.value.result.fingerprint = hash('tampered');
	corrupt.value.run.resultFingerprint = corrupt.value.result.fingerprint;
	expect(
		await createEvaluationClient(
			vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(corrupt)))
		).execute({ op: 'get', runId: 'run' })
	).toMatchObject({ ok: false, code: 'PERSISTENCE_FAILED' });
});
it('opening a saved run cannot strand an in-flight fixture installation', async () => {
	let finish!: (r: EvaluationResponse) => void;
	const execute = vi
		.fn<EvaluationClient['execute']>()
		.mockImplementationOnce(() => new Promise((r) => (finish = r)));
	const s = createEvaluationWorkspace({ execute });
	const job = s.install();
	await s.openRun('old');
	expect(execute).toHaveBeenCalledTimes(1);
	finish(failure);
	await job;
	expect(s.installing).toBe(false);
	s.dispose();
});
