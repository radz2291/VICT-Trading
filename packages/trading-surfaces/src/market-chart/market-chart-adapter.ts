/**
 * Product-owned adapter around the pinned third-party charting library
 * (`lightweight-charts@5.2.1`, Apache-2.0). This module is the ONLY place
 * the library's types and implementation may appear; it is imported
 * dynamically from the client-only chart effect so it never evaluates
 * during SSR. Replacing the chart engine means replacing this file.
 */
import type { Bar } from '@trading-os/trading-domain';

export interface MarketChartColors {
	readonly background: string;
	readonly text: string;
	readonly grid: string;
	readonly border: string;
	readonly crosshair: string;
	readonly up: string;
	readonly down: string;
	readonly volumeUp: string;
	readonly volumeDown: string;
}

export interface MarketChartOptions {
	readonly colors: MarketChartColors;
	readonly pricePrecision: number;
	/** Show the time-of-day on the time axis (true for intraday timeframes). */
	readonly intraday: boolean;
}

export interface MarketChartHandle {
	/** Replace the full series (oldest → newest bars). */
	setData(bars: readonly Bar[]): void;
	/** Subscribe to crosshair moves; null when the cursor leaves the chart. */
	onCrosshair(handler: (bar: Bar | null) => void): void;
	/** Flash/restore the crosshair at a specific bar time (keyboard focus). */
	highlightTime(time: number | null): void;
	destroy(): void;
}

/**
 * Create the candlestick + volume chart (two panes, shared crosshair).
 * Must only be called in a browser context with a real canvas available.
 */
export async function createMarketChart(
	container: HTMLElement,
	options: MarketChartOptions
): Promise<MarketChartHandle> {
	const lib = await import('lightweight-charts');
	const chart = lib.createChart(container, {
		autoSize: true,
		layout: {
			background: { color: options.colors.background },
			textColor: options.colors.text,
			fontSize: 11,
			attributionLogo: false,
			panes: {
				separatorColor: options.colors.border,
				separatorHoverColor: options.colors.crosshair
			}
		},
		grid: {
			vertLines: { color: options.colors.grid },
			horzLines: { color: options.colors.grid }
		},
		rightPriceScale: { borderColor: options.colors.border },
		timeScale: {
			borderColor: options.colors.border,
			timeVisible: options.intraday,
			secondsVisible: false,
			rightOffset: 4
		},
		crosshair: {
			mode: lib.CrosshairMode.Normal,
			vertLine: { color: options.colors.crosshair, labelBackgroundColor: options.colors.crosshair },
			horzLine: { color: options.colors.crosshair, labelBackgroundColor: options.colors.crosshair }
		}
	});

	const priceFormat = {
		type: 'price' as const,
		precision: options.pricePrecision,
		minMove: 1 / 10 ** options.pricePrecision
	};
	const candles = chart.addSeries(
		lib.CandlestickSeries,
		{
			upColor: options.colors.up,
			downColor: options.colors.down,
			borderUpColor: options.colors.up,
			borderDownColor: options.colors.down,
			wickUpColor: options.colors.up,
			wickDownColor: options.colors.down,
			priceFormat
		},
		0
	);
	const volume = chart.addSeries(
		lib.HistogramSeries,
		{
			priceFormat: { type: 'volume' },
			priceLineVisible: false,
			lastValueVisible: false
		},
		1
	);
	// Volume occupies the lower quarter of the combined chart.
	const panes = chart.panes();
	panes[0]?.setStretchFactor(3);
	panes[1]?.setStretchFactor(1);

	let bars: readonly Bar[] = [];
	const byTime = new Map<number, Bar>();
	let crosshairHandler: ((bar: Bar | null) => void) | null = null;

	chart.subscribeCrosshairMove((param) => {
		if (crosshairHandler === null) {
			return;
		}
		const time = param.time;
		if (typeof time !== 'number') {
			crosshairHandler(null);
			return;
		}
		const bar = byTime.get(time * 1000);
		crosshairHandler(bar ?? null);
	});

	return {
		setData(next: readonly Bar[]) {
			bars = next;
			byTime.clear();
			const candleData = [];
			const volumeData = [];
			for (const bar of bars) {
				byTime.set(bar.time, bar);
				candleData.push({
					time: (bar.time / 1000) as never,
					open: bar.open,
					high: bar.high,
					low: bar.low,
					close: bar.close
				});
				volumeData.push({
					time: (bar.time / 1000) as never,
					value: bar.volume,
					color: bar.close >= bar.open ? options.colors.volumeUp : options.colors.volumeDown
				});
			}
			candles.setData(candleData);
			volume.setData(volumeData);
			chart.timeScale().fitContent();
		},
		onCrosshair(handler: (bar: Bar | null) => void) {
			crosshairHandler = handler;
		},
		highlightTime(time: number | null) {
			if (time === null) {
				chart.clearCrosshairPosition();
				return;
			}
			const bar = bars.find((entry) => entry.time === time);
			if (bar !== undefined) {
				chart.setCrosshairPosition(bar.close, (bar.time / 1000) as never, candles);
			}
		},
		destroy() {
			chart.remove();
		}
	};
}
