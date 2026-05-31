<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import '../app.css';

	let { children } = $props();

	const isAppRoute = $derived(page.url.pathname.startsWith('/app'));

	afterNavigate((navigation) => {
		// Instantly scroll to top on route change (unless going to a hash anchor)
		if (!navigation.to?.url.hash) {
			const originalScrollBehavior = document.documentElement.style.scrollBehavior;
			document.documentElement.style.scrollBehavior = 'auto'; // Disable smooth scroll
			window.scrollTo(0, 0);
			
			// Restore original scroll behavior after the jump
			setTimeout(() => {
				document.documentElement.style.scrollBehavior = originalScrollBehavior;
			}, 10);
		}
	});
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
