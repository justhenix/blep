<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	type Mode = 'idle' | 'running' | 'done';
	type Intent = 'verdict' | 'recommendation' | 'comparison';
	type SidebarActiveView = 'new_scan' | 'history';

	type ChatMessage = {
		id?: string;
		role: 'user' | 'blep';
		content: string;
		timestamp: number;
		status?: 'loading' | 'done' | 'error';
		result?: MockResult | null;
	};

	let { data } = $props();

	type ToolStep = {
		id: string;
		name: string;
		label: string;
		status: 'queued' | 'running' | 'done';
		output?: string;
	};

	type VerdictResult = {
		mode: 'VERDICT';
		title: string;
		badge: string;
		fatal_flaw: string;
		why_it_matters: string;
		better_target: string;
		next_action: string;
	};

	type RecommendationResult = {
		mode: 'RECOMMENDATION';
		title: string;
		summary: string;
		buy_target: string[];
		avoid: { pattern: string; reason: string }[];
		deal_rules: string[];
		next_action: string;
	};

	type ComparisonResult = {
		mode: 'COMPARISON';
		title: string;
		badge: string;
		summary: string;
		compared: { name: string; points: string[] }[];
		winner_row: string;
		next_action: string;
	};

	type MockResult = VerdictResult | RecommendationResult | ComparisonResult;

	type HistoryEntry = {
		id: string;
		query: string;
		verdict: 'APPROVED' | 'WASTE' | 'RECOMMENDATION';
		timestamp: number;
	};

	type PromptCard = {
		label: string;
		placeholder: string;
		sample: string;
		intent: Intent;
	};

	const fontDisplay = 'font-display';
	const fontBody = 'font-body';
	const fontMono = 'font-mono-ui';

	let mode = $state<Mode>('idle');
	let draftInput = $state('');
	let selectedMode = $state<Intent | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let toolSteps = $state<ToolStep[]>([]);
	let brainJuice = $state(3);

	let now = $state(new Date());

	const tooltipText = $derived.by(() => {
		if (brainJuice >= 3) {
			return 'quota full';
		}
		const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
		const diffMs = midnight.getTime() - now.getTime();
		const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		if (diffHrs > 0) {
			return `resets in ${diffHrs}h ${diffMins}m`;
		}
		return `resets in ${diffMins}m`;
	});
	let activeHistoryId = $state<string | null>(null);
	let activeSidebarView = $state<SidebarActiveView>('new_scan');
	let elapsedSeconds = $state(0);
	let sidebarExpanded = $state(true);
	let isMobileRail = $state(false);
	let activityOpen = $state(false);

	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let chatViewportEl = $state<HTMLElement | null>(null);
	let elapsedTimer: ReturnType<typeof setInterval> | null = null;

	const history: HistoryEntry[] = [
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
	];

	const promptCards: PromptCard[] = [
		{
			label: 'Listing',
			placeholder: 'Paste laptop link, specs, or ask “gaming laptop 15 juta”',
			sample: 'Acer Swift Go 14 Ultra 7, 32GB RAM, 1TB SSD, 19 juta. Worth it?',
			intent: 'verdict'
		},
		{
			label: 'Recommend',
			placeholder: 'Paste laptop link, specs, or ask “gaming laptop 15 juta”',
			sample: 'Gaming laptop 15 juta recommendation',
			intent: 'recommendation'
		},
		{
			label: 'Compare',
			placeholder: 'Paste laptop link, specs, or ask “gaming laptop 15 juta”',
			sample: 'Lenovo LOQ RTX 4050 vs Acer Nitro V RTX 4050, which one?',
			intent: 'comparison'
		}
	];

	const heroVariants = [
		{
			headline: 'BLEP saves your wallet.',
			subhead: 'Paste a listing, compare picks, or ask for a budget target.'
		},
		{
			headline: 'Stop buying overpriced junk.',
			subhead: 'Paste a listing. BLEP checks if price makes sense.'
		},
		{
			headline: 'Bad deals look good now.',
			subhead: 'BLEP checks specs, price, and better options.'
		},
		{
			headline: 'Ask first. Regret less.',
			subhead: 'BLEP finds weak specs, fake value, and better targets.'
		},
		{
			headline: 'Know before you buy.',
			subhead: 'Drop a listing or budget. BLEP gives clean buying signal.'
		},
	];
	let activeHero = $state(heroVariants[data.initialHeroIndex ?? 0]);

	const modeByIntent = (intent: Intent | null) =>
		promptCards.find((card) => card.intent === intent) ?? promptCards[0];

	const TOOL_STEPS_BY_INTENT = {
		verdict: [
			{ id: 'intent', name: 'intent.detect', label: 'Classifying request' },
			{ id: 'listing', name: 'listing.parse', label: 'Parsing listing details' },
			{ id: 'market', name: 'market.search', label: 'Scanning local marketplace' },
			{ id: 'spec', name: 'spec.extract', label: 'Extracting specifications' },
			{ id: 'trap', name: 'trap.scan', label: 'Scanning for seller traps' },
			{ id: 'verdict', name: 'verdict.render', label: 'Rendering final output' }
		],
		recommendation: [
			{ id: 'intent', name: 'intent.detect', label: 'Classifying request' },
			{ id: 'budget', name: 'budget.parse', label: 'Reading budget constraints' },
			{ id: 'market', name: 'market.search', label: 'Scanning local marketplace' },
			{ id: 'spec', name: 'spec.target', label: 'Finding acceptable hardware' },
			{ id: 'trap', name: 'trap.scan', label: 'Looking for seller traps' },
			{ id: 'verdict', name: 'verdict.render', label: 'Rendering final output' }
		],
		comparison: [
			{ id: 'intent', name: 'intent.detect', label: 'Classifying request' },
			{ id: 'option', name: 'option.parse', label: 'Parsing compared options' },
			{ id: 'market', name: 'market.search', label: 'Scanning local marketplace' },
			{ id: 'spec', name: 'spec.compare', label: 'Comparing specifications side-by-side' },
			{ id: 'trap', name: 'trap.scan', label: 'Looking for traps' },
			{ id: 'winner', name: 'winner.render', label: 'Rendering winner output' }
		]
	} as const;

	const LOG_OUTPUTS_BY_INTENT = {
		verdict: [
			'Verdict scan request found',
			'Parsed device name & listing details',
			'Found comparable local options',
			'Extracted spec sheet details',
			'No direct listing traps detected',
			'Verdict card complete'
		],
		recommendation: [
			'Recommendation request found',
			'Budget: 15 juta / market: Indonesia',
			'Checking current price bracket',
			'Targeting RTX 4050-class',
			'Rejecting RTX 2050 and 8GB traps',
			'Building recommendation panel'
		],
		comparison: [
			'Comparison request found',
			'Options: Lenovo LOQ and Acer Nitro V detected',
			'Querying benchmark and pricing info',
			'Chassis & thermal performance evaluated',
			'RAM soldered warning checked',
			'Comparison verdict card built'
		]
	} as const;

	const MOCK_VERDICT: VerdictResult = {
		mode: 'VERDICT',
		title: 'Listing verdict',
		badge: 'CAUTION / MOCK',
		fatal_flaw: 'Good machine, but price must beat newer OLED/Ultra deals nearby.',
		why_it_matters:
			'Swift Go 14 is capable, but at 19 juta buyer must confirm this config beats latest Ultra 5/7 OLED deals in same bracket.',
		better_target: 'Compare against Core Ultra 5/7 OLED configs under same budget.',
		next_action: 'Send listing link and BLEP will judge final pick.'
	};

	const MOCK_RECOMMENDATION: RecommendationResult = {
		mode: 'RECOMMENDATION',
		title: 'Recommendation target',
		summary: 'Target RTX 4050-class. Avoid RTX 2050 above 10-11 juta.',
		buy_target: [
			'Ryzen 5 / Core i5 H-series',
			'RTX 4050 class minimum',
			'16GB dual-channel',
			'512GB NVMe SSD',
			'15.6" 144Hz IPS',
			'Dual-fan cooling',
			'Upgradeable RAM preferred'
		],
		avoid: [
			{ pattern: 'RTX 2050 above 10-11 juta', reason: 'Old entry GPU wearing a gaming sticker.' },
			{ pattern: 'GTX 1650 premium listings', reason: 'Too old unless brutally cheap.' },
			{ pattern: '8GB single-channel final config', reason: 'Kills multitasking and ages badly.' }
		],
		deal_rules: [
			'Demand RTX 4050+ at this budget before paying.',
			'Reject 8GB soldered RAM as final config.',
			'Check sustained thermals, not peak benchmarks.'
		],
		next_action: 'Send 2 listing links and BLEP will judge final pick.'
	};

	const MOCK_COMPARISON: ComparisonResult = {
		mode: 'COMPARISON',
		title: 'Pick cleaner 4050 deal',
		badge: 'MOCK COMPARISON',
		summary:
			'Lenovo LOQ usually wins if cooling, RAM, and price are sane. Nitro V can win only if cheaper with same RAM and warranty.',
		compared: [
			{
				name: 'Lenovo LOQ RTX 4050',
				points: ['stronger chassis target', 'check RAM config', 'check warranty/price']
			},
			{
				name: 'Acer Nitro V RTX 4050',
				points: ['okay if cheaper', 'watch thermals', 'reject bad RAM config']
			}
		],
		winner_row: 'Winner: Lenovo LOQ, unless Nitro V is meaningfully cheaper.',
		next_action: 'Send both listing links. BLEP will judge final pick.'
	};

	const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

	const detectIntent = (query: string): Intent => {
		const lower = query.toLowerCase();
		if (
			/\b(vs|versus)\b/.test(lower) ||
			lower.includes('mending') ||
			lower.includes('compare') ||
			lower.includes('which one')
		) {
			return 'comparison';
		}
		if (
			lower.includes('recommend') ||
			lower.includes('rekomendasi') ||
			lower.includes('gaming laptop') ||
			lower.includes('cari') ||
			lower.includes('best')
		) {
			return 'recommendation';
		}
		return 'verdict';
	};

	const verdictColor = (value: string) => {
		const upper = value.toUpperCase();
		if (upper.includes('APPROVED')) return 'verdict-approved';
		if (upper.includes('CAUTION')) return 'verdict-caution';
		if (upper.includes('WASTE')) return 'verdict-waste';
		if (upper.includes('RECOMMENDATION')) return 'verdict-recommendation';
		return 'verdict-default';
	};

	const startElapsedTimer = () => {
		elapsedSeconds = 0;
		elapsedTimer = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
	};

	const stopElapsedTimer = () => {
		if (elapsedTimer) {
			clearInterval(elapsedTimer);
			elapsedTimer = null;
		}
	};

	const scrollToBottom = async () => {
		await tick();
		if (chatViewportEl) {
			chatViewportEl.scrollTop = chatViewportEl.scrollHeight;
		}
	};

	async function runMockScan(query: string) {
		if (!query.trim() || mode === 'running') return;

		const runId = crypto.randomUUID();
		mode = 'running';
		activeHistoryId = null;

		if (brainJuice <= 0) {
			messages = [
				...messages,
				{ id: `${runId}-user`, role: 'user', content: query, timestamp: Date.now() },
				{
					id: `${runId}-assistant`,
					role: 'blep',
					status: 'loading',
					content: 'Checking brain reserves...',
					timestamp: Date.now()
				}
			];
			draftInput = '';
			scrollToBottom();
			await delay(1000);
			const tiredResponses = [
				"BLEP is tired, ask again later!",
				"BLEPpp?! Oh, no BLEP is tired. Ask again later?",
				"Sorry buddy, ask me again later okay?",
				"My silicon brain is completely out of juice. Try again later!",
				"I'm depleted. No more hardware judging for now. Ask me again later!"
			];
			const randomResponse = tiredResponses[Math.floor(Math.random() * tiredResponses.length)];
			messages = messages.map((m) =>
				m.id === `${runId}-assistant` ? { ...m, status: 'done', content: randomResponse } : m
			);
			mode = 'done';
			scrollToBottom();
			return;
		}

		brainJuice = Math.max(0, brainJuice - 1);
		messages = [
			...messages,
			{ id: `${runId}-user`, role: 'user', content: query, timestamp: Date.now() },
			{
				id: `${runId}-assistant`,
				role: 'blep',
				status: 'loading',
				content: 'Checking market traps...',
				timestamp: Date.now()
			}
		];
		draftInput = '';

		const intent = detectIntent(query);
		toolSteps = TOOL_STEPS_BY_INTENT[intent].map((step) => ({
			...step,
			status: 'queued' as const
		}));

		startElapsedTimer();
		scrollToBottom();

		try {
			const logs = LOG_OUTPUTS_BY_INTENT[intent];
			for (let i = 0; i < toolSteps.length; i++) {
				toolSteps[i].status = 'running';
				await delay(600 + Math.random() * 500);
				toolSteps[i].status = 'done';
				toolSteps[i].output = logs[i];
			}

			await delay(300);
			stopElapsedTimer();

			let result: MockResult;
			let content = '';
			if (intent === 'comparison') {
				result = MOCK_COMPARISON;
				content = 'Pick cleaner 4050 deal.';
			} else if (intent === 'recommendation') {
				result = MOCK_RECOMMENDATION;
				content = 'Target RTX 4050-class. Avoid RTX 2050 above 10-11 juta.';
			} else {
				result = MOCK_VERDICT;
				content = 'Verdict is CAUTION. Here is why.';
			}

			messages = messages.map((m) =>
				m.id === `${runId}-assistant` ? { ...m, status: 'done', content, result } : m
			);
		} catch {
			messages = messages.map((m) =>
				m.id === `${runId}-assistant`
					? { ...m, status: 'error', content: 'Scan failed. Previous result kept.' }
					: m
			);
		} finally {
			mode = 'done';
			selectedMode = intent;
			scrollToBottom();
		}
	}

	const handleSubmit = () => {
		if (draftInput.trim() && mode !== 'running') runMockScan(draftInput.trim());
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	};

	const handleModeChip = (card: PromptCard) => {
		selectedMode = card.intent;
		draftInput = card.sample;
		textareaEl?.focus();
	};

	const expandSidebar = () => {
		sidebarExpanded = true;
	};

	const collapseSidebar = () => {
		sidebarExpanded = false;
	};

	const clearScanContext = () => {
		mode = 'idle';
		messages = [];
		toolSteps = [];
		draftInput = '';
		selectedMode = null;
		activeHistoryId = null;
		elapsedSeconds = 0;
		stopElapsedTimer();
	};

	const handleNewScanClick = () => {
		clearScanContext();
		activeHero = heroVariants[Math.floor(Math.random() * heroVariants.length)];
		activeSidebarView = 'new_scan';
		requestAnimationFrame(() => textareaEl?.focus());
	};

	const loadHistoryItem = (entry: HistoryEntry) => {
		activeSidebarView = 'history';
		activeHistoryId = entry.id;
		draftInput = entry.query;
		mode = 'done';

		if (entry.verdict === 'RECOMMENDATION') {
			selectedMode = 'recommendation';
			messages = [
				{ id: 'hist-user', role: 'user', content: entry.query, timestamp: Date.now() - 5000 },
				{
					id: 'hist-blep',
					role: 'blep',
					status: 'done',
					content: 'Target RTX 4050-class. Avoid RTX 2050 above 10-11 juta.',
					timestamp: Date.now(),
					result: MOCK_RECOMMENDATION
				}
			];
			toolSteps = TOOL_STEPS_BY_INTENT.recommendation.map((step, i) => ({
				...step,
				status: 'done' as const,
				output: LOG_OUTPUTS_BY_INTENT.recommendation[i]
			}));
		} else {
			selectedMode = 'verdict';
			const res =
				entry.verdict === 'APPROVED'
					? {
							mode: 'VERDICT' as const,
							title: 'Listing verdict',
							badge: 'APPROVED / MOCK',
							fatal_flaw: 'None major. Solid screen and upgradeable RAM.',
							why_it_matters:
								'Lenovo LOQ at 14 million is one of cleaner budget RTX 4050 entries in Indonesia. Decent cooling, upgradeable slots, honest pricing.',
							better_target: 'Compare with Acer Nitro V to see if cheaper same-spec deal exists.',
							next_action: 'Send listing link and BLEP will judge final pick.'
						}
					: {
							mode: 'VERDICT' as const,
							title: 'Listing verdict',
							badge: 'WASTE / MOCK',
							fatal_flaw: 'Soldered 8GB RAM and weak CPU at 12 million.',
							why_it_matters:
								'At 12 million, Ryzen 3 with soldered 8GB RAM is seller charity. Find Ryzen 5 or older RTX 3050 laptops instead.',
							better_target: 'Look for Ryzen 5 / 16GB upgradeable configs.',
							next_action: 'Send listing link and BLEP will judge final pick.'
						};
			messages = [
				{ id: 'hist-user', role: 'user', content: entry.query, timestamp: Date.now() - 5000 },
				{
					id: 'hist-blep',
					role: 'blep',
					status: 'done',
					content:
						entry.verdict === 'APPROVED'
							? 'Verdict is APPROVED. Here is why.'
							: 'Verdict is WASTE. Here is why.',
					timestamp: Date.now(),
					result: res
				}
			];
			toolSteps = TOOL_STEPS_BY_INTENT.verdict.map((step, i) => ({
				...step,
				status: 'done' as const,
				output: LOG_OUTPUTS_BY_INTENT.verdict[i]
			}));
		}
		scrollToBottom();
	};

	const canSubmit = $derived(draftInput.trim().length > 0 && mode !== 'running');
	const collapsed = $derived(!sidebarExpanded || isMobileRail);
	const sidebarWidth = $derived(collapsed ? '68px' : '292px');
	const activityWidth = $derived(activityOpen ? '320px' : '0px');
	const composerPlaceholder = $derived(modeByIntent(selectedMode).placeholder);

	onMount(() => {
		document.documentElement.classList.add('app-lock');
		document.body.classList.add('app-lock');

		textareaEl?.focus();
		const mediaQuery = window.matchMedia('(max-width: 980px)');
		const syncMobileRail = () => {
			isMobileRail = mediaQuery.matches;
		};

		syncMobileRail();
		mediaQuery.addEventListener('change', syncMobileRail);

		const interval = setInterval(() => {
			now = new Date();
		}, 60000);

		return () => {
			document.documentElement.classList.remove('app-lock');
			document.body.classList.remove('app-lock');
			mediaQuery.removeEventListener('change', syncMobileRail);
			clearInterval(interval);
			stopElapsedTimer();
		};
	});
