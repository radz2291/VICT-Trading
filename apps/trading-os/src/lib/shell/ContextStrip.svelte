<script lang="ts">
	/**
	 * The persistent product context strip: Trading OS identity, program and
	 * workspace context, market context, truthful activity status, truthful
	 * data health, and the command-palette entry point. This is product
	 * chrome — VICT remains responsible for navigation and screens inside
	 * the host below it.
	 */
	import { browser } from '$app/environment';
	import type { TradingServices, WorkspaceSaveState } from '@trading-os/trading-surfaces';

	let { services, onOpenPalette }: { services: TradingServices; onOpenPalette: () => void } =
		$props();

	const workspaceState = $derived(services.workspace.state);
	const saveState = $derived(services.workspace.saveState);
	const instrument = $derived(
		services.workspace.instruments.find((entry) => entry.id === workspaceState.instrumentId) ?? null
	);
	const timeframe = $derived(
		services.workspace.timeframes.find((entry) => entry.id === workspaceState.timeframeId) ?? null
	);
	const operationCount = $derived(services.backgroundOperations.operations.length);

	// Platform-aware shortcut display (F-5): the palette opens with Ctrl+K
	// everywhere and Cmd+K on Apple platforms. The label is resolved on the
	// client after mount so SSR output stays deterministic.
	let shortcutLabel = $state('Ctrl K');
	$effect(() => {
		if (browser) {
			const platform = `${navigator.platform ?? ''} ${navigator.userAgent}`;
			shortcutLabel = /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘K' : 'Ctrl K';
		}
	});

	const SAVE_STATE_LABEL: Record<WorkspaceSaveState, string | null> = {
		idle: null,
		saving: 'Saving…',
		saved: 'Workspace saved',
		failed: 'Save failed — not persisted'
	};
	const saveLabel = $derived(SAVE_STATE_LABEL[saveState]);
</script>

<header class="tos-strip">
	<span class="tos-strip__brand">Trading OS</span>
	<span class="tos-strip__item tos-strip__item--context">
		<span class="tos-strip__k">Program</span>
		<span>Personal Trading Program</span>
	</span>
	<span class="tos-strip__item tos-strip__item--context">
		<span class="tos-strip__k">Workspace</span>
		<span>Default</span>
	</span>
	<span class="tos-strip__item tos-strip__item--context tos-strip__item--market">
		<span class="tos-strip__k">Context</span>
		<span class="tos-strip__mono">
			{instrument ? instrument.symbol : '—'} · {timeframe ? timeframe.label : '—'}
		</span>
	</span>
	<span class="tos-strip__spacer" aria-hidden="true"></span>
	<span class="tos-strip__item tos-strip__item--status">
		<span class="tos-dot tos-dot--idle" aria-hidden="true"></span>
		<span class="visually-hidden">Activity: </span>
		No active run
	</span>
	<span class="tos-strip__item tos-strip__item--status">
		<span class="visually-hidden">Background operations: </span>
		{operationCount === 0 ? 'No background operations' : `${operationCount} running`}
	</span>
	{#if saveLabel !== null}
		<span
			class="tos-strip__item tos-strip__item--save"
			class:tos-strip__item--save-failed={saveState === 'failed'}
			data-tos-save={saveState}
			role="status"
		>
			<span class="tos-dot tos-dot--save-{saveState}" aria-hidden="true"></span>
			<span class="visually-hidden">Workspace save: </span>
			{saveLabel}
		</span>
	{/if}
	<span
		class="tos-strip__item tos-strip__item--fixture"
		title="Deterministic synthetic series — never a live feed"
	>
		<span class="tos-dot tos-dot--fixture" aria-hidden="true"></span>
		<span class="visually-hidden">Data health: </span>
		Fixture data — not live
	</span>
	<button
		type="button"
		class="tos-strip__palette"
		onclick={onOpenPalette}
		aria-label="Open command palette (Control K)"
	>
		{shortcutLabel}
	</button>
</header>

<style>
	.tos-strip {
		display: flex;
		align-items: center;
		gap: calc(var(--tos-unit) * 3);
		padding: 0 calc(var(--tos-unit) * 3);
		height: 42px;
		background: var(--tos-surface-raised);
		border-bottom: 1px solid var(--tos-border);
		flex: 0 0 auto;
	}

	.tos-strip__brand {
		font-weight: 700;
		font-size: 0.88rem;
		letter-spacing: 0.02em;
		color: var(--tos-accent);
		white-space: nowrap;
	}

	.tos-strip__item {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--tos-unit));
		font-size: 0.76rem;
		color: var(--tos-text);
		white-space: nowrap;
	}

	.tos-strip__item--context {
		color: var(--tos-text-muted);
	}

	.tos-strip__k {
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--tos-text-muted);
	}

	.tos-strip__mono {
		font-family: var(--tos-font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--tos-text);
	}

	.tos-strip__spacer {
		flex: 1;
	}

	.tos-strip__item--status {
		color: var(--tos-text-muted);
	}

	.tos-strip__item--save {
		color: var(--tos-text-muted);
		font-size: 0.72rem;
	}

	.tos-strip__item--save-failed {
		color: var(--tos-warning);
	}

	.tos-dot--save-saving {
		background: var(--tos-accent);
	}

	.tos-dot--save-saved {
		background: var(--tos-text-muted);
		opacity: 0.6;
	}

	.tos-dot--save-failed {
		background: var(--tos-warning);
	}

	.tos-strip__item--fixture {
		color: var(--tos-warning);
		font-size: 0.72rem;
	}

	.tos-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		display: inline-block;
	}

	.tos-dot--idle {
		background: var(--tos-text-muted);
		opacity: 0.6;
	}

	.tos-dot--fixture {
		background: var(--tos-warning);
	}

	.tos-strip__palette {
		margin-left: calc(var(--tos-unit) * 2);
		background: var(--tos-bg);
		color: var(--tos-text-muted);
		border: 1px solid var(--tos-border);
		border-radius: 5px;
		font-family: var(--tos-font-mono);
		font-size: 0.72rem;
		padding: 0.22rem 0.55rem;
		cursor: pointer;
	}

	.tos-strip__palette:hover {
		color: var(--tos-text);
		border-color: var(--tos-accent);
	}

	.tos-strip__palette:focus-visible {
		outline: 2px solid var(--tos-focus);
		outline-offset: 1px;
	}

	@media (max-width: 860px) {
		.tos-strip__item--context {
			display: none;
		}
	}

	@media (max-width: 560px) {
		.tos-strip {
			gap: calc(var(--tos-unit) * 2);
			padding: 0 calc(var(--tos-unit) * 2);
		}
		.tos-strip__item--fixture {
			display: none;
		}
		.tos-strip__item--save {
			font-size: 0.68rem;
		}
	}
</style>
