/**
 * The deterministic fixture market-data source.
 *
 * Every series is generated from a fixed seed derived from
 * (instrumentId, timeframeId) against a FIXED anchor instant, so snapshots
 * are byte-stable across runs, restarts, and processes. This is fixture
 * data for the T1 platform proof — it is never presented as live, broker,
 * or historical market data.
 *
 * No method rules, detectors, or indicators live here — only ordered OHLCV
 * bars for presentation.
 */
import type {
	Bar,
	Instrument,
	MarketDataPort,
	MarketDataSnapshot,
	Timeframe
} from '@trading-os/trading-domain';
import { validateBarSeries } from '@trading-os/trading-domain';
import { hashString, mulberry32 } from './seeded-random.ts';

/** Fixed anchor instant (UTC ms): 2026-08-28T20:00:00Z. Never `Date.now()`. */
export const FIXTURE_ANCHOR_MS = Date.UTC(2026, 7, 28, 20, 0, 0);

/** Bars generated per series (bounded; enough for credible chart behavior). */
export const FIXTURE_BARS_PER_SERIES = 620;

/** The T1 fixture instrument catalogue (clearly fixtures, neutral names). */
export const FIXTURE_INSTRUMENTS: readonly Instrument[] = [
	{ id: 'FXT-A', symbol: 'FXT-A', name: 'Fixture Alpha Index', pricePrecision: 2 },
	{ id: 'FXT-B', symbol: 'FXT-B', name: 'Fixture Bravo Index', pricePrecision: 2 },
	{ id: 'FXT-C', symbol: 'FXT-C', name: 'Fixture Charlie Forex', pricePrecision: 4 },
	{ id: 'FXT-D', symbol: 'FXT-D', name: 'Fixture Delta Metals', pricePrecision: 2 },
	{ id: 'FXT-E', symbol: 'FXT-E', name: 'Fixture Echo Energy', pricePrecision: 3 },
	{ id: 'FXT-F', symbol: 'FXT-F', name: 'Fixture Foxtrot Crypto', pricePrecision: 1 }
];

/** The T1 fixture timeframe catalogue. */
export const FIXTURE_TIMEFRAMES: readonly Timeframe[] = [
	{ id: '1m', label: '1m', seconds: 60 },
	{ id: '5m', label: '5m', seconds: 300 },
	{ id: '15m', label: '15m', seconds: 900 },
	{ id: '1h', label: '1H', seconds: 3600 },
	{ id: '4h', label: '4H', seconds: 14400 },
	{ id: '1D', label: '1D', seconds: 86400 }
];

/** Base price anchors per instrument (deterministic generation inputs). */
const BASE_PRICES: Readonly<Record<string, number>> = {
	'FXT-A': 4180,
	'FXT-B': 1264,
	'FXT-C': 1.086,
	'FXT-D': 2332,
	'FXT-E': 78.4,
	'FXT-F': 61240
};

const FIXTURE_SOURCE = {
	kind: 'fixture',
	label: 'Fixture data — not live'
} as const;

function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

/**
 * Generate the full deterministic bar series for one instrument/timeframe.
 * Series are validated before leaving the generator: any NaN, invalid OHLC
 * relationship, or timestamp disorder fails generation loudly.
 */
export function generateFixtureBars(instrumentId: string, timeframeId: string): readonly Bar[] {
	const instrument = FIXTURE_INSTRUMENTS.find((entry) => entry.id === instrumentId);
	const timeframe = FIXTURE_TIMEFRAMES.find((entry) => entry.id === timeframeId);
	if (instrument === undefined || timeframe === undefined) {
		throw new Error(`Unknown fixture series requested: ${instrumentId}/${timeframeId}.`);
	}
	const random = mulberry32(hashString(`${instrumentId}|${timeframeId}|trading-os-t1`));
	const basePrice = BASE_PRICES[instrumentId] ?? 100;
	const decimals = instrument.pricePrecision;
	// Volatility scales mildly with timeframe length so higher timeframes
	// show proportionally wider ranges (presentation realism, not a claim).
	const barVolatility = 0.0016 * Math.sqrt(timeframe.seconds / 60);
	const drift = 0.00004 * Math.sqrt(timeframe.seconds / 60);
	const seconds = timeframe.seconds;
	const end = Math.floor(FIXTURE_ANCHOR_MS / (seconds * 1000)) * seconds * 1000;

	const bars: Bar[] = [];
	let close = basePrice * (0.94 + 0.12 * random());
	for (let i = FIXTURE_BARS_PER_SERIES - 1; i >= 0; i--) {
		const time = end - i * seconds * 1000;
		const open = close;
		const ret = drift + (random() * 2 - 1) * barVolatility;
		close = open * (1 + ret);
		// Intrabar range: wicks extend beyond the body by a random fraction.
		const body = Math.abs(close - open);
		const wick = Math.max(open, close) * barVolatility * (0.35 + 1.3 * random()) + body * 0.15;
		const high = Math.max(open, close) + wick * random();
		const low = Math.min(open, close) - wick * random();
		const volume = Math.round(
			(900 + 6200 * random()) * (1 + (body / Math.max(open, 1e-9) / barVolatility) * 0.9)
		);
		bars.push({
			time,
			open: roundTo(open, decimals),
			high: roundTo(high, decimals),
			low: roundTo(low, decimals),
			close: roundTo(close, decimals),
			volume
		});
	}
	const issues = validateBarSeries(bars);
	if (issues.length > 0) {
		throw new Error(`Fixture generation produced an invalid series (${issues.join(', ')}).`);
	}
	return bars;
}

/** The fixture MarketDataPort. Deterministic; bounded; validated. */
export function createFixtureMarketData(): MarketDataPort {
	const cache = new Map<string, readonly Bar[]>();
	function series(instrumentId: string, timeframeId: string): readonly Bar[] {
		const key = `${instrumentId}|${timeframeId}`;
		const cached = cache.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const generated = generateFixtureBars(instrumentId, timeframeId);
		cache.set(key, generated);
		return generated;
	}
	return {
		instruments: FIXTURE_INSTRUMENTS,
		timeframes: FIXTURE_TIMEFRAMES,
		snapshot(instrumentId: string, timeframeId: string, limit: number): MarketDataSnapshot {
			const known = FIXTURE_INSTRUMENTS.some((entry) => entry.id === instrumentId);
			const knownTf = FIXTURE_TIMEFRAMES.some((entry) => entry.id === timeframeId);
			if (!known || !knownTf) {
				return {
					instrumentId,
					timeFrameId: timeframeId,
					bars: [],
					source: FIXTURE_SOURCE,
					health: {
						state: 'error',
						asOf: FIXTURE_ANCHOR_MS,
						message: `No fixture series exists for ${instrumentId}/${timeframeId}.`
					}
				};
			}
			const bounded = series(instrumentId, timeframeId).slice(-Math.max(1, Math.floor(limit)));
			return {
				instrumentId,
				timeFrameId: timeframeId,
				bars: bounded,
				source: FIXTURE_SOURCE,
				health: { state: 'ok', asOf: FIXTURE_ANCHOR_MS }
			};
		}
	};
}
