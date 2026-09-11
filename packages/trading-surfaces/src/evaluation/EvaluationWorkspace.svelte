<script lang="ts">
	import { getTradingServices } from '../services.ts';
	import {
		CALCULATION_REVISION,
		FIXTURE_LABEL,
		parseEvaluationRequest
	} from '@trading-os/trading-domain';
	import StoredChart from './StoredChart.svelte';
	import './evaluation.css';
	const services = getTradingServices(),
		service = services.evaluation;
	let bindings = $state<Record<string, string>>({}),
		driver = $state(''),
		start = $state(''),
		end = $state(''),
		accepted = $state(false),
		validation = $state(''),
		timestamp = $state(0);
	const version = $derived(service?.selectedVersion ?? null);
	const busy = $derived(
		service?.state === 'starting' ||
			service?.installing ||
			(!!service?.run && ['queued', 'running'].includes(service.run.status))
	);
	const frames = $derived(service?.result?.content.frames ?? []),
		frame = $derived(frames[timestamp] ?? frames[0]);
	const iso = (n: number) => new Date(n).toISOString();
	const inputTime = (n: number) => iso(n).slice(0, 16);
	$effect(() => {
		if (version) {
			bindings = {};
			driver = version.content.observations[0]?.id ?? '';
			start = '';
			end = '';
			accepted = false;
			validation = '';
			timestamp = 0;
		}
	});
	function suggestRange() {
		const s = service?.series.find((s) => s.id === bindings[driver]);
		if (s) {
			start = inputTime(
				Math.max(s.coverage.start + s.durationMs, s.coverage.end - 95 * s.durationMs)
			);
			end = inputTime(s.coverage.end + s.durationMs);
		}
	}
	function utc(text: string) {
		if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) throw new Error('UTC required');
		return Date.parse(`${text}:00.000Z`);
	}
	async function submit() {
		if (!version || !service) return;
		validation = '';
		try {
			const request = parseEvaluationRequest({
				schema: 'trading.evaluation-request@1',
				methodVersionId: version.id,
				bindings: version.content.observations.map((o) => ({
					observationId: o.id,
					seriesId: bindings[o.id] ?? ''
				})),
				start: utc(start),
				end: utc(end),
				driverObservationId: driver,
				calculationRevision: CALCULATION_REVISION
			});
			if (!accepted) {
				validation = 'Accept the displayed calculation revision before starting.';
				return;
			}
			timestamp = 0;
			await service.start(request);
		} catch {
			validation = 'Choose a compatible series for each observation and a valid bounded UTC range.';
		}
	}
	async function chart() {
		if (!service?.result) return;
		const r = service.result.content,
			b = r.identity.bindings.find((b) => b.observationId === r.identity.driverObservationId),
			s = service.series.find((s) => s.id === b?.seriesId);
		if (s)
			await service.loadChart(
				s.id,
				Math.max(0, r.identity.start - s.durationMs),
				r.identity.end - s.durationMs
			);
	}
	const label = (id: string) =>
		services.methods?.catalog.definitions.find((d) => d.id === id)?.label ?? id;
</script>

