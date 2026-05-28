<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';

	let { children } = $props();
</script>

{@render children()}

<footer class="bg-neutral-100 px-4 pb-6 text-black sm:px-6 lg:px-8">
	<nav
		class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 border-t-4 border-black pt-4 font-mono text-xs"
		aria-label="Footer"
	>
		<a class="font-black underline decoration-2 underline-offset-4" href={resolve('/')}>BLEP</a>
		<a class="underline decoration-2 underline-offset-4" href={resolve('/privacy')}>Privacy</a>
		<a class="underline decoration-2 underline-offset-4" href={resolve('/terms')}>Terms</a>
		<span class="ml-auto">hackathon demo</span>
	</nav>
</footer>
