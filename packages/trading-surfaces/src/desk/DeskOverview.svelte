<script lang="ts">
	/**
	 * trading.desk-overview@1 — the Desk status summary. Shows ONLY truthful
	 * T1 facts: the workspace context, the selected market context, the data
	 * source and its health, and the (empty) activity and background-
	 * operation state. No invented P&L, metrics, or analytics.
	 */
	import { getTradingServices } from '../services.ts';

	const services = getTradingServices();

	const state = $derived(services.workspace.state);
	const instrument = $derived(
		services.workspace.instruments.find((entry) => entry.id === state.instrumentId) ?? null
	);
	const timeframe = $derived(
		services.workspace.timeframes.find((entry) => entry.id === state.timeframeId) ?? null
	);
	const backgroundOps = $derived(services.backgroundOperations.operations);
</script>

<section class="desk" aria-label="Desk status">
	<h2 class="desk__heading">Workspace status</h2>
	<dl class="desk__grid">
		<div class="desk__row">
			<dt>Trading Program</dt>
			<dd>Personal Trading Program <span class="desk__note">(default, simulated context)</span></dd>
		</div>
		<div class="desk__row">
			<dt>Workspace</dt>
			<dd>Default market workspace</dd>
		</div>
		<div class="desk__row">
			<dt>Market context</dt>
			<dd>
				{#if instrument !== null && timeframe !== null}
					{instrument.symbol} · {timeframe.label}
					<span class="desk__note">({instrument.name})</span>
				{:else}
					No instrument selected
				{/if}
			</dd>
		</div>
		<div class="desk__row">
			<dt>Data source</dt>
			<dd>
				Fixture data — not live <span class="desk__note">(deterministic synthetic series)</span>
			</dd>
		</div>
		<div class="desk__row">
			<dt>Activity</dt>
			<dd class="desk__idle">No active run</dd>
		</div>
		<div class="desk__row">
			<dt>Background operations</dt>
			<dd class="desk__idle">
				{backgroundOps.length === 0 ? 'No background operations' : `${backgroundOps.length} active`}
			</dd>
		</div>
	</dl>
</section>

<style>
	.desk {
		background: var(--tos-surface, #161c24);
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: var(--tos-radius, 6px);
		padding: calc(var(--tos-unit, 6px) * 2) calc(var(--tos-unit, 6px) * 3);
		max-width: 46rem;
	}

	.desk__heading {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tos-text-muted, #97a3ae);
		margin: 0 0 calc(var(--tos-unit, 6px) * 1.5);
	}

	.desk__grid {
		margin: 0;
		display: grid;
		grid-template-columns: minmax(9rem, auto) 1fr;
		row-gap: calc(var(--tos-unit, 6px) * 1.4);
		column-gap: calc(var(--tos-unit, 6px) * 4);
	}

	.desk__row {
		display: contents;
	}

	.desk__grid dt {
		font-size: 0.78rem;
		color: var(--tos-text-muted, #97a3ae);
	}

	.desk__grid dd {
		margin: 0;
		font-size: 0.85rem;
		color: var(--tos-text, #e8edf2);
		font-variant-numeric: tabular-nums;
	}

	.desk__note {
		color: var(--tos-text-muted, #97a3ae);
		font-size: 0.78rem;
	}

	.desk__idle {
		color: var(--tos-text-muted, #97a3ae);
	}
</style>
