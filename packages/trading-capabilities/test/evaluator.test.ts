import { describe, it, expect } from 'vitest';
import { createAuthoringCatalog } from '../src/index.ts';
import { createCalculationRegistry, evaluateMethod, evaluationIdentity } from '../src/evaluator.ts';
import {
	canonicalEvaluation,
	composeRules,
	parseEvaluationRequest,
	parseSeriesSpec,
	parseEvaluationContent,
	type RuleState
} from '@trading-os/trading-domain';
import {
	anchor,
	content,
	hash,
	request,
	seriesInput,
	spec,
	version,
	withBars
} from './evaluation-helpers.ts';
const catalog = createAuthoringCatalog(),
	registry = createCalculationRegistry();
describe('exact deterministic calculations', () => {
	it('hand-calculates previous-bar range, warm-up and strict above-high', () => {
		const input = seriesInput(),
			v = version();
		const r = evaluateMethod(v, request(input, v), [input], catalog, registry);
		expect(r.frames[0]!.outputs[0]!.diagnostics[0]!.code).toBe('WARM_UP');
		expect(r.frames[2]!.outputs[0]!.values).toEqual({ high: 22, low: 8 });
		expect(r.frames[2]!.state).toBe('true');
	});
	it('hand-calculates mean and includes exact threshold equality', () => {
		const input = seriesInput(spec([10, 20, 30, 40, 50, 60])),
			v = version(content('mean'));
		const r = evaluateMethod(v, request(input, v), [input], catalog, registry);
		expect(r.frames[2]!.outputs[0]!.values).toEqual({ mean: 15 });
		expect(r.frames[2]!.outputs[1]!.values.distancePercent).toBe(100);
		expect(r.frames[2]!.state).toBe('true');
		expect(r.frames[3]!.state).toBe('false');
	});
	it.each(['above-high', 'below-low', 'inside-range'])('range boundary %s', (relation) => {
		const input = seriesInput(spec([10, 20, 22])),
			c = content();
		const v = version({
			...c,
			capabilities: [
				c.capabilities[0]!,
				{ ...c.capabilities[1]!, config: { context: 'context', source: 'analysis', relation } }
			]
		});
		const r = evaluateMethod(
			v,
			{ ...request(input, v), end: anchor + 4 * 900000 },
			[input],
			catalog,
			registry
		);
		expect(r.frames[2]!.state).toBe(relation === 'inside-range' ? 'true' : 'false');
	});
	it('uses half-open UTC sessions at 08:00 and 16:00', () => {
		const input = seriesInput(spec(Array(97).fill(10))),
			c = content();
		const v = version({
			...c,
			capabilities: [
				{
					id: 'session',
					capabilityId: 'rule.session-window',
					revision: '1',
					config: { context: 'context', session: '08:00–16:00' }
				}
			]
		});
		const r = evaluateMethod(
			v,
			{ ...request(input, v), end: anchor + 86400000 },
			[input],
			catalog,
			registry
		);
		expect(r.frames.find((f) => f.time === anchor + 8 * 3600000)!.state).toBe('true');
		expect(r.frames.find((f) => f.time === anchor + 16 * 3600000)!.state).toBe('false');
	});
	it('missing current and previous bars are unavailable, not false', () => {
		const input = seriesInput(),
			r = evaluateMethod(
				version(),
				request(input),
				[
					withBars(
						input,
						input.bars.filter((_, i) => i !== 2)
					)
				],
				catalog,
				registry
			);
		expect(r.frames[2]!.outputs[0]!.diagnostics[0]!.code).toBe('MISSING_DATA');
		expect(r.frames[3]!.state).toBe('unavailable');
	});
	it('zero means and arithmetic overflow report unavailable', () => {
		for (const prices of [
			[0, 0, 1, 2],
			[1e308, 1e308, 1, 2]
		]) {
			const input = seriesInput(spec(prices)),
				v = version(content('mean'));
			const r = evaluateMethod(
				v,
				{ ...request(input, v), end: anchor + 5 * 900000 },
				[input],
				catalog,
				registry
			);
			expect(r.frames[2]!.state).toBe('unavailable');
		}
	});
	it('poison-future prices never alter earlier frames', () => {
		const input = seriesInput(),
			v = version(),
			req = { ...request(input, v), end: anchor + 4 * 900000 };
		const before = evaluateMethod(v, req, [input], catalog, registry);
		const poisoned = withBars(
			input,
			input.bars.map((b, i) => (i >= 3 ? { ...b, open: 1e9, high: 1e9, low: 1e9, close: 1e9 } : b))
		);
		expect(evaluateMethod(v, req, [poisoned], catalog, registry)).toEqual(before);
	});
	it('binds weekly closed data with no unfinished weekly lookahead', () => {
		const low = seriesInput(spec(Array(100).fill(200))),
			weekly = seriesInput(spec([100, 110, 120, 1e8], '1W'));
		const c = content(),
			v = version({
				...c,
				observations: [
					...c.observations,
					{
						id: 'weekly',
						label: 'Weekly',
						instrument: 'EXAMPLE-A',
						timeframe: '1W',
						dataType: 'bars'
					}
				],
				capabilities: [
					{ ...c.capabilities[0]!, config: { context: 'weekly', lookback: 2 } },
					c.capabilities[1]!
				]
			});
		const shifted = seriesInput({
			...spec(Array(100).fill(200)),
			bars: low.bars.map((b) => ({ ...b, time: b.time + 21 * 86400000 }))
		});
		const req = {
			...request(shifted, v),
			bindings: [
				{ observationId: 'context', seriesId: shifted.series.id },
				{ observationId: 'weekly', seriesId: weekly.series.id }
			],
			start: anchor + 21 * 86400000,
			end: anchor + 21 * 86400000 + 900000
		};
		const r = evaluateMethod(v, req, [weekly, shifted], catalog, registry);
		expect(r.frames[0]!.outputs[0]!.values).toEqual({ high: 112, low: 98 });
	});
	it('rejects unsupported exact revisions and invalid dependency order', () => {
		const input = seriesInput(),
			v = version();
		expect(() =>
			evaluateMethod(v, request(input), [input], catalog, createCalculationRegistry([]))
		).toThrow('revision');
		expect(() =>
			evaluateMethod(
				version({ ...content(), capabilities: [...content().capabilities].reverse() }),
				request(input),
				[input],
				catalog,
				registry
			)
		).toThrow();
	});
	it('registry refuses duplicate revisions and freezes entries', () => {
		const c = registry.resolve('analysis.range', '1', 'closed-bars-v1')!;
		expect(Object.isFrozen(c)).toBe(true);
		expect(() => createCalculationRegistry([c, c])).toThrow();
		expect(registry.resolve('analysis.range', '2', 'closed-bars-v1')).toBeUndefined();
	});
	it('repeats identical bytes without input mutation or order dependence', () => {
		const input = seriesInput(),
			v = version(),
			req = request(input),
			before = JSON.stringify([v, req, input]);
		const a = canonicalEvaluation(evaluateMethod(v, req, [input], catalog, registry)),
			b = canonicalEvaluation(evaluateMethod(v, req, [input], catalog, registry));
		expect(a).toBe(b);
		expect(hash(a)).toBe(hash(b));
		expect(JSON.stringify([v, req, input])).toBe(before);
	});
	it('identity includes range, driver, data, method, calculation and engine; excludes operational time', () => {
		const input = seriesInput(),
			v = version(),
			req = request(input);
		const id = evaluationIdentity(v, req, [input.series], catalog, registry),
			fingerprint = hash(canonicalEvaluation(id));
		for (const change of [
			{ start: id.start + 900000 },
			{ end: id.end - 900000 },
			{ driverObservationId: 'other' },
			{ methodVersionId: 'other' },
			{ methodFingerprint: hash('other') },
			{ engine: 'trading.evaluator@2' },
			{ operation: 'trading.evaluate@2' },
			{ calculations: [{ ...id.calculations[0]!, calculationRevision: 'closed-bars-v2' }] },
			{
				bindings: [{ ...id.bindings[0]!, seriesId: hash('data'), seriesFingerprint: hash('data') }]
			}
		])
			expect(hash(canonicalEvaluation({ ...id, ...change }))).not.toBe(fingerprint);
		expect(
			evaluationIdentity(
				{ ...v, createdAt: '2026-09-12T00:00:00.000Z' },
				req,
				[input.series],
				catalog,
				registry
			)
		).toEqual(id);
	});
});
describe('bounded contracts and three-state logic', () => {
	const states: RuleState[] = ['true', 'false', 'unavailable'];
	const all = [
		['true', 'false', 'unavailable'],
		['false', 'false', 'false'],
		['unavailable', 'false', 'unavailable']
	];
	const any = [
		['true', 'true', 'true'],
		['true', 'false', 'unavailable'],
		['true', 'unavailable', 'unavailable']
	];
	for (let a = 0; a < 3; a++)
		for (let b = 0; b < 3; b++)
			it(`truth table ${states[a]} × ${states[b]}`, () => {
				expect(composeRules('all', [states[a]!, states[b]!])).toBe(all[a]![b]);
				expect(composeRules('any', [states[a]!, states[b]!])).toBe(any[a]![b]);
			});
	it('fails closed for empty rule input', () => {
		expect(composeRules('all', [])).toBe('unavailable');
		expect(composeRules('any', [])).toBe('unavailable');
	});
	it('strict unknown/future schemas and invalid numbers fail', () => {
		const req = request();
		expect(() => parseEvaluationRequest({ ...req, extra: true })).toThrow();
		expect(() =>
			parseEvaluationRequest({ ...req, schema: 'trading.evaluation-request@2' })
		).toThrow();
		for (const value of [NaN, Infinity, -0]) expect(() => canonicalEvaluation({ value })).toThrow();
		expect(() => parseSeriesSpec({ ...spec(), durationMs: 86400000 })).toThrow();
	});
	it('rejects oversized ranges, frames, and result counts', () => {
		const input = seriesInput();
		expect(() =>
			parseEvaluationRequest({ ...request(input), end: anchor + 400 * 86400000 })
		).toThrow();
		expect(() =>
			evaluateMethod(
				version(),
				{ ...request(input), end: anchor + 514 * 900000 },
				[input],
				catalog,
				registry
			)
		).toThrow();
		const r = evaluateMethod(version(), request(input), [input], catalog, registry);
		expect(() =>
			parseEvaluationContent({ ...r, counts: { true: 1, false: 0, unavailable: 0 } })
		).toThrow();
	});
});
