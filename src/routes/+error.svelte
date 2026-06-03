<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { theme } from '$lib/theme.svelte';

	const ERROR_LOGOS: Record<number, string> = {
		400: '/logo-black-400.svg',
		401: '/logo-black-401.svg',
		403: '/logo-black-403.svg',
		404: '/logo-black-404.svg',
		429: '/logo-black-429.svg',
		500: '/logo-black-500.svg',
		503: '/logo-black-503.svg'
	};

	const ERROR_LOGOS_DARK: Record<number, string> = {
		400: '/logo-w-400.svg',
		401: '/logo-w-401.svg',
		403: '/logo-w-403.svg',
		404: '/logo-w-404.svg',
		429: '/logo-w-429.svg',
		500: '/logo-w-500.svg',
		503: '/logo-w-503.svg'
	};

	const ROASTS: Record<number, string> = {
		400: `Bad request. BLEP didn't understand that junk.`,
		401: `BLEP doesn't know who you are. Identify yourself first.`,
		403: `BLEP doesn't let strangers in. Earn access or go home.`,
		404: `This page doesn't exist. BLEP checked. Twice.`,
		429: `Slow down. BLEP is completely out of breath.`,
		500: `Something broke inside. Even BLEP is confused.`,
		503: `BLEP is temporarily out of service. Try again later.`
	};

	const STATUS_LABELS: Record<number, string> = {
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		404: 'Not Found',
		429: 'Too Many Requests',
		500: 'Internal Error',
		503: 'Service Unavailable'
	};

	const status = $derived(page.status);
	const message = $derived(page.error?.message || STATUS_LABELS[status] || 'Unknown Error');
	const logo = $derived(ERROR_LOGOS[status] || ERROR_LOGOS[404]);
	const logoDark = $derived(ERROR_LOGOS_DARK[status] || ERROR_LOGOS_DARK[404]);
	const roast = $derived(ROASTS[status] || `BLEP has no words for this. That's rare.`);
	const label = $derived(STATUS_LABELS[status] || `Error ${status}`);
</script>

<svelte:head>
	<title>{status} · {label} · BLEP</title>
	<meta name="description" content="BLEP error page — {status} {label}" />
</svelte:head>

<main class="error-page">
	<div class="error-inner">
		{#if theme.resolved === 'light'}
			<img class="error-logo" src={logo} alt="BLEP {status}" />
		{:else}
			<img class="error-logo" src={logoDark} alt="BLEP {status}" />
		{/if}

		<div class="error-copy">
			<p class="error-label">{label}</p>
			<p class="error-roast">{roast}</p>
			{#if message && message !== label}
				<p class="error-detail">{message}</p>
			{/if}
			<a class="error-cta focus-visible-ring" href={base || '/'}>← Back to safety</a>
		</div>
	</div>
</main>

<style>
	.error-page {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem 1.5rem;
		min-height: calc(100svh - var(--nav-height, 72px));
		box-sizing: border-box;
	}

	.error-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(48px, 6vw, 80px);
		max-width: 80rem;
		width: 100%;
	}

	.error-logo {
		flex-shrink: 0;
		width: clamp(320px, 34vw, 560px);
		height: auto;
		opacity: 0.92;
	}

	.error-copy {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 420px;
		width: 100%;
		text-align: left;
	}

	.error-label {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 3.5vw, 3.2rem);
		letter-spacing: -0.03em;
		line-height: 1.05;
		margin: 0;
		color: var(--color-ink);
	}

	.error-roast {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: clamp(0.95rem, 1.1vw, 1.15rem);
		line-height: 1.5;
		margin: 0;
		color: color-mix(in oklab, var(--color-ink) 60%, transparent);
	}

	.error-detail {
		font-family: var(--font-body);
		font-size: 0.85rem;
		line-height: 1.4;
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: color-mix(in oklab, var(--color-ink) 4%, transparent);
		border-left: 3px solid var(--color-ink);
		color: color-mix(in oklab, var(--color-ink) 55%, transparent);
	}

	.error-cta {
		display: inline-flex;
		align-items: center;
		margin-top: 0.75rem;
		padding: 0.6rem 1.4rem;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.9rem;
		letter-spacing: 0.01em;
		color: var(--color-paper);
		background: var(--color-ink);
		border: 1px solid var(--color-ink);
		text-decoration: none;
		transition:
			background 0.15s,
			color 0.15s;
		width: fit-content;
	}

	.error-cta:hover {
		background: var(--color-paper);
		color: var(--color-ink);
	}

	/* ---- responsive: stack on medium/small screens ---- */
	@media (max-width: 860px) {
		.error-inner {
			flex-direction: column;
			text-align: center;
			gap: 2.5rem;
		}

		.error-logo {
			width: min(78vw, 360px);
		}

		.error-copy {
			align-items: center;
			text-align: center;
			max-width: 100%;
		}

		.error-label {
			font-size: clamp(1.8rem, 5.5vw, 2.5rem);
		}

		.error-roast {
			font-size: 1rem;
		}

		.error-detail {
			border-left: none;
			border-top: 3px solid var(--color-ink);
			padding-top: 0.75rem;
		}
	}
</style>
