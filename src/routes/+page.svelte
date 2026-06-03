<script lang="ts">
	import { onMount } from 'svelte';
	import { spring } from 'svelte/motion';
	import { fade, slide } from 'svelte/transition';

	const timelineData = [
		{
			title: 'Bring',
			body: 'Paste link, screenshot, or messy listing text.'
		},
		{
			title: 'Locate',
			body: 'BLEP hunts price, specs, heat, repair traps, and complaints.'
		},
		{
			title: 'Execute',
			body: 'Approved. Caution. Waste.<br />No polite fog.'
		},
		{
			title: 'Press X for Doubt',
			body: 'Still coping? Ask follow-up. BLEP explains why the deal stinks.'
		}
	];

	const faqs = [
		{
			q: 'Why not just search manually or ask standard AI?',
			a: 'Standard AI explains specs. BLEP judges the deal. It cuts through listing noise to give you a blunt APPROVED, CAUTION, or WASTE.'
		},
		{
			q: 'What does BLEP check?',
			a: 'Price, specs, age, heat, upgrade traps, repair risk, complaints, and better options nearby.'
		},
		{
			q: 'Can it recommend laptops too?',
			a: 'Yes. Ask by budget and use case, like “gaming laptop 15 juta”. BLEP gives target specs, traps to avoid, and shortlist logic.'
		},
		{
			q: 'What makes a deal WASTE?',
			a: 'Old parts at new prices, weak GPU sold as gaming, soldered 8GB RAM, bad screen, hot chassis, or cheaper better options.'
		},
		{
			q: 'Is BLEP always certain?',
			a: 'No. If evidence is thin, BLEP says so. No fake confidence.'
		},
		{
			q: 'What happens after verdict?',
			a: 'You can argue with it. BLEP explains the fatal flaw and what to buy instead.'
		}
	];

	let activeFaq = $state(0);

	let windowWidth = $state(1024);
	let windowHeight = $state(768);
	let isSquinting = $state(false);
	let isIdle = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
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

	const handleMouseMove = (e: MouseEvent) => {
		// x is inverted because the parent <g> has scale(-1, 1)
		const rx = (e.clientX / windowWidth - 0.5) * -70;
		const ry = (e.clientY / windowHeight - 0.5) * 70;
		eyeOffset.set({ x: rx, y: ry });
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

	// Timeline scroll observer — track which step is closest to viewport center
	onMount(() => {
		// Force scroll to hash if present on load (fixes SvelteKit cross-page hash navigation)
		if (window.location.hash) {
			const target = document.querySelector(window.location.hash);
			if (target) {
				setTimeout(() => {
					target.scrollIntoView({ behavior: 'smooth' });
				}, 50);
			}
		}

		const updateIndicatorPosition = () => {
			if (!spineEl || stepEls.length === 0) return;

			// 1. Calculate active step based on viewport position
			// Use an activation line a bit above center (0.4) to favor items we are scrolling to
			const mid = window.innerHeight * 0.4;
			let best = activeStep;
			let bestDist = Infinity;
			for (let i = 0; i < stepEls.length; i++) {
				const el = stepEls[i];
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const center = rect.top + rect.height / 2;
				const dist = Math.abs(center - mid);
				if (dist < bestDist) {
					bestDist = dist;
					best = i;
				}
			}
			if (activeStep !== best) activeStep = best;

			// 2. Snap the indicator exactly to the center of the active step
			const activeEl = stepEls[activeStep];
			if (!activeEl) return;
			const spineRect = spineEl.getBoundingClientRect();
			const spineTop = spineRect.top + window.scrollY;
			const activeRect = activeEl.getBoundingClientRect();
			const targetY = activeRect.top + activeRect.height / 2 + window.scrollY - spineTop;

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
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', handleScroll);
			clearTimeout(initialTimeout);
		};
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

<main class="grow">
	<!-- ═══════════════ HERO ═══════════════ -->
	<section
		id="top"
		class="flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden border-b border-ink/15 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
	>
		<div
			class="mx-auto grid w-full max-w-300 min-w-0 gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:items-center"
		>
			<div class="relative z-10 max-w-xl min-w-0">
				<h1 class="hero-headline max-w-xl font-display text-balance">Buy less junk.</h1>
				<div class="mt-5 h-px w-full max-w-xs bg-ink/35"></div>
				<p class="hero-copy mt-6 max-w-md text-lg text-ink/70 sm:text-xl">
					Sellers overhype basic toasters. Paste a listing or ask what to buy. BLEP tells you if
					it&apos;s a steal, sketchy, or wallet poison.
				</p>

				<div id="demo" class="mt-8 flex scroll-mt-24 flex-wrap items-center gap-3">
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink bg-ink px-6 font-display text-sm font-semibold tracking-[0.01em] text-paper transition hover:bg-ink/85 hover:text-paper"
						href="/app"
					>
						Ask BLEP
					</a>
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink/35 bg-paper px-6 font-display text-sm font-semibold tracking-[0.01em] text-ink transition hover:bg-ink/6 hover:border-transparent"
						href="/app?q=Lenovo LOQ RTX 4050 vs Acer Nitro V RTX 4050, which one?"
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
					class="absolute top-[19%] left-[24%] h-52 w-52 rounded-full border border-ink/25 bg-paper dark:border-ink/45"
				></div>
				<div
					class="absolute top-[18%] right-[10%] h-12 w-56 rotate-[-36deg] bg-paper-dark/80 dark:bg-ink/10"
				></div>
				<div
					class="absolute top-[18%] left-[12%] h-28 w-48 border border-ink/20 dark:border-ink/40"
				></div>
				<div
					class="absolute top-[51%] left-[25%] h-px w-[65%] rotate-[-18deg] bg-ink/30 dark:bg-ink/50"
				></div>
				<div
					class="absolute top-[28%] right-[12%] h-px w-[42%] rotate-[-36deg] bg-ink/35 dark:bg-ink/55"
				></div>
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
										stroke="var(--color-ink)"
										stroke-width="22"
										stroke-linecap="butt"
										stroke-linejoin="miter"
									/>
									<!-- Visually right eye -->
									<polyline
										points="528.12,487.6 591,510.55 531.14,561.46"
										fill="none"
										stroke="var(--color-ink)"
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

	<section
		id="flow"
		class="scroll-mt-20 border-y border-ink/15 bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
	>
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div class="mb-16 text-center">
				<h2 class="font-display text-4xl font-bold sm:text-5xl">How it works</h2>
			</div>

			<div class="timeline-spine" bind:this={spineEl}>
				<!-- Dynamic active scroll indicator node -->
				<div
					bind:this={indicatorEl}
					class="pointer-events-none absolute left-2 z-10
						h-3 w-3 -translate-x-1/2 -translate-y-1/2
						bg-ink transition-[top] duration-300 ease-out
						md:left-1/2 md:h-4 md:w-4"
				></div>

				{#each timelineData as step, i (step.title)}
					<div class="timeline-step" bind:this={stepEls[i]}>
						<div
							class="h-4.5 w-4.5 shrink-0"
							style="grid-column:2; grid-row:1; justify-self:center; align-self:start; margin-top:2.25rem; z-index:1;"
						></div>
						<div
							class="bg-paper p-8 transition-all duration-300 md:p-12
								{activeStep === i ? 'border border-ink opacity-100' : 'border border-ink/10 opacity-40'}"
							style={i % 2 === 0
								? 'grid-column:1; grid-row:1; text-align:right;'
								: 'grid-column:3; grid-row:1;'}
						>
							<span class="mb-2 block font-body text-sm font-bold text-ink/45">0{i + 1}</span>
							<h3 class="font-display text-2xl leading-tight font-bold sm:text-3xl">
								{step.title}
							</h3>
							<p class="mt-3 text-base leading-relaxed font-medium text-ink/65">
								{@html step.body}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══════════════ FAQ ═══════════════ -->
	<section id="faq" class="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
		<div class="mx-auto w-full max-w-300 min-w-0">
			<div class="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
				<!-- Left Column -->
				<div class="lg:sticky lg:top-24 lg:self-start">
					<h2 class="font-display text-4xl leading-tight font-bold sm:text-5xl">
						Questions before regret.
					</h2>
					<p class="mt-4 max-w-md text-base leading-relaxed font-medium text-ink/65">
						Cheap can still be expensive. Know before you pay.
					</p>
				</div>

				<!-- Right Column: Accordion -->
				<div class="faq-accordion">
					{#each faqs as faq, i (faq.q)}
						<article class="faq-row border-t border-ink">
							<h3>
								<button
									type="button"
									class="faq-trigger flex w-full items-start justify-between py-6 text-left focus:outline-none"
									aria-expanded={activeFaq === i}
									onclick={() => (activeFaq = activeFaq === i ? -1 : i)}
								>
									<span class="pr-8 font-display text-lg font-bold sm:text-xl">{faq.q}</span>
									<span class="faq-icon relative mt-1 h-5 w-5 shrink-0">
										<span
											class="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 bg-ink transition-transform duration-300"
										></span>
										<span
											class="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 bg-ink transition-transform duration-300 {activeFaq ===
											i
												? 'scale-0 rotate-90'
												: 'scale-100'}"
										></span>
									</span>
								</button>
							</h3>
							{#if activeFaq === i}
								<div class="faq-content overflow-hidden" transition:slide={{ duration: 300 }}>
									<p class="pb-8 text-base leading-relaxed font-medium text-ink/65">
										{faq.a}
									</p>
								</div>
							{/if}
						</article>
					{/each}
					<div class="border-t border-ink"></div>
				</div>
			</div>
		</div>
	</section>
</main>

<style>
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
		background: var(--color-ink);
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
		filter: drop-shadow(8px 10px 0 color-mix(in oklab, var(--color-ink) 5.5%, transparent));
		animation: mascot-float 5.5s ease-in-out infinite;
	}

	.cube-line {
		fill: var(--color-paper);
		stroke: var(--color-ink);
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
		fill: var(--color-ink);
		stroke: var(--color-ink);
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
		stroke: var(--color-ink);
		stroke-width: 18;
		stroke-linecap: butt;
		stroke-linejoin: miter;
	}

	.eepy-pulse {
		animation: eepy-pulse 3s ease-in-out infinite;
	}

	.z-float {
		opacity: 0;
		animation: float-z 3.6s ease-in infinite;
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
		border-left: 2px dotted color-mix(in oklab, var(--color-ink) 25%, transparent);
		transform: translateX(-50%);
	}

	.timeline-step {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 2.5rem 1fr;
		align-items: start;
		padding: 1.5rem 0;
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
