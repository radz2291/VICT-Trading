<script lang="ts">
	import type { Bar } from '@trading-os/trading-domain';
	import type { MarketChartHandle } from '../market-chart/market-chart-adapter.ts';
	import { resolveMarketChartColors } from '../market-chart/chart-colors.ts';
	let {
		bars,
		selectedTime = null,
		durationMs = 900000
	}: { bars: readonly Bar[]; selectedTime?: number | null; durationMs?: number } = $props();
	let host: HTMLDivElement;
	let handle = $state.raw<MarketChartHandle | undefined>(undefined);
	let failed = $state(false);
	$effect(() => {
		if (!host) return;
		let disposed = false;
		void import('../market-chart/market-chart-adapter.ts')
			.then(async ({ createMarketChart }) => {
				const chart = await createMarketChart(host, {
					colors: resolveMarketChartColors(),
					pricePrecision: 2,
					intraday: durationMs < 86400000
				});
				if (disposed) {
					chart.destroy();
					return;
				}
				handle = chart;
				handle.setData(bars);
				handle.highlightTime(selectedTime === null ? null : selectedTime - durationMs);
			})
			.catch(() => {
				if (!disposed) failed = true;
			});
		return () => {
			disposed = true;
			handle?.destroy();
			handle = undefined;
		};
	});
	$effect(() => {
		handle?.setData(bars);
		handle?.highlightTime(selectedTime === null ? null : selectedTime - durationMs);
	});
</script>

<div
	class="stored-chart"
	bind:this={host}
	aria-label="Stored fixture candlestick and volume chart"
></div>
{#if failed}<p role="status">
		Chart unavailable. Exact values remain available in the timestamp inspector.
	</p>{/if}

<style>
	.stored-chart {
		height: 240px;
		min-width: 0;
		width: 100%;
		position: relative;
	}
	@media (max-width: 600px) {
		.stored-chart {
			height: 190px;
		}
	}
</style>
