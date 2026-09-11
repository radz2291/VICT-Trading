import { createHash } from 'node:crypto';
import {
	stableJson,
	originalProvenance,
	FIXTURE_LABEL,
	CALCULATION_REVISION,
	type Bar,
	type MethodContent,
	type MethodVersion,
	type SeriesSpec,
	type SeriesInput,
	type EvaluationRequest,
	seriesHealth
} from '@trading-os/trading-domain';
export const hash = (s: string) => `sha256:${createHash('sha256').update(s).digest('hex')}`;
export const anchor = Date.UTC(2025, 0, 6);
export function spec(
	prices: readonly number[] = [10, 20, 30, 40, 50, 60],
	timeframe = '15m',
	instrument = 'EXAMPLE-A'
): SeriesSpec {
	const durationMs = timeframe === '1W' ? 604800000 : timeframe === '1D' ? 86400000 : 900000;
	return {
		schema: 'trading.series-content@1',
		instrument,
		timeframe,
		durationMs,
		alignmentMs: timeframe === '1W' ? 345600000 : 0,
		timestampConvention: 'utc-open-ms',
		source: {
			kind: 'fixture',
			label: FIXTURE_LABEL,
			revision: 'tiny-1',
			description: 'Hand-calculated test series.'
		},
		bars: prices.map((p, i) => ({
			time: anchor + i * durationMs,
			open: p,
			high: p + 2,
			low: p - 2,
			close: p,
			volume: 100
		}))
	};
}
export function seriesInput(value = spec()): SeriesInput {
	const { bars, ...metadata } = value,
		id = hash(stableJson(value));
	return {
		series: {
			...metadata,
			schema: 'trading.stored-series@1',
			id,
			fingerprint: id,
			coverage: {
				start: bars[0]!.time,
				end: bars.at(-1)!.time + value.durationMs,
				barCount: bars.length
			},
			health: seriesHealth(bars, value.durationMs),
			ingestion: {
				requestId: 'tiny-ingest',
				ingestedAt: '2026-09-11T00:00:00.000Z',
				operation: 'trading.ingest-fixture@1'
			}
		},
		bars
	};
}
export function content(kind: 'range' | 'mean' = 'range'): MethodContent {
	return {
		schema: 'trading.method-content@1',
		name: `Tiny ${kind}`,
		description: 'Hand-calculated test',
		rulePolicy: 'all',
		observations: [
			{
				id: 'context',
				label: 'Context',
				instrument: 'EXAMPLE-A',
				timeframe: '15m',
				dataType: 'bars'
			}
		],
		capabilities:
			kind === 'range'
				? [
						{
							id: 'analysis',
							capabilityId: 'analysis.range',
							revision: '1',
							config: { context: 'context', lookback: 2 }
						},
						{
							id: 'rule',
							capabilityId: 'rule.range-relation',
							revision: '1',
							config: { context: 'context', source: 'analysis', relation: 'above-high' }
						}
					]
				: [
						{
							id: 'analysis',
							capabilityId: 'analysis.mean',
							revision: '1',
							config: { context: 'context', lookback: 2, price: 'close' }
						},
						{
							id: 'rule',
							capabilityId: 'rule.mean-distance',
							revision: '1',
							config: {
								context: 'context',
								source: 'analysis',
								side: 'above',
								distancePercent: 100
							}
						}
					]
	};
}
export function version(c = content()): MethodVersion {
	const canonical = stableJson(c);
	return {
		schema: 'trading.method-version@1',
		id: 'tiny-version',
		methodId: 'tiny-method',
		number: 1,
		createdAt: '2026-09-11T00:00:00.000Z',
		provenance: originalProvenance(),
		content: c,
		canonical,
		fingerprint: hash(canonical)
	};
}
export function request(input = seriesInput(), v = version()): EvaluationRequest {
	return {
		schema: 'trading.evaluation-request@1',
		methodVersionId: v.id,
		bindings: [{ observationId: 'context', seriesId: input.series.id }],
		start: anchor + 900000,
		end: anchor + 7 * 900000,
		driverObservationId: 'context',
		calculationRevision: CALCULATION_REVISION
	};
}
export function withBars(input: SeriesInput, bars: readonly Bar[]): SeriesInput {
	return { ...input, bars };
}
