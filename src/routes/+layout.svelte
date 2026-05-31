<script lang="ts">
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import '../app.css';

	let { children } = $props();

	const isAppRoute = $derived(page.url.pathname.startsWith('/app'));
</script>

{#if isAppRoute}
	<div class="bg-paper text-ink selection:bg-ink selection:text-paper">
		{@render children()}
	</div>
{:else}
	<div class="flex min-h-screen flex-col bg-paper text-ink selection:bg-ink selection:text-paper">
		<Header />
		{@render children()}
		<Footer />
	</div>
{/if}
