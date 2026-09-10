<script lang="ts">
	/**
	 * trading.market-chart@1 — the versioned custom market-chart surface.
	 *
	 * Renders candlesticks + volume (shared crosshair, two panes) through the
	 * product-owned chart adapter, with truthful loading/empty/stale/error
	 * states, a textual OHLCV readout, keyboard bar inspection, and a hidden
	 * accessible data table. All data arrives through product services
	 * (bounded primitive props are not used for data); the chart engine is
	 * loaded dynamically and never evaluates during SSR.
	 */
	import type { Bar, MarketDataHealth } from '@trading-os/trading-domain';
	import { getTradingServices } from '../services.ts';
	import { clampCursorIndex, formatOhlcv, resolveChartPhase } from './chart-logic.ts';
	import type { MarketChartHandle } from './market-chart-adapter.ts';
	import { resolveMarketChartColors } from './chart-colors.ts';

	const services = getTradingServices();

	let container: HTMLDivElement | null = $state(null);
	let loading = $state(true);
	let bars: readonly Bar[] = $state([]);
	let health: MarketDataHealth | null = $state(null);
	let hovered: Bar | null = $state(null);
	let cursor: number = $state(-1);
	let loadToken = 0;

	const instrumentId = $derived(services.workspace.state.instrumentId);
	const timeFrameId = $derived(services.workspace.state.timeframeId);
	const instrument = $derived(
		services.workspace.instruments.find((entry) => entry.id === instrumentId) ?? {
			id: instrumentId,
			symbol: instrumentId,
			name: instrumentId,
			pricePrecision: 2
		}
	);
	const timeframe = $derived(
		services.workspace.timeframes.find((entry) => entry.id === timeFrameId) ?? {
			id: timeFrameId,
			label: timeFrameId,
			seconds: 0
		}
	);
	const phase = $derived(resolveChartPhase({ loading, barCount: bars.length, health }));
	const cursorBar = $derived(cursor >= 0 && cursor < bars.length ? bars[cursor]! : null);
	const readoutBar = $derived(
		hovered ?? cursorBar ?? (bars.length > 0 ? bars[bars.length - 1]! : null)
	);
	const readoutIndex = $derived(readoutBar === null ? -1 : bars.indexOf(readoutBar));
	const readout = $derived(
		readoutBar === null
			? null
			: formatOhlcv(
					readoutBar,
					readoutIndex > 0 ? bars[readoutIndex - 1]?.close : undefined,
					instrument
				)
	);

	function isoTime(time: number): string {
		return new Date(time).toISOString().replace('T', ' ').slice(0, 16);
	}

	function stepCursor(delta: number | 'home' | 'end'): void {
		if (bars.length === 0) {
			return;
		}
		if (delta === 'home') {
			cursor = 0;
		} else if (delta === 'end') {
			cursor = bars.length - 1;
		} else {
			cursor = clampCursorIndex(cursor + delta, bars.length);
		}
		hovered = null;
	}

	// Client-only chart lifecycle. `$effect` never runs during SSR, and the
	// chart engine is imported dynamically, so no browser-only code executes
	// on the server. Re-created when the instrument (price precision) or
	// timeframe (axis mode) changes.
	$effect(() => {
		const chartInstrument = instrument;
		const chartTimeframe = timeframe;
		const element = container;
		const token = ++loadToken;
		let disposed = false;
		let currentHandle: MarketChartHandle | null = null;

		async function run(): Promise<void> {
			if (element === null) {
				return;
			}
			loading = true;
			health = null;
			hovered = null;
			cursor = -1;
			const { createMarketChart } = await import('./market-chart-adapter.ts');
			if (disposed || token !== loadToken || element === null) {
				return;
			}
			currentHandle = await createMarketChart(element, {
				colors: resolveMarketChartColors(),
				pricePrecision: chartInstrument.pricePrecision,
				intraday: chartTimeframe.seconds < 86_400
			});
			if (disposed || token !== loadToken) {
				currentHandle.destroy();
				return;
			}
			currentHandle.onCrosshair((bar) => {
				hovered = bar;
			});
			const snapshot = services.marketData.snapshot(chartInstrument.id, chartTimeframe.id, 400);
			bars = snapshot.bars;
			health = snapshot.health;
			loading = false;
			currentHandle.setData(snapshot.bars);
		}

		void run();
		return () => {
			disposed = true;
			currentHandle?.destroy();
		};
	});
</script>

