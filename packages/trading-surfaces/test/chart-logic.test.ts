import { describe, expect, it } from 'vitest';
import {
	clampCursorIndex,
	formatOhlcv,
	resolveChartPhase
} from '../src/market-chart/chart-logic.ts';
import { TEST_INSTRUMENTS, testBars } from './helpers.svelte.ts';

describe('resolveChartPhase', () => {
	it('loading wins while a load is in flight', () => {
		expect(
			resolveChartPhase({ loading: true, barCount: 10, health: { state: 'ok', asOf: 0 } })
		).toBe('loading');
	});

	it('error is shown even when stale data exists (never stale-as-current)', () => {
		expect(
			resolveChartPhase({ loading: false, barCount: 10, health: { state: 'error', asOf: 0 } })
		).toBe('error');
	});

	it('zero bars with healthy source is empty', () => {
		expect(
			resolveChartPhase({ loading: false, barCount: 0, health: { state: 'ok', asOf: 0 } })
		).toBe('empty');
	});

	it('stale keeps bars visible as stale', () => {
		expect(
			resolveChartPhase({ loading: false, barCount: 10, health: { state: 'stale', asOf: 0 } })
		).toBe('stale');
	});

	it('healthy bars are ready', () => {
		expect(
			resolveChartPhase({ loading: false, barCount: 10, health: { state: 'ok', asOf: 0 } })
		).toBe('ready');
	});
});

describe('formatOhlcv', () => {
	it('formats with instrument precision and a signed change vs previous close', () => {
		const bars = testBars(3);
		const bar = bars[2]!;
		const text = formatOhlcv(bar, bars[1]!.close, TEST_INSTRUMENTS[0]!);
		expect(text.open).toBe(bar.open.toFixed(2));
		expect(text.close).toBe(bar.close.toFixed(2));
		expect(text.high).toBe(bar.high.toFixed(2));
		expect(text.low).toBe(bar.low.toFixed(2));
		expect(text.volume).toBe(bar.volume.toLocaleString('en-US'));
		const changeAbs = bar.close - bars[1]!.close;
		const sign = changeAbs > 0 ? '+' : '';
		expect(text.change).toBe(
			`${sign}${changeAbs.toFixed(2)} (${sign}${((changeAbs / bars[1]!.close) * 100).toFixed(2)}%)`
		);
	});

	it('classifies direction from body', () => {
		const bars = testBars(6);
		const up = formatOhlcv(bars[5]!, bars[4]!.close, TEST_INSTRUMENTS[0]!);
		expect(['up', 'down', 'flat']).toContain(up.direction);
	});
});

describe('clampCursorIndex', () => {
	it('clamps to series bounds and handles empty series', () => {
		expect(clampCursorIndex(-5, 10)).toBe(0);
		expect(clampCursorIndex(50, 10)).toBe(9);
		expect(clampCursorIndex(0, 0)).toBe(-1);
	});
});
