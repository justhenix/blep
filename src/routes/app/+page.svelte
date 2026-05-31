<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';

	// ─── Types ───────────────────────────────────────────────────────────
	type ToolStatus = 'queued' | 'running' | 'done';
	type AppMode = 'idle' | 'running' | 'done' | 'error';

	type ToolStep = {
		id: string;
		name: string;
		label: string;
		status: ToolStatus;
		output?: string;
	};

	type ChatMessage = {
		role: 'user' | 'blep';
		content: string;
		timestamp: number;
	};

	type VerdictResult = {
		mode: 'VERDICT';
		name: string;
		verdict: 'APPROVED' | 'CAUTION' | 'WASTE';
		fatal_flaw: string;
		landfill_year: number;
		roast: string;
		summary: string;
		better_target?: string;
		confidence: string;
		specs: {
			upgradeable: boolean;
			thermal: string;
			forum_score: number;
		};
		evidence: { title: string; url: string; quote_or_fact: string; relevance: string }[];
	};

	type RecommendationResult = {
		mode: 'RECOMMENDATION';
		query: string;
		parsed_need: {
			category: string;
			use_case: string;
			budget_idr: number | null;
			market: string;
		};
		recommendation_summary: string;
		target_specs: Record<string, string>;
		picks: {
			label: string;
			name: string;
			expected_price_idr: number | null;
			why: string;
			caveat: string;
		}[];
		avoid: { pattern: string; reason: string }[];
		deal_rules: string[];
		confidence: string;
		next_action: string;
	};

	type ComparisonResult = {
		mode: 'COMPARISON';
		query: string;
		winner: string;
		loser: string;
		verdict: 'CLEAR_WIN' | 'CLOSE_CALL' | 'BOTH_BAD';
		reason: string;
		compared: {
			name: string;
			price_idr: number | null;
			strengths: string[];
			flaws: string[];
			verdict: 'APPROVED' | 'CAUTION' | 'WASTE';
		}[];
		confidence: string;
	};

	type ScanResult = VerdictResult | RecommendationResult | ComparisonResult;

	type HistoryEntry = {
		id: string;
		query: string;
		verdict?: string;
		timestamp: number;
	};

	type PromptCard = {
		title: string;
		text: string;
		sample: string;
	};

	// ─── State ───────────────────────────────────────────────────────────
	let mode: AppMode = $state('idle');
	let input = $state('');
	let messages: ChatMessage[] = $state([]);
	let toolSteps: ToolStep[] = $state([]);
	let scanResult: ScanResult | null = $state(null);
	let sidebarOpen = $state(false);
	let thinkingOpen = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let mainEl = $state<HTMLElement | null>(null);
	let brainJuice = $state(2);

	const history: HistoryEntry[] = $state([
		{
			id: '1',
			query: 'Lenovo LOQ RTX 4050 14 juta',
			verdict: 'APPROVED',
			timestamp: Date.now() - 86400000
		},
		{
			id: '2',
			query: 'Acer Aspire 5 Ryzen 3 12 juta',
			verdict: 'WASTE',
			timestamp: Date.now() - 172800000
		},
		{
			id: '3',
			query: 'Gaming laptop 15 juta recommendation',
			verdict: 'RECOMMENDATION',
			timestamp: Date.now() - 259200000
		}
	]);

	const promptCards: PromptCard[] = [
		{
			title: 'Judge a listing',
			text: 'Paste marketplace text or URL.',
			sample: 'Acer Swift Go 14 Ultra 7, 32GB RAM, 1TB SSD, 19 juta. Worth it?'
		},
		{
			title: 'Find recommendation',
			text: 'Budget + use case.',
			sample: 'Recommend gaming laptop 15 juta in Indonesia.'
		},
		{
			title: 'Compare',
			text: 'Two options enter. One survives.',
			sample: 'Lenovo LOQ RTX 4050 vs Acer Nitro V RTX 4050, which one?'
		}
	];

	// ─── Mock Data ───────────────────────────────────────────────────────

	const MOCK_TOOL_STEPS: Omit<ToolStep, 'status'>[] = [
		{ id: 'intent', name: 'intent.detect', label: 'classifying request' },
		{ id: 'market', name: 'market.search', label: 'checking current price bracket' },
		{ id: 'spec', name: 'spec.extract', label: 'reading CPU, GPU, RAM, screen' },
		{ id: 'complaint', name: 'complaint.scan', label: 'looking for heat, repair, forum complaints' },
		{ id: 'alt', name: 'alternative.compare', label: 'checking better nearby options' },
		{ id: 'verdict', name: 'verdict.render', label: 'building verdict card' }
	];

	const BLEP_LOG_LINES = [
		'[blep reading budget...]',
		'[blep sniffing seller cope...]',
		'[blep checking money saving devices...]',
		'[blep scanning forum thoughts...]',
		'[blep detecting bad spec...]',
		'[blep comparing nearby damage...]',
		'[blep counting future regret...]',
		'[blep building verdict...]'
	];

	const MOCK_VERDICT: VerdictResult = {
		mode: 'VERDICT',
		name: 'Acer Swift Go 14 Ultra 7',
		verdict: 'CAUTION',
		fatal_flaw: 'Good machine, but price must beat newer OLED/Ultra deals nearby.',
		landfill_year: 2031,
		roast:
			'Solid internals wearing a premium sticker. The price has to justify itself against newer configs.',
		summary:
			'The Swift Go 14 is a capable ultrabook, but at 19 juta the buyer must confirm this config beats the latest Ultra 5/7 OLED deals in the same bracket.',
		better_target: 'Compare against Core Ultra 5/7 OLED configs under same budget.',
		confidence: 'MOCK',
		specs: {
			upgradeable: false,
			thermal: 'Fanless under light load, audible under sustained CPU work.',
			forum_score: 7
		},
		evidence: [
			{
				title: 'Mock evidence (caution)',
				url: 'https://example.com/blep/mock-evidence',
				quote_or_fact: 'Mock mode active; no live web research was performed.',
				relevance: 'Proves response shape and validation path before AI integration.'
			}
		]
	};

	const MOCK_RECOMMENDATION: RecommendationResult = {
		mode: 'RECOMMENDATION',
		query: 'gaming laptop 15 juta',
		parsed_need: {
			category: 'laptop',
			use_case: 'gaming',
			budget_idr: 15000000,
			market: 'Indonesia'
		},
		recommendation_summary:
			'At 15 juta, target RTX 4050 class with 16GB RAM and 144Hz panel. Reject soldered 8GB and U-series CPUs wearing gaming stickers.',
		target_specs: {
			cpu: 'Ryzen 5 / Core i5 H-series (8 cores)',
			gpu: 'RTX 4050 class minimum',
			ram: '16GB dual-channel',
			storage: '512GB NVMe SSD',
			screen: '15.6" 144Hz IPS',
			thermal: 'Dual-fan with acceptable sustained clocks',
			upgradeability: 'Upgradeable RAM preferred'
		},
		picks: [
			{
				label: 'BEST_OVERALL',
				name: 'RTX 4050 gaming laptop target',
				expected_price_idr: null,
				why: 'Hits the playable-modern-games bracket without overpaying for badge GPUs.',
				caveat: 'Mock pick. Exact model depends on live listing evidence.'
			},
			{
				label: 'CHEAPER_SAFE',
				name: 'RTX 3050 laptop only if much cheaper',
				expected_price_idr: null,
				why: 'Acceptable when non-GPU value (panel, build, RAM) is strong.',
				caveat: 'Only if the price gap is real, not marketing.'
			},
			{
				label: 'STRETCH_PICK',
				name: 'RTX 4060 deal if found near budget',
				expected_price_idr: null,
				why: 'Worth stretching only when price is close and cooling is not trash.',
				caveat: 'Do not chase RTX 4060 if RAM, screen, or thermals are cut down.'
			}
		],
		avoid: [
			{ pattern: 'RTX 2050 above 10-11 juta', reason: 'Old entry GPU wearing a gaming sticker.' },
			{
				pattern: 'GTX 1650 premium listings',
				reason: 'Too old for this bracket unless brutally cheap.'
			},
			{
				pattern: '8GB single-channel final config',
				reason: 'Kills multitasking and cannot be fixed later.'
			}
		],
		deal_rules: [
			'Demand RTX 4050+ at this budget before paying.',
			'Reject 8GB soldered RAM as a final config.',
			'Check sustained thermals, not just peak benchmarks.'
		],
		confidence: 'MOCK',
		next_action: 'Send 2 listing links and BLEP will judge final pick.'
	};

	const MOCK_COMPARISON: ComparisonResult = {
		mode: 'COMPARISON',
		query: 'Lenovo LOQ RTX 4050 vs Acer Nitro V RTX 4050',
		winner: 'Lenovo LOQ RTX 4050',
		loser: 'Acer Nitro V RTX 4050',
		verdict: 'CLOSE_CALL',
		reason:
			'Both are competent RTX 4050 machines. Lenovo LOQ edges on thermals and build reputation. Acer Nitro V may win on price if discounted.',
		compared: [
			{
				name: 'Lenovo LOQ RTX 4050',
				price_idr: null,
				strengths: ['Better sustained thermals', 'Stronger forum reputation'],
				flaws: ['Higher asking price'],
				verdict: 'APPROVED'
			},
			{
				name: 'Acer Nitro V RTX 4050',
				price_idr: null,
				strengths: ['Possibly cheaper', 'Decent screen'],
				flaws: ['Weaker cooling', 'Mixed build quality reports'],
				verdict: 'CAUTION'
			}
		],
		confidence: 'MOCK'
	};

	// ─── Helpers ─────────────────────────────────────────────────────────

	const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

	const scrollToBottom = () => {
		if (mainEl) {
			requestAnimationFrame(() => {
				mainEl!.scrollTop = mainEl!.scrollHeight;
			});
		}
	};

	const detectMockResultType = (query: string): ScanResult => {
		const lower = query.toLowerCase();
		if (
			lower.includes('vs') ||
			lower.includes('versus') ||
			lower.includes('mending') ||
			lower.includes('compare')
		) {
			return MOCK_COMPARISON;
		}
		if (
			lower.includes('recommend') ||
			lower.includes('rekomendasi') ||
			lower.includes('cari') ||
			lower.includes('best')
		) {
			return MOCK_RECOMMENDATION;
		}
		return MOCK_VERDICT;
	};

	const verdictColor = (v: string) => {
		switch (v) {
			case 'APPROVED':
				return 'bg-mint text-ink';
			case 'CAUTION':
				return 'bg-[#FFE566] text-ink';
			case 'WASTE':
				return 'bg-ink text-white';
			default:
				return 'bg-paper-dark text-ink';
		}
	};

	const compVerdictColor = (v: string) => {
		switch (v) {
			case 'CLEAR_WIN':
				return 'bg-mint text-ink';
			case 'CLOSE_CALL':
				return 'bg-[#FFE566] text-ink';
			case 'BOTH_BAD':
				return 'bg-ink text-white';
			default:
				return 'bg-paper-dark text-ink';
		}
	};

	const formatIdr = (value: number | null) =>
		value === null ? '—' : `Rp${value.toLocaleString('id-ID')}`;

	const labelFor = (value: string) =>
		value
			.split('_')
			.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
			.join(' ');

	// ─── Mock Scan ───────────────────────────────────────────────────────

	async function runMockScan(query: string) {
		if (!query.trim() || mode === 'running') return;

		mode = 'running';
		scanResult = null;
		brainJuice = Math.max(0, brainJuice - 1);

		messages = [
			...messages,
			{ role: 'user', content: query, timestamp: Date.now() }
		];

		// Initialize tool steps
		toolSteps = MOCK_TOOL_STEPS.map((s) => ({ ...s, status: 'queued' as ToolStatus }));
		scrollToBottom();

		// Animate through steps
		for (let i = 0; i < toolSteps.length; i++) {
			toolSteps[i].status = 'running';
			await delay(600 + Math.random() * 500);
			toolSteps[i].status = 'done';
			toolSteps[i].output = BLEP_LOG_LINES[i] ?? '[blep done]';
		}

		await delay(400);

		const result = detectMockResultType(query);
		scanResult = result;

		messages = [
			...messages,
			{
				role: 'blep',
				content:
					result.mode === 'VERDICT'
						? `Verdict: ${(result as VerdictResult).verdict}`
						: result.mode === 'RECOMMENDATION'
							? 'Recommendation ready.'
							: 'Comparison complete.',
				timestamp: Date.now()
			}
		];

		mode = 'done';
		input = '';
		scrollToBottom();
	}

	// ─── Handlers ────────────────────────────────────────────────────────

	const handleSubmit = () => {
		if (input.trim() && mode !== 'running') {
			runMockScan(input.trim());
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handlePromptCard = (sample: string) => {
		input = sample;
		runMockScan(sample);
	};

	const handleTrySample = () => {
		const sample = promptCards[0].sample;
		input = sample;
		runMockScan(sample);
	};

	const resetToIdle = () => {
		mode = 'idle';
		messages = [];
		toolSteps = [];
		scanResult = null;
		input = '';
	};

	// ─── Lifecycle ───────────────────────────────────────────────────────
	onMount(() => {
		textareaEl?.focus();
	});
</script>

<svelte:head>
	<title>BLEP — Hardware Court</title>
	<meta
		name="description"
		content="Paste a listing, screenshot text, or ask for a recommendation. BLEP judges hardware deals."
	/>
</svelte:head>

<div class="app-shell">
	<!-- ═══ NAVBAR ═══ -->
	<nav class="app-navbar" aria-label="App navigation">
		<div class="app-navbar__left">
			<a href="/" class="focus-visible-ring flex items-center" aria-label="BLEP home">
				<img class="h-5 w-auto sm:h-6" src="/logo-full-main.svg" alt="BLEP" />
			</a>
		</div>
		<div class="app-navbar__center">
			<span class="font-mono text-[10px] font-bold tracking-[0.15em] text-ink/50 uppercase"
				>hardware court</span
			>
		</div>
		<div class="app-navbar__right">
			<a
				href="/"
				class="focus-visible-ring font-display text-xs font-semibold text-ink/60 underline decoration-ink/30 underline-offset-2 transition hover:text-ink"
				>Back home</a
			>
			<span
				class="inline-flex items-center gap-1.5 border border-ink/20 px-2.5 py-1 font-mono text-[10px] font-bold text-ink/70 uppercase"
			>
				<span
					class="inline-block h-1.5 w-1.5 {brainJuice > 0 ? 'bg-mint' : 'bg-ink/30'}"
				></span>
				Brain Juice {brainJuice}/2
			</span>
		</div>
	</nav>

	<div class="app-body">
		<!-- ═══ LEFT SIDEBAR: HISTORY ═══ -->
		<aside class="app-sidebar-left" class:sidebar-open={sidebarOpen} aria-label="Scan history">
			<div class="sidebar-header">
				<h2 class="font-display text-sm font-bold uppercase tracking-wide">History</h2>
				<button
					class="focus-visible-ring sidebar-close-btn lg:hidden"
					onclick={() => (sidebarOpen = false)}
					aria-label="Close history"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			<ul class="sidebar-list">
				{#each history as entry (entry.id)}
					<li class="sidebar-item">
						<button
							class="focus-visible-ring sidebar-item-btn"
							onclick={() => {
								input = entry.query;
								sidebarOpen = false;
							}}
						>
							<span class="sidebar-item-query">{entry.query}</span>
							{#if entry.verdict}
								<span class="sidebar-item-badge {verdictColor(entry.verdict)}"
									>{entry.verdict}</span
								>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
			{#if history.length === 0}
				<p class="px-4 py-8 text-center font-mono text-[10px] text-ink/40 uppercase">No scans yet</p>
			{/if}
		</aside>

		<!-- ═══ MAIN ═══ -->
		<main class="app-main" bind:this={mainEl}>
			<!-- Mobile toolbar -->
			<div class="mobile-toolbar lg:hidden">
				<button
					class="focus-visible-ring mobile-toolbar-btn"
					onclick={() => (sidebarOpen = !sidebarOpen)}
					aria-label="Toggle history"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 6h16M4 12h16M4 18h16" />
					</svg>
					<span>History</span>
				</button>
				{#if mode === 'running' || mode === 'done'}
					<button
						class="focus-visible-ring mobile-toolbar-btn"
						onclick={() => (thinkingOpen = !thinkingOpen)}
						aria-label="Toggle thinking log"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M9 5l7 7-7 7" />
						</svg>
						<span>Thinking</span>
					</button>
				{/if}
			</div>

			<!-- ─── Idle State ─── -->
			{#if mode === 'idle'}
				<div class="idle-state" in:fade={{ duration: 200 }}>
					<!-- Mascot tiny -->
					<div class="idle-mascot" aria-hidden="true">
						<svg viewBox="0 0 862.31 902.94" class="h-16 w-16 opacity-25">
							<g transform="scale(-1, 1) translate(-862.31, 0)">
								<polygon
									class="cube-line-mini"
									points="30 42.28 432.76 183.25 432.76 334.29 828.81 243.66 832.17 740.4 432.76 871.3 30 733.69 30 42.28"
								/>
								<polygon
									fill="#111"
									points="719.45 519.14 658.1 533.12 655.08 459.26 716.42 445.28 719.45 519.14"
								/>
								<polygon
									fill="#111"
									points="592.49 547.48 531.14 561.46 528.12 487.6 589.47 473.62 592.49 547.48"
								/>
							</g>
						</svg>
					</div>

					<h1 class="idle-heading">What are we judging?</h1>
					<p class="idle-subtext">
						Paste a listing, screenshot text, or ask for a recommendation.
					</p>

					<div class="prompt-cards">
						{#each promptCards as card, i (card.title)}
							<button
								class="focus-visible-ring prompt-card"
								onclick={() => handlePromptCard(card.sample)}
								in:fly={{ y: 20, delay: i * 80, duration: 300 }}
							>
								<span class="prompt-card-marker" aria-hidden="true">+</span>
								<div>
									<h3 class="prompt-card-title">{card.title}</h3>
									<p class="prompt-card-text">{card.text}</p>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- ─── Chat / Result ─── -->
			{#if mode !== 'idle'}
				<div class="chat-area">
					{#each messages as msg, i (msg.timestamp + i)}
						<div
							class="chat-msg {msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--blep'}"
							in:fly={{ y: 12, duration: 200 }}
						>
							{#if msg.role === 'user'}
								<div class="chat-bubble-user">
									<p>{msg.content}</p>
								</div>
							{:else}
								<div class="chat-bubble-blep">
									<span class="chat-label-blep">blep</span>
									<p>{msg.content}</p>
								</div>
							{/if}
						</div>
					{/each}

					<!-- Mobile thinking log -->
					{#if (mode === 'running' || mode === 'done') && thinkingOpen}
						<div class="mobile-thinking-panel lg:hidden" transition:slide={{ duration: 200 }}>
							<div class="sidebar-header">
								<h3 class="font-mono text-[10px] font-bold tracking-[0.15em] text-ink/50 uppercase">
									Thinking log
								</h3>
							</div>
							<ul class="tool-steps-list">
								{#each toolSteps as step (step.id)}
									<li class="tool-step" class:tool-step--done={step.status === 'done'}>
										<div class="tool-step-header">
											<code class="tool-step-name">{step.name}</code>
											<span
												class="tool-step-badge"
												class:badge-queued={step.status === 'queued'}
												class:badge-running={step.status === 'running'}
												class:badge-done={step.status === 'done'}
											>
												{step.status}
											</span>
										</div>
										<p class="tool-step-label">{step.label}</p>
										{#if step.output}
											<p class="tool-step-output" in:fade={{ duration: 150 }}>{step.output}</p>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- ─── Result Card ─── -->
					{#if scanResult}
						<div class="result-card" in:fly={{ y: 24, duration: 350 }}>
							{#if scanResult.mode === 'VERDICT'}
								{@const v = scanResult as VerdictResult}
								<div class="result-card-inner">
									<header class="result-header">
										<div>
											<h2 class="result-device-name">{v.name}</h2>
											<p class="result-meta">
												Landfill: {v.landfill_year} · Forum: {v.specs.forum_score}/10
											</p>
										</div>
										<span class="verdict-stamp {verdictColor(v.verdict)}">{v.verdict}</span>
									</header>

									<div class="result-fatal-flaw">
										<span class="result-label">Fatal flaw</span>
										<p>{v.fatal_flaw}</p>
									</div>

									<blockquote class="result-roast">
										"{v.roast}"
									</blockquote>

									<p class="result-summary">{v.summary}</p>

									{#if v.better_target}
										<div class="result-better-target">
											<span class="result-label">Better target</span>
											<p>{v.better_target}</p>
										</div>
									{/if}

									<div class="result-specs-row">
										<div class="result-spec-chip">
											<span class="result-label">Upgradeable</span>
											<span>{v.specs.upgradeable ? 'Yes' : 'No'}</span>
										</div>
										<div class="result-spec-chip">
											<span class="result-label">Thermal</span>
											<span class="text-xs">{v.specs.thermal}</span>
										</div>
									</div>

									<div class="result-evidence">
										<span class="result-label">Evidence</span>
										{#each v.evidence as ev (ev.title)}
											<div class="evidence-item">
												<p class="evidence-quote">"{ev.quote_or_fact}"</p>
												<p class="evidence-relevance">{ev.relevance}</p>
											</div>
										{/each}
									</div>

									<div class="result-confidence">
										<span class="font-mono text-[9px] font-bold text-ink/40 uppercase"
											>Confidence</span
										>
										<span class="font-mono text-xs font-bold">{v.confidence}</span>
									</div>
								</div>
							{:else if scanResult.mode === 'RECOMMENDATION'}
								{@const r = scanResult as RecommendationResult}
								<div class="result-card-inner">
									<header class="result-header">
										<div>
											<h2 class="result-device-name">Build this instead.</h2>
											<p class="result-meta">
												{r.parsed_need.category} · {r.parsed_need.use_case} · {formatIdr(
													r.parsed_need.budget_idr
												)} · {r.parsed_need.market}
											</p>
										</div>
										<span class="verdict-stamp bg-mint text-ink">{r.confidence}</span>
									</header>

									<p class="result-summary">{r.recommendation_summary}</p>

									<div class="result-specs-grid">
										{#each Object.entries(r.target_specs) as [key, val] (key)}
											<div class="result-spec-item">
												<span class="result-label">{labelFor(key)}</span>
												<span class="text-sm">{val}</span>
											</div>
										{/each}
									</div>

									<div class="result-picks">
										<span class="result-label">Picks</span>
										{#each r.picks as pick (pick.label + pick.name)}
											<div class="pick-card">
												<div class="pick-header">
													<h3 class="pick-name">{pick.name}</h3>
													<span class="pick-label">{labelFor(pick.label)}</span>
												</div>
												<p class="pick-why">{pick.why}</p>
												<p class="pick-caveat">{pick.caveat}</p>
											</div>
										{/each}
									</div>

									<div class="result-avoid-rules">
										<div>
											<span class="result-label">Avoid traps</span>
											{#each r.avoid as trap (trap.pattern)}
												<div class="avoid-item">
													<strong>{trap.pattern}</strong>
													<p>{trap.reason}</p>
												</div>
											{/each}
										</div>
										<div>
											<span class="result-label">Deal rules</span>
											<ol class="deal-rules-list">
												{#each r.deal_rules as rule (rule)}
													<li>{rule}</li>
												{/each}
											</ol>
										</div>
									</div>

									<div class="result-next-action">
										<span class="result-label">Next action</span>
										<p>{r.next_action}</p>
									</div>
								</div>
							{:else if scanResult.mode === 'COMPARISON'}
								{@const c = scanResult as ComparisonResult}
								<div class="result-card-inner">
									<header class="result-header">
										<div>
											<h2 class="result-device-name">
												{c.winner} <span class="text-ink/40">vs</span>
												{c.loser}
											</h2>
										</div>
										<span class="verdict-stamp {compVerdictColor(c.verdict)}"
											>{c.verdict.replace('_', ' ')}</span
										>
									</header>

									<p class="result-summary">{c.reason}</p>

									<div class="comparison-grid">
										{#each c.compared as item (item.name)}
											<div class="comparison-card">
												<div class="comparison-card-header">
													<h3 class="font-display text-lg font-bold">{item.name}</h3>
													<span
														class="verdict-stamp-small {verdictColor(item.verdict)}"
														>{item.verdict}</span
													>
												</div>
												<div class="comparison-lists">
													<div>
														<span class="result-label">Strengths</span>
														<ul>
															{#each item.strengths as s (s)}
																<li class="comparison-plus">+ {s}</li>
															{/each}
														</ul>
													</div>
													<div>
														<span class="result-label">Flaws</span>
														<ul>
															{#each item.flaws as f (f)}
																<li class="comparison-minus">− {f}</li>
															{/each}
														</ul>
													</div>
												</div>
											</div>
										{/each}
									</div>

									<div class="result-confidence">
										<span class="font-mono text-[9px] font-bold text-ink/40 uppercase"
											>Confidence</span
										>
										<span class="font-mono text-xs font-bold">{c.confidence}</span>
									</div>
								</div>
							{/if}

							<!-- New scan button -->
							<button class="new-scan-btn focus-visible-ring" onclick={resetToIdle}>
								New scan
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- ═══ COMPOSER ═══ -->
			<div class="composer-dock">
				<div class="composer-inner">
					<label for="blep-input" class="sr-only">Your hardware question</label>
					<textarea
						id="blep-input"
						bind:this={textareaEl}
						bind:value={input}
						onkeydown={handleKeydown}
						rows="1"
						disabled={mode === 'running'}
						placeholder={'Paste listing link, specs, or ask: "gaming laptop 15 juta"'}
						class="composer-textarea focus-visible-ring"
					></textarea>
					<div class="composer-actions">
						{#if mode === 'idle'}
							<button
								class="focus-visible-ring try-sample-btn"
								onclick={handleTrySample}
								type="button"
							>
								Try sample
							</button>
						{/if}
						<button
							class="focus-visible-ring judge-btn"
							onclick={handleSubmit}
							disabled={mode === 'running' || !input.trim()}
							type="button"
						>
							{#if mode === 'running'}
								<span class="judge-btn-spinner"></span>
								Thinking
							{:else}
								Judge
							{/if}
						</button>
					</div>
				</div>
			</div>
		</main>

		<!-- ═══ RIGHT SIDEBAR: THINKING LOG ═══ -->
		<aside class="app-sidebar-right" aria-label="Thinking log">
			<div class="sidebar-header">
				<h2 class="font-mono text-[10px] font-bold tracking-[0.15em] text-ink/50 uppercase">
					Thinking log
				</h2>
			</div>

			{#if toolSteps.length === 0}
				<div class="flex flex-col items-center justify-center px-4 py-16 text-center">
					<div class="mb-3 h-px w-8 bg-ink/15"></div>
					<p class="font-mono text-[10px] leading-relaxed text-ink/35 uppercase">
						Submit a query to see<br />agent tool calls here
					</p>
					<div class="mt-3 h-px w-8 bg-ink/15"></div>
				</div>
			{:else}
				<ul class="tool-steps-list">
					{#each toolSteps as step (step.id)}
						<li
							class="tool-step"
							class:tool-step--done={step.status === 'done'}
							in:fly={{ x: 12, duration: 200 }}
						>
							<div class="tool-step-header">
								<code class="tool-step-name">{step.name}</code>
								<span
									class="tool-step-badge"
									class:badge-queued={step.status === 'queued'}
									class:badge-running={step.status === 'running'}
									class:badge-done={step.status === 'done'}
								>
									{step.status}
								</span>
							</div>
							<p class="tool-step-label">{step.label}</p>
							{#if step.output}
								<p class="tool-step-output" in:fade={{ duration: 150 }}>{step.output}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
</div>

<style>
	/* ═══════════════════════════════════════════════════════════════════════
	   BLEP APP SHELL
	   ═══════════════════════════════════════════════════════════════════════ */

	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
	}

	/* ── Navbar ── */
	.app-navbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		height: 3rem;
		border-bottom: 1px solid rgba(17, 17, 17, 0.12);
		padding: 0 1rem;
		flex-shrink: 0;
	}

	.app-navbar__left {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.app-navbar__center {
		flex: 0 0 auto;
	}

	.app-navbar__right {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	/* ── Body grid ── */
	.app-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Sidebars ── */
	.app-sidebar-left,
	.app-sidebar-right {
		flex-shrink: 0;
		overflow-y: auto;
		border-color: rgba(17, 17, 17, 0.12);
	}

	.app-sidebar-left {
		width: 15rem;
		border-right: 1px solid rgba(17, 17, 17, 0.12);
		display: none;
	}

	.app-sidebar-right {
		width: 17rem;
		border-left: 1px solid rgba(17, 17, 17, 0.12);
		display: none;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid rgba(17, 17, 17, 0.08);
	}

	.sidebar-close-btn {
		background: none;
		border: none;
		padding: 0.25rem;
		cursor: pointer;
		color: var(--color-ink);
	}

	.sidebar-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.sidebar-item {
		border-bottom: 1px solid rgba(17, 17, 17, 0.06);
	}

	.sidebar-item-btn {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		padding: 0.75rem 1rem;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		transition: background-color 120ms ease;
	}

	.sidebar-item-btn:hover {
		background-color: rgba(17, 17, 17, 0.03);
	}

	.sidebar-item-query {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.4;
		color: var(--color-ink);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.sidebar-item-badge {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 6px;
		display: inline-block;
		width: fit-content;
	}

	/* ── Main area ── */
	.app-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow-y: auto;
		position: relative;
	}

	/* ── Mobile toolbar ── */
	.mobile-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid rgba(17, 17, 17, 0.08);
		flex-shrink: 0;
	}

	.mobile-toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: 1px solid rgba(17, 17, 17, 0.15);
		padding: 0.3rem 0.6rem;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
		color: var(--color-ink);
		transition: border-color 120ms;
	}

	.mobile-toolbar-btn:hover {
		border-color: var(--color-ink);
	}

	/* ── Mobile sidebar overlay ── */
	@media (max-width: 1023px) {
		.app-sidebar-left {
			position: fixed;
			top: 3rem;
			left: 0;
			bottom: 0;
			z-index: 40;
			width: 16rem;
			background: var(--color-paper);
			transform: translateX(-100%);
			transition: transform 200ms ease;
		}

		.app-sidebar-left.sidebar-open {
			transform: translateX(0);
			box-shadow: 4px 0 24px rgba(0, 0, 0, 0.08);
			display: block;
		}
	}

	/* ── Idle state ── */
	.idle-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem 6rem;
		text-align: center;
	}

	.idle-mascot {
		margin-bottom: 1.5rem;
	}

	.cube-line-mini {
		fill: var(--color-paper);
		stroke: #111;
		stroke-width: 28;
		stroke-linejoin: miter;
		stroke-miterlimit: 10;
	}

	.idle-heading {
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 3.2rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.idle-subtext {
		margin-top: 0.75rem;
		font-family: var(--font-body);
		font-size: 1rem;
		color: rgba(17, 17, 17, 0.55);
		font-weight: 500;
		max-width: 28rem;
	}

	/* ── Prompt cards ── */
	.prompt-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
		margin-top: 2rem;
		width: 100%;
		max-width: 42rem;
	}

	.prompt-card {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 1rem;
		border: 1px solid rgba(17, 17, 17, 0.18);
		background: white;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 150ms,
			transform 100ms;
	}

	.prompt-card:hover {
		border-color: var(--color-ink);
		transform: translateY(-1px);
	}

	.prompt-card-marker {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: 700;
		color: rgba(17, 17, 17, 0.3);
		line-height: 1;
		margin-top: 0.15rem;
	}

	.prompt-card-title {
		font-family: var(--font-display);
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.3;
	}

	.prompt-card-text {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: rgba(17, 17, 17, 0.55);
		margin-top: 0.15rem;
		line-height: 1.4;
		font-weight: 500;
	}

	/* ── Chat ── */
	.chat-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.5rem 1rem 6rem;
		max-width: 48rem;
		margin: 0 auto;
		width: 100%;
	}

	.chat-msg {
		display: flex;
	}

	.chat-msg--user {
		justify-content: flex-end;
	}

	.chat-msg--blep {
		justify-content: flex-start;
	}

	.chat-bubble-user {
		max-width: 80%;
		border: 1px solid var(--color-ink);
		background: var(--color-ink);
		color: white;
		padding: 0.625rem 0.875rem;
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.5;
	}

	.chat-bubble-blep {
		max-width: 80%;
		border: 1px solid rgba(17, 17, 17, 0.15);
		background: white;
		padding: 0.625rem 0.875rem;
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.5;
	}

	.chat-label-blep {
		display: block;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(17, 17, 17, 0.4);
		margin-bottom: 0.25rem;
	}

	/* ── Mobile thinking panel ── */
	.mobile-thinking-panel {
		border: 1px solid rgba(17, 17, 17, 0.12);
		background: var(--color-paper-dark);
		margin: 0.5rem 0;
	}

	/* ── Result card ── */
	.result-card {
		max-width: 48rem;
		width: 100%;
	}

	.result-card-inner {
		border: 2px solid var(--color-ink);
		background: white;
		padding: 1.5rem;
	}

	.result-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(17, 17, 17, 0.12);
	}

	.result-device-name {
		font-family: var(--font-display);
		font-size: clamp(1.25rem, 3vw, 1.75rem);
		font-weight: 800;
		line-height: 1.15;
	}

	.result-meta {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		color: rgba(17, 17, 17, 0.5);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-top: 0.25rem;
	}

	.verdict-stamp {
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.35rem 0.75rem;
		transform: rotate(-2deg);
		flex-shrink: 0;
		box-shadow: 3px 3px 0 0 rgba(17, 17, 17, 0.9);
	}

	.verdict-stamp-small {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 6px;
		letter-spacing: 0.04em;
	}

	.result-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(17, 17, 17, 0.45);
		margin-bottom: 0.3rem;
	}

	.result-fatal-flaw {
		margin-bottom: 1rem;
	}

	.result-fatal-flaw p {
		font-family: var(--font-body);
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.5;
	}

	.result-roast {
		border-left: 3px solid var(--color-ink);
		padding-left: 0.875rem;
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-style: italic;
		line-height: 1.6;
		color: rgba(17, 17, 17, 0.75);
		margin-bottom: 1rem;
	}

	.result-summary {
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.6;
		color: rgba(17, 17, 17, 0.7);
		margin-bottom: 1rem;
	}

	.result-better-target {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--color-paper-dark);
		border: 1px solid rgba(17, 17, 17, 0.08);
	}

	.result-better-target p {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.5;
	}

	.result-specs-row {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.result-spec-chip {
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(17, 17, 17, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.result-specs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.result-spec-item {
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(17, 17, 17, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.result-evidence {
		margin-bottom: 1rem;
	}

	.evidence-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(17, 17, 17, 0.06);
	}

	.evidence-quote {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-style: italic;
		color: rgba(17, 17, 17, 0.65);
		line-height: 1.5;
	}

	.evidence-relevance {
		font-family: var(--font-mono);
		font-size: 10px;
		color: rgba(17, 17, 17, 0.4);
		margin-top: 0.2rem;
	}

	.result-confidence {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(17, 17, 17, 0.08);
	}

	/* ── Recommendation-specific ── */
	.result-picks {
		margin-bottom: 1.25rem;
	}

	.pick-card {
		border: 1px solid rgba(17, 17, 17, 0.15);
		padding: 0.75rem;
		margin-top: 0.5rem;
		background: white;
	}

	.pick-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.pick-name {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 700;
	}

	.pick-label {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(17, 17, 17, 0.45);
		letter-spacing: 0.05em;
	}

	.pick-why {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.5;
		color: rgba(17, 17, 17, 0.7);
	}

	.pick-caveat {
		font-family: var(--font-mono);
		font-size: 10px;
		color: rgba(17, 17, 17, 0.4);
		margin-top: 0.25rem;
	}

	.result-avoid-rules {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.avoid-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(17, 17, 17, 0.06);
	}

	.avoid-item strong {
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 700;
		display: block;
	}

	.avoid-item p {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: rgba(17, 17, 17, 0.55);
		margin-top: 0.1rem;
		line-height: 1.4;
	}

	.deal-rules-list {
		list-style: decimal;
		padding-left: 1.125rem;
	}

	.deal-rules-list li {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.5;
		padding: 0.25rem 0;
		color: rgba(17, 17, 17, 0.7);
	}

	.result-next-action {
		padding: 0.75rem;
		background: var(--color-paper-dark);
		border: 1px solid rgba(17, 17, 17, 0.08);
	}

	.result-next-action p {
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.5;
	}

	/* ── Comparison ── */
	.comparison-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.comparison-card {
		border: 1px solid rgba(17, 17, 17, 0.15);
		padding: 0.875rem;
	}

	.comparison-card-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(17, 17, 17, 0.08);
	}

	.comparison-lists {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.comparison-plus {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgba(17, 17, 17, 0.7);
		line-height: 1.5;
	}

	.comparison-minus {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgba(17, 17, 17, 0.5);
		line-height: 1.5;
	}

	/* ── New scan button ── */
	.new-scan-btn {
		display: block;
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.625rem;
		border: 1px solid rgba(17, 17, 17, 0.2);
		background: transparent;
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition:
			background-color 120ms,
			border-color 120ms;
	}

	.new-scan-btn:hover {
		background: var(--color-ink);
		color: white;
		border-color: var(--color-ink);
	}

	/* ── Tool steps ── */
	.tool-steps-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.tool-step {
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid rgba(17, 17, 17, 0.06);
		transition: opacity 200ms;
	}

	.tool-step--done {
		opacity: 0.55;
	}

	.tool-step-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.tool-step-name {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--color-ink);
	}

	.tool-step-badge {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 1px 5px;
	}

	.badge-queued {
		color: rgba(17, 17, 17, 0.35);
		border: 1px solid rgba(17, 17, 17, 0.12);
	}

	.badge-running {
		color: var(--color-ink);
		border: 1px solid var(--color-ink);
		animation: badge-pulse 1.2s ease-in-out infinite;
	}

	.badge-done {
		color: rgba(17, 17, 17, 0.4);
		background: rgba(17, 17, 17, 0.06);
		border: 1px solid rgba(17, 17, 17, 0.06);
	}

	.tool-step-label {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 500;
		color: rgba(17, 17, 17, 0.5);
		margin-top: 0.15rem;
		line-height: 1.4;
	}

	.tool-step-output {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		color: rgba(17, 17, 17, 0.4);
		margin-top: 0.25rem;
	}

	/* ── Composer ── */
	.composer-dock {
		position: sticky;
		bottom: 0;
		padding: 0.75rem 1rem 0.875rem;
		background: linear-gradient(to bottom, transparent, var(--color-paper) 30%);
		flex-shrink: 0;
	}

	.composer-inner {
		max-width: 48rem;
		margin: 0 auto;
		border: 1px solid rgba(17, 17, 17, 0.25);
		background: white;
		display: flex;
		flex-direction: column;
		transition: border-color 150ms;
	}

	.composer-inner:focus-within {
		border-color: var(--color-ink);
	}

	.composer-textarea {
		font-family: var(--font-body);
		font-size: 0.9375rem;
		font-weight: 500;
		line-height: 1.5;
		padding: 0.75rem 0.875rem 0.25rem;
		border: none;
		background: transparent;
		resize: none;
		outline: none;
		min-height: 2.5rem;
		max-height: 8rem;
		color: var(--color-ink);
		field-sizing: content;
	}

	.composer-textarea::placeholder {
		color: rgba(17, 17, 17, 0.35);
	}

	.composer-textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.composer-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
	}

	.try-sample-btn {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(17, 17, 17, 0.45);
		background: none;
		border: 1px solid rgba(17, 17, 17, 0.12);
		padding: 0.3rem 0.5rem;
		cursor: pointer;
		transition:
			border-color 120ms,
			color 120ms;
	}

	.try-sample-btn:hover {
		border-color: var(--color-ink);
		color: var(--color-ink);
	}

	.judge-btn {
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		padding: 0.4rem 1rem;
		border: 1px solid var(--color-ink);
		background: var(--color-ink);
		color: white;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		transition:
			background-color 120ms,
			opacity 120ms;
	}

	.judge-btn:hover:not(:disabled) {
		background: white;
		color: var(--color-ink);
	}

	.judge-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.judge-btn-spinner {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spinner-spin 0.6s linear infinite;
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

	/* ── Keyframes ── */
	@keyframes badge-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes spinner-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Desktop ── */
	@media (min-width: 1024px) {
		.app-sidebar-left {
			display: block;
		}
		.app-sidebar-right {
			display: block;
		}
	}

	/* ── Small mobile ── */
	@media (max-width: 480px) {
		.prompt-cards {
			grid-template-columns: 1fr;
		}

		.result-avoid-rules {
			grid-template-columns: 1fr;
		}

		.comparison-grid {
			grid-template-columns: 1fr;
		}

		.result-specs-row {
			grid-template-columns: 1fr;
		}
	}

	/* ── Reduced motion ── */
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
