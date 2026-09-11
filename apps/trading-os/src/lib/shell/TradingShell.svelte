<script lang="ts">
	/**
	 * TradingShell — the product-owned composition root around the canonical
	 * public VICT renderer (`VitApp`).
	 *
	 * VICT remains responsible for navigation, screens, regions, standard
	 * surfaces, and declared safe states, rendered entirely from the compiled
	 * Application Plan. TradingShell owns the persistent product chrome:
	 * identity, context strip, command palette, and the responsive shell
	 * composition. Product state and services reach the chrome and the
	 * custom trading surfaces through Svelte context provided HERE and
	 * validated at registration time — no global mutable singleton, no
	 * renderer internals copied, no DOM/CSS hiding of VICT navigation.
	 */
	import { setContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { VitApp } from '@victframework/renderer-svelte';
	import type { ActionResult } from '@victframework/renderer-svelte';
	import { createComponentRegistry } from '@victframework/application/renderer';
	import type { ApplicationPlan } from '@victframework/application';
	import type { WorkspaceInstance } from '@trading-os/trading-domain';
	import {
		registerTradingSurfaces,
		TRADING_SERVICES_CONTEXT_KEY
	} from '@trading-os/trading-surfaces';
	import { compileAppPlan } from '$lib/application/definition';
	import { createAppServices } from '$lib/services.svelte';
	import ContextStrip from '$lib/shell/ContextStrip.svelte';
	import CommandPalette from '$lib/shell/CommandPalette.svelte';

	interface Props {
		data: { plan: Record<string, unknown>; workspace: WorkspaceInstance };
	}
	let { data }: Props = $props();

	// One services instance per shell instance (created from the persisted
	// workspace loaded server-side; client state takes over after hydration).
	// Capturing the INITIAL loaded workspace here is intentional: the shell
	// seeds once per mount, and the client workspace state owns the session
	// from then on.
	// svelte-ignore state_referenced_locally
	const services = createAppServices(data.workspace);
	setContext(TRADING_SERVICES_CONTEXT_KEY, services);
	onMount(() => {
		void services.evaluation?.load();
		return () => services.evaluation?.dispose();
	});

	// The compiled plan: one source of truth for the renderer AND the
	// command palette. Compilation is deterministic (stable application
	// version), browser-safe, and happens per shell instance.
	const plan: ApplicationPlan = compileAppPlan();

	const registry = createComponentRegistry('registry.trading-os', '1');
	registerTradingSurfaces(registry, services);

	async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
		const response = await fetch('/api/act', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ actionId, input })
		});
		return (await response.json()) as ActionResult;
	}

	let paletteOpen = $state(false);

	function openPalette(): void {
		paletteOpen = true;
	}

	function closePalette(): void {
		paletteOpen = false;
	}

	function onShellKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}

	const workspaceState = $derived(services.workspace.state);
	function protectUnsavedMethod(event: BeforeUnloadEvent): void {
		const methods = services.methods;
		if (methods?.dirty || methods?.state === 'saving' || methods?.state === 'conflict') {
			event.preventDefault();
			event.returnValue = '';
		}
	}
</script>

<svelte:window
	onkeydown={onShellKeydown}
	onpagehide={() => services.workspace.flush()}
	onbeforeunload={protectUnsavedMethod}
/>

<div
	class="tos-shell"
	data-tos-layout={workspaceState.layoutPreset}
	data-tos-watchlist={workspaceState.watchlistVisible ? 'on' : 'off'}
>
	<ContextStrip {services} onOpenPalette={openPalette} />
	<div class="tos-host">
		<VitApp
			{plan}
			{registry}
			{dispatch}
			path={page.url.pathname}
			navigate={(path) => void goto(path)}
			onInvalidate={() => void invalidateAll()}
		/>
	</div>
	{#if paletteOpen}
		<CommandPalette {plan} {services} onClose={closePalette} />
	{/if}
</div>
