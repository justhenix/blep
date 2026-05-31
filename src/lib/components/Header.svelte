<script lang="ts">
	import { page } from '$app/state';

	type NavLink = {
		label: string;
		href: string;
	};

	const navLinks: NavLink[] = [
		{ label: 'How it works', href: '#how-it-works' },
		{ label: 'Demo', href: '#demo' },
		{ label: 'Why BLEP', href: '#why-blep' }
	];

	const toLandingHref = (href: string) => (page.route.id === '/' ? href : `/${href}`);
</script>

<header
	class="sticky top-0 z-50 border-b border-ink/15 bg-paper/95 backdrop-blur"
	aria-label="Site header"
>
	<nav
		class="mx-auto flex w-full max-w-300 items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8"
		aria-label="Main"
	>
		<a class="focus-visible-ring flex shrink-0 items-center" href="/" aria-label="BLEP home">
			<img class="h-6 w-auto sm:h-7" src="/logo-full-main.svg" alt="BLEP" />
		</a>

		<div class="hidden items-center gap-8 md:flex" aria-label="Landing sections">
			<ul class="flex items-center gap-8">
				{#each navLinks as link (link.label)}
					<li>
						<a class="nav-link focus-visible-ring" href={toLandingHref(link.href)}>
							<span>{link.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>

		<a
			class="focus-visible-ring inline-flex min-h-10 items-center border border-ink bg-ink px-4 font-display text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-white hover:text-ink"
			href="/app"
		>
			Ask BLEP
		</a>
	</nav>
</header>

<style>
	.nav-link {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: rgb(17 17 17 / 0.72);
		text-decoration: underline;
		text-decoration-thickness: 0.075em;
		text-underline-offset: 0.16em;
	}

	.nav-link:hover,
	.nav-link:focus-visible {
		color: var(--color-ink);
		text-decoration-thickness: 0.12em;
	}
</style>
