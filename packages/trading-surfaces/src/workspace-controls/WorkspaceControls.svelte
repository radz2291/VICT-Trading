<script lang="ts">
	/**
	 * trading.workspace-controls@1 — the market workspace control strip.
	 * Instrument and timeframe selection, bounded layout presets, and
	 * watchlist visibility. Every change updates the persisted Workspace
	 * Instance through the workspace service.
	 */
	import { getTradingServices, type WorkspaceLayoutPreset } from '../services.ts';

	const services = getTradingServices();

	const state = $derived(services.workspace.state);

	const presets: readonly { readonly id: WorkspaceLayoutPreset; readonly label: string }[] = [
		{ id: 'chart-focus', label: 'Chart focus' },
		{ id: 'balanced', label: 'Balanced' },
		{ id: 'inspect', label: 'Inspect' }
	];

	function onInstrumentChange(event: Event): void {
		const target = event.currentTarget as HTMLSelectElement;
		services.workspace.setInstrument(target.value);
	}

	function onTimeframeChange(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		services.workspace.setTimeframe(target.value);
	}

	function onPresetChange(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		services.workspace.setLayoutPreset(target.value as WorkspaceLayoutPreset);
	}

	function onWatchlistToggle(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		services.workspace.setWatchlistVisible(target.checked);
	}
</script>

<section class="controls" aria-label="Workspace controls">
	<div class="controls__group">
		<label class="controls__label" for="tos-instrument">Instrument</label>
		<select
			id="tos-instrument"
			class="controls__select"
			value={state.instrumentId}
			onchange={onInstrumentChange}
		>
			{#each services.workspace.instruments as instrument (instrument.id)}
				<option value={instrument.id}>{instrument.symbol} — {instrument.name}</option>
			{/each}
		</select>
	</div>

	<fieldset class="controls__group controls__fieldset">
		<legend class="controls__label">Timeframe</legend>
		<div class="controls__segmented" role="radiogroup" aria-label="Timeframe">
			{#each services.workspace.timeframes as timeframe (timeframe.id)}
				<label class="controls__seg" class:is-active={state.timeframeId === timeframe.id}>
					<input
						type="radio"
						name="tos-timeframe"
						value={timeframe.id}
						checked={state.timeframeId === timeframe.id}
						onchange={onTimeframeChange}
					/>
					{timeframe.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class="controls__group controls__fieldset">
		<legend class="controls__label">Layout</legend>
		<div class="controls__segmented" role="radiogroup" aria-label="Layout preset">
			{#each presets as preset (preset.id)}
				<label class="controls__seg" class:is-active={state.layoutPreset === preset.id}>
					<input
						type="radio"
						name="tos-layout"
						value={preset.id}
						checked={state.layoutPreset === preset.id}
						onchange={onPresetChange}
					/>
					{preset.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<label class="controls__toggle">
		<input type="checkbox" checked={state.watchlistVisible} onchange={onWatchlistToggle} />
		<span>Watchlist</span>
	</label>
</section>

<style>
	.controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: calc(var(--tos-unit, 6px) * 3);
		padding: calc(var(--tos-unit, 6px) * 1.5) calc(var(--tos-unit, 6px) * 2.5);
		background: var(--tos-surface, #161c24);
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: var(--tos-radius, 6px);
	}

	.controls__group {
		display: flex;
		align-items: center;
		gap: calc(var(--tos-unit, 6px) * 1.5);
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.controls__fieldset,
	.controls__fieldset legend {
		padding: 0;
	}

	.controls__fieldset legend {
		float: left;
	}

	.controls__label {
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tos-text-muted, #97a3ae);
	}

	.controls__select {
		background: var(--tos-bg, #0d1117);
		color: var(--tos-text, #e8edf2);
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: 4px;
		padding: 0.28rem 0.5rem;
		font: inherit;
		font-size: 0.82rem;
		max-width: 15rem;
	}

	.controls__select:focus-visible {
		outline: 2px solid var(--tos-focus, #4fa3ff);
		outline-offset: 1px;
	}

	.controls__seg:has(input:focus-visible) {
		outline: 2px solid var(--tos-focus, #4fa3ff);
		outline-offset: -2px;
	}

	.controls__toggle input:focus-visible {
		outline: 2px solid var(--tos-focus, #4fa3ff);
		outline-offset: 1px;
	}

	.controls__segmented {
		display: inline-flex;
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: 5px;
		overflow: hidden;
	}

	.controls__seg {
		display: inline-flex;
	}

	.controls__seg input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.controls__seg {
		position: relative;
	}

	.controls__seg {
		cursor: pointer;
		font-size: 0.78rem;
		padding: 0.28rem 0.7rem;
		color: var(--tos-text-muted, #97a3ae);
		border-right: 1px solid var(--tos-border, #2a3340);
		user-select: none;
	}

	.controls__seg:last-child {
		border-right: 0;
	}

	.controls__seg:hover {
		color: var(--tos-text, #e8edf2);
	}

	.controls__seg.is-active {
		background: color-mix(in srgb, var(--tos-accent, #d29922) 20%, transparent);
		color: var(--tos-text, #e8edf2);
	}

	.controls__toggle {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--tos-unit, 6px));
		font-size: 0.78rem;
		color: var(--tos-text-muted, #97a3ae);
		cursor: pointer;
		margin-left: auto;
	}

	.controls__toggle input {
		accent-color: var(--tos-accent, #d29922);
		width: 0.95rem;
		height: 0.95rem;
	}
</style>
