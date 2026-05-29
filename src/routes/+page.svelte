<script lang="ts">
	import { onDestroy } from 'svelte';
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
		'[blep scanning forum complaints...]',
		'[blep checking repairability...]',
		'[blep comparing price to regret...]',
		'[blep preparing verdict...]'
	];

	const recommendationLogs = [
		'[blep reading budget...]',
		'[blep hunting same-price alternatives...]',
		'[blep rejecting RGB traps...]',
		'[blep checking thermals...]',
		'[blep building shortlist...]'
	];

	const steps = [
		{
			title: 'Paste',
			text: 'Drop in a used listing.'
		},
		{
			title: 'Check',
			text: 'Specs, reviews, complaints, repairability.'
		},
		{
			title: 'Decide',
			text: 'Approved. Caution. Waste.'
		}
	];

	const reasons = [
		{
			title: 'Save money',
			text: 'Cheap can still be expensive.'
		},
		{
			title: 'Avoid landfill tech',
			text: 'Some devices are already done.'
		},
		{
			title: 'Read between specs',
			text: 'Listings hide the bad parts.'
		}
	];

	let listing = $state('Used ThinkPad T480, i5, 8GB RAM, 256GB SSD, $180');
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
	let footerShowP = $state(false);
	let footerPFlashTimer: ReturnType<typeof setTimeout> | undefined;
	let footerInView = $state(false);
	let footerRef = $state<HTMLElement | null>(null);

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

	const handleFooterMascotClick = () => {
		footerShowP = true;
		if (footerPFlashTimer) clearTimeout(footerPFlashTimer);
		footerPFlashTimer = setTimeout(() => {
			footerShowP = false;
		}, 520);
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

	const plannedIntent = $derived(detectBlepIntent(listing).intent);
	const submitLabel = $derived(
		plannedIntent === 'RECOMMENDATION_SCAN'
			? 'Build shortlist'
			: plannedIntent === 'COMPARISON_SCAN'
				? 'Compare devices'
				: 'Judge this listing'
	);
	const activeLogs = $derived(
		scanIntent === 'RECOMMENDATION_SCAN' ? recommendationLogs : demoLogs
	);
	const verdictReady = $derived(demoPhase === 'done');
	const verdictResult = $derived(scanResult?.mode === 'VERDICT' ? scanResult : null);
	const recommendationResult = $derived(
		scanResult?.mode === 'RECOMMENDATION' ? scanResult : null
	);
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
		if (footerPFlashTimer) clearTimeout(footerPFlashTimer);
	});
</script>

