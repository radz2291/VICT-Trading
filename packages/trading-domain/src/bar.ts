/**
 * Timestamped OHLCV bar and its validation. A bar is a plain data record;
 * validation is total (never throws) and returns structured issue codes.
 */

/** One timestamped OHLCV bar. `time` is UTC milliseconds since the epoch. */
export interface Bar {
	readonly time: number;
	readonly open: number;
	readonly high: number;
	readonly low: number;
	readonly close: number;
	readonly volume: number;
}

/** Structured validation issue codes for bars and bar series. */
export type BarIssueCode =
	| 'BAR_NOT_OBJECT'
	| 'BAR_TIME_NOT_INTEGER'
	| 'BAR_PRICE_NOT_FINITE'
	| 'BAR_VOLUME_NOT_FINITE'
	| 'BAR_VOLUME_NEGATIVE'
	| 'BAR_HIGH_BELOW_BODY'
	| 'BAR_LOW_ABOVE_BODY'
	| 'SERIES_NOT_ARRAY'
	| 'SERIES_TIMESTAMP_ORDER';

/**
 * Validate one bar. Returns every issue found (empty when the bar is valid);
 * never throws for any input.
 */
export function validateBar(bar: unknown): readonly BarIssueCode[] {
	if (typeof bar !== 'object' || bar === null) {
		return ['BAR_NOT_OBJECT'];
	}
	const b = bar as Record<string, unknown>;
	const issues: BarIssueCode[] = [];
	if (!Number.isInteger(b['time'])) {
		issues.push('BAR_TIME_NOT_INTEGER');
	}
	for (const field of ['open', 'high', 'low', 'close'] as const) {
		const value = b[field];
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			issues.push('BAR_PRICE_NOT_FINITE');
		}
	}
	const volume = b['volume'];
	if (typeof volume !== 'number' || !Number.isFinite(volume)) {
		issues.push('BAR_VOLUME_NOT_FINITE');
	} else if (volume < 0) {
		issues.push('BAR_VOLUME_NEGATIVE');
	}
	const open = b['open'];
	const high = b['high'];
	const low = b['low'];
	const close = b['close'];
	if (
		typeof open === 'number' &&
		Number.isFinite(open) &&
		typeof high === 'number' &&
		Number.isFinite(high) &&
		typeof low === 'number' &&
		Number.isFinite(low) &&
		typeof close === 'number' &&
		Number.isFinite(close)
	) {
		if (high < Math.max(open, close) - Number.EPSILON * Math.max(1, Math.abs(high))) {
			issues.push('BAR_HIGH_BELOW_BODY');
		}
		if (low > Math.min(open, close) + Number.EPSILON * Math.max(1, Math.abs(low))) {
			issues.push('BAR_LOW_ABOVE_BODY');
		}
	}
	return issues;
}

/**
 * Validate an ordered bar series: every bar valid, timestamps strictly
 * increasing (no duplicates, no gaps backwards). Returns every issue found;
 * never throws for any input.
 */
export function validateBarSeries(bars: unknown): readonly BarIssueCode[] {
	if (!Array.isArray(bars)) {
		return ['SERIES_NOT_ARRAY'];
	}
	const issues: BarIssueCode[] = [];
	let previousTime = Number.NEGATIVE_INFINITY;
	for (const [index, bar] of bars.entries()) {
		for (const issue of validateBar(bar)) {
			issues.push(issue);
		}
		if (typeof bar === 'object' && bar !== null) {
			const time = (bar as Record<string, unknown>)['time'];
			if (Number.isInteger(time)) {
				if ((time as number) <= previousTime) {
					issues.push('SERIES_TIMESTAMP_ORDER');
				}
				previousTime = time as number;
			}
		}
		void index;
	}
	return issues;
}