</script>

<svelte:head>
	<title>BLEP — Hardware Court</title>
	<meta
		name="description"
		content="Paste a listing, screenshot text, or ask for a recommendation. BLEP judges hardware deals."
	/>
</svelte:head>

{#snippet ActivityLog()}
	<div class="activity-inner">
		<div class="activity-header">
			<div>
				<h2 class="activity-title {fontDisplay}">Activity</h2>
				<p class="activity-subtitle {fontMono}">
					{mode === 'running' ? `${elapsedSeconds}s running` : 'agent trace'}
				</p>
			</div>
			<button
				type="button"
				class="btnIcon panel-close"
				onclick={() => (activityOpen = false)}
				aria-label="Close activity"
			>
				×
			</button>
		</div>

		<div class="activity-body">
			{#if toolSteps.length === 0}
				<div class="activity-empty">
					<div class="activity-empty-line"></div>
					<p class="activity-empty-text {fontMono}">Submit query.<br />Tool calls appear here.</p>
					<div class="activity-empty-line"></div>
				</div>
			{:else}
				<ul class="activity-steps" aria-label="Activity steps">
					{#each toolSteps as step (step.id)}
						<li class="activity-step" class:step-done={step.status === 'done'}>
							<div class="activity-step-head">
								<code class="activity-step-name {fontMono}">{step.name}</code>
								<span
									class="activity-step-status {fontMono}"
									class:step-running={step.status === 'running'}
									class:step-queued={step.status === 'queued'}
								>
									{step.status}
								</span>
							</div>
							<p class="activity-step-label {fontBody}">{step.label}</p>
							{#if step.output}
								<p class="activity-step-output {fontMono}">{step.output}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet Composer()}
	<div class="composer-wrap">
		<div class="composer-box">
			<label for="blep-input" class="sr-only">Your hardware question</label>
			<textarea
				id="blep-input"
				bind:this={textareaEl}
				bind:value={draftInput}
				onkeydown={handleKeydown}
				disabled={mode === 'running'}
				placeholder={composerPlaceholder}
				class="composer-textarea {fontBody}"
				style="min-height: 80px; padding: 12px;"
			></textarea>
			<div class="composer-actions-row">
				<button
					class="btnPrimary composer-primary"
					onclick={handleSubmit}
					disabled={!canSubmit}
					type="button"
				>
					{mode === 'running' ? 'Asking...' : 'Ask BLEP'}
				</button>
			</div>
		</div>

		{#if messages.length === 0}
			<div class="composer-chips-under">
				<div class="mode-chips" aria-label="Scan mode">
					{#each promptCards as card (card.intent)}
						<button
							class="mode-chip {fontDisplay}"
							class:selected={selectedMode === card.intent}
							onclick={() => handleModeChip(card)}
							type="button"
							aria-pressed={selectedMode === card.intent}
						>
							{card.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<p class="composer-disclaimer {fontBody}">BLEP can make mistakes. You decide the final buy.</p>
	</div>
{/snippet}

<div
	class="app-shell {fontBody}"
	style:--sidebar-width={sidebarWidth}
	style:--activity-width={activityWidth}
>
	<aside id="sidebar" class="sidebar" class:collapsed aria-label="Scan history">
		<div class="sidebar-brand">
			<button
				type="button"
				class="sidebar-brand-button icon-only"
				onclick={expandSidebar}
				aria-label="Expand sidebar"
				aria-expanded={!collapsed}
				aria-controls="sidebar"
			>
				<img src="/logo-main.svg" alt="" class="sidebar-logo-icon" />
			</button>
			<div class="sidebar-brand-expanded">
				<a href="/" class="sidebar-brand-link" aria-label="BLEP home">
					<img src="/logo-full-main.svg" alt="BLEP" class="sidebar-logo-full" />
				</a>
				<button
					type="button"
					class="btnIcon sidebar-toggle"
					onclick={collapseSidebar}
					aria-label="Collapse sidebar"
					aria-expanded={!collapsed}
					aria-controls="sidebar"
				>
					‹
				</button>
			</div>
		</div>

		<button
			class="sidebar-new"
			class:active={activeSidebarView === 'new_scan'}
			onclick={handleNewScanClick}
			type="button"
			aria-label="New scan"
			aria-current={activeSidebarView === 'new_scan' ? 'page' : undefined}
		>
			<span class="sidebar-new-icon" aria-hidden="true">+</span>
			<span class="sidebar-new-text">New scan</span>
		</button>

		<div class="sidebar-label {fontMono}">History</div>

		<ul class="sidebar-history">
			{#each history as entry (entry.id)}
				<li>
					<button
						class="sidebar-history-item"
						class:active={activeHistoryId === entry.id}
						onclick={() => loadHistoryItem(entry)}
						type="button"
						aria-label={entry.query}
					>
						<span class="history-dot {verdictColor(entry.verdict)}" aria-hidden="true"></span>
						<span class="history-copy">
							<span class="history-query {fontBody}">{entry.query}</span>
							<span class="history-badge {fontMono} {verdictColor(entry.verdict)}"
								>{entry.verdict}</span
							>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	<main class="main-column">
		<header class="main-actions" aria-label="App actions">
			<div class="brain-badge {fontMono}" aria-label={`Brain Juice ${brainJuice} of 3`} data-tooltip={tooltipText}>
				<span class="brain-dot" class:active={brainJuice > 0}></span>
				BRAIN JUICE {brainJuice}/3
			</div>
			<button
				type="button"
				class="log-toggle {fontDisplay}"
				onclick={() => (activityOpen = !activityOpen)}
				aria-expanded={activityOpen}
				aria-controls="activity-panel"
			>
				Log
			</button>
		</header>

		<section class="chat-viewport" bind:this={chatViewportEl} aria-label="Chat">
			<div class="chat-inner">
				{#if mode === 'idle'}
					<div class="idle-stack" in:fade={{ duration: 150 }}>
						<div class="idle-copy">
							<div class="idle-heading-row">
								<img src="/logo-main.svg" alt="" class="idle-mark" />
								<h1 class="idle-heading {fontDisplay}">{activeHero.headline}</h1>
							</div>
							<p class="idle-subcopy {fontBody}">
								{activeHero.subhead}
							</p>
						</div>

						<div class="idle-bottom">
							{@render Composer()}
						</div>
					</div>
				{:else}
					<div class="messages-list">
						{#each messages as msg, idx (msg.id || msg.timestamp + idx)}
							{#if msg.role === 'user'}
								<div class="chat-run">
									<div
										class="msg-row msg-user"
										in:fly={{ y: 10, duration: 160 }}
									>
										<div class="msg-bubble-user {fontBody}">
											<p>{msg.content}</p>
										</div>
									</div>

									{#if messages[idx + 1] && messages[idx + 1].role === 'blep'}
										{@const blepMsg = messages[idx + 1]}
										<div
											class="msg-row msg-blep"
											in:fly={{ y: 10, duration: 160 }}
										>
											<div class="msg-blep-block">
												<span class="msg-blep-label {fontMono}">BLEP</span>
												{#if blepMsg.status === 'loading'}
													<p class="msg-blep-content thinking {fontBody}">{blepMsg.content}</p>
												{:else}
													<p class="msg-blep-content {fontBody}">{blepMsg.content}</p>
												{/if}
											</div>
										</div>

										{#if blepMsg.result}
											<div class="result-card" in:fly={{ y: 16, duration: 220 }}>
												{#if blepMsg.result.mode === 'VERDICT'}
													{@const result = blepMsg.result as VerdictResult}
													<header class="result-header">
														<h2 class="result-title {fontDisplay}">{result.title}</h2>
														<span class="result-badge {fontDisplay} {verdictColor(result.badge)}"
															>{result.badge}</span
														>
													</header>
													<div class="result-grid">
														<div>
															<span class="result-label {fontMono}">Fatal flaw</span>
															<p class="result-strong {fontBody}">{result.fatal_flaw}</p>
														</div>
														<div>
															<span class="result-label {fontMono}">Better target</span>
															<p class="result-strong {fontBody}">{result.better_target}</p>
														</div>
													</div>
													<p class="result-copy {fontBody}">{result.why_it_matters}</p>
													<div class="result-action">
														<span class="result-label {fontMono}">Next</span>
														<p class="result-strong {fontBody}">{result.next_action}</p>
													</div>
												{:else if blepMsg.result.mode === 'RECOMMENDATION'}
													{@const result = blepMsg.result as RecommendationResult}
													<header class="result-header">
														<h2 class="result-title {fontDisplay}">{result.title}</h2>
														<span class="result-badge {fontDisplay} verdict-approved">RECOMMENDATION</span
														>
													</header>
													<p class="result-copy {fontBody}">{result.summary}</p>
													<div class="result-grid">
														<div>
															<span class="result-label {fontMono}">Buy target</span>
															<ul class="result-list {fontBody}">
																{#each result.buy_target.slice(0, 4) as item (item)}
																	<li>{item}</li>
																{/each}
															</ul>
														</div>
														<div>
															<span class="result-label {fontMono}">Avoid</span>
															<ul class="result-list {fontBody}">
																{#each result.avoid.slice(0, 3) as trap (trap.pattern)}
																	<li><strong>{trap.pattern}</strong>: {trap.reason}</li>
																{/each}
															</ul>
														</div>
													</div>
													<div class="result-action">
														<span class="result-label {fontMono}">Next</span>
														<p class="result-strong {fontBody}">{result.next_action}</p>
													</div>
												{:else}
													{@const result = blepMsg.result as ComparisonResult}
													<header class="result-header">
														<h2 class="result-title {fontDisplay}">{result.title}</h2>
														<span class="result-badge {fontDisplay} verdict-caution">{result.badge}</span>
													</header>
													<p class="result-copy {fontBody}">{result.summary}</p>
													<div class="compare-grid">
														{#each result.compared as item (item.name)}
															<div class="compare-col">
																<h3 class="compare-name {fontDisplay}">{item.name}</h3>
																<ul class="result-list {fontBody}">
																	{#each item.points as point (point)}
																		<li>{point}</li>
																	{/each}
																</ul>
															</div>
														{/each}
													</div>
													<div class="result-action winner">
														<span class="result-label {fontMono}">Winner</span>
														<p class="result-strong {fontBody}">{result.winner_row}</p>
													</div>
												{/if}
											</div>
										{/if}
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		</section>

		{#if mode !== 'idle'}
			<footer class="composer-dock">
				{@render Composer()}
			</footer>
		{/if}
	</main>

	{#if activityOpen}
		<aside
			id="activity-panel"
			class="activity-panel"
			aria-label="Activity log"
			transition:fly={{ x: 28, duration: 180 }}
		>
			{@render ActivityLog()}
		</aside>
	{/if}
</div>

<style>
	:global(html.app-lock),
	:global(body.app-lock) {
		height: 100%;
		overflow: hidden;
	}

	.app-shell {
		height: 100dvh;
		display: grid;
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--activity-width);
		overflow: hidden;
		background: var(--color-paper);
		color: var(--color-ink);
		transition: grid-template-columns 180ms ease;
	}

	.sidebar {
		min-width: 0;
		border-right: 1px solid rgba(17, 17, 17, 0.12);
		background: #f7f5ef;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.sidebar-brand {
		min-height: 64px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		position: relative;
		transition: padding 180ms ease;
	}

	.sidebar.collapsed .sidebar-brand {
		padding: 10px 12px;
	}

	.sidebar-brand-link {
		min-width: 0;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		color: var(--color-ink);
		text-decoration: none;
		flex: 1;
	}

	.sidebar-brand-button {
		position: absolute;
		left: 12px;
		top: 10px;
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
		display: inline-grid;
		place-items: center;
		opacity: 0;
		pointer-events: none;
		transition: opacity 180ms ease;
	}

	.sidebar.collapsed .sidebar-brand-button {
		opacity: 1;
		pointer-events: auto;
	}

	.sidebar-brand-expanded {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 12px;
		opacity: 1;
		pointer-events: auto;
		white-space: nowrap;
		overflow: hidden;
		transition: opacity 180ms ease;
	}

	.sidebar.collapsed .sidebar-brand-expanded {
		opacity: 0;
		pointer-events: none;
	}

	.sidebar-brand-link:hover,
	.sidebar-brand-link:focus-visible,
	.sidebar-brand-button:hover,
	.sidebar-brand-button:focus-visible,
	.sidebar-toggle:hover,
	.sidebar-toggle:focus-visible,
	.log-toggle:hover,
	.log-toggle:focus-visible {
		background: rgba(17, 17, 17, 0.06);
		outline: none;
		border: 0;
		box-shadow: none;
	}

	.sidebar-logo-full {
		display: block;
		width: auto;
		height: 32px;
	}

	.sidebar-logo-icon {
		display: block;
		width: 34px;
		height: 34px;
		object-fit: contain;
	}

	.sidebar-toggle {
		border: 0;
		outline: none;
		color: var(--color-ink);
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 800;
		line-height: 1;
	}

	.sidebar-new {
		width: calc(100% - 28px);
		min-height: 44px;
		margin: 2px 14px 12px;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		text-align: left;
		font-size: 14px;
		font-weight: 700;
		transition:
			width 180ms ease,
			margin 180ms ease,
			padding 180ms ease,
			gap 180ms ease,
			border-color 180ms ease,
			background 180ms ease;
	}

	.sidebar-new-icon {
		font-size: 18px;
		line-height: 1;
		flex-shrink: 0;
	}

	.sidebar-new-text {
		opacity: 1;
		max-width: 150px;
		white-space: nowrap;
		overflow: hidden;
		transition:
			opacity 180ms ease,
			max-width 180ms ease;
	}

	.sidebar.collapsed .sidebar-new-text {
		opacity: 0;
		max-width: 0;
		pointer-events: none;
	}

	.sidebar-new:hover,
	.sidebar-new:focus-visible,
	.sidebar-new.active {
		border-color: rgba(17, 17, 17, 0.16);
		background: rgba(17, 17, 17, 0.05);
		outline: 2px solid transparent;
	}

	.sidebar.collapsed .sidebar-new {
		width: 44px;
		margin: 2px auto 12px;
		justify-content: center;
		padding: 0;
		gap: 0;
	}

	.sidebar-label {
		padding: 8px 16px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(17, 17, 17, 0.42);
		max-height: 30px;
		overflow: hidden;
		transition:
			max-height 180ms ease,
			padding 180ms ease;
	}

	.sidebar.collapsed .sidebar-label {
		max-height: 0;
		padding-top: 0;
		padding-bottom: 0;
		pointer-events: none;
	}

	.sidebar-history {
		list-style: none;
		margin: 0;
		padding: 0 8px 16px;
		overflow-y: auto;
		width: 100%;
		transition: padding 180ms ease;
	}

	.sidebar.collapsed .sidebar-history {
		padding: 0 0 16px;
	}

	.sidebar-history-item {
		width: 100%;
		min-height: 44px;
		border: 0;
		background: transparent;
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 8px;
		text-align: left;
		cursor: pointer;
		color: var(--color-ink);
		transition:
			padding 180ms ease,
			gap 180ms ease,
			background 180ms ease;
	}

	.sidebar.collapsed .sidebar-history-item {
		justify-content: center;
		align-items: center;
		padding: 10px 0;
		gap: 0;
	}

	.sidebar-history-item:hover,
	.sidebar-history-item:focus-visible,
	.sidebar-history-item.active {
		background: rgba(17, 17, 17, 0.06);
		outline: 2px solid transparent;
	}

	.history-dot {
		width: 12px;
		height: 12px;
		margin-top: 4px;
		border: 1.5px solid var(--color-ink);
		box-shadow: 1.5px 1.5px 0 rgba(17, 17, 17, 0.9);
		flex: 0 0 auto;
		transition:
			width 180ms ease,
			height 180ms ease,
			margin 180ms ease;
	}

	.sidebar.collapsed .history-dot {
		width: 16px;
		height: 16px;
		margin: 0;
	}

	.history-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 5px;
		max-width: 220px;
		overflow: hidden;
		transition: max-width 180ms ease;
	}

	.sidebar.collapsed .history-copy {
		max-width: 0;
		pointer-events: none;
	}

	.history-query {
		font-size: 13px;
		font-weight: 600;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.history-badge {
		width: fit-content;
		border: 1px solid rgba(17, 17, 17, 0.18);
		padding: 1px 6px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.main-column {
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		background: var(--color-paper);
	}

	.main-actions {
		position: sticky;
		top: 0;
		z-index: 30;
		min-height: 58px;
		padding: 8px 18px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		border-bottom: 1px solid rgba(17, 17, 17, 0.08);
		background: var(--color-paper);
	}

	.back-home {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 0 8px;
		color: rgba(17, 17, 17, 0.72);
		text-decoration: none;
	}

	.back-home-logo {
		height: 26px;
		width: auto;
		display: block;
	}

	.back-home-text {
		font-size: 12px;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.back-home:hover,
	.back-home:focus-visible {
		color: var(--color-ink);
		outline: 2px solid transparent;
	}

	.brain-badge,
	.log-toggle {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--color-ink);
		background: var(--color-paper);
		color: var(--color-ink);
		padding: 0 16px;
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.brain-badge {
		position: relative;
		gap: 10px;
	}

	.brain-badge::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: -32px;
		right: -1.5px;
		background: var(--color-ink);
		color: var(--color-paper);
		padding: 4px 8px;
		font-size: 10px;
		font-family: var(--font-mono);
		font-weight: 700;
		border: 1px solid var(--color-ink);
		white-space: nowrap;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition: opacity 150ms ease, visibility 150ms ease;
		z-index: 50;
		text-transform: none;
		letter-spacing: normal;
	}

	.brain-badge:hover::after {
		opacity: 1;
		visibility: visible;
	}

	.log-toggle {
		cursor: pointer;
	}

	.brain-dot {
		width: 7px;
		height: 7px;
		background: rgba(17, 17, 17, 0.25);
	}

	.brain-dot.active {
		background: var(--color-mint);
	}

	.chat-viewport {
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 32px clamp(16px, 4vw, 48px) 40px;
	}

	.chat-inner {
		width: 100%;
		max-width: 840px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 36px;
	}

	.chat-run {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.idle-stack {
		min-height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 18px;
		padding-top: max(44px, calc(43vh - 190px));
	}

	.idle-copy {
		text-align: center;
	}

	.idle-heading-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.idle-mark {
		width: 46px;
		height: 46px;
		object-fit: contain;
	}

	.idle-heading {
		margin: 0;
		font-size: clamp(1.9rem, 4vw, 3rem);
		line-height: 1.06;
		font-weight: 600;
		letter-spacing: 0;
	}

	.idle-subcopy {
		margin: 8px 0 0;
		color: rgba(17, 17, 17, 0.58);
		font-size: 0.98rem;
		font-weight: 600;
	}

	.idle-bottom {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 36px;
		padding: 8px 0 26px;
	}

	.msg-row {
		display: flex;
	}

	.msg-user {
		justify-content: flex-end;
	}

	.msg-blep {
		justify-content: flex-start;
	}

	.msg-bubble-user {
		max-width: 720px;
		background: var(--color-ink);
		color: var(--color-paper);
		padding: 14px 20px;
		font-size: 0.96rem;
		font-weight: 600;
		line-height: 1.45;
	}

	.msg-bubble-user p,
	.msg-blep-content {
		margin: 0;
		white-space: pre-wrap;
	}

	.msg-blep-block {
		max-width: min(78%, 620px);
	}

	.msg-blep-label,
	.result-label {
		display: block;
		margin-bottom: 4px;
		color: rgba(17, 17, 17, 0.45);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.msg-blep-content {
		color: var(--color-ink);
		font-size: 0.96rem;
		font-weight: 600;
		line-height: 1.55;
	}

	.thinking {
		color: rgba(17, 17, 17, 0.54);
	}

	.result-card {
		width: min(100%, 720px);
		border: 2px solid var(--color-ink);
		background: white;
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.result-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid rgba(17, 17, 17, 0.1);
		padding-bottom: 12px;
	}

	.result-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
	}

	.result-badge {
		border: 1.5px solid var(--color-ink);
		padding: 4px 9px;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		white-space: nowrap;
		box-shadow: 2px 2px 0 rgba(17, 17, 17, 0.88);
	}

	.result-grid,
	.compare-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.result-copy,
	.result-strong {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.result-copy {
		color: rgba(17, 17, 17, 0.76);
		font-weight: 600;
	}

	.result-strong {
		color: var(--color-ink);
		font-weight: 800;
	}

	.result-list {
		margin: 0;
		padding-left: 18px;
		color: rgba(17, 17, 17, 0.78);
		font-size: 0.86rem;
		font-weight: 600;
		line-height: 1.45;
	}

	.result-action,
	.compare-col {
		border: 1px solid rgba(17, 17, 17, 0.16);
		background: var(--color-paper);
		padding: 12px;
	}

	.result-action.winner {
		background: var(--color-mint);
		border-color: var(--color-ink);
	}

	.compare-name {
		margin: 0 0 8px;
		font-size: 0.92rem;
		font-weight: 800;
	}

	.composer-dock {
		position: sticky;
		bottom: 0;
		z-index: 25;
		border-top: 1px solid rgba(17, 17, 17, 0.12);
		background: var(--color-paper);
		padding: 18px clamp(16px, 4vw, 48px);
	}

	.composer-wrap {
		box-sizing: border-box;
		width: 100%;
		max-width: 840px;
		margin: 0 auto;
	}

	.composer-box {
		box-sizing: border-box;
		width: 100%;
		border: 2px solid var(--color-ink);
		background: white;
		padding: 10px;
	}

	.composer-box:focus-within {
		box-shadow: 3px 3px 0 rgba(17, 17, 17, 0.9);
	}

	.composer-textarea {
		width: 100%;
		min-height: 80px;
		resize: none;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		outline: 0;
		padding: 12px;
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.5;
	}

	.composer-textarea::placeholder {
		color: rgba(17, 17, 17, 0.5);
	}

	.composer-textarea:disabled {
		cursor: not-allowed;
		opacity: 0.58;
	}

	.composer-actions-row {
		display: flex;
		justify-content: flex-end;
		padding-top: 8px;
	}

	.composer-chips-under {
		margin-top: 14px;
	}

	.mode-chips {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		flex-wrap: wrap;
	}

	.mode-chip {
		flex: 1 1 96px;
		min-height: 38px;
		border: 1px solid rgba(17, 17, 17, 0.15);
		background: transparent;
		color: rgba(17, 17, 17, 0.65);
		padding: 0 10px;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		border-radius: 4px;
		transition:
			background 160ms ease,
			border-color 160ms ease,
			color 160ms ease;
	}

	.mode-chip:hover,
	.mode-chip:focus-visible {
		border-color: var(--color-ink);
		color: var(--color-ink);
		outline: 2px solid #111;
		outline-offset: 2px;
	}

	.mode-chip.selected {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-paper);
	}

	.composer-secondary,
	.composer-primary {
		min-width: 112px;
	}

	.composer-disclaimer {
		margin: 8px 0 0;
		color: rgba(17, 17, 17, 0.48);
		text-align: center;
		font-size: 0.76rem;
		font-weight: 600;
	}

	.activity-panel {
		min-width: 0;
		border-left: 1px solid rgba(17, 17, 17, 0.12);
		background: #f7f5ef;
		overflow-y: auto;
	}

	.activity-inner {
		display: flex;
		flex-direction: column;
	}

	.activity-header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: #f7f5ef;
		min-height: 64px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid rgba(17, 17, 17, 0.1);
	}

	.activity-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 800;
	}

	.activity-subtitle {
		margin: 2px 0 0;
		color: rgba(17, 17, 17, 0.45);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.panel-close {
		border: 0;
		font-size: 24px;
		line-height: 1;
	}

	.activity-body {
		flex: 1;
		min-height: 0;
	}

	.activity-empty {
		min-height: 220px;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 12px;
		padding: 20px;
		text-align: center;
	}

	.activity-empty-line {
		width: 36px;
		height: 1px;
		background: rgba(17, 17, 17, 0.18);
	}

	.activity-empty-text {
		margin: 0;
		color: rgba(17, 17, 17, 0.38);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.activity-steps {
		list-style: none;
		margin: 0;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.activity-step.step-done {
		opacity: 0.58;
	}

	.activity-step-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.activity-step-name {
		color: var(--color-ink);
		font-size: 11px;
		font-weight: 800;
	}

	.activity-step-status {
		border: 1px solid rgba(17, 17, 17, 0.18);
		padding: 1px 6px;
		color: rgba(17, 17, 17, 0.48);
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
	}

	.activity-step-status.step-running {
		border-color: var(--color-ink);
		color: var(--color-ink);
	}

	.activity-step-label {
		margin: 3px 0 0;
		color: rgba(17, 17, 17, 0.6);
		font-size: 12px;
		font-weight: 600;
		line-height: 1.35;
	}

	.activity-step-output {
		margin: 5px 0 0;
		color: rgba(17, 17, 17, 0.44);
		font-size: 10px;
		font-weight: 700;
		line-height: 1.4;
	}

	:global(.verdict-approved) {
		background: var(--color-mint);
		color: var(--color-ink);
	}

	:global(.verdict-caution) {
		background: #ffe566;
		color: var(--color-ink);
	}

	:global(.verdict-waste) {
		background: var(--color-ink);
		color: var(--color-paper);
	}

	:global(.verdict-recommendation) {
		background: var(--color-paper-dark);
		color: var(--color-ink);
	}

	:global(.verdict-default) {
		background: white;
		color: var(--color-ink);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 980px) {
		.app-shell {
			grid-template-columns: 68px minmax(0, 1fr);
		}

		.sidebar {
			align-items: center;
		}

		.sidebar-brand {
			padding-inline: 0;
		}

		.sidebar-toggle,
		.sidebar-label,
		.history-copy,
		.sidebar-new span + span {
			display: none;
		}

		.sidebar-new {
			width: 44px;
			margin-inline: 0;
		}

		.sidebar-history-item {
			justify-content: center;
			align-items: center;
			padding: 10px 0;
		}

		.history-dot {
			width: 16px;
			height: 16px;
			margin: 0;
		}

		.activity-panel {
			position: fixed;
			top: 0;
			right: 0;
			z-index: 30;
			width: min(320px, calc(100vw - 68px));
			height: 100dvh;
			min-height: 0;
			box-shadow: -8px 0 24px rgba(17, 17, 17, 0.12);
		}
	}

	@media (max-width: 760px) {
		.result-grid,
		.compare-grid {
			grid-template-columns: 1fr;
		}

		.main-actions {
			padding-inline: 10px;
			gap: 6px;
		}

		.chat-viewport {
			padding: 18px 12px;
		}

		.idle-stack {
			justify-content: flex-start;
			padding-top: 36px;
		}

		.idle-heading-row {
			align-items: flex-start;
			gap: 9px;
		}

		.idle-mark {
			width: 36px;
			height: 36px;
			margin-top: 3px;
		}

		.idle-heading {
			font-size: 2rem;
			text-align: left;
		}

		.idle-subcopy {
			text-align: left;
		}

		.msg-bubble-user,
		.msg-blep-block {
			max-width: 92%;
		}

		.composer-actions-row {
			flex-direction: column;
			align-items: stretch;
		}

		.mode-chips {
			width: 100%;
			overflow-x: auto;
			padding-bottom: 2px;
			flex-wrap: nowrap;
		}

		.mode-chip {
			flex: 0 0 auto;
		}

		.composer-primary {
			width: 100%;
			min-width: 0;
		}
	}
</style>
