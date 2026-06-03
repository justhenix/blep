<script lang="ts">
	import { page } from '$app/state';
	import { spring } from 'svelte/motion';
	import { theme } from '$lib/theme.svelte';

	type FooterLink = {
		label: string;
		href: string;
	};

	const footerPrimaryLinks: FooterLink[] = [
		{ label: 'Flow', href: '#flow' },
		{ label: 'FAQ', href: '#faq' },
		{ label: 'Contact', href: 'https://x.com/heni0x' }
	];

	const footerLegalLinks: FooterLink[] = [
		{ label: 'Privacy Policy', href: '/privacy' },
		{ label: 'Terms', href: '/terms' }
	];

	let footerInView = $state(false);
	let footerRef = $state<HTMLElement | null>(null);

	const footerEyeOffset = spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.08,
			damping: 0.75
		}
	);

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	const toLandingHref = (href: string) => (page.route.id === '/' ? href : `/${href}`);

	const toHref = (href: string) => {
		if (href.startsWith('#')) return toLandingHref(href);
		return href;
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!footerInView || !footerRef) {
			footerEyeOffset.set({ x: 0, y: 0 });
			return;
		}

		const rect = footerRef.getBoundingClientRect();
		const pivotX = rect.left + rect.width * 0.205;
		const pivotY = rect.top + rect.height * 0.555;
		const fx = ((e.clientX - pivotX) / rect.width) * 42;
		const fy = ((e.clientY - pivotY) / rect.height) * 34;

		footerEyeOffset.set({
			x: clamp(fx, -14, 14),
			y: clamp(fy, -12, 12)
		});
	};

	$effect(() => {
		if (!footerRef || typeof IntersectionObserver === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				footerInView = entry?.isIntersecting ?? false;
				if (!footerInView) footerEyeOffset.set({ x: 0, y: 0 });
			},
			{ threshold: 0.15 }
		);

		observer.observe(footerRef);

		return () => observer.disconnect();
	});
</script>

<svelte:window onmousemove={handleMouseMove} />

