/** Server-only bounded ingestion fixture. Continuous synthetic UTC calendar. */
import { FIXTURE_LABEL, type Bar, type SeriesSpec } from '@trading-os/trading-domain';
export const FIXTURE_ANCHOR = Date.UTC(2025, 0, 6);
export const FIXTURE_DAYS = 280;
export const FIXTURE_SEED = 73129;
function underlying(seed: number): Bar[] {
	let state = seed >>> 0,
		previous = 10000;
	const bars: Bar[] = [];
	for (let i = 0; i < FIXTURE_DAYS * 96; i++) {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		const open = previous;
		const phase = Math.floor(i / (96 * 14)) % 4;
		const drift = phase === 0 ? 2 : phase === 1 ? -2 : phase === 2 ? 4 : -4;
		const close = open + ((state >>> 16) % 17) - 8 + drift;
		const high = Math.max(open, close) + 5 + (state % 11),
			low = Math.min(open, close) - 5 - ((state >>> 8) % 11);
		bars.push({
			time: FIXTURE_ANCHOR + i * 900000,
			open: open / 100,
			high: high / 100,
			low: low / 100,
			close: close / 100,
			volume: 100 + (state % 900)
		});
		previous = close;
	}
	return bars;
}
function aggregate(bars: readonly Bar[], size: number): Bar[] {
	const result: Bar[] = [];
	for (let i = 0; i + size <= bars.length; i += size) {
		const group = bars.slice(i, i + size);
		result.push({
			time: group[0]!.time,
			open: group[0]!.open,
			high: Math.max(...group.map((b) => b.high)),
			low: Math.min(...group.map((b) => b.low)),
			close: group.at(-1)!.close,
			volume: group.reduce((n, b) => n + b.volume, 0)
		});
	}
	return result;
}
export function deterministicFixture(): readonly SeriesSpec[] {
	const a = underlying(FIXTURE_SEED),
		b = underlying(FIXTURE_SEED + 1);
	const spec = (
		instrument: string,
		timeframe: string,
		durationMs: number,
		bars: readonly Bar[],
		description: string
	): SeriesSpec => ({
		schema: 'trading.series-content@1',
		instrument,
		timeframe,
		durationMs,
		alignmentMs: timeframe === '1W' ? 345600000 : 0,
		timestampConvention: 'utc-open-ms',
		source: { kind: 'fixture', label: FIXTURE_LABEL, revision: 'fixture-1', description },
		bars
	});
	return [
		spec(
			'EXAMPLE-A',
			'15m',
			900000,
			a,
			'Complete synthetic 15-minute history. Continuous UTC calendar, including weekends.'
		),
		spec(
			'EXAMPLE-A',
			'1D',
			86400000,
			aggregate(a, 96),
			'UTC days aggregated from the EXAMPLE-A 15-minute fixture.'
		),
		spec(
			'EXAMPLE-A',
			'1W',
			604800000,
			aggregate(a, 672),
			'Monday 00:00 UTC weeks aggregated from the EXAMPLE-A 15-minute fixture.'
		),
		spec(
			'EXAMPLE-B',
			'1D',
			86400000,
			aggregate(b, 96),
			'UTC days aggregated from the EXAMPLE-B base fixture; a different instrument.'
		),
		spec(
			'EXAMPLE-A',
			'15m',
			900000,
			a.filter((_, i) => ![250 * 96 + 3, 250 * 96 + 4, 251 * 96 + 8].includes(i)),
			'Intentional missing-bar variant of EXAMPLE-A; three omitted bars to inspect unavailable states.'
		)
	];
}
