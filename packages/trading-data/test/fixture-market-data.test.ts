import { describe, expect, it } from 'vitest';
import {
	FIXTURE_ANCHOR_MS,
	FIXTURE_BARS_PER_SERIES,
	FIXTURE_INSTRUMENTS,
	FIXTURE_TIMEFRAMES,
	createFixtureMarketData,
	generateFixtureBars
} from '../src/index.ts';
import { validateBarSeries } from '@trading-os/trading-domain';

describe('fixture market data', () => {
	it('is deterministic across repeated generation', () => {
		const a = generateFixtureBars('FXT-A', '1h');
		const b = generateFixtureBars('FXT-A', '1h');
		expect(a).toEqual(b);
		expect(a.length).toBe(FIXTURE_BARS_PER_SERIES);
	});

	it('produces identical snapshots across independent port instances', () => {
		const s1 = createFixtureMarketData().snapshot('FXT-C', '5m', 300);
		const s2 = createFixtureMarketData().snapshot('FXT-C', '5m', 300);
		expect(s2).toEqual(s1);
	});

	it('every instrument/timeframe series is valid: finite, ordered, unique timestamps, sane OHLC', () => {
		const port = createFixtureMarketData();
		for (const instrument of FIXTURE_INSTRUMENTS) {
			for (const timeframe of FIXTURE_TIMEFRAMES) {
				const snapshot = port.snapshot(instrument.id, timeframe.id, 10_000);
				expect(snapshot.health.state).toBe('ok');
				expect(validateBarSeries(snapshot.bars)).toEqual([]);
			}
		}
	});

	it('bounds snapshots to the requested limit, oldest → newest', () => {
		const port = createFixtureMarketData();
		const snapshot = port.snapshot('FXT-A', '1h', 120);
		expect(snapshot.bars.length).toBe(120);
		expect(snapshot.bars[0]!.time).toBeLessThan(snapshot.bars[119]!.time);
		const full = port.snapshot('FXT-A', '1h', 10_000);
		expect(full.bars.length).toBe(FIXTURE_BARS_PER_SERIES);
		// Series end at the fixed anchor, aligned to the timeframe grid.
		expect(full.bars[full.bars.length - 1]!.time).toBeLessThanOrEqual(FIXTURE_ANCHOR_MS);
	});

	it('labels itself truthfully as fixture data', () => {
		const port = createFixtureMarketData();
		const snapshot = port.snapshot('FXT-A', '1D', 10);
		expect(snapshot.source).toEqual({ kind: 'fixture', label: 'Fixture data — not live' });
	});

	it('returns a structured error snapshot for unknown series', () => {
		const port = createFixtureMarketData();
		const snapshot = port.snapshot('NOPE', '1h', 10);
		expect(snapshot.bars).toEqual([]);
		expect(snapshot.health.state).toBe('error');
		expect(snapshot.health.message).toContain('No fixture series');
	});

	it('prices stay positive and volumes non-negative for every series', () => {
		for (const instrument of FIXTURE_INSTRUMENTS) {
			for (const timeframe of FIXTURE_TIMEFRAMES) {
				for (const bar of generateFixtureBars(instrument.id, timeframe.id)) {
					expect(bar.low).toBeGreaterThan(0);
					expect(bar.volume).toBeGreaterThanOrEqual(0);
				}
			}
		}
	});
});