<footer class="blep-footer" aria-labelledby="footer-title" bind:this={footerRef}>
	<h2 id="footer-title" class="sr-only">Footer</h2>

	<nav class="blep-footer__links" aria-label="Footer">
		<div class="blep-footer__col blep-footer__locale">
			<button
				class="footer-link focus-visible-ring"
				type="button"
				onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
			>
				<svg
					class="blep-footer__locale-arrow"
					viewBox="0 0 24 24"
					aria-hidden="true"
					focusable="false"
				>
					<path
						d="M12 19V5m0 0-5 5m5-5 5 5"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2.25"
					/>
				</svg>
				<span>Top</span>
			</button>
		</div>

		<div class="blep-footer__col">
			{#each footerPrimaryLinks as link (link.label)}
				<a
					class="footer-link focus-visible-ring"
					href={toHref(link.href)}
					target={link.href.startsWith('http') ? '_blank' : null}
					rel={link.href.startsWith('http') ? 'noopener noreferrer' : null}
				>
					{link.label}
				</a>
			{/each}
		</div>

		<div class="blep-footer__col">
			{#each footerLegalLinks as link (link.label)}
				<a class="footer-link focus-visible-ring" href={toHref(link.href)}>{link.label}</a>
			{/each}
		</div>
	</nav>

	<button class="blep-footer__logo-wrap" type="button" aria-label="BLEP mascot">
		{#if theme.resolved === 'light'}
			<img
				class="blep-footer__logo"
				src="/logo-full-main.svg"
				alt=""
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<img
				class="blep-footer__logo"
				src="/logo-full-white.svg"
				alt=""
				loading="lazy"
				decoding="async"
			/>
		{/if}
		<svg
			class="blep-footer__logo-eyes"
			viewBox="0 0 1440 442.5"
			role="presentation"
			focusable="false"
		>
			<g class="blep-footer-eye-mask">
				<polygon
					points="340.546875 253.601562 311.574219 260.203125 310.148438 225.328125 339.117188 218.726562"
				/>
				<polygon
					points="280.59375 266.980469 251.625 273.582031 250.199219 238.710938 279.167969 232.109375"
				/>
			</g>
			<g
				class="blep-footer-eye-track"
				style="transform: translate({footerInView ? $footerEyeOffset.x : 0}px, {footerInView
					? $footerEyeOffset.y
					: 0}px);"
			>
				<g class="blep-footer-face" aria-hidden="true">
					<polygon
						class="blep-footer-eye"
						points="340.546875 253.601562 311.574219 260.203125 310.148438 225.328125 339.117188 218.726562"
					/>
					<polygon
						class="blep-footer-eye"
						points="280.59375 266.980469 251.625 273.582031 250.199219 238.710938 279.167969 232.109375"
					/>
				</g>
			</g>
		</svg>
	</button>
</footer>

<style>
	/* ── Footer ── */
	.blep-footer {
		--footer-bg: var(--color-paper);
		--footer-ink: var(--color-ink);
		--footer-max: 75rem;
		--footer-pad-x: clamp(1.25rem, 5vw, 6rem);
		--footer-pad-top: clamp(4.5rem, 12vh, 10rem);
		--footer-link-size: clamp(1.2rem, 1.45vw, 1.75rem);
		--footer-logo-pad: clamp(0.75rem, 1.8vw, 2rem);
		position: relative;
		overflow: hidden;
		min-height: 100svh;
		border-top: 1px solid rgba(17, 17, 17, 0.2);
		background: var(--footer-bg);
		color: var(--footer-ink);
		isolation: isolate;
	}

	.blep-footer__links {
		position: relative;
		z-index: 2;
		display: grid;
		grid-template-columns: minmax(7.5rem, 1fr) minmax(12rem, 1fr) minmax(13rem, 1fr);
		align-items: start;
		gap: clamp(3rem, 12vw, 13.75rem);
		max-width: var(--footer-max);
		padding: var(--footer-pad-top) var(--footer-pad-x) 0;
	}

	.blep-footer__col {
		display: grid;
		align-content: start;
		gap: 0.65rem;
	}

	.footer-link {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		width: fit-content;
		color: currentColor;
		font-family: var(--font-display);
		font-size: var(--footer-link-size);
		font-weight: 600;
		line-height: 1.12;
		letter-spacing: 0.01em;
		text-decoration: underline;
		text-decoration-thickness: 0.075em;
		text-underline-offset: 0.16em;
	}

	.footer-link:hover,
	.footer-link:focus-visible {
		text-decoration-thickness: 0.12em;
	}

	.blep-footer__locale-arrow {
		width: 0.9em;
		height: 0.9em;
		flex: 0 0 auto;
		transform: translateY(-0.02em);
	}

	.blep-footer__logo-wrap {
		position: absolute;
		left: 50%;
		bottom: var(--footer-logo-pad);
		z-index: 1;
		width: calc(100vw - (var(--footer-logo-pad) * 2));
		border: 0;
		background: transparent;
		padding: 0;
		transform: translateX(-50%);
		cursor: pointer;
		pointer-events: auto;
	}

	.blep-footer__logo {
		width: 100%;
		height: auto;
		margin: 0;
		padding: 0;
	}

	.blep-footer__logo-eyes {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.blep-footer-eye-track,
	.blep-footer-eye,
	.blep-footer-eye-mask {
		transform-box: fill-box;
		transform-origin: center;
	}

	.blep-footer-eye-track {
		transition: transform 180ms ease-out;
	}

	.blep-footer-eye-mask polygon {
		fill: var(--color-paper);
		stroke: var(--color-paper);
		stroke-width: 26;
		stroke-linejoin: miter;
	}

	.blep-footer-eye {
		fill: var(--color-ink);
		stroke: var(--color-ink);
		stroke-width: 7;
		stroke-linejoin: miter;
	}

	/* ── Utility ── */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.blep-footer {
			min-height: 82svh;
		}

		.blep-footer__links {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}

		.blep-footer__locale {
			grid-column: 1 / -1;
		}
	}
</style>
