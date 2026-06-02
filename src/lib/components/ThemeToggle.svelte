<script lang="ts">
	import { theme, type Theme } from '$lib/theme.svelte';
	import { onMount } from 'svelte';

	let open = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let buttonRef = $state<HTMLButtonElement | null>(null);

	const setTheme = (t: Theme) => {
		theme.setTheme(t);
		open = false;
	};

	const toggle = () => (open = !open);

	onMount(() => {
		const handleClick = (e: MouseEvent) => {
			if (
				open &&
				menuRef &&
				buttonRef &&
				!menuRef.contains(e.target as Node) &&
				!buttonRef.contains(e.target as Node)
			) {
				open = false;
			}
		};
		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	});
</script>

<div class="relative inline-block text-left">
	<button
		bind:this={buttonRef}
		class="focus-visible-ring flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-ink/15 bg-paper text-ink transition-colors hover:bg-ink hover:text-paper"
		onclick={toggle}
		aria-label="Toggle theme"
		aria-expanded={open}
		aria-haspopup="true"
		type="button"
	>
		{#if theme.resolved === 'light'}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-5 w-5"
			>
				<circle cx="12" cy="12" r="4"></circle>
				<path d="M12 2v2"></path>
				<path d="M12 20v2"></path>
				<path d="m4.93 4.93 1.41 1.41"></path>
				<path d="m17.66 17.66 1.41 1.41"></path>
				<path d="M2 12h2"></path>
				<path d="M20 12h2"></path>
				<path d="m6.34 17.66-1.41 1.41"></path>
				<path d="m19.07 4.93-1.41 1.41"></path>
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="h-4.5 w-4.5"
			>
				<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
			</svg>
		{/if}
	</button>

	{#if open}
		<div
			bind:this={menuRef}
			class="absolute right-0 z-50 mt-2 w-32 origin-top-right border border-ink/25 bg-paper py-1 shadow-[4px_4px_0_0_rgba(17,17,17,1)] outline-none dark:shadow-[4px_4px_0_0_rgba(251,250,246,0.3)]"
			role="menu"
			aria-orientation="vertical"
			tabindex="-1"
		>
			<button
				class="block w-full cursor-pointer px-4 py-2 text-left font-display text-sm font-semibold text-ink hover:bg-ink/10 {theme.preference ===
				'light'
					? 'bg-ink/10'
					: ''}"
				role="menuitem"
				onclick={() => setTheme('light')}
			>
				Light
			</button>
			<button
				class="block w-full cursor-pointer px-4 py-2 text-left font-display text-sm font-semibold text-ink hover:bg-ink/10 {theme.preference ===
				'dark'
					? 'bg-ink/10'
					: ''}"
				role="menuitem"
				onclick={() => setTheme('dark')}
			>
				Dark
			</button>
			<button
				class="block w-full cursor-pointer px-4 py-2 text-left font-display text-sm font-semibold text-ink hover:bg-ink/10 {theme.preference ===
				'system'
					? 'bg-ink/10'
					: ''}"
				role="menuitem"
				onclick={() => setTheme('system')}
			>
				System
			</button>
		</div>
	{/if}
</div>
