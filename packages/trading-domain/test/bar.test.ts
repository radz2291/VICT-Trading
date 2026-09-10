import { describe, expect, it } from 'vitest';
import { validateBar, validateBarSeries, type Bar } from '../src/bar.ts';

const good: Bar = {
	time: 1_700_000_000_000,
	open: 10,
	high: 11,
	low: 9.5,
	close: 10.5,
	volume: 100
};

function barWith(overrides: Partial<Bar>): Bar {
	return { ...good, ...overrides };
}

describe('validateBar', () => {
	it('accepts a well-formed bar', () => {
		expect(validateBar(good)).toEqual([]);
	});

	it('accepts a doji where high equals the body', () => {
		const doji = barWith({ open: 10, high: 10, low: 10, close: 10 });
		expect(validateBar(doji)).toEqual([]);
	});

	it('rejects non-finite prices including NaN and Infinity', () => {
		expect(validateBar(barWith({ open: Number.NaN }))).toContain('BAR_PRICE_NOT_FINITE');
		expect(validateBar(barWith({ high: Number.POSITIVE_INFINITY }))).toContain(
			'BAR_PRICE_NOT_FINITE'
		);
	});

	it('rejects a high below the body', () => {
		expect(validateBar(barWith({ high: 10.2, open: 10, close: 10.5 }))).toContain(
			'BAR_HIGH_BELOW_BODY'
		);
	});

	it('rejects a low above the body', () => {
		expect(validateBar(barWith({ low: 9.9, open: 10, close: 9.7 }))).toContain(
			'BAR_LOW_ABOVE_BODY'
		);
	});

	it('rejects negative volume', () => {
		expect(validateBar(barWith({ volume: -1 }))).toContain('BAR_VOLUME_NEGATIVE');
	});

	it('never throws for garbage input', () => {
		expect(validateBar(undefined)).toEqual(['BAR_NOT_OBJECT']);
		expect(validateBar(42)).toEqual(['BAR_NOT_OBJECT']);
		expect(validateBar(null)).toEqual(['BAR_NOT_OBJECT']);
		expect(validateBar({})).toContain('BAR_TIME_NOT_INTEGER');
	});
});

describe('validateBarSeries', () => {
	it('accepts an ordered series', () => {
		const series = [
			good,
			barWith({ time: good.time + 60_000, open: 10.5, high: 10.8, low: 10.2, close: 10.6 })
		];
		expect(validateBarSeries(series)).toEqual([]);
	});

	it('rejects duplicate and out-of-order timestamps', () => {
		expect(validateBarSeries([good, { ...good }])).toContain('SERIES_TIMESTAMP_ORDER');
		expect(validateBarSeries([barWith({ time: 2 }), barWith({ time: 1 })])).toContain(
			'SERIES_TIMESTAMP_ORDER'
		);
	});

	it('rejects a non-array input without throwing', () => {
		expect(validateBarSeries('nope')).toEqual(['SERIES_NOT_ARRAY']);
	});
});