<svelte:head>
	<title>BLEP | Tiny hardware judge</title>
	<meta
		name="description"
		content="Paste a used laptop listing. BLEP checks the evidence and tells you if it is worth it."
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
				<img class="h-8 w-auto sm:h-10" src="/logo-full-main.svg" alt="BLEP" />
			</a>

			<div class="hidden items-center gap-8 text-sm font-semibold text-ink/70 md:flex">
				<a class="nav-link" href="#how">How it works</a>
				<a class="nav-link" href="#demo">Demo</a>
				<a class="nav-link" href="#why">Why BLEP</a>
			</div>

			<a
				class="focus-visible-ring inline-flex min-h-10 items-center border border-ink bg-ink px-4 text-sm font-bold text-white transition hover:bg-white hover:text-ink"
				href="#demo"
			>
				Ask BLEP
			</a>
		</nav>
	</header>

	<section
		id="top"
		class="flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden border-b border-ink/15 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
	>
		<div
			class="mx-auto grid w-full max-w-300 min-w-0 gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:items-center"
		>
			<div class="relative z-10 max-w-xl min-w-0">
				<h1 class="hero-headline max-w-xl leading-[0.94] font-bold text-balance">Buy less junk.</h1>
				<div class="mt-5 h-px w-full max-w-xs bg-ink/35"></div>
				<p class="mt-6 max-w-md text-lg leading-relaxed text-ink/70 sm:text-xl">
					Paste the listing. BLEP tells you if it&apos;s worth it.
				</p>
				<p class="mt-5 font-mono text-sm font-bold text-ink uppercase">
					Approved / Caution / Waste
				</p>

				<div class="mt-8 flex flex-wrap items-center gap-3">
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink bg-ink px-6 text-sm font-bold text-white transition hover:bg-white hover:text-ink"
						href="#demo"
					>
						Judge my listing
					</a>
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink/35 bg-white px-6 text-sm font-bold text-ink transition hover:border-ink"
						href="#verdict"
					>
						See demo verdict
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

	<section id="demo" class="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div
				class="mb-8 flex flex-col justify-between gap-4 border-b border-ink/20 pb-5 md:flex-row md:items-end"
			>
				<div>
					<h2 class="mt-2 text-4xl font-bold sm:text-5xl">Try the judge</h2>
				</div>
				<p class="max-w-md text-base leading-relaxed text-ink/65">
					Paste a listing or broad buyer ask.
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
							class="focus-visible-ring border border-ink/35 bg-white px-3 py-2 font-mono text-xs font-bold text-ink/75 uppercase transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
							type="button"
							onclick={() => applyDemoQuery('rekomendasi laptop gaming 15 juta')}
							disabled={demoPhase === 'running'}
						>
							rekomendasi laptop gaming 15 juta
						</button>
					</div>

					<textarea
						id="listing"
						class="focus-visible-ring min-h-40 w-full resize-none border border-ink bg-white p-4 text-base leading-relaxed outline-none"
						bind:value={listing}
						placeholder="Paste listing, device name, broad recommendation ask, or comparison."
					></textarea>

					<button
						class="focus-visible-ring inline-flex min-h-12 items-center justify-center border border-ink bg-ink px-5 text-sm font-bold text-white transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
						type="button"
						onclick={runDemo}
						disabled={demoPhase === 'running' || !listing.trim()}
					>
						{demoPhase === 'running' ? 'Thinking...' : submitLabel}
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
								<p class="font-mono text-xs font-bold text-ink/55 uppercase">Mock judge</p>
								<h3 class="mt-3 text-3xl font-bold">Result waits here.</h3>
								<p class="mt-3 text-sm leading-relaxed text-ink/65">Mock mode returns fixed data.</p>
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
									<h3 class="mt-3 text-3xl font-bold">BLEP tripped.</h3>
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
								<p class="mb-3 border border-ink bg-paper p-3 font-mono text-xs font-bold text-ink/70 uppercase">
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
											<h3 class="mt-1 text-3xl font-bold">Not enough anchors.</h3>
										</div>
										<p class="stamp -rotate-2 border border-ink bg-white px-5 py-2 font-bold uppercase">
											ASK
										</p>
									</div>
									<p class="mt-5 text-base leading-relaxed font-bold text-ink/80">
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
													class="focus-visible-ring border border-ink/35 bg-white px-3 py-2 font-mono text-xs font-bold text-ink/75 uppercase transition hover:border-ink"
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
											<h3 class="mt-1 text-3xl font-bold">{comparisonResult.winner} wins.</h3>
										</div>
										<p class="stamp -rotate-2 border border-ink bg-white px-5 py-2 font-bold uppercase">
											{comparisonResult.verdict}
										</p>
									</div>
									<p class="mt-5 border-l-4 border-ink bg-white p-4 text-base leading-relaxed font-bold">
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
											<h3 class="mt-1 text-3xl font-bold">{verdictResult.name}</h3>
										</div>
										<p class="stamp -rotate-3 border border-ink px-5 py-2 font-bold uppercase">
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
										class="mt-5 border-l-4 border-ink bg-white p-4 text-base leading-relaxed font-bold"
									>
										{verdictResult.roast}
									</blockquote>

									<p class="mt-5 border-t border-ink/20 pt-5 text-base leading-relaxed text-ink/75">
										<strong class="text-ink">Summary:</strong> {verdictResult.summary}
									</p>
								</article>
							{:else}
								<div class="grid min-h-90 place-items-center border border-ink bg-paper p-6">
									<div class="max-w-md text-center">
										<p class="font-mono text-xs font-bold text-ink/55 uppercase">No result</p>
										<h3 class="mt-3 text-3xl font-bold">Nothing rendered.</h3>
										<p class="mt-3 text-sm leading-relaxed text-ink/65">
											Try mock mode or send a clearer hardware ask.
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

	<section id="how" class="border-y border-ink/15 bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div class="mb-10 max-w-2xl">
				<p class="font-mono text-xs font-bold text-ink/60 uppercase">Flow</p>
				<h2 class="mt-2 text-4xl font-bold sm:text-5xl">How it works</h2>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				{#each steps as step, index (step.title)}
					<article class="construct-card relative min-h-64 border border-ink bg-white p-5">
						<div class="mb-8 flex items-center justify-between">
							<span class="font-mono text-xs font-bold text-ink/55 uppercase">0{index + 1}</span>
							<svg class="h-8 w-16 text-ink" viewBox="0 0 64 32" aria-hidden="true">
								<path
									d="M4 16h50M44 7l10 9-10 9"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								/>
							</svg>
						</div>
						{#if index === 0}
							<!-- Paste SVG (lucide-clipboard) -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="mb-5 h-8 w-8 text-ink"
								aria-hidden="true"
							>
								<rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
								<path
									d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
								/>
							</svg>
						{:else if index === 1}
							<!-- Check SVG (lucide-search) -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="mb-5 h-8 w-8 text-ink"
								aria-hidden="true"
							>
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.3-4.3" />
							</svg>
						{:else}
							<!-- Decide SVG (lucide-check-circle) -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="mb-5 h-8 w-8 text-ink"
								aria-hidden="true"
							>
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
								<path d="m22 4-10 10.01-3-3" />
							</svg>
						{/if}
						<h3 class="text-2xl font-bold">{step.title}</h3>
						<p class="mt-3 text-sm leading-relaxed text-ink/65">{step.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section id="why" class="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div class="mb-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
				<div>
					<p class="font-mono text-xs font-bold text-ink/60 uppercase">Why BLEP matters</p>
					<h2 class="mt-2 text-4xl font-bold sm:text-5xl">Cheap can still be expensive.</h2>
				</div>
				<p class="max-w-xl text-base leading-relaxed text-ink/65 lg:justify-self-end">
					Know before you pay.
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				{#each reasons as reason (reason.title)}
					<article class="reason-card border border-ink/35 bg-white p-5">
						<div class="mb-6 h-12 w-12 border border-ink bg-paper">
							<div
								class="h-full w-full translate-x-2 translate-y-2 border border-ink bg-white"
							></div>
						</div>
						<h3 class="text-2xl font-bold">{reason.title}</h3>
						<p class="mt-3 text-sm leading-relaxed text-ink/65">{reason.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<footer class="blep-footer" aria-labelledby="footer-title" bind:this={footerRef}>
		<h2 id="footer-title" class="sr-only">Footer</h2>

		<nav class="blep-footer__links" aria-label="Footer">
			<div class="blep-footer__col blep-footer__locale">
				<a href="#top">Top</a>
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

		<button
			class="blep-footer__logo-wrap"
			type="button"
			aria-label="Interact with BLEP mascot"
			onclick={handleFooterMascotClick}
		>
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
					<polygon
						class="blep-footer-eye"
						points="340.546875 253.601562 311.574219 260.203125 310.148438 225.328125 339.117188 218.726562"
					/>
					<polygon
						class="blep-footer-eye"
						points="280.59375 266.980469 251.625 273.582031 250.199219 238.710938 279.167969 232.109375"
					/>
					<text class="blep-footer-p {footerShowP ? 'opacity-100' : 'opacity-0'}" x="361" y="260">
						P
					</text>
				</g>
			</svg>
		</button>
	</footer>
</main>

<style>
	.nav-link {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.25rem;
		text-decoration-color: transparent;
	}

	.nav-link:hover {
		color: var(--color-ink);
		text-decoration-color: currentColor;
	}

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
		width: fit-content;
		color: currentColor;
		font:
			400 var(--footer-link-size) / 1.12 Arial,
			sans-serif;
		text-decoration: underline;
		text-decoration-thickness: 0.075em;
		text-underline-offset: 0.16em;
	}

	.blep-footer__col a:hover {
		text-decoration-thickness: 0.12em;
	}

	.blep-footer__locale a::before {
		content: '◎';
		margin-right: 1rem;
		font-size: 0.75em;
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

	.blep-footer-p {
		fill: #000000;
		font-family: var(--font-mono);
		font-size: 54px;
		font-weight: 700;
		transition: opacity 140ms ease;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.hero-headline {
		font-size: clamp(3.8rem, 8vw, 7.25rem);
		letter-spacing: 0;
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
		font-size: 1.5rem;
		line-height: 1;
	}

	.detail-block p {
		margin-top: 0.4rem;
		font-weight: 700;
		line-height: 1.5;
	}

	.construct-card,
	.reason-card {
		transition:
			transform 160ms ease,
			box-shadow 160ms ease;
	}

	.construct-card:hover,
	.reason-card:hover {
		transform: translate(-2px, -2px);
		box-shadow: 6px 6px 0 rgba(17, 17, 17, 0.1);
	}

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
		.z-float {
			animation: none !important;
		}
	}
</style>
