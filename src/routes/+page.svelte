<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';

	type DemoPhase = 'idle' | 'running' | 'done';

	const demoLogs = [
		'[blep checking specs...]',
		'[blep scanning forum complaints...]',
		'[blep checking repairability...]',
		'[blep comparing price to regret...]',
		'[blep preparing verdict...]'
	];

	const evidenceCards = [
		{
			title: 'Repair signal',
			text: 'RAM and storage can be upgraded, so the machine has room to stay useful.'
		},
		{
			title: 'Forum pattern',
			text: 'Common complaints are battery wear and dust, not dead-board failures.'
		}
	];

	const steps = [
		{
			title: 'Paste the listing',
			text: 'Drop in a device name, marketplace listing, or spec sheet.'
		},
		{
			title: 'BLEP checks evidence',
			text: 'Specs, repairability signals, thermal reputation, forum complaints, and review patterns.'
		},
		{
			title: 'Get the verdict',
			text: 'A clear decision: approved, caution, or waste.'
		}
	];

	const reasons = [
		{
			title: 'Save money',
			text: 'Avoid devices that look cheap but become expensive.'
		},
		{
			title: 'Avoid landfill tech',
			text: 'Spot hardware that is too limited, sealed, or already obsolete.'
		},
		{
			title: 'Decode specs',
			text: 'Turn messy listings into a decision normal buyers can trust.'
		}
	];

	let listing = $state('Used ThinkPad T480, i5, 8GB RAM, 256GB SSD, $180');
	let demoPhase = $state<DemoPhase>('idle');
	let visibleLogs = $state<string[]>([]);
	let eyeX = $state(0);
	let eyeY = $state(0);
	let logTimer: ReturnType<typeof setTimeout> | undefined;

	const verdictReady = $derived(demoPhase === 'done');

	const clearDemoTimer = () => {
		if (logTimer) {
			clearTimeout(logTimer);
			logTimer = undefined;
		}
	};

	const showLog = (index: number, delay: number) => {
		logTimer = setTimeout(() => {
			visibleLogs = [...visibleLogs, demoLogs[index]];

			if (index === demoLogs.length - 1) {
				demoPhase = 'done';
				return;
			}

			showLog(index + 1, delay);
		}, delay);
	};

	const runDemo = () => {
		if (demoPhase === 'running') return;

		clearDemoTimer();
		visibleLogs = [];
		demoPhase = 'running';

		const prefersReducedMotion =
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		showLog(0, prefersReducedMotion ? 80 : 520);
	};

	const handleMascotPointer = (event: PointerEvent) => {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const x = (event.clientX - rect.left) / rect.width - 0.5;
		const y = (event.clientY - rect.top) / rect.height - 0.5;

		eyeX = -Math.max(-1, Math.min(1, x * 2)) * 25;
		eyeY = Math.max(-1, Math.min(1, y * 2)) * 20;
	};

	const resetMascotEyes = () => {
		eyeX = 0;
		eyeY = 0;
	};

	onDestroy(clearDemoTimer);
</script>

<svelte:head>
	<title>BLEP | Tiny AI hardware judge</title>
	<meta
		name="description"
		content="Paste a used laptop listing. BLEP checks specs, forums, and reviews, then gives you a clear buy, caution, or waste verdict."
	/>
</svelte:head>