<section class="chart-panel" aria-label="Market chart — {instrument.symbol} {timeframe.label}">
	<header class="chart-panel__head">
		<h2 class="chart-panel__title">Market chart</h2>
		<span class="chart-panel__context">{instrument.symbol} · {timeframe.label}</span>
		<span class="chart-panel__fixture" title="Deterministic synthetic series, not live market data"
			>Fixture data — not live</span
		>
	</header>

	{#if phase === 'error'}
		<p class="chart-panel__banner chart-panel__banner--error" role="alert">
			Market data failed: {health?.message ?? 'the source reported an error'}. No data is shown as
			current.
		</p>
	{:else if phase === 'empty'}
		<p class="chart-panel__banner" role="status">
			No bars are available for {instrument.symbol} at {timeframe.label}.
		</p>
	{:else if phase === 'stale'}
		<p class="chart-panel__banner chart-panel__banner--warn" role="status">
			Stale — showing last known data. {health?.message ?? 'The source has not refreshed.'}
		</p>
	{:else if phase === 'loading'}
		<p class="chart-panel__banner" role="status">Loading market data…</p>
	{/if}

	<!-- Decorative plot area: the chart engine draws here. All information is
	     available textually in the readout and the data table below. -->
	<div class="chart-panel__plot" bind:this={container} aria-hidden="true"></div>

	{#if bars.length > 0 && readout !== null}
		<!-- The readout is an intentionally focusable keyboard-inspection group:
		     arrow keys step through bars for keyboard and screen-reader users. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="chart-panel__readout"
			role="group"
			tabindex="0"
			aria-label="Bar inspection — use arrow keys to step through bars, Home and End to jump"
			onkeydown={(event) => {
				if (event.key === 'ArrowLeft') {
					event.preventDefault();
					stepCursor(-1);
				} else if (event.key === 'ArrowRight') {
					event.preventDefault();
					stepCursor(1);
				} else if (event.key === 'Home') {
					event.preventDefault();
					stepCursor('home');
				} else if (event.key === 'End') {
					event.preventDefault();
					stepCursor('end');
				}
			}}
		>
			<span class="chart-panel__readout-time" aria-hidden="true">{isoTime(readoutBar!.time)}</span>
			<span
				class="chart-panel__kv {readout.direction === 'up'
					? 'is-up'
					: readout.direction === 'down'
						? 'is-down'
						: ''}"
			>
				<span class="chart-panel__kv-item"><span class="chart-panel__k">O</span>{readout.open}</span
				>
				<span class="chart-panel__kv-item"><span class="chart-panel__k">H</span>{readout.high}</span
				>
				<span class="chart-panel__kv-item"><span class="chart-panel__k">L</span>{readout.low}</span>
				<span class="chart-panel__kv-item"
					><span class="chart-panel__k">C</span>{readout.close}</span
				>
				<span
					class="chart-panel__kv-item chart-panel__change {readout.direction === 'up'
						? 'is-up'
						: readout.direction === 'down'
							? 'is-down'
							: ''}">{readout.change}</span
				>
				<span class="chart-panel__kv-item"
					><span class="chart-panel__k">V</span>{readout.volume}</span
				>
			</span>
			<span class="chart-panel__readout-hint" aria-hidden="true">◀ ▶ step bars</span>
			<span class="visually-hidden" aria-live="polite">
				Bar {isoTime(readoutBar!.time)}: open {readout.open}, high {readout.high}, low {readout.low},
				close {readout.close}, volume {readout.volume}, change {readout.change}
			</span>
		</div>
	{/if}

	{#if bars.length > 0}
		<details class="chart-panel__table">
			<summary>Bar data (last {Math.min(40, bars.length)} bars)</summary>
			<!-- Scrollable region: keyboard-scrollable by WCAG 2.1 (2.1.1). -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="chart-panel__table-scroll" tabindex="0">
				<table>
					<caption class="visually-hidden">
						OHLCV data for {instrument.symbol} at {timeframe.label}, newest last
					</caption>
					<thead>
						<tr>
							<th scope="col">Time (UTC)</th>
							<th scope="col">Open</th>
							<th scope="col">High</th>
							<th scope="col">Low</th>
							<th scope="col">Close</th>
							<th scope="col">Volume</th>
						</tr>
					</thead>
					<tbody>
						{#each bars.slice(-40) as bar (bar.time)}
							<tr>
								<td>{isoTime(bar.time)}</td>
								<td class="num">{bar.open}</td>
								<td class="num">{bar.high}</td>
								<td class="num">{bar.low}</td>
								<td class="num">{bar.close}</td>
								<td class="num">{bar.volume}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}

	<footer class="chart-panel__foot">
		Fixture data — not live · Charting: Lightweight Charts (TradingView), Apache-2.0
	</footer>
</section>

<style>
	.chart-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--tos-surface, #161c24);
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: var(--tos-radius, 6px);
		overflow: hidden;
	}

	.chart-panel__head {
		display: flex;
		align-items: baseline;
		gap: calc(var(--tos-unit, 6px) * 2);
		padding: calc(var(--tos-unit, 6px) * 1.5) calc(var(--tos-unit, 6px) * 2.5);
		border-bottom: 1px solid var(--tos-border, #2a3340);
	}

	.chart-panel__title {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tos-text-muted, #97a3ae);
		margin: 0;
	}

	.chart-panel__context {
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.82rem;
		color: var(--tos-text, #e8edf2);
		font-variant-numeric: tabular-nums;
	}

	.chart-panel__fixture {
		margin-left: auto;
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		color: var(--tos-warning, #d9a53a);
		border: 1px solid color-mix(in srgb, var(--tos-warning, #d9a53a) 45%, transparent);
		border-radius: 999px;
		padding: 0.1rem 0.55rem;
		white-space: nowrap;
	}

	.chart-panel__banner {
		margin: 0;
		padding: calc(var(--tos-unit, 6px) * 1.5) calc(var(--tos-unit, 6px) * 2.5);
		font-size: 0.82rem;
		color: var(--tos-text-muted, #97a3ae);
		border-bottom: 1px solid var(--tos-border, #2a3340);
	}

	.chart-panel__banner--warn {
		color: var(--tos-warning, #d9a53a);
		background: color-mix(in srgb, var(--tos-warning, #d9a53a) 12%, transparent);
	}

	.chart-panel__banner--error {
		color: var(--tos-down, #e5534b);
		background: color-mix(in srgb, var(--tos-down, #e5534b) 12%, transparent);
	}

	.chart-panel__plot {
		flex: 1 1 auto;
		min-height: 0;
	}

	.chart-panel__readout {
		display: flex;
		align-items: center;
		gap: calc(var(--tos-unit, 6px) * 2.5);
		padding: calc(var(--tos-unit, 6px)) calc(var(--tos-unit, 6px) * 2.5);
		border-top: 1px solid var(--tos-border, #2a3340);
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		color: var(--tos-text, #e8edf2);
		cursor: default;
	}

	.chart-panel__readout:focus-visible {
		outline: 2px solid var(--tos-focus, #4fa3ff);
		outline-offset: -2px;
	}

	.chart-panel__readout-time {
		color: var(--tos-text-muted, #97a3ae);
	}

	.chart-panel__kv {
		display: inline-flex;
		gap: calc(var(--tos-unit, 6px) * 2);
		flex-wrap: wrap;
	}

	.chart-panel__k {
		color: var(--tos-text-muted, #97a3ae);
		margin-right: 0.3em;
	}

	.chart-panel__change.is-up,
	.is-up {
		color: var(--tos-up, #3fb27f);
	}

	.chart-panel__change.is-down,
	.is-down {
		color: var(--tos-down, #e5534b);
	}

	.chart-panel__readout-hint {
		margin-left: auto;
		font-size: 0.68rem;
		color: var(--tos-text-muted, #97a3ae);
		white-space: nowrap;
	}

	.chart-panel__table {
		border-top: 1px solid var(--tos-border, #2a3340);
		font-size: 0.78rem;
	}

	.chart-panel__table summary {
		cursor: pointer;
		padding: calc(var(--tos-unit, 6px)) calc(var(--tos-unit, 6px) * 2.5);
		color: var(--tos-text-muted, #97a3ae);
		user-select: none;
	}

	.chart-panel__table summary:hover {
		color: var(--tos-text, #e8edf2);
	}

	.chart-panel__table-scroll {
		max-height: 220px;
		overflow: auto;
	}

	.chart-panel__table table {
		width: 100%;
		border-collapse: collapse;
	}

	.chart-panel__table th,
	.chart-panel__table td {
		text-align: left;
		padding: 0.2rem calc(var(--tos-unit, 6px) * 2.5);
		border-bottom: 1px solid var(--tos-border, #2a3340);
		font-variant-numeric: tabular-nums;
		font-family: var(--tos-font-mono, ui-monospace, monospace);
	}

	.chart-panel__table td.num {
		text-align: right;
	}

	.chart-panel__foot {
		padding: calc(var(--tos-unit, 6px)) calc(var(--tos-unit, 6px) * 2.5);
		border-top: 1px solid var(--tos-border, #2a3340);
		font-size: 0.68rem;
		color: var(--tos-text-muted, #97a3ae);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
