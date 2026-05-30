<script lang="ts">
	import { page } from '$app/state';
</script>

<header
	class="sticky top-0 z-50 border-b border-ink/15 bg-paper/95 backdrop-blur"
	aria-label="Site header"
>
	<nav
		class="mx-auto flex w-full max-w-300 items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8"
		aria-label="Main"
	>
		<a
			class="focus-visible-ring flex shrink-0 items-center"
			href={page.route.id === '/' ? '#top' : '/#top'}
			aria-label="BLEP home"
		>
			<img class="h-6 w-auto sm:h-7" src="/logo-full-main.svg" alt="BLEP" />
		</a>

		<div class="hidden items-center gap-8 font-display text-sm font-semibold text-ink/70 md:flex">
			<a class="nav-link" href={page.route.id === '/' ? '#how' : '/#how'}>How it works</a>
			<a class="nav-link" href={page.route.id === '/' ? '#demo' : '/#demo'}>Demo</a>
			<a class="nav-link" href={page.route.id === '/' ? '#why' : '/#why'}>Why BLEP</a>
		</div>

		<a
			class="focus-visible-ring inline-flex min-h-10 items-center border border-ink bg-ink px-4 font-display text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-white hover:text-ink"
			href={page.route.id === '/' ? '#demo' : '/#demo'}
		>
			Ask BLEP
		</a>
	</nav>
</header>

<style>
	.nav-link {
		font-family: var(--font-display);
		font-weight: 600;
		letter-spacing: 0.01em;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.25rem;
		text-decoration-color: transparent;
	}

	.nav-link:hover {
		color: var(--color-ink);
		text-decoration-color: currentColor;
	}
</style>