<main class="min-h-screen bg-paper text-ink font-sans antialiased">
	<!-- Sticky Header -->
	<nav class="sticky top-0 z-50 border-b border-neutral-200 bg-paper/90 backdrop-blur-md" aria-label="Main">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a class="focus-ring shrink-0 transition hover:opacity-90" href="#top" aria-label="BLEP home">
				<img class="h-11 w-auto sm:h-12" src="/logo-full-main.svg" alt="BLEP Logo" />
			</a>

			<div class="hidden items-center gap-8 text-sm font-semibold text-neutral-600 md:flex">
				<a class="hover:text-ink transition" href="#how">How it works</a>
				<a class="hover:text-ink transition" href="#demo">Demo</a>
				<a class="hover:text-ink transition" href="#why">Why BLEP</a>
			</div>

			<a class="focus-ring bg-ink text-white hover:bg-neutral-800 px-4 py-2 text-xs font-bold rounded-lg transition shadow-sm" href="#demo">
				Try demo
			</a>
		</div>
	</nav>

	<!-- Hero Section -->
	<section id="top" class="paper-grid-light border-b border-neutral-200 px-6 py-16 sm:py-24">
		<div class="mx-auto max-w-6xl grid gap-12 lg:grid-cols-12 lg:items-center">
			<!-- Hero Left -->
			<div class="lg:col-span-7 space-y-6">

				<h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-tight">
					Don't buy e-waste with a keyboard.
				</h1>

				<p class="text-lg text-neutral-600 leading-relaxed max-w-xl">
					Paste a used laptop listing. BLEP scans technical specs, scour forums, and parses reviews, giving you a clear buy, caution, or waste verdict in seconds.
				</p>

				<div class="flex flex-wrap items-center gap-4 pt-2">
					<a href="#demo" class="soft-border bg-ink text-white hover:bg-neutral-800 px-6 py-3 text-sm font-bold rounded-xl soft-shadow-sm hover:-translate-x-px hover:-translate-y-px transition-all">
						Judge my listing
					</a>
					<a href="#how" class="soft-border bg-white text-ink hover:bg-neutral-50 px-6 py-3 text-sm font-bold rounded-xl transition-all">
						See how it works
					</a>
				</div>
			</div>

			<!-- Hero Right: Contained Mascot Card -->
			<div class="lg:col-span-5 flex justify-center">
				<div
					class="w-full max-w-105 aspect-square rounded-2xl paper-grid-light p-6 flex flex-col justify-between relative overflow-hidden soft-border shadow-sm group cursor-default"
					style:--eye-x={eyeX}
					style:--eye-y={eyeY}
					role="presentation"
					onpointermove={handleMascotPointer}
					onpointerleave={resetMascotEyes}
				>
					<!-- Top status line -->
					<div class="flex items-center justify-between border-b border-neutral-200 pb-3">
						<span class="text-[10px] font-mono tracking-wider text-neutral-400">BLEP COGNITIVE ENGINE</span>

					</div>

					<!-- Mascot Vector Stage -->
					<div class="mascot-stage flex-1 flex items-center justify-center relative" aria-hidden="true">
						<div class="orbit orbit-one"></div>
						<div class="orbit orbit-two"></div>
						
						<svg class="mascot-cube" viewBox="0 0 862.31 902.94" aria-hidden="true">
							<g transform="scale(-1, 1) translate(-862.31, 0)">
								<polygon class="cube-line" points="30 42.28 432.76 183.25 432.76 334.29 828.81 243.66 832.17 740.4 432.76 871.3 30 733.69 30 42.28" />
								<line class="cube-line" x1="33.36" y1="297.37" x2="201.17" y2="357.78" />
								<g class="eye-pair">
									<polygon class="mascot-eye" points="719.45 519.14 658.1 533.12 655.08 459.26 716.42 445.28 719.45 519.14" />
									<polygon class="mascot-eye" points="592.49 547.48 531.14 561.46 528.12 487.6 589.47 473.62 592.49 547.48" />
								</g>
							</g>
						</svg>
					</div>

					<!-- Bottom spec signals -->
					<div class="grid grid-cols-3 gap-2 text-ink">
						<div class="border border-neutral-200 rounded-xl p-2.5 bg-neutral-50/50 font-mono text-center">
							<p class="text-[9px] uppercase tracking-wider text-neutral-400">SIGNAL</p>
							<p class="mt-0.5 text-xs font-semibold text-neutral-800">Repairable</p>
						</div>
						<div class="border border-neutral-200 rounded-xl p-2.5 bg-neutral-50/50 font-mono text-center">
							<p class="text-[9px] uppercase tracking-wider text-neutral-400">RISK</p>
							<p class="mt-0.5 text-xs font-semibold text-neutral-800">Battery</p>
						</div>
						<div class="border border-neutral-200 rounded-xl p-2.5 bg-neutral-50/50 font-mono text-center">
							<p class="text-[9px] uppercase tracking-wider text-neutral-400">VERDICT</p>
							<p class="mt-0.5 text-xs font-semibold text-emerald-600">Approved</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Demo Section -->
	<section id="demo" class="px-6 py-20 bg-paper">
		<div class="mx-auto max-w-6xl">
			<div class="text-center max-w-2xl mx-auto mb-16 space-y-3">
				<h2 class="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">Test drive the AI Judge</h2>
				<p class="text-neutral-600">Simulate BLEP scanning a listing in real time. Click the button to inspect the hardware.</p>
			</div>

			<div class="grid gap-8 lg:grid-cols-12 items-start">
				<!-- Input Form Column -->
				<div class="lg:col-span-5">
					<form class="soft-border bg-white p-6 rounded-2xl soft-shadow-sm space-y-4" onsubmit={(event) => event.preventDefault()}>
						<div class="flex items-center justify-between">
							<span class="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">INPUT DATA</span>
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
								Brain Juice 1/2
							</span>
						</div>

						<div class="space-y-1.5">
							<label class="block text-sm font-bold text-neutral-700" for="listing">Listing / Specs Text</label>
							<textarea
								id="listing"
								class="focus-ring w-full min-h-35 resize-none border border-neutral-300 rounded-xl p-4 text-sm font-medium outline-none bg-neutral-50 focus:bg-white transition"
								bind:value={listing}
								placeholder="Paste specs or marketplace listing description here..."
							></textarea>
						</div>

						<button
							class="w-full bg-ink text-white hover:bg-neutral-800 disabled:bg-neutral-400 py-3.5 px-4 rounded-xl text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed flex items-center justify-center gap-2"
							type="button"
							onclick={runDemo}
							disabled={demoPhase === 'running' || !listing.trim()}
						>
							{#if demoPhase === 'running'}
								<svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Judging listing...
							{:else}
								Judge this listing
							{/if}
						</button>
					</form>
				</div>

				<!-- Output Panel Column -->
				<div class="lg:col-span-7">
					{#if demoPhase === 'idle'}
						<div class="soft-border bg-white rounded-2xl p-12 flex flex-col items-center justify-center text-center border-dashed border-neutral-300 min-h-90">
							<div class="h-12 w-12 rounded-xl bg-neutral-50 flex items-center justify-center text-xl mb-4 border border-neutral-200">
								🔍
							</div>
							<h3 class="font-bold text-neutral-900 text-lg">Verdict Preview</h3>
							<p class="text-sm text-neutral-500 mt-1 max-w-xs">
								Fill in the details and click the button to trigger a simulated AI evaluation receipt.
							</p>
						</div>
					{:else if demoPhase === 'running'}
						<div class="soft-border bg-neutral-950 text-neutral-200 rounded-2xl p-6 font-mono text-xs space-y-4 shadow-sm min-h-90 flex flex-col justify-between">
							<div class="space-y-3">
								<div class="flex items-center justify-between border-b border-neutral-800 pb-3">
									<span class="text-neutral-500 text-[10px] tracking-wider">BLEP AGENT INSPECTION LOG</span>
									<span class="text-emerald-400 animate-pulse text-[10px] font-bold">ANALYZING</span>
								</div>
								<div class="space-y-2.5">
									{#each visibleLogs as log (log)}
										<p class="flex items-center gap-2 text-emerald-400">
											<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
											<span>{log}</span>
										</p>
									{/each}
								</div>
							</div>
							<div class="text-[10px] text-neutral-600 text-right">
								Memory usage: 8.4MB / 16MB
							</div>
						</div>
					{:else if verdictReady}
						<!-- Verdict Receipt Card -->
						<div class="soft-border bg-white rounded-2xl p-6 soft-shadow space-y-6">
							<!-- Header -->
							<div class="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-5">
								<div>
									<span class="text-[10px] font-bold font-mono tracking-wider text-neutral-400 uppercase">INSPECTED SYSTEM</span>
									<h3 class="text-2xl font-extrabold text-neutral-900 mt-0.5">ThinkPad T480</h3>
								</div>
								<span class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
									APPROVED
								</span>
							</div>

							<!-- Spec Chips -->
							<div class="grid grid-cols-3 gap-3">
								<div class="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
									<span class="block text-[9px] font-bold font-mono tracking-wider text-neutral-400 uppercase">LANDFILL YEAR</span>
									<span class="block text-lg font-bold text-neutral-800 mt-0.5">2031</span>
								</div>
								<div class="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
									<span class="block text-[9px] font-bold font-mono tracking-wider text-neutral-400 uppercase">UPGRADEABLE</span>
									<span class="block text-lg font-bold text-neutral-800 mt-0.5">Yes</span>
								</div>
								<div class="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center">
									<span class="block text-[9px] font-bold font-mono tracking-wider text-neutral-400 uppercase">FORUM SCORE</span>
									<span class="block text-lg font-bold text-neutral-800 mt-0.5">8/10</span>
								</div>
							</div>

							<!-- Details block -->
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
									<span class="text-[10px] font-bold font-mono tracking-wider text-neutral-400 uppercase">FATAL FLAW</span>
									<p class="text-sm font-semibold text-neutral-800 mt-1">Battery health is the gamble. Check cycle count before paying.</p>
								</div>
								<div class="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
									<span class="text-[10px] font-bold font-mono tracking-wider text-neutral-400 uppercase">THERMAL CHARACTERISTICS</span>
									<p class="text-sm font-semibold text-neutral-800 mt-1">Manageable if cleaned</p>
								</div>
							</div>

							<!-- Blockquote roast -->
							<div class="bg-neutral-50 border-l-4 border-ink p-4 rounded-r-xl italic text-sm font-semibold text-neutral-600 leading-relaxed">
								"Old, square, and somehow still less embarrassing than a shiny sealed laptop with soldered regret."
							</div>

							<!-- Summary statement -->
							<p class="text-sm font-bold text-neutral-800">
								Verdict Summary: <span class="font-medium text-neutral-600">A repairable used laptop that can still make sense at the right price.</span>
							</p>

							<!-- Evidence list -->
							<div class="border-t border-neutral-100 pt-5 space-y-3">
								<span class="block text-[10px] font-bold font-mono tracking-wider text-neutral-400 uppercase">COLLECTED EVIDENCE</span>
								<div class="grid gap-3 sm:grid-cols-2">
									{#each evidenceCards as card (card.title)}
										<div class="border border-neutral-200 rounded-xl p-3.5 bg-neutral-50/50">
											<h4 class="text-xs font-bold text-neutral-700">{card.title}</h4>
											<p class="text-xs text-neutral-500 mt-1 leading-relaxed">{card.text}</p>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- How It Works Section -->
	<section id="how" class="border-t border-b border-neutral-200 bg-paper-dark px-6 py-20">
		<div class="mx-auto max-w-6xl">
			<div class="max-w-2xl space-y-3 mb-12">
				<span class="text-xs font-bold font-mono uppercase tracking-wider text-neutral-500">SYSTEM FLOW</span>
				<h2 class="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">Evidence first. Verdict second.</h2>
				<p class="text-neutral-600">BLEP evaluates listings pragmatically using real-world specs, forum signals, and review metadata.</p>
			</div>

			<div class="grid gap-6 md:grid-cols-3">
				{#each steps as step, index (step.title)}
					<div class="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm relative space-y-4">
						<div class="flex items-center justify-between">
							<span class="font-mono text-2xl font-black text-neutral-200">0{index + 1}</span>
							<span class="h-6 w-6 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-500">
								✓
							</span>
						</div>
						<h3 class="text-lg font-bold text-neutral-950">{step.title}</h3>
						<p class="text-sm text-neutral-600 leading-relaxed">{step.text}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Why BLEP Section -->
	<section id="why" class="px-6 py-20 bg-paper">
		<div class="mx-auto max-w-6xl">
			<div class="grid gap-12 lg:grid-cols-12 lg:items-end mb-12">
				<div class="lg:col-span-6 space-y-3">
					<span class="text-xs font-bold font-mono uppercase tracking-wider text-neutral-500">THE PROBLEM</span>
					<h2 class="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">Cheap hardware can still be expensive.</h2>
				</div>
				<div class="lg:col-span-6 lg:justify-self-end">
					<p class="text-neutral-600 max-w-md">
						We turn scattered forum feedback and vendor spec sheets into a clear decision system so your hard-earned money avoids e-waste landfills.
					</p>
				</div>
			</div>

			<div class="grid gap-6 md:grid-cols-3">
				{#each reasons as reason (reason.title)}
					<div class="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm space-y-4">
						<div class="h-10 w-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center text-lg">
							🎯
						</div>
						<h3 class="text-lg font-bold text-neutral-950">{reason.title}</h3>
						<p class="text-sm text-neutral-600 leading-relaxed">{reason.text}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-neutral-200 bg-paper-dark px-6 py-12">
		<div class="mx-auto max-w-6xl flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-4">
				<img class="h-10 w-auto" src="/logo-full-main.svg" alt="BLEP Logo" />
				<p class="text-sm text-neutral-500 font-semibold max-w-sm">
					Fast, factual hardware decisions before you spend.
				</p>
			</div>
			<div class="flex items-center gap-6 text-sm font-semibold text-neutral-500">
				<a class="hover:text-ink transition" href="#top">Back to top</a>
				<a class="hover:text-ink transition" href={resolve('/privacy')}>Privacy</a>
				<a class="hover:text-ink transition" href={resolve('/terms')}>Terms</a>
			</div>
		</div>
	</footer>
</main>

<style>
	/* Orbit design in light theme */
	.orbit {
		position: absolute;
		border: 1px dashed rgba(17, 17, 17, 0.08);
		border-radius: 999px;
	}

	.orbit-one {
		width: 85%;
		height: 140px;
		transform: rotate(-15deg);
	}

	.orbit-two {
		width: 65%;
		height: 100px;
		transform: rotate(20deg);
		opacity: 0.7;
	}

	.mascot-cube {
		position: relative;
		z-index: 3;
		width: min(85%, 280px);
		filter: drop-shadow(-10px 12px 0 rgba(0, 0, 0, 0.03));
		animation: cube-float 5s ease-in-out infinite;
	}

	.cube-line {
		fill: none;
		stroke: #111111;
		stroke-linejoin: miter;
		stroke-miterlimit: 10;
		stroke-linecap: butt;
		stroke-width: 45;
	}

	.eye-pair {
		transform: translate(calc(var(--eye-x) * 1px), calc(var(--eye-y) * 1px));
		transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.mascot-eye {
		fill: #111111;
		stroke: #111111;
		stroke-width: 15;
		stroke-linejoin: miter;
		stroke-miterlimit: 10;
		transform-box: fill-box;
		transform-origin: center;
		animation: blink 6s infinite;
	}

	@keyframes cube-float {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	@keyframes blink {
		0%, 90%, 100% {
			transform: scaleY(1);
		}
		93% {
			transform: scaleY(0.1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.001ms !important;
		}
	}
</style>
