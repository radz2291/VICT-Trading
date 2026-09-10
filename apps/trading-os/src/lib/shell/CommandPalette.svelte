<script lang="ts">
	/**
	 * The Trading OS command palette (Ctrl+K / Cmd+K).
	 *
	 * Navigation commands are DERIVED FROM THE COMPILED APPLICATION PLAN —
	 * the same plan the renderer renders — so route identity and labels have
	 * exactly one source of truth. There is no second, hardcoded route
	 * registry anywhere in the product. Layout and workspace commands invoke
	 * real T1 behavior through the workspace service.
	 *
	 * Accessibility: modal dialog pattern with combobox/listbox semantics,
	 * roving active option, Escape to close, and focus restoration to the
	 * invoking element.
	 */
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ApplicationPlan } from '@victframework/application';
	import type { TradingServices } from '@trading-os/trading-surfaces';
	import { WORKSPACE_LAYOUT_PRESETS } from '@trading-os/trading-domain';

	let {
		plan,
		services,
		onClose
	}: {
		plan: ApplicationPlan;
		services: TradingServices;
		onClose: () => void;
	} = $props();

	const PRESET_LABELS: Record<string, string> = {
		'chart-focus': 'Chart focus',
		balanced: 'Balanced',
		inspect: 'Inspect'
	};

	interface Command {
		readonly id: string;
		readonly label: string;
		readonly group: string;
		readonly hint: string;
		run(): void;
	}

	function buildCommands(svc: TradingServices): Command[] {
		// 1. Navigation commands from the compiled plan (single source of truth).
		const navigation: Command[] = plan.routes
			.filter((entry) => entry.route.nav !== undefined && entry.screen !== null)
			.map((entry) => ({
				id: `nav:${entry.route.id}`,
				label: entry.route.nav?.label ?? entry.route.id,
				group: entry.route.nav?.group ?? 'Go',
				hint: entry.route.path,
				run: () => {
					void goto(entry.route.path);
				}
			}));
		// 2. Real workspace commands (persisted layout + panel visibility).
		const layouts: Command[] = WORKSPACE_LAYOUT_PRESETS.map((preset) => ({
			id: `layout:${preset}`,
			label: `Layout: ${PRESET_LABELS[preset] ?? preset}`,
			group: 'Workspace',
			hint: 'persisted',
			run: () => {
				svc.workspace.setLayoutPreset(preset);
			}
		}));
		const watchlist: Command = {
			id: 'watchlist:toggle',
			label: svc.workspace.state.watchlistVisible ? 'Hide watchlist' : 'Show watchlist',
			group: 'Workspace',
			hint: 'persisted',
			run: () => {
				svc.workspace.setWatchlistVisible(!svc.workspace.state.watchlistVisible);
			}
		};
		return [...navigation, ...layouts, watchlist];
	}

	const commands = $derived(buildCommands(services));

	let query = $state('');
	let activeIndex = $state(0);
	let inputElement = $state<HTMLInputElement | null>(null);
	let listElement = $state<HTMLUListElement | null>(null);
	// The invoking element is captured at component initialisation (before the
	// input takes focus) so closing restores the trader's exact location.
	const previousFocus = typeof document !== 'undefined' ? document.activeElement : null;

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (needle.length === 0) {
			return commands;
		}
		return commands.filter((command) =>
			`${command.group} ${command.label} ${command.hint}`.toLowerCase().includes(needle)
		);
	});

	$effect(() => {
		if (activeIndex >= filtered.length) {
			activeIndex = Math.max(0, filtered.length - 1);
		}
	});

	$effect(() => {
		void tick().then(() => inputElement?.focus());
		return () => {
			if (previousFocus instanceof HTMLElement) {
				previousFocus.focus();
			}
		};
	});

	function reset(): void {
		activeIndex = 0;
	}

	function runCommand(command: Command | undefined): void {
		if (command === undefined) {
			return;
		}
		command.run();
		onClose();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onClose();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
			void scrollActiveIntoView();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
			void scrollActiveIntoView();
		} else if (event.key === 'Home') {
			event.preventDefault();
			activeIndex = 0;
			void scrollActiveIntoView();
		} else if (event.key === 'End') {
			event.preventDefault();
			activeIndex = Math.max(filtered.length - 1, 0);
			void scrollActiveIntoView();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			runCommand(filtered[activeIndex]);
		} else if (event.key === 'Tab') {
			// Keep focus inside the dialog: Tab behaves like ArrowDown.
			event.preventDefault();
			activeIndex = event.shiftKey
				? Math.max(activeIndex - 1, 0)
				: Math.min(activeIndex + 1, filtered.length - 1);
			void scrollActiveIntoView();
		}
	}

	async function scrollActiveIntoView(): Promise<void> {
		await tick();
		const active = listElement?.querySelector('[aria-selected="true"]');
		active?.scrollIntoView({ block: 'nearest' });
	}

	function onBackdropMousedown(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<div class="palette-backdrop" onmousedown={onBackdropMousedown} role="presentation">
	<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
		<input
			class="palette__input"
			type="text"
			role="combobox"
			aria-expanded={filtered.length > 0}
			aria-controls="tos-palette-list"
			aria-activedescendant={filtered[activeIndex] !== undefined
				? `tos-command-${activeIndex}`
				: undefined}
			aria-autocomplete="list"
			placeholder="Search commands…"
			aria-label="Search commands"
			bind:this={inputElement}
			bind:value={query}
			oninput={reset}
			onkeydown={handleKeydown}
		/>
		<ul
			class="palette__list"
			id="tos-palette-list"
			role="listbox"
			aria-label="Commands"
			bind:this={listElement}
		>
			{#each filtered as command, index (command.id)}
				<!-- Combobox/listbox pattern: keyboard operation is owned by the input
				     (ArrowUp/Down/Enter/Escape + aria-activedescendant). The click
				     handler is pointer-only convenience; svelte-check requires the
				     explicit ignore (eslint's equivalent rule does not fire). -->
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<li
					id={`tos-command-${index}`}
					role="option"
					class="palette__option"
					class:is-active={index === activeIndex}
					aria-selected={index === activeIndex}
					onclick={() => runCommand(command)}
					onmousemove={() => (activeIndex = index)}
				>
					<span class="palette__option-label">{command.label}</span>
					<span class="palette__option-group">{command.group}</span>
					<span class="palette__option-hint">{command.hint}</span>
				</li>
			{:else}
				<li class="palette__empty" role="status">No matching commands.</li>
			{/each}
		</ul>
		<footer class="palette__foot">↑↓ navigate · Enter run · Esc close</footer>
	</div>
</div>

<style>
	.palette-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(4, 8, 12, 0.62);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 9vh 16px 16px;
		z-index: 100;
	}

	.palette {
		width: min(620px, 100%);
		background: var(--tos-surface-raised, #1b232e);
		border: 1px solid var(--tos-border, #2a3340);
		border-radius: 10px;
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.palette__input {
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--tos-border, #2a3340);
		color: var(--tos-text, #e8edf2);
		font: inherit;
		font-size: 0.95rem;
		padding: 0.8rem 1rem;
	}

	.palette__input:focus-visible {
		outline: none;
	}

	.palette__input::placeholder {
		color: var(--tos-text-muted, #97a3ae);
	}

	.palette__list {
		list-style: none;
		margin: 0;
		padding: 0.3rem;
		max-height: 46vh;
		overflow-y: auto;
	}

	.palette__option {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: baseline;
		gap: calc(var(--tos-unit, 6px) * 3);
		padding: 0.5rem 0.7rem;
		border-radius: 6px;
		cursor: pointer;
	}

	.palette__option.is-active {
		background: color-mix(in srgb, var(--tos-accent, #d29922) 18%, transparent);
	}

	.palette__option-label {
		color: var(--tos-text, #e8edf2);
		font-size: 0.88rem;
	}

	.palette__option-group {
		color: var(--tos-accent, #d29922);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}

	.palette__option-hint {
		color: var(--tos-text-muted, #97a3ae);
		font-family: var(--tos-font-mono, ui-monospace, monospace);
		font-size: 0.72rem;
	}

	.palette__empty {
		padding: 0.9rem;
		color: var(--tos-text-muted, #97a3ae);
		font-size: 0.85rem;
	}

	.palette__foot {
		padding: 0.45rem 1rem;
		border-top: 1px solid var(--tos-border, #2a3340);
		color: var(--tos-text-muted, #97a3ae);
		font-size: 0.68rem;
	}
</style>
