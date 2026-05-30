<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { spring } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import RecommendationCard from '$lib/components/RecommendationCard.svelte';
	import { detectBlepIntent, type BlepIntent } from '$lib/blep/intent';
	import type { BlepPhase1Output, BlepScanResponse } from '$lib/blep/types';

	type DemoPhase = 'idle' | 'running' | 'done';
	type ScanMode = BlepScanResponse['mode'];

	const demoLogs = [
		'[blep checking specs...]',
		'[blep sniffing seller cope...]',
		'[blep scanning forum thoughts...]',
		'[blep comparing price bracket...]',
		'[blep preparing verdict...]'
	];

	const recommendationLogs = [
		'[blep reading budget...]',
		'[blep hunting same-price alternatives...]',
		'[blep scanning forum thoughts...]',
		'[blep rejecting rgb traps...]',
		'[blep checking thermals...]',
		'[blep building shortlist...]'
	];

	const timelineData = [
		{
			title: 'Capture',
			body: 'Paste messy listing text. BLEP strips the seller fog.'
		},
		{
			title: 'Dissect',
			body: 'It checks component age, heat, repair traps, and real complaints.'
		},
		{
			title: 'Sentence',
			body: 'You get APPROVED, CAUTION, or WASTE. No polite fog.'
		},
		{
			title: 'Press X for Doubt',
			body: 'Still coping? Ask follow-up. BLEP explains why the deal stinks.'
		}
	];

	const traps = [
		{
			title: 'The Fake New Trap',
			body: 'Old parts in a sealed box are still old. BLEP checks hardware age before you buy a slow paperweight.'
		},
		{
			title: 'The Permanent Slowdown',
			body: 'Soldered memory means zero upgrade path. Cute today, painful later.'
		},
		{
			title: 'The Finger Burner',
			body: 'Great specs mean nothing if the chassis hits 95\u00b0C and throttles itself into sadness.'
		}
	];

	let listing = $state('');
	let demoPhase = $state<DemoPhase>('idle');
	let visibleLogs = $state<string[]>([]);
	let scanResult = $state<BlepPhase1Output | null>(null);
	let scanIntent = $state<BlepIntent | null>(null);
	let scanMode = $state<ScanMode | null>(null);
	let scanError = $state<string | null>(null);
	let logTimer: ReturnType<typeof setTimeout> | undefined;
	let activeQuery = '';

	let windowWidth = $state(1024);
	let windowHeight = $state(768);
	let isSquinting = $state(false);
	let isIdle = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	let footerInView = $state(false);
	let footerRef = $state<HTMLElement | null>(null);
	let activeStep = $state(0);
	let stepEls: HTMLElement[] = [];
	let spineEl = $state<HTMLElement | null>(null);
	let indicatorEl = $state<HTMLElement | null>(null);

	const eyeOffset = spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.06,
			damping: 0.7
		}
	);
	const footerEyeOffset = spring(
		{ x: 0, y: 0 },
		{
			stiffness: 0.08,
			damping: 0.75
		}
	);

	const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

	const handleMouseMove = (e: MouseEvent) => {
		// x is inverted because the parent <g> has scale(-1, 1)
		const rx = (e.clientX / windowWidth - 0.5) * -70;
		const ry = (e.clientY / windowHeight - 0.5) * 70;
		eyeOffset.set({ x: rx, y: ry });

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

	const handleMascotClick = () => {
		isSquinting = true;
		setTimeout(() => {
			isSquinting = false;
		}, 800);
	};

	const resetIdleTimer = () => {
		isIdle = false;
		if (idleTimer) clearTimeout(idleTimer);
		// 1 minute idle
		idleTimer = setTimeout(() => {
			isIdle = true;
		}, 60000);
	};

	$effect(() => {
		resetIdleTimer();

		const handleActivity = () => resetIdleTimer();
		const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
		events.forEach((e) => window.addEventListener(e, handleActivity));

		return () => {
			if (idleTimer) clearTimeout(idleTimer);
			events.forEach((e) => window.removeEventListener(e, handleActivity));
		};
	});

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

	// Timeline scroll observer — track which step is closest to viewport center
	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return;

		const visible = new Set<number>();

		const pickClosest = () => {
			if (visible.size === 0) return;
			const mid = window.innerHeight / 2;
			let best = activeStep;
			let bestDist = Infinity;
			for (const idx of visible) {
				const el = stepEls[idx];
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const center = rect.top + rect.height / 2;
				const dist = Math.abs(center - mid);
				if (dist < bestDist) {
					bestDist = dist;
					best = idx;
				}
			}
			activeStep = best;
		};

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const idx = stepEls.indexOf(entry.target as HTMLElement);
					if (idx === -1) continue;
					if (entry.isIntersecting) visible.add(idx);
					else visible.delete(idx);
				}
				pickClosest();
			},
			{ rootMargin: '-40% 0px -40% 0px' }
		);

		for (const el of stepEls) observer.observe(el);

		// Dynamic active indicator top calculation
		const updateIndicatorPosition = () => {
			if (!spineEl || stepEls.length === 0) return;
			const firstStep = stepEls[0];
			const lastStep = stepEls[stepEls.length - 1];
			if (!firstStep || !lastStep) return;

			const spineRect = spineEl.getBoundingClientRect();
			const spineTop = spineRect.top + window.scrollY;

			// We calculate the Y positions of the vertical center of the first and last cards
			const firstStepRect = firstStep.getBoundingClientRect();
			const lastStepRect = lastStep.getBoundingClientRect();

			const yStart = firstStepRect.top + firstStepRect.height / 2 + window.scrollY - spineTop;
			const yEnd = lastStepRect.top + lastStepRect.height / 2 + window.scrollY - spineTop;

			// The indicator follows the exact center of the viewport
			const viewportCenter = window.scrollY + window.innerHeight / 2;
			const centerRelativeToSpine = viewportCenter - spineTop;

			// Clamp it between the first and last step centers
			const targetY = Math.max(yStart, Math.min(centerRelativeToSpine, yEnd));

			if (indicatorEl) {
				indicatorEl.style.top = `${targetY}px`;
			}
		};

		const handleScroll = () => {
			requestAnimationFrame(updateIndicatorPosition);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', handleScroll, { passive: true });

		// Trigger initial calculations after a short delay so layout resolves
		const initialTimeout = setTimeout(updateIndicatorPosition, 100);

		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', handleScroll);
			clearTimeout(initialTimeout);
		};
	});

	const activeLogs = $derived(scanIntent === 'RECOMMENDATION_SCAN' ? recommendationLogs : demoLogs);
	const verdictReady = $derived(demoPhase === 'done');
	const verdictResult = $derived(scanResult?.mode === 'VERDICT' ? scanResult : null);
	const recommendationResult = $derived(scanResult?.mode === 'RECOMMENDATION' ? scanResult : null);
	const needsInputResult = $derived(scanResult?.mode === 'NEEDS_INPUT' ? scanResult : null);
	const comparisonResult = $derived(scanResult?.mode === 'COMPARISON' ? scanResult : null);

	const clearDemoTimer = () => {
		if (!logTimer) return;
		clearTimeout(logTimer);
		logTimer = undefined;
	};

	const finishScan = async () => {
		try {
			const response = await fetch(resolve('/api/scan'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: activeQuery })
			});
			const data = (await response.json()) as Partial<BlepScanResponse> & { error?: string };

			if (!data.result || !data.intent || !data.mode) {
				throw new Error(data.error ?? 'scan_failed');
			}

			scanMode = data.mode;
			scanIntent = data.intent;
			scanResult = data.result;
			scanError = data.ok ? null : (data.error ?? 'Scan returned fallback result.');
		} catch (error) {
			scanResult = null;
			scanError =
				error instanceof Error
					? `BLEP scan failed: ${error.message}`
					: 'BLEP scan failed. Check mock mode or auth.';
		} finally {
			demoPhase = 'done';
		}
	};

	const showLog = (index: number, delay: number) => {
		logTimer = setTimeout(() => {
			const log = activeLogs[index];
			if (!log) {
				void finishScan();
				return;
			}

			visibleLogs = [...visibleLogs, log];

			if (index === activeLogs.length - 1) {
				void finishScan();
				return;
			}

			showLog(index + 1, delay);
		}, delay);
	};

	const applyDemoQuery = (query: string) => {
		if (demoPhase === 'running') return;

		clearDemoTimer();
		listing = query;
		scanIntent = detectBlepIntent(query).intent;
		scanResult = null;
		scanMode = null;
		scanError = null;
		visibleLogs = [];
		demoPhase = 'idle';
	};

	const runDemo = () => {
		if (demoPhase === 'running' || !listing.trim()) return;

		clearDemoTimer();
		activeQuery = listing.trim();
		scanIntent = detectBlepIntent(activeQuery).intent;
		scanResult = null;
		scanMode = null;
		scanError = null;
		visibleLogs = [];
		demoPhase = 'running';

		const prefersReducedMotion =
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		showLog(0, prefersReducedMotion ? 40 : 430);
	};

	onDestroy(() => {
		clearDemoTimer();
	});