<section class="ev" data-testid="evaluation-workspace" aria-labelledby="evaluation-title">
	<header class="ev-heading">
		<div>
			<span class="ev-eyebrow">METHODS / EVALUATION INSPECTOR</span>
			<h2 id="evaluation-title">Deterministic evaluation</h2>
			<p>{FIXTURE_LABEL}</p>
		</div>
	</header>
	{#if !service}<p role="alert">Evaluation services are unavailable.</p>{:else}
		{#if !version}<div class="ev-empty">
				<h3>Start with a frozen Method Version</h3>
				<p>
					Create a Method, define its observations and capabilities, then freeze a valid version.
					Choose Evaluate / Inspect in Version history.
				</p>
			</div>{:else}
			<section class="ev-config" aria-label="Evaluation configuration">
				<h3>{version.content.name} · Version {version.number}</h3>
				<p class="ev-note">
					Pin every observation to an immutable stored series. Selection creates no active operating
					mode.
				</p>
				{#if service.catalogState === 'loading'}<p role="status">
						Loading stored series…
					</p>{:else if service.catalogState === 'failed'}<p role="alert">
						Data catalog unavailable. Refresh the catalog in Markets.
					</p>{:else if !service.series.length}<p class="ev-warning">
						No stored dataset. Install the deterministic fixture in Markets first.
					</p>{/if}
				<div class="ev-form-grid">
					{#each version.content.observations as observation (observation.id)}<div class="ev-field">
							<label for={`binding-${observation.id}`}
								>{observation.label} · {observation.instrument} · {observation.timeframe}</label
							><select
								id={`binding-${observation.id}`}
								value={bindings[observation.id] ?? ''}
								onchange={(e) =>
									(bindings = { ...bindings, [observation.id]: e.currentTarget.value })}
								disabled={busy}
								><option value="">Choose stored series</option
								>{#each service.series.filter((s) => s.instrument === observation.instrument && s.timeframe === observation.timeframe) as s (s.id)}<option
										value={s.id}
										>{s.instrument} · {s.timeframe} · {s.health.state} · {s.fingerprint.slice(
											7,
											19
										)}</option
									>{/each}</select
							>{#if !service.series.some((s) => s.instrument === observation.instrument && s.timeframe === observation.timeframe)}<small
									class="ev-warning"
									>No compatible stored series. Instrument and timeframe must match exactly.</small
								>{/if}
						</div>{/each}
				</div>
				<div class="ev-form-grid">
					<div class="ev-field">
						<label for="evaluation-driver">Driver timeline</label><select
							id="evaluation-driver"
							bind:value={driver}
							disabled={busy}
							>{#each version.content.observations as o (o.id)}<option value={o.id}
									>{o.label} · {o.timeframe}</option
								>{/each}</select
						>
					</div>
					<div class="ev-field">
						<label for="evaluation-start">From UTC (inclusive)</label><input
							id="evaluation-start"
							type="datetime-local"
							bind:value={start}
							disabled={busy}
						/>
					</div>
					<div class="ev-field">
						<label for="evaluation-end">Until UTC (exclusive)</label><input
							id="evaluation-end"
							type="datetime-local"
							bind:value={end}
							disabled={busy}
						/>
					</div>
				</div>
				<div class="ev-actions">
					<button disabled={!bindings[driver] || busy} onclick={suggestRange}
						>Use last 96 intervals</button
					><span class="ev-note">Up to 512 frames. Missing expected closes remain visible.</span>
				</div>
				<details>
					<summary>Selected data coverage and health</summary
					>{#each version.content.observations as o (o.id)}{@const data = service.series.find(
							(s) => s.id === bindings[o.id]
						)}{#if data}<p>
								<strong
									>{o.label}: {data.instrument} · {data.timeframe} · {data.health.state}</strong
								><br />{iso(data.coverage.start)} → {iso(data.coverage.end)} (exclusive)<br />{data
									.coverage.barCount} bars · {data.source.description}
							</p>{/if}{/each}
				</details>
				<details>
					<summary>Calculation semantics · {CALCULATION_REVISION}</summary>
					<p>
						Only fully closed bars are available. Range and mean references use N previous closed
						bars, excluding the current closed bar. Price rules use the current close. Range
						above/below comparisons are strict; inside includes equality. Mean-distance thresholds
						include equality. UTC windows are half-open. Gaps and warm-up produce unavailable
						states.
					</p>
					<p>
						Judgment questions remain unanswered. Risk requests and execution assumptions remain
						declarations.
					</p>
				</details>
				<label class="ev-check"
					><input type="checkbox" bind:checked={accepted} disabled={busy} />Use calculation revision {CALCULATION_REVISION}
					with this Method Version.</label
				>
				{#if validation}<p role="alert" class="ev-warning">{validation}</p>{/if}
				<button
					class="ev-primary"
					disabled={busy || !accepted || !start || !end}
					onclick={() => void submit()}
					>{busy ? 'Evaluation in progress…' : 'Start deterministic evaluation'}</button
				>
			</section>{/if}
		<div role="status" class="ev-status" data-state={service.run?.status ?? service.state}>
			<strong
				>{service.run
					? `${service.run.methodName} · v${service.run.versionNumber} · ${service.run.status}`
					: service.state === 'starting'
						? 'Submitting evaluation…'
						: service.state === 'loading'
							? 'Loading persisted evaluation…'
							: service.state === 'failed'
								? 'Evaluation unavailable'
								: 'Ready to inspect'}</strong
			>{#if service.message}<span>{service.message}</span>{/if}
		</div>
		{#if service.state === 'failed'}<button onclick={() => void service.retry()}
				>Retry / reconcile request</button
			>{/if}
		{#each service.diagnostics as d, i (i)}<p class="ev-warning">
				{d.instanceId}: {d.message}
			</p>{/each}
		{#if service.run}<details class="ev-run-details">
				<summary>Exact run inputs and revisions</summary>
				<dl class="ev-details">
					<dt>Run request</dt>
					<dd class="ev-fingerprint">{service.run.id}</dd>
					<dt>Method Version</dt>
					<dd>
						{service.run.methodName} · Version {service.run.versionNumber}<br /><span
							class="ev-fingerprint">{service.run.request.methodVersionId}</span
						>
					</dd>
					<dt>Method fingerprint</dt>
					<dd class="ev-fingerprint">{service.run.identity.methodFingerprint}</dd>
					<dt>Range UTC</dt>
					<dd>{iso(service.run.identity.start)} → {iso(service.run.identity.end)} (exclusive)</dd>
					<dt>Driver</dt>
					<dd>{service.run.identity.driverObservationId}</dd>
					<dt>Engine / operation</dt>
					<dd>{service.run.identity.engine} / {service.run.identity.operation}</dd>
					<dt>Input fingerprint</dt>
					<dd class="ev-fingerprint">{service.run.inputFingerprint}</dd>
					<dt>Result fingerprint</dt>
					<dd class="ev-fingerprint">{service.run.resultFingerprint ?? 'No committed result'}</dd>
					<dt>Operational duration</dt>
					<dd>
						{service.run.startedAt && service.run.finishedAt
							? `${Date.parse(service.run.finishedAt) - Date.parse(service.run.startedAt)} ms`
							: 'Not complete'}
					</dd>
				</dl>
				{#each service.run.identity.bindings as b (b.observationId)}{@const data =
						service.series.find((s) => s.id === b.seriesId)}{#if data}<p>
							{data.instrument} · {data.timeframe} · {data.health.state}<br />{iso(
								data.coverage.start
							)} → {iso(data.coverage.end)} (exclusive)<br />{data.source.description} · revision {data
								.source.revision}
						</p>{:else}<p class="ev-warning">
							Data catalog unavailable for this pinned binding.
						</p>{/if}
					<p class="ev-fingerprint">{b.observationId} → {b.seriesFingerprint}</p>{/each}
				{#each service.run.identity.calculations as c (c.capabilityId)}<p>
						{c.capabilityId}@{c.definitionRevision} · {c.calculationRevision}
					</p>{/each}
			</details>{/if}
		{#if service.result && frame}<section aria-label="Completed evaluation" class="ev-results">
				<header class="ev-heading">
					<h3>{service.result.content.method.name} · v{service.result.content.method.number}</h3>
					<span>{frames.length} timestamps</span>
				</header>
				<div class="ev-counts">
					{#each ['true', 'false', 'unavailable'] as key (key)}<div>
							<span class="ev-state" data-state={key}>{key}</span><strong
								>{service.result.content.counts[key as 'true' | 'false' | 'unavailable']}</strong
							>
						</div>{/each}
				</div>
				<p class="ev-note">
					Counts describe combined rule states. They do not describe trading outcomes.
				</p>
				<div class="ev-inspect-controls">
					<button disabled={timestamp <= 0} onclick={() => (timestamp = Math.max(0, timestamp - 1))}
						>Previous timestamp</button
					>
					<div class="ev-field">
						<label for="evaluation-timestamp">Inspect timestamp (UTC close)</label><select
							id="evaluation-timestamp"
							bind:value={timestamp}
							>{#each frames as f, i (f.time)}<option value={i}>{iso(f.time)} · {f.state}</option
								>{/each}</select
						>
					</div>
					<button
						disabled={timestamp >= frames.length - 1}
						onclick={() => (timestamp = Math.min(frames.length - 1, timestamp + 1))}
						>Next timestamp</button
					>
				</div>
				<section aria-label="Timestamp inspection">
					<h4>
						{iso(frame.time)} <span class="ev-state" data-state={frame.state}>{frame.state}</span>
					</h4>
					<div class="ev-output-grid">
						{#each frame.outputs as output (output.instanceId)}<article class="ev-output">
								<header class="ev-heading">
									<h4>{label(output.capabilityId)} <small>· {output.instanceId}</small></h4>
									<span class="ev-state" data-state={output.state}>{output.state}</span>
								</header>
								<dl class="ev-details">
									{#each Object.entries(output.values) as [key, value] (key)}<dt>{key}</dt>
										<dd>{value.toLocaleString('en-US', { maximumFractionDigits: 10 })}</dd>{/each}
								</dl>
								{#each output.diagnostics as d, i (i)}<p class="ev-warning">
										{d.message}
									</p>{/each}<small
									>{output.capabilityId}@{output.definitionRevision} · {output.calculationRevision}</small
								>
							</article>{/each}
					</div>
				</section>
				<button onclick={() => void chart()}>Show driver chart for this result</button>
				{#if service.chartState === 'loading'}<p role="status">
						Loading stored chart…
					</p>{:else if service.chartState === 'failed'}<p role="alert">
						Chart data unavailable.
					</p>{:else if service.chartSeries && service.result.content.identity.bindings.some((b) => b.observationId === service.result!.content.identity.driverObservationId && b.seriesId === service.chartSeries!.id)}<StoredChart
						bars={service.chartBars}
						selectedTime={frame.time}
						durationMs={service.chartSeries.durationMs}
					/>{/if}
				<div class="ev-declarations">
					{#each [{ key: 'judgment', title: 'Unanswered judgment questions' }, { key: 'risk', title: 'Risk requests — declarations only' }, { key: 'execution', title: 'Execution assumptions — declarations only' }] as category (category.key)}<section
						>
							<h4>{category.title}</h4>
							{#each service.result.content.declarations[category.key as 'judgment' | 'risk' | 'execution'] as d (d.id)}<p
								>
									{Object.entries(d.config)
										.map(([key, value]) => `${key}: ${value}`)
										.join(' · ')}
								</p>{:else}<p class="ev-note">None declared.</p>{/each}
						</section>{/each}
				</div>
			</section>{/if}
		<section class="ev-saved" aria-label="Saved evaluations">
			<div class="ev-heading">
				<h3>Saved evaluations</h3>
				<button onclick={() => void service.refreshRuns()}>Refresh runs</button>
			</div>
			{#if !service.runs.length}<p>
					No evaluation runs yet. Completed and failed runs are retained across reloads.
				</p>{:else}<ul>
					{#each service.runs as saved (saved.id)}<li>
							<button
								disabled={busy}
								onclick={() => {
									timestamp = 0;
									void service.openRun(saved.id);
								}}
								><strong>{saved.methodName} · v{saved.versionNumber}</strong><span
									>{saved.status} · {saved.createdAt.replace('T', ' ').slice(0, 19)} UTC</span
								><small>Input {saved.inputFingerprint.slice(7, 23)}</small></button
							>
						</li>{/each}
				</ul>{/if}
		</section>
	{/if}
</section>
