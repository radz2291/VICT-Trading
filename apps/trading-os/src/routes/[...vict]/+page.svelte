<script lang="ts">
	// The GENERIC application host page: the only page shell this application
	// will ever need. Everything visible is rendered from the neutral plan
	// inside the product-owned TradingShell composition root.
	import TradingShell from '$lib/shell/TradingShell.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Trading OS</title>
	<meta name="color-scheme" content="dark" />
</svelte:head>

<TradingShell {data} />
