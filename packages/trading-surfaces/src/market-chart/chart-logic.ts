/**
 * Pure chart view-model logic: phase resolution and OHLCV presentation.
 * Unit-testable without a chart engine or DOM.
 */
import type { Bar, Instrument, MarketDataHealth } from '@trading-os/trading-domain';

/** The visible phase of the market chart. */
export type ChartPhase = 'loading' | 'ready' | 'empty' | 'stale' | 'error';

/** Resolve the visible phase from load state + health (pure). */
export function resolveChartPhase(input: {
	readonly loading: boolean;
	readonly barCount: number;
	readonly health: MarketDataHealth | null;
}): ChartPhase {
	if (input.loading) {
		return 'loading';
	}
	if (input.health?.state === 'error') {
		return 'error';
	}
	if (input.barCount === 0) {
		return 'empty';
	}
	if (input.health?.state === 'stale') {
		return 'stale';
	}
	return 'ready';
}

export interface OhlcvText {
	readonly open: string;
	readonly high: string;
	readonly low: string;
	readonly close: string;
	readonly volume: string;
	readonly change: string;
	readonly direction: 'up' | 'down' | 'flat';
}

function formatPrice(value: number, precision: number): string {
	return value.toLocaleString('en-US', {
		minimumFractionDigits: precision,
		maximumFractionDigits: precision
	});
}

/** Format one bar's OHLCV for the textual readout (pure). */
export function formatOhlcv(
	bar: Bar,
	previousClose: number | undefined,
	instrument: Instrument
): OhlcvText {
	const direction = bar.close > bar.open ? 'up' : bar.close < bar.open ? 'down' : ('flat' as const);
	const reference = previousClose ?? bar.open;
	const changeAbs = bar.close - reference;
	const changePct = reference !== 0 ? (changeAbs / reference) * 100 : 0;
	const sign = changeAbs > 0 ? '+' : '';
	return {
		open: formatPrice(bar.open, instrument.pricePrecision),
		high: formatPrice(bar.high, instrument.pricePrecision),
		low: formatPrice(bar.low, instrument.pricePrecision),
		close: formatPrice(bar.close, instrument.pricePrecision),
		volume: bar.volume.toLocaleString('en-US'),
		change: `${sign}${formatPrice(changeAbs, instrument.pricePrecision)} (${sign}${changePct.toFixed(2)}%)`,
		direction
	};
}

/** The index of the bar a keyboard cursor should show (clamped; pure). */
export function clampCursorIndex(index: number, length: number): number {
	if (length === 0) {
		return -1;
	}
	if (index < 0) {
		return 0;
	}
	if (index >= length) {
		return length - 1;
	}
	return index;
}