</script>

<svelte:head>
	<title>BLEP</title>
	<meta
		name="description"
		content="Paste a listing or ask what to buy. BLEP judges hardware deals against live market reality."
	/>
</svelte:head>

<svelte:window
	bind:innerWidth={windowWidth}
	bind:innerHeight={windowHeight}
	onmousemove={handleMouseMove}
/>

<main class="min-h-screen bg-paper text-ink selection:bg-ink selection:text-paper">
	<header
		class="sticky top-0 z-50 border-b border-ink/15 bg-paper/95 backdrop-blur"
		aria-label="Site header"
	>
		<nav
			class="mx-auto flex w-full max-w-300 items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8"
			aria-label="Main"
		>
			<a class="focus-visible-ring flex shrink-0 items-center" href="#top" aria-label="BLEP home">
				<img class="h-6 w-auto sm:h-7" src="/logo-full-main.svg" alt="BLEP" />
			</a>

			<div class="hidden items-center gap-8 text-sm font-semibold text-ink/70 md:flex font-display">
				<a class="nav-link" href="#how">How it works</a>
				<a class="nav-link" href="#demo">Demo</a>
				<a class="nav-link" href="#why">Why BLEP</a>
			</div>

			<a
				class="focus-visible-ring inline-flex min-h-10 items-center border border-ink bg-ink px-4 text-sm font-display font-semibold tracking-[0.01em] text-white transition hover:bg-white hover:text-ink"
				href="#demo"
			>
				Ask BLEP
			</a>
		</nav>
	</header>

	<!-- ═══════════════ HERO ═══════════════ -->
	<section
		id="top"
		class="flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden border-b border-ink/15 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
	>
		<div
			class="mx-auto grid w-full max-w-300 min-w-0 gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:items-center"
		>
			<div class="relative z-10 max-w-xl min-w-0">
				<h1 class="hero-headline font-display max-w-xl text-balance">Buy less junk.</h1>
				<div class="mt-5 h-px w-full max-w-xs bg-ink/35"></div>
				<p class="hero-copy mt-6 max-w-md text-lg text-ink/70 sm:text-xl">
					Sellers overhype basic toasters. Paste a listing or ask what to buy. BLEP tells you if
					it&apos;s a steal, sketchy, or wallet poison.
				</p>
				<p class="mt-5 font-mono text-sm font-bold text-ink uppercase">
					Approved / Caution / Waste
				</p>

				<div class="mt-8 flex flex-wrap items-center gap-3">
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink bg-ink px-6 text-sm font-display font-semibold tracking-[0.01em] text-white transition hover:bg-white hover:text-ink"
						href="#demo"
					>
						Ask BLEP
					</a>
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink/35 bg-white px-6 text-sm font-display font-semibold tracking-[0.01em] text-ink transition hover:border-ink"
						href="#demo"
					>
						Compare laptops
					</a>
				</div>
			</div>

			<div
				class="poster-stage relative min-h-87.5 w-full min-w-0 overflow-hidden sm:min-h-100 lg:min-h-115"
				role="img"
				aria-label="BLEP cube mascot inside constructivist hardware verdict poster"
			>
				<div
					class="absolute top-[19%] left-[24%] h-52 w-52 rounded-full border border-ink/25 bg-paper"
				></div>
				<div
					class="absolute top-[18%] right-[10%] h-12 w-56 rotate-[-36deg] bg-paper-dark/80"
				></div>
				<div class="absolute top-[18%] left-[12%] h-28 w-48 border border-ink/20"></div>
				<div class="absolute top-[51%] left-[25%] h-px w-[65%] rotate-[-18deg] bg-ink/30"></div>
				<div class="absolute top-[28%] right-[12%] h-px w-[42%] rotate-[-36deg] bg-ink/35"></div>
				<div class="plus-mark top-[31%] left-[12%]"></div>
				<div class="plus-mark right-[10%] bottom-[15%]"></div>
				<span
					class="absolute top-[55%] right-[6%] border border-ink/80 bg-paper px-3 py-1 font-mono text-xs font-bold text-ink uppercase"
				>
					worth check
				</span>
				<p
					class="absolute bottom-[8%] left-[9%] max-w-48 font-mono text-[10px] leading-relaxed font-bold text-ink/55 uppercase"
				>
					Specs. Repairability. Complaints. Price.
				</p>

				<div
					class="absolute inset-0 z-10 mx-auto flex items-center justify-center"
					aria-hidden="true"
				>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<svg
						class="mascot-cube w-[66%] max-w-82.5 cursor-pointer sm:w-[58%] lg:max-w-87.5"
						viewBox="0 0 862.31 902.94"
						onclick={handleMascotClick}
						role="img"
						aria-label="BLEP mascot"
					>
						<g transform="scale(-1, 1) translate(-862.31, 0)">
							<polygon
								class="cube-line"
								points="30 42.28 432.76 183.25 432.76 334.29 828.81 243.66 832.17 740.4 432.76 871.3 30 733.69 30 42.28"
							/>
							<line class="cube-line" x1="33.36" y1="297.37" x2="201.17" y2="357.78" />
							<g
								class="blep-eye-track"
								style="transform: translate({isIdle ? 0 : $eyeOffset.x}px, {isIdle
									? 0
									: $eyeOffset.y}px);"
							>
								<!-- Squinting eyes (crossfade) -->
								<g
									class="transition-opacity duration-200 {isSquinting
										? 'opacity-100'
										: 'opacity-0'}"
								>
									<!-- Visually left eye -->
									<polyline
										points="716.42,445.28 656.5,496 719.45,519.14"
										fill="none"
										stroke="#111111"
										stroke-width="22"
										stroke-linecap="butt"
										stroke-linejoin="miter"
									/>
									<!-- Visually right eye -->
									<polyline
										points="528.12,487.6 591,510.55 531.14,561.46"
										fill="none"
										stroke="#111111"
										stroke-width="22"
										stroke-linecap="butt"
										stroke-linejoin="miter"
									/>
								</g>

								<!-- Normal / Sleep eyes -->
								<g
									class="transition-opacity duration-200 {isSquinting
										? 'opacity-0'
										: 'opacity-100'}"
								>
									<g class="blep-eyes blep-eyes--awake {isIdle ? 'is-hidden' : ''}">
										<polygon
											class="blep-eye mascot-eye"
											points="719.45 519.14 658.1 533.12 655.08 459.26 716.42 445.28 719.45 519.14"
										/>
										<polygon
											class="blep-eye mascot-eye"
											points="592.49 547.48 531.14 561.46 528.12 487.6 589.47 473.62 592.49 547.48"
										/>
									</g>
									<g class="blep-eyes blep-eyes--sleep {isIdle ? '' : 'is-hidden'}">
										<line class="blep-eye blep-eye--lid" x1="713" y1="486" x2="661" y2="498" />
										<line class="blep-eye blep-eye--lid" x1="586" y1="514" x2="534" y2="526" />
									</g>
								</g>
							</g>
						</g>
					</svg>
				</div>
				{#if isIdle}
					<div
						class="pointer-events-none absolute inset-0 z-20 mx-auto flex items-center justify-center"
						aria-hidden="true"
						transition:fade={{ duration: 400 }}
					>
						<div class="relative aspect-square w-[66%] max-w-82.5 sm:w-[58%] lg:max-w-87.5">
							<p
								class="eepy-pulse absolute top-[15%] left-[-15%] font-mono text-xs font-bold text-ink/40 sm:left-[-10%]"
							>
								(eepy...)
							</p>
							<div class="absolute top-[5%] right-[10%] h-24 w-16 font-mono font-bold text-ink/40">
								<span class="z-float absolute bottom-0 left-0 text-xl">z</span>
								<span
									class="z-float absolute bottom-4 left-4 text-2xl"
									style="animation-delay: 1.2s;">z</span
								>
								<span
									class="z-float absolute bottom-9 left-8 text-3xl"
									style="animation-delay: 2.4s;">z</span
								>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- ═══════════════ TRY THE JUDGE ═══════════════ -->
	<section id="demo" class="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div
				class="mb-8 flex flex-col justify-between gap-4 border-b border-ink/20 pb-5 md:flex-row md:items-end"
			>
				<div>
					<h2 class="mt-2 text-4xl font-display font-bold sm:text-5xl">Try the judge</h2>
				</div>
				<p class="max-w-md text-base leading-relaxed text-ink/65">
					Paste a listing. Drop messy specs. Or just ask what to buy.
				</p>
			</div>

			<div
				class="lab-card grid w-full min-w-0 gap-0 overflow-hidden border border-ink bg-white lg:grid-cols-[0.88fr_1.12fr]"
			>
				<form
					class="grid gap-5 border-b border-ink/20 bg-paper p-5 sm:p-7 lg:border-r lg:border-b-0"
					onsubmit={(event) => event.preventDefault()}
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<label class="font-mono text-xs font-bold text-ink/70 uppercase" for="listing">
							Listing input
						</label>
						<span
							class="border border-ink bg-white px-3 py-1 font-mono text-xs font-bold uppercase"
						>
							Brain Juice 1/2
						</span>
					</div>

					<div class="flex flex-wrap gap-2">
						<button
							class="focus-visible-ring border border-ink/35 bg-white px-3 py-2 font-display text-xs font-semibold tracking-[0.02em] text-ink/75 uppercase transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
							type="button"
							onclick={() => applyDemoQuery('Is this 7jt college laptop a trap?')}
							disabled={demoPhase === 'running'}
						>
							Is this 7jt college laptop a trap?
						</button>
						<button
							class="focus-visible-ring border border-ink/35 bg-white px-3 py-2 font-display text-xs font-semibold tracking-[0.02em] text-ink/75 uppercase transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
							type="button"
							onclick={() => applyDemoQuery('Best gaming setup for 15jt?')}
							disabled={demoPhase === 'running'}
						>
							Best gaming setup for 15jt?
						</button>
						<button
							class="focus-visible-ring border border-ink/35 bg-white px-3 py-2 font-display text-xs font-semibold tracking-[0.02em] text-ink/75 uppercase transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
							type="button"
							onclick={() => applyDemoQuery('Mending ASUS TUF atau Lenovo LOQ?')}
							disabled={demoPhase === 'running'}
						>
							Mending ASUS TUF atau Lenovo LOQ?
						</button>
					</div>

					<textarea
						id="listing"
						class="focus-visible-ring min-h-40 w-full resize-none border border-ink bg-white p-4 text-base leading-relaxed outline-none"
						bind:value={listing}
						placeholder="rekomendasi laptop gaming 15 juta"
					></textarea>

					<button
						class="focus-visible-ring inline-flex min-h-12 items-center justify-center border border-ink bg-ink px-5 text-sm font-display font-semibold tracking-[0.01em] text-white transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onclick={runDemo}
						disabled={demoPhase === 'running' || !listing.trim()}
					>
						{demoPhase === 'running' ? 'Thinking...' : 'Judge this'}
					</button>

					<div
						class="grid grid-cols-3 border border-ink/20 bg-white text-center font-mono text-xs font-bold text-ink/70 uppercase"
					>
						<span class="border-r border-ink/20 px-2 py-3">Specs</span>
						<span class="border-r border-ink/20 px-2 py-3">Forums</span>
						<span class="px-2 py-3">Repair</span>
					</div>
				</form>

				<div id="verdict" class="min-h-105 min-w-0 bg-white p-5 sm:p-7">
					{#if demoPhase === 'idle'}
						<div
							class="grid h-full min-h-90 place-items-center border border-dashed border-ink/35 bg-paper"
						>
							<div class="max-w-sm px-6 text-center">
								<p class="font-mono text-xs font-bold text-ink/55 uppercase">
									BLEP is idling...
								</p>
								<h3 class="mt-3 text-3xl font-display font-bold">Try to ask him.</h3>
								<p class="mt-3 text-sm leading-relaxed text-ink/65">
									Courtroom quiet. Feed him a listing link or budget to wake him up.
								</p>
								<p class="mt-4 font-mono text-xs font-bold text-ink/40 uppercase">
									Result waits here.
								</p>
							</div>
						</div>
					{:else if demoPhase === 'running'}
						<div class="grid min-h-90 border border-ink bg-paper p-5">
							<div>
								<div class="mb-5 flex items-center justify-between border-b border-ink/20 pb-3">
									<p class="font-mono text-xs font-bold text-ink/60 uppercase">
										BLEP inspection log
									</p>
									<p class="log-pulse font-mono text-xs font-bold text-ink uppercase">Analyzing</p>
								</div>
								<div class="space-y-3 font-mono text-sm font-bold text-ink">
									{#each visibleLogs as log (log)}
										<p class="log-line">{log}</p>
									{/each}
								</div>
							</div>
						</div>
					{:else if verdictReady}
						{#if scanError && !scanResult}
							<div class="grid min-h-90 place-items-center border border-ink bg-paper p-6">
								<div class="max-w-md text-center">
									<p class="font-mono text-xs font-bold text-ink/55 uppercase">Scan failed</p>
									<h3 class="mt-3 text-3xl font-display font-bold">BLEP tripped.</h3>
									<p class="mt-3 text-sm leading-relaxed text-ink/65">{scanError}</p>
								</div>
							</div>
						{:else}
							{#if scanMode && scanIntent}
								<p class="mb-3 font-mono text-xs font-bold text-ink/55 uppercase">
									{scanMode} / {scanIntent}
								</p>
							{/if}

							{#if scanError}
								<p
									class="mb-3 border border-ink bg-paper p-3 font-mono text-xs font-bold text-ink/70 uppercase"
								>
									{scanError}
								</p>
							{/if}

							{#if recommendationResult}
								<RecommendationCard recommendation={recommendationResult} />
							{:else if needsInputResult}
								<article class="border border-ink bg-paper p-5 sm:p-6" aria-label="BLEP questions">
									<div
										class="flex flex-wrap items-start justify-between gap-4 border-b border-ink pb-5"
									>
										<div>
											<p class="font-mono text-xs font-bold text-ink/60 uppercase">Need input</p>
											<h3 class="mt-1 text-3xl font-display font-bold">Not enough anchors.</h3>
										</div>
										<p
											class="stamp -rotate-2 border border-ink bg-white px-5 py-2 uppercase"
										>
											ASK
										</p>
									</div>
									<p class="mt-5 text-base leading-relaxed font-medium text-ink/80">
										{needsInputResult.reason}
									</p>
									<div class="mt-5 grid gap-3 sm:grid-cols-2">
										{#each needsInputResult.questions as question (question)}
											<div class="detail-block">
												<h4>Question</h4>
												<p>{question}</p>
											</div>
										{/each}
									</div>
									<div class="mt-5 border-t border-ink/20 pt-5">
										<p class="font-mono text-xs font-bold text-ink/55 uppercase">Examples</p>
										<div class="mt-3 flex flex-wrap gap-2">
											{#each needsInputResult.examples as example (example)}
												<button
													class="focus-visible-ring border border-ink/35 bg-white px-3 py-2 font-display text-xs font-semibold tracking-[0.02em] text-ink/75 uppercase transition hover:border-ink"
													type="button"
													onclick={() => applyDemoQuery(example)}
												>
													{example}
												</button>
											{/each}
										</div>
									</div>
								</article>
							{:else if comparisonResult}
								<article class="border border-ink bg-paper p-5 sm:p-6" aria-label="BLEP comparison">
									<div
										class="flex flex-wrap items-start justify-between gap-4 border-b border-ink pb-5"
									>
										<div>
											<p class="font-mono text-xs font-bold text-ink/60 uppercase">Comparison</p>
											<h3 class="mt-1 text-3xl font-display font-bold">
												{comparisonResult.winner} wins.
											</h3>
										</div>
										<p
											class="stamp -rotate-2 border border-ink bg-white px-5 py-2 uppercase"
										>
											{comparisonResult.verdict}
										</p>
									</div>
									<p
										class="mt-5 border-l-4 border-ink bg-white p-4 text-base leading-relaxed font-medium"
									>
										{comparisonResult.reason}
									</p>
									<div class="mt-5 grid gap-3 md:grid-cols-2">
										{#each comparisonResult.compared as option (option.name)}
											<section class="detail-block">
												<h4>{option.verdict}</h4>
												<p>{option.name}</p>
												<p class="mt-2 text-sm text-ink/65">
													Strengths: {option.strengths.join(', ')}
												</p>
												<p class="mt-1 text-sm text-ink/65">Flaws: {option.flaws.join(', ')}</p>
											</section>
										{/each}
									</div>
								</article>
							{:else if verdictResult}
								<article
									class="verdict-card border border-ink bg-paper p-5 sm:p-6"
									aria-label="Demo verdict"
								>
									<div
										class="flex flex-wrap items-start justify-between gap-4 border-b border-ink pb-5"
									>
										<div>
											<p class="font-mono text-xs font-bold text-ink/60 uppercase">Product</p>
											<h3 class="mt-1 text-3xl font-display font-bold">{verdictResult.name}</h3>
										</div>
										<p class="stamp -rotate-3 border border-ink px-5 py-2 uppercase">
											{verdictResult.verdict}
										</p>
									</div>

									<div class="mt-5 grid gap-3 sm:grid-cols-3">
										<div class="spec-chip">
											<span>Landfill year</span>
											<strong>{verdictResult.landfill_year}</strong>
										</div>
										<div class="spec-chip">
											<span>Upgradeable</span>
											<strong>{verdictResult.specs.upgradeable ? 'Yes' : 'No'}</strong>
										</div>
										<div class="spec-chip">
											<span>Forum score</span>
											<strong>{verdictResult.specs.forum_score}/10</strong>
										</div>
									</div>

									<div class="mt-5 grid gap-3 md:grid-cols-2">
										<section class="detail-block">
											<h4>Fatal flaw</h4>
											<p>{verdictResult.fatal_flaw}</p>
										</section>
										<section class="detail-block">
											<h4>Thermal</h4>
											<p>{verdictResult.specs.thermal}</p>
										</section>
									</div>

									<blockquote
										class="mt-5 border-l-4 border-ink bg-white p-4 text-base leading-relaxed font-medium"
									>
										{verdictResult.roast}
									</blockquote>

									<p class="mt-5 border-t border-ink/20 pt-5 text-base leading-relaxed text-ink/75">
										<strong class="text-ink">Summary:</strong>
										{verdictResult.summary}
									</p>
								</article>
							{:else}
								<div class="grid min-h-90 place-items-center border border-ink bg-paper p-6">
									<div class="max-w-md text-center">
										<p class="font-mono text-xs font-bold text-ink/55 uppercase">No result</p>
										<h3 class="mt-3 text-3xl font-display font-bold">Nothing rendered.</h3>
										<p class="mt-3 text-sm leading-relaxed text-ink/65">
											Try a different hardware ask.
										</p>
									</div>
								</div>
							{/if}
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- ═══════════════ AGENT BROADCAST TICKER ═══════════════ -->
	<div class="ticker-wrap overflow-hidden whitespace-nowrap border-y-2 border-black py-4" aria-hidden="true">
		<div class="ticker-track flex w-max">
			<div class="ticker-content flex shrink-0 items-center font-display font-black uppercase tracking-widest text-ink">
				<span class="mx-6">[PLACEHOLDER EXPRESSION THINKING]</span>
				<span>BLEP SNIFFING SELLER COPE</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION JUDGING]</span>
				<span>BLEP COUNTING FUTURE REGRET</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION ANNOYED]</span>
				<span>BLEP REJECTING RGB TRAPS</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION SCANNING]</span>
				<span>BLEP DETECTING BAD SPEC</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION READING]</span>
				<span>BLEP SCANNING FORUM THOUGHTS</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION PROCESSING]</span>
				<span>BLEP RETICULATING SPLINES</span>
				<span class="mx-6">■</span>
			</div>
			<div class="ticker-content flex shrink-0 items-center font-display font-black uppercase tracking-widest text-ink">
				<span class="mx-6">[PLACEHOLDER EXPRESSION THINKING]</span>
				<span>BLEP SNIFFING SELLER COPE</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION JUDGING]</span>
				<span>BLEP COUNTING FUTURE REGRET</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION ANNOYED]</span>
				<span>BLEP REJECTING RGB TRAPS</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION SCANNING]</span>
				<span>BLEP DETECTING BAD SPEC</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION READING]</span>
				<span>BLEP SCANNING FORUM THOUGHTS</span>
				<span class="mx-6">■</span>
				<span class="mx-6">[PLACEHOLDER EXPRESSION PROCESSING]</span>
				<span>BLEP RETICULATING SPLINES</span>
				<span class="mx-6">■</span>
			</div>
		</div>
	</div>

	<!-- ═══════════════ HOW IT WORKS — SCROLL TIMELINE ═══════════════ -->
	<section id="how" class="border-y border-ink/15 bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div class="mb-16 text-center">
				<h2 class="text-4xl font-display font-bold sm:text-5xl">How it works</h2>
			</div>

			<div class="timeline-spine" bind:this={spineEl}>
				<!-- Dynamic active scroll indicator node -->
				<div
					bind:this={indicatorEl}
					class="absolute bg-ink pointer-events-none z-10
						w-3 h-3 md:w-4 md:h-4
						left-[0.5rem] md:left-1/2 -translate-x-1/2 -translate-y-1/2
						transition-[top] duration-300 ease-out"
				></div>

				{#each timelineData as step, i (step.title)}
					<div
						class="timeline-step"
						bind:this={stepEls[i]}
					>
						<div
							class="w-[1.125rem] h-[1.125rem] shrink-0"
							style="grid-column:2; grid-row:1; justify-self:center; align-self:start; margin-top:2.25rem; z-index:1;"
						></div>
						<div
							class="p-8 md:p-12 bg-white transition-all duration-300
								{activeStep === i ? 'opacity-100 border border-ink' : 'opacity-40 border border-ink/10'}"
							style="{i % 2 === 0 ? 'grid-column:1; grid-row:1; text-align:right;' : 'grid-column:3; grid-row:1;'}"
						>
							<span class="block font-display text-sm font-bold text-ink/45 mb-2">0{i + 1}</span>
							<h3 class="font-display text-2xl font-bold leading-tight sm:text-3xl">{step.title}</h3>
							<p class="mt-3 text-base font-medium text-ink/65 leading-relaxed">{step.body}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══════════════ TRAP DETECTOR ═══════════════ -->
	<section id="why" class="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div class="mb-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
				<div>
					<h2 class="text-4xl font-display font-bold sm:text-5xl">
						Cheap can still be expensive.
					</h2>
				</div>
				<p class="max-w-xl text-base leading-relaxed text-ink/65 lg:justify-self-end">
					Know before you pay.
				</p>
			</div>

			{#each traps as trap, i (trap.title)}
				<article class="trap-row">
					<span class="trap-num">0{i + 1}</span>
					<div class="min-w-0">
						<h3 class="trap-heading">{trap.title}</h3>
						<p class="trap-body">{trap.body}</p>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<!-- ═══════════════ FOOTER ═══════════════ -->
	<footer class="blep-footer" aria-labelledby="footer-title" bind:this={footerRef}>
		<h2 id="footer-title" class="sr-only">Footer</h2>

		<nav class="blep-footer__links" aria-label="Footer">
			<div class="blep-footer__col blep-footer__locale">
				<a href="#top">
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
				</a>
			</div>

			<div class="blep-footer__col">
				<a href="#how">How it works</a>
				<a href="#demo">Demo</a>
				<a href="#why">Why BLEP</a>
				<a href="mailto:hello@blep.local">Contact</a>
			</div>

			<div class="blep-footer__col">
				<a href={resolve('/privacy')}>Privacy Policy</a>
				<a href={resolve('/terms')}>Terms</a>
				<a href="#demo">Judge listing</a>
				<a href="#verdict">Demo verdict</a>
			</div>
		</nav>

		<button class="blep-footer__logo-wrap" type="button" aria-label="BLEP mascot">
			<img
				class="blep-footer__logo"
				src="/logo-full-main.svg"
				alt=""
				loading="lazy"
				decoding="async"
			/>
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
</main>

<style>
	/* ── Navigation ── */
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

	.blep-footer__col a {
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

	.blep-footer__col a:hover {
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
		display: block;
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
		fill: #000000;
		stroke: #000000;
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

	/* ── Hero ── */
	.hero-headline {
		font-family: var(--font-display);
		font-size: clamp(3.8rem, 8vw, 7rem);
		font-weight: 800;
		line-height: 0.92;
		letter-spacing: 0;
	}

	.hero-copy {
		font-family: var(--font-body);
		font-weight: 500;
		line-height: 1.6;
	}

	.poster-stage {
		isolation: isolate;
	}

	.poster-stage span,
	.poster-stage p {
		z-index: 20;
	}

	.plus-mark {
		position: absolute;
		width: 30px;
		height: 30px;
	}

	.plus-mark::before,
	.plus-mark::after {
		content: '';
		position: absolute;
		background: #111111;
	}

	.plus-mark::before {
		left: 14px;
		top: 0;
		width: 2px;
		height: 30px;
	}

	.plus-mark::after {
		left: 0;
		top: 14px;
		width: 30px;
		height: 2px;
	}

	/* ── Mascot ── */
	.mascot-cube {
		filter: drop-shadow(8px 10px 0 rgba(17, 17, 17, 0.055));
		animation: mascot-float 5.5s ease-in-out infinite;
	}

	.cube-line {
		fill: #fbfaf8;
		stroke: #111111;
		stroke-linecap: butt;
		stroke-linejoin: miter;
		stroke-miterlimit: 10;
		stroke-width: 30;
	}

	.blep-eye-track,
	.blep-eyes,
	.blep-eye {
		transform-box: fill-box;
		transform-origin: center;
	}

	.blep-eye-track {
		transition: transform 180ms ease-out;
	}

	.blep-eyes {
		opacity: 1;
		transition: opacity 200ms ease;
	}

	.blep-eyes.is-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.mascot-eye {
		fill: #111111;
		stroke: #111111;
		stroke-linejoin: miter;
		stroke-miterlimit: 10;
		stroke-width: 8;
		animation: blink 6s infinite;
		transition: transform 200ms ease;
	}

	.blep-eyes--sleep {
		transition-duration: 220ms;
	}

	.blep-eye--lid {
		fill: none;
		stroke: #111111;
		stroke-width: 18;
		stroke-linecap: butt;
		stroke-linejoin: miter;
	}

	/* ── Sandbox / Lab card ── */
	.lab-card {
		box-shadow: 8px 8px 0 rgba(17, 17, 17, 0.045);
	}

	.log-line {
		animation: log-in 180ms ease-out both;
	}

	.log-line::before {
		content: '';
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		margin-right: 0.65rem;
		border: 1px solid #111111;
		background: #ffffff;
	}

	.log-pulse {
		animation: pulse-text 900ms ease-in-out infinite;
	}

	.eepy-pulse {
		animation: eepy-pulse 3s ease-in-out infinite;
	}

	.z-float {
		opacity: 0;
		animation: float-z 3.6s ease-in infinite;
	}

	.stamp {
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.04em;
		box-shadow: 3px 3px 0 #111111;
	}

	.spec-chip,
	.detail-block {
		border: 1px solid rgba(17, 17, 17, 0.35);
		background: #ffffff;
		padding: 1rem;
	}

	.spec-chip span,
	.detail-block h4 {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(17, 17, 17, 0.58);
	}

	.spec-chip strong {
		display: block;
		margin-top: 0.25rem;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}

	.detail-block p {
		margin-top: 0.4rem;
		font-family: var(--font-body);
		font-weight: 500;
		line-height: 1.6;
	}

	/* ── Agent Broadcast Ticker ── */
	.ticker-track {
		animation: ticker-scroll 90s linear infinite;
	}

	/* ── How It Works Timeline ── */
	.timeline-spine {
		position: relative;
		max-width: 56rem;
		margin: 0 auto;
	}

	.timeline-spine::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		border-left: 2px dotted rgba(17, 17, 17, 0.25);
		transform: translateX(-50%);
	}

	.timeline-step {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 2.5rem 1fr;
		align-items: start;
		padding: 1.5rem 0;
	}

	/* ── Trap Detector ── */
	.trap-row {
		display: grid;
		grid-template-columns: 3.5rem 1fr;
		gap: 1.5rem;
		align-items: start;
		padding: 1.75rem 0;
		border-top: 3px solid var(--color-ink);
		transition: background-color 160ms ease;
	}

	.trap-row:hover {
		background-color: var(--color-paper-dark);
	}

	.trap-num {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.75rem;
		color: rgba(17, 17, 17, 0.55);
		padding-top: 0.35rem;
	}

	.trap-heading {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.5rem;
		line-height: 1.2;
	}

	.trap-body {
		margin-top: 0.5rem;
		font-family: var(--font-body);
		font-weight: 500;
		color: rgba(17, 17, 17, 0.65);
		line-height: 1.6;
	}

	/* ── Keyframes ── */
	@keyframes mascot-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	@keyframes blink {
		0%,
		91%,
		100% {
			transform: scaleY(1);
		}
		94% {
			transform: scaleY(0.08);
		}
	}

	@keyframes log-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse-text {
		50% {
			opacity: 0.45;
		}
	}

	@keyframes eepy-pulse {
		0%,
		100% {
			opacity: 0.8;
		}
		50% {
			opacity: 0.4;
		}
	}

	@keyframes float-z {
		0% {
			opacity: 0;
			transform: translate(0, 5px) scale(0.8);
		}
		20% {
			opacity: 0.7;
		}
		80% {
			opacity: 0.7;
		}
		100% {
			opacity: 0;
			transform: translate(15px, -20px) scale(1.2);
		}
	}

	@keyframes ticker-scroll {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	/* ── Mobile ── */
	@media (max-width: 768px) {
		.timeline-spine::before {
			left: 0.5rem;
		}

		.timeline-step {
			grid-template-columns: 1.75rem 1fr;
			padding: 1rem 0;
		}

		/* Mobile: force node col-1, card col-2, left-align for all steps */
		.timeline-step > :first-child {
			grid-column: 1 !important;
			width: 0.875rem !important;
			height: 0.875rem !important;
			margin-top: 1.25rem !important;
		}

		.timeline-step > :last-child {
			grid-column: 2 !important;
			grid-row: 1 !important;
			text-align: left !important;
		}
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

		#top {
			align-items: start;
			min-height: auto;
			padding-top: 2rem;
			padding-bottom: 2rem;
		}

		.hero-headline {
			font-size: clamp(3rem, 13vw, 3.7rem);
		}

		.poster-stage {
			min-height: 250px;
		}

		.poster-stage .mascot-cube {
			width: 50%;
			max-width: 190px;
		}

		.poster-stage span {
			right: auto;
			left: 55%;
			top: 64%;
		}

		.poster-stage p {
			bottom: 3%;
			left: 8%;
			max-width: 11rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.001ms !important;
		}

		.mascot-cube,
		.mascot-eye,
		.eepy-pulse,
		.z-float,
		.ticker-track {
			animation: none !important;
		}
	}
</style>
