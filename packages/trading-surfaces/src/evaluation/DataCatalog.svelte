<script lang="ts">
	import { getTradingServices } from '../services.ts';
	import { FIXTURE_LABEL } from '@trading-os/trading-domain';
	import StoredChart from './StoredChart.svelte';
	import './evaluation.css';
	const service = getTradingServices().evaluation;
</script>

<section class="ev" aria-labelledby="stored-data-title" data-testid="data-catalog">
	<header class="ev-heading">
		<div>
			<span class="ev-eyebrow">MARKETS / STORED DATA</span>
			<h2 id="stored-data-title">Market data library</h2>
			<p>{FIXTURE_LABEL}</p>
		</div>
		<div class="ev-actions">
			<button onclick={() => void service?.load()} disabled={service?.installing}
				>Refresh catalog</button
			><button
				class="ev-primary"
				onclick={() => void service?.install()}
				disabled={!service || service.installing}
				>{service?.installing ? 'Installing fixture…' : 'Install deterministic fixture'}</button
			>
		</div>
	</header>
	{#if !service}<p role="alert">Stored-data services are unavailable.</p>{:else}
		<p class="ev-note">
			Fixed calendar · UTC opening timestamps · immutable series revisions. Install once to make the
			same data available to every Method evaluation.
		</p>
		{#if service.installing}<p role="status">Installing and validating a bounded dataset…</p>{/if}
		{#if service.message}<div class="ev-warning" role="status">
				{service.message}<button onclick={() => void service.retry()}>Retry request</button>
			</div>{/if}
		{#if service.catalogState === 'loading'}<p role="status">
				Loading stored series…
			</p>{:else if service.catalogState === 'failed'}<p role="alert">
				Data catalog unavailable. Refresh to read confirmed state.
			</p>{:else if !service.series.length}<div class="ev-empty">
				<h3>No stored dataset</h3>
				<p>
					Install the deterministic fixture to inspect coverage and evaluate a frozen Method
					Version. No market download or account connection is needed.
				</p>
			</div>{:else}
			<div class="ev-series-grid">
				{#each service.series as series (series.id)}<article class="ev-series">
						<div class="ev-heading">
							<h3>{series.instrument} · {series.timeframe}</h3>
							<span
								class="ev-state"
								data-state={series.health.state === 'ready' ? 'true' : 'unavailable'}
								>{series.health.state === 'ready'
									? 'Ready'
									: `${series.health.gaps.reduce((n, g) => n + g.missingBars, 0)} missing bars`}</span
							>
						</div>
						<p>{series.source.description}</p>
						<dl class="ev-details">
							<dt>Coverage UTC</dt>
							<dd>
								{new Date(series.coverage.start).toISOString().slice(0, 10)} → {new Date(
									series.coverage.end
								)
									.toISOString()
									.slice(0, 10)} (end exclusive)
							</dd>
							<dt>Bars / interval</dt>
							<dd>
								{series.coverage.barCount.toLocaleString('en-US')} / {series.durationMs / 60000} minutes
							</dd>
							<dt>Source revision</dt>
							<dd>{series.source.revision}</dd>
						</dl>
						<details>
							<summary>Data identity and health</summary>
							<p class="ev-fingerprint">{series.fingerprint}</p>
							<p>Ingested {series.ingestion.ingestedAt}</p>
							{#each series.health.gaps as gap (gap.start)}<p class="ev-warning">
									Gap: {new Date(gap.start).toISOString()} → {new Date(gap.end).toISOString()} · {gap.missingBars}
									absent
								</p>{/each}
						</details>
						<button
							onclick={() =>
								void service.loadChart(
									series.id,
									Math.max(series.coverage.start, series.coverage.end - 96 * series.durationMs),
									series.coverage.end
								)}>Inspect stored bars</button
						>
					</article>{/each}
			</div>
		{/if}
		{#if service.receipt}<p role="status">
				Installation confirmed · {service.receipt.barCount.toLocaleString('en-US')} bars · {service
					.receipt.durationMs} ms. Repeated installation preserves existing revisions.
			</p>{/if}
		{#if service.chartState === 'loading'}<p role="status">
				Loading bounded chart data…
			</p>{:else if service.chartState === 'failed'}<p role="alert">
				Stored chart data could not be verified.
			</p>{:else if service.chartSeries}<section class="ev-chart">
				<h3>
					{service.chartSeries.instrument} · {service.chartSeries.timeframe} · stored revision
				</h3>
				<p class="ev-note">Last {service.chartBars.length} stored bars. Historical fixture only.</p>
				<StoredChart bars={service.chartBars} durationMs={service.chartSeries.durationMs} />
			</section>{/if}
	{/if}
</section>
