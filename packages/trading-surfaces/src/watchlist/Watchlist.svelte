<script lang="ts">
	/**
	 * trading.watchlist@1 — instrument inspection and selection for the
	 * market workspace. Lists every instrument served by the bound market
	 * data source with its last close and change on the workspace timeframe;
	 * selecting an instrument updates the persisted workspace.
	 */
	import { getTradingServices } from '../services.ts';

	const services = getTradingServices();

	const instrumentId = $derived(services.workspace.state.instrumentId);
	const timeframe = $derived(
		services.workspace.timeframes.find(
			(entry) => entry.id === services.workspace.state.timeframeId
		) ?? { id: '', label: '', seconds: 0 }
	);

	interface Row {
		readonly id: string;
		readonly symbol: string;
		readonly name: string;
		readonly last: string;
		readonly change: string;
		readonly direction: 'up' | 'down' | 'flat';
		readonly precision: number;
	}

	const rows: readonly Row[] = $derived.by(() => {
		return services.workspace.instruments.map((instrument) => {
			const snapshot = services.marketData.snapshot(instrument.id, timeframe.id || '1h', 2);
			const bars = snapshot.bars;
			const last = bars[bars.length - 1];
			const prev = bars[bars.length - 2];
			if (last === undefined) {
				return {
					id: instrument.id,
					symbol: instrument.symbol,
					name: instrument.name,
					last: '—',
					change: '—',
					direction: 'flat',
					precision: instrument.pricePrecision
				};
			}
			const reference = prev?.close ?? last.open;
			const changeAbs = last.close - reference;
			const changePct = reference !== 0 ? (changeAbs / reference) * 100 : 0;
			const sign = changeAbs > 0 ? '+' : '';
			return {
				id: instrument.id,
				symbol: instrument.symbol,
				name: instrument.name,
				last: last.close.toLocaleString('en-US', {
					minimumFractionDigits: instrument.pricePrecision,
					maximumFractionDigits: instrument.pricePrecision
				}),
				change: `${sign}${changePct.toFixed(2)}%`,
				direction: changeAbs > 0 ? 'up' : changeAbs < 0 ? 'down' : 'flat',
				precision: instrument.pricePrecision
			};
		});
	});

	function select(id: string): void {
		services.workspace.setInstrument(id);
	}
</script>

<section class="watchlist" aria-label="Instrument watchlist">
	<header class="watchlist__head">
		<h2 class="watchlist__title">Instruments</h2>
		<span class="watchlist__tf" aria-hidden="true">{timeframe.label || '—'}</span>
	</header>
	<ul class="watchlist__list" role="list" aria-label="Select instrument">
		{#each rows as row (row.id)}
			<li>
				<button
					type="button"
					class="watchlist__row"
					aria-current={row.id === instrumentId ? 'true' : undefined}
					class:is-active={row.id === instrumentId}
					onclick={() => select(row.id)}
				>
					<span class="watchlist__symbol">{row.symbol}</span>
					<span class="watchlist__name">{row.name}</span>
					<span class="watchlist__last">{row.last}</span>
					<span
						class="watchlist__change {row.direction === 'up'
							? 'is-up'
							: row.direction === 'down'
								? 'is-down'
								: ''}">{row.change}</span
					>
				</button>
			</li>
		{/each}
	</ul>
	<footer class="watchlist__foot">Fixture data — not live</footer>
</section>

<style>
	.watchlist {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--tos-surface, #161c24);
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: var(--tos-radius, 6px);
		overflow: hidden;
	}

	.watchlist__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: calc(var(--tos-unit, 6px) * 1.5) calc(var(--tos-unit, 6px) * 2.5);
		border-bottom: 1px solid var(--tos-border, #2a3340);
	}

	.watchlist__title {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tos-text-muted, #97a3ae);
		margin: 0;
	}

	.watchlist__tf {
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.75rem;
		color: var(--tos-text-muted, #97a3ae);
	}

	.watchlist__list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}

	.watchlist__row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-areas:
			'symbol last change'
			'name last change';
		column-gap: calc(var(--tos-unit, 6px) * 2);
		width: 100%;
		padding: calc(var(--tos-unit, 6px) * 1.2) calc(var(--tos-unit, 6px) * 2.5);
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--tos-border, #2a3340);
		color: var(--tos-text, #e8edf2);
		text-align: left;
		cursor: pointer;
		font: inherit;
	}

	.watchlist__row:hover {
		background: color-mix(in srgb, var(--tos-accent, #d29922) 7%, transparent);
	}

	.watchlist__row.is-active {
		background: color-mix(in srgb, var(--tos-accent, #d29922) 14%, transparent);
		box-shadow: inset 2px 0 0 var(--tos-accent, #d29922);
	}

	.watchlist__row:focus-visible {
		outline: 2px solid var(--tos-focus, #4fa3ff);
		outline-offset: -2px;
	}

	.watchlist__symbol {
		grid-area: symbol;
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.watchlist__name {
		grid-area: name;
		font-size: 0.7rem;
		color: var(--tos-text-muted, #97a3ae);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.watchlist__last {
		grid-area: last;
		align-self: center;
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.watchlist__change {
		grid-area: change;
		align-self: center;
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		min-width: 4.5em;
	}

	.is-up {
		color: var(--tos-up, #3fb27f);
	}

	.is-down {
		color: var(--tos-down, #e5534b);
	}

	.watchlist__foot {
		padding: calc(var(--tos-unit, 6px)) calc(var(--tos-unit, 6px) * 2.5);
		border-top: 1px solid var(--tos-border, #2a3340);
		font-size: 0.68rem;
		color: var(--tos-text-muted, #97a3ae);
	}
</style>
