<script lang="ts">
	// Global layout: imports the design-token layer and the canonical
	// renderer theme once, and renders the routed page inside the shell.
	import '@victframework/renderer-svelte/theme.css';
	import '$lib/styles/tokens.css';
	import '$lib/styles/shell.css';
	let { children } = $props();
</script>

{@render children()}
