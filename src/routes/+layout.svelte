<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import '../app.css';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col bg-paper text-ink selection:bg-ink selection:text-paper">
	<Header />
	{@render children()}
	<Footer />
</div>
