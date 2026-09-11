import { it, expect } from 'vitest';
import {
	parseSeriesSpec,
	parseEvaluationCommand,
	parseEvaluationRequest,
	parseStoredSeries,
	parseEvaluationRun,
	parseEvaluationContent,
	canonicalEvaluation,
	contentFingerprint,
	composeRules,
	immutableCopy,
	utf8Length,
	type RuleState
} from '../src/index.ts';
import {
	spec,
	seriesInput,
	request,
	version,
	hash
} from '../../trading-capabilities/test/evaluation-helpers.ts';
import { createAuthoringCatalog } from '../../trading-capabilities/src/index.ts';
import {
	createCalculationRegistry,
	evaluateMethod
} from '../../trading-capabilities/src/evaluator.ts';
it('rejects unknown fields and future schemas on every persisted data contract', () => {
	const s = seriesInput().series;
	for (const value of [
		{ ...s, extra: true },
		{ ...s, schema: 'trading.stored-series@2' },
		{ ...s, health: { state: 'ready', gaps: [], extra: true } },
		{ ...s, coverage: { ...s.coverage, barCount: 999 } }
	])
		expect(() => parseStoredSeries(value)).toThrow();
	expect(() => parseEvaluationCommand({ op: 'get', runId: 'ok', extra: true })).toThrow();
	expect(() => parseSeriesSpec({ ...spec(), extra: true })).toThrow();
	expect(() => parseEvaluationRun({ schema: 'trading.evaluation-run@99' })).toThrow();
});
it('bounds canonical UTF-8 bytes including multi-byte text', () => {
	expect(utf8Length('aé€😀')).toBe(10);
	expect(() => canonicalEvaluation({ text: '😀'.repeat(1000001) })).toThrow('limit');
	expect(() => canonicalEvaluation({ value: -0 })).toThrow();
	expect(() =>
		parseEvaluationRequest({ ...request(), end: request().start + 367 * 86400000 })
	).toThrow();
});
it('canonical input sorts observation bindings and excludes transport identity', () => {
	const r = request(),
		bindings = [...r.bindings, { observationId: 'another', seriesId: hash('series') }];
	expect(parseEvaluationRequest({ ...r, bindings })).toEqual(
		parseEvaluationRequest({ ...r, bindings: [...bindings].reverse() })
	);
	expect(canonicalEvaluation(r)).not.toContain('requestId');
});
it('valid records are recursively immutable and fingerprints match the standard vector', async () => {
	const s = parseSeriesSpec(spec());
	expect(Object.isFrozen(s.bars[0])).toBe(true);
	expect(() => {
		(s.bars[0] as { close: number }).close = 9;
	}).toThrow();
	expect(await contentFingerprint('abc')).toBe(
		'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
	);
});
it('result identity and diagnostics fail closed on corruption', () => {
	const input = seriesInput(),
		c = evaluateMethod(
			version(),
			request(),
			[input],
			createAuthoringCatalog(),
			createCalculationRegistry()
		);
	expect(() => parseEvaluationContent({ ...c, schema: 'future' })).toThrow();
	const corrupted = JSON.parse(JSON.stringify(c));
	corrupted.frames[0].outputs[0].diagnostics[0].message = 'raw database error';
	expect(() => parseEvaluationContent(corrupted)).toThrow();
	expect(Object.isFrozen(parseEvaluationContent(c).frames)).toBe(true);
});
it('three-state composition retains unavailable across single and empty inputs', () => {
	for (const state of ['true', 'false', 'unavailable'] as RuleState[])
		for (const policy of ['all', 'any'] as const)
			expect(composeRules(policy, immutableCopy([state]))).toBe(state);
	expect(composeRules('all', [])).toBe('unavailable');
});
