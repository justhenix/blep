<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { spring } from 'svelte/motion';
	import { fade } from 'svelte/transition';

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
		if (typeof IntersectionObserver === 'undefined') return;

		const visible = new SvelteSet<number>();

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

<main class="flex-grow">
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
				<p class="mt-5 font-mono text-sm font-bold text-ink uppercase">
					Approved / Caution / Waste
				</p>

				<div class="mt-8 flex flex-wrap items-center gap-3">
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink bg-ink px-6 font-display text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-white hover:text-ink"
						href="#demo"
					>
						Ask BLEP
					</a>
					<a
						class="focus-visible-ring inline-flex min-h-12 items-center border border-ink/35 bg-white px-6 font-display text-sm font-semibold tracking-[0.01em] text-ink transition hover:border-ink"
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

	<section id="how" class="border-y border-ink/15 bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
							class="bg-white p-8 transition-all duration-300 md:p-12
								{activeStep === i ? 'border border-ink opacity-100' : 'border border-ink/10 opacity-40'}"
							style={i % 2 === 0
								? 'grid-column:1; grid-row:1; text-align:right;'
								: 'grid-column:3; grid-row:1;'}
						>
							<span class="mb-2 block font-body text-sm font-bold text-ink/45">0{i + 1}</span>
							<h3 class="font-display text-2xl leading-tight font-bold sm:text-3xl">
								{step.title}
							</h3>
							<p class="mt-3 text-base leading-relaxed font-medium text-ink/65">{step.body}</p>
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
					<h2 class="font-display text-4xl font-bold sm:text-5xl">Cheap can still be expensive.</h2>
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
		font-family: var(--font-body);
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
