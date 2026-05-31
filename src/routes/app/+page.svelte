<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import FollowUpChat from '$lib/components/FollowUpChat.svelte';
	// TODO PROD: import AuthGuard from '$lib/components/AuthGuard.svelte';

	type Mode = 'idle' | 'running' | 'done';
	type Intent = 'verdict' | 'recommendation' | 'comparison';
	type SidebarActiveView = 'new_scan' | 'history';

	type Phase1Json = {
		mode: string;
		[key: string]: unknown;
	};

	type ChatMessage = {
		id?: string;
		role: 'user' | 'blep';
		content: string;
		timestamp: number;
		status?: 'loading' | 'done' | 'error';
		result?: MockResult | null;
		phase1Json?: Phase1Json | null;
	};

	let { data } = $props();

	type ToolStep = {
		id: string;
		name: string;
		label: string;
		status: 'queued' | 'running' | 'done' | 'fail' | 'skipped' | 'fallback';
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
		shop_links?: { label: string; url: string }[];
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
		verdict: string;
		timestamp: number;
		doubtMessages?: DoubtMsg[];
		savedMessages?: ChatMessage[];
		savedToolSteps?: ToolStep[];
		savedMode?: Intent;
		pinned?: boolean;
		archived?: boolean;
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
	let brainJuiceMax = $state(3);

	// ── IP-based session (MVP — no auth required) ──
	// TODO PROD: replace with Google OAuth (AuthGuard)
	const syncQuotaFromServer = async () => {
		try {
			const res = await fetch('/api/quota');
			if (res.ok) {
				const data = await res.json();
				if (data.quota) {
					brainJuice = data.quota.remaining;
					brainJuiceMax = data.quota.limit;
				}
			}
		} catch {
			// Quota sync failed silently — UI keeps default
		}
	};

	// ── Phase 2 doubt state ──
	type ComposerMode = 'scan' | 'doubt';
	type DoubtMsg = { role: 'user' | 'assistant'; content: string };
	const MAX_DOUBT_TURNS = 5;
	const DOUBT_CHIPS = [
		'Why is this bad?',
		'Seller says it can game',
		'What should I buy instead?',
		'Price changed'
	];

	let composerMode = $state<ComposerMode>('scan');
	let doubtMessages = $state<DoubtMsg[]>([]);
	let doubtLoading = $state(false);
	let doubtError = $state('');
	let showRescanCta = $state(false);

	// ── Dynamic thinking phrases ──
	const THINKING_PHRASES = [
		'Sniffing out marketing BS...',
		'Calculating e-waste potential...',
		'Cross-referencing real prices...',
		'Judging...',
		'Checking seller claims...',
		'Scanning forum complaints...',
		'Counting future regret...',
		'Detecting spec inflation...',
		'Comparing price bracket...',
		'Reading between the lines...'
	];
	let thinkingPhrase = $state(THINKING_PHRASES[0]);
	let thinkingInterval: ReturnType<typeof setInterval> | null = null;

	const startThinkingCycle = () => {
		let idx = 0;
		thinkingPhrase = THINKING_PHRASES[0];
		thinkingInterval = setInterval(() => {
			idx = (idx + 1) % THINKING_PHRASES.length;
			thinkingPhrase = THINKING_PHRASES[idx];
		}, 2200);
	};

	const stopThinkingCycle = () => {
		if (thinkingInterval) {
			clearInterval(thinkingInterval);
			thinkingInterval = null;
		}
	};

	// ── Scan error state ──
	let scanErrorCode = $state<string | null>(null);
	let scanStage = $state<string | null>(null);
	let scanTraceId = $state<string | null>(null);

	let lastScanQuery = $state<string | null>(null);

	let now = $state(new Date());

	const tooltipText = $derived.by(() => {
		if (brainJuice >= brainJuiceMax) {
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

	const HISTORY_STORAGE_KEY = 'blep_history_v1';

	// Load history from localStorage on init
	const loadHistoryFromStorage = (): HistoryEntry[] => {
		try {
			const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed;
		} catch {
			return [];
		}
	};

	let history = $state<HistoryEntry[]>(
		typeof window !== 'undefined' ? loadHistoryFromStorage() : []
	);

	// Persist history to localStorage whenever it changes
	$effect(() => {
		// Only save the lightweight fields — skip savedMessages/savedToolSteps (too big, not needed across refreshes)
		const lite = history.map((item) => {
			const copy = { ...item };
			delete copy.savedMessages;
			delete copy.savedToolSteps;
			return copy;
		});
		try {
			localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(lite));
		} catch {
			// Storage full or unavailable — silent
		}
	});

	/** Save current scan result to history sidebar */
	const saveToHistory = (query: string, verdict: string) => {
		const entry: HistoryEntry = {
			id: crypto.randomUUID(),
			query,
			verdict,
			timestamp: Date.now(),
			doubtMessages: [...doubtMessages],
			savedMessages: [...messages],
			savedToolSteps: toolSteps.map((s) => ({ ...s })),
			savedMode: selectedMode ?? 'verdict'
		};
		history = [entry, ...history];
		activeHistoryId = entry.id;
		activeSidebarView = 'history';
	};

	/** Update doubt messages on the active history entry */
	const syncDoubtToHistory = () => {
		if (!activeHistoryId) return;
		history = history.map((h) =>
			h.id === activeHistoryId ? { ...h, doubtMessages: [...doubtMessages] } : h
		);
	};

	// ── History actions: pin, archive, delete ──
	let showArchived = $state(false);
	let contextMenuId = $state<string | null>(null);

	const togglePin = (id: string) => {
		history = history.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h));
		contextMenuId = null;
	};

	const archiveEntry = (id: string) => {
		history = history.map((h) => (h.id === id ? { ...h, archived: true } : h));
		if (activeHistoryId === id) activeHistoryId = null;
		contextMenuId = null;
	};

	const unarchiveEntry = (id: string) => {
		history = history.map((h) => (h.id === id ? { ...h, archived: false } : h));
		contextMenuId = null;
	};

	const deleteEntry = (id: string) => {
		history = history.filter((h) => h.id !== id);
		if (activeHistoryId === id) activeHistoryId = null;
		contextMenuId = null;
	};

	// Sorted: pinned first, then by time, archived toggled
	const visibleHistory = $derived(
		history
			.filter((h) => (showArchived ? !!h.archived : !h.archived))
			.sort((a, b) => {
				if (a.pinned && !b.pinned) return -1;
				if (!a.pinned && b.pinned) return 1;
				return b.timestamp - a.timestamp;
			})
	);

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
		}
	];
	let activeHero = $state(untrack(() => heroVariants[data.initialHeroIndex ?? 0]));

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

	const pickRandom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

	const AGENT_LOG_POOLS: Record<Intent, string[][]> = {
		verdict: [
			['intent → verdict scan', 'routing to verdict judge', 'VERDICT_SCAN locked'],
			['parsing listing data...', 'extracting device + price', 'reading seller claims'],
			['checking live prices IDR', 'scanning tokped/shopee bracket', 'market reality check'],
			['pulling spec sheet', 'CPU/GPU/RAM extracted', 'spec validation running'],
			['sniffing seller cope...', 'trap scan: soldered RAM?', 'checking thermal complaints'],
			['building verdict card', 'rendering judgment', 'verdict locked. done.']
		],
		recommendation: [
			['intent → recommendation', 'budget request detected', 'RECOMMENDATION_SCAN locked'],
			['parsing budget ceiling', 'budget: reading IDR target', 'constraint extraction'],
			['hunting current listings', 'scanning marketplace bracket', 'price bracket mapped'],
			['finding target spec class', 'GPU tier selection running', 'acceptable hardware filtered'],
			['rejecting overpriced traps', 'trap scan: 8GB soldered?', 'filtering RGB tax'],
			['building shortlist', 'recommendation panel ready', 'picks locked. done.']
		],
		comparison: [
			['intent → comparison', 'two devices detected', 'COMPARISON_SCAN locked'],
			['parsing option A + B', 'extracting both configs', 'device pair identified'],
			['checking prices for both', 'benchmark data lookup', 'market position compared'],
			['spec diff running', 'thermal + chassis scored', 'side-by-side built'],
			['checking trap asymmetry', 'RAM/storage lock check', 'upgrade path compared'],
			['winner selected', 'comparison card built', 'judgment rendered. done.']
		]
	};

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

	// ── Mock Phase 1 JSON for doubt chat ──────────────────
	const MOCK_PHASE1_VERDICT: Phase1Json = {
		mode: 'VERDICT',
		name: 'Acer Swift Go 14 Ultra 7',
		verdict: 'CAUTION',
		landfill_year: 2029,
		fatal_flaw: 'Good machine, but price must beat newer OLED/Ultra deals nearby.',
		specs: {
			upgradeable: true,
			thermal: 'Acceptable for ultrabook class',
			forum_score: 6
		},
		roast: 'Decent laptop pretending it is the only option. It is not.',
		summary:
			'Swift Go 14 is capable at 19 juta but buyer must confirm this config beats latest Ultra 5/7 OLED deals.',
		evidence: [
			{
				title: 'Mock spec review',
				url: 'https://example.com/review',
				quote_or_fact: 'Ultra 7 performance is competitive',
				relevance: 'CPU benchmark'
			}
		]
	};

	const MOCK_PHASE1_RECOMMENDATION: Phase1Json = {
		mode: 'RECOMMENDATION',
		query: 'Gaming laptop 15 juta recommendation',
		parsed_need: {
			category: 'laptop',
			use_case: 'gaming',
			budget_idr: 15000000,
			market: 'Indonesia',
			hard_constraints: []
		},
		recommendation_summary: 'Target RTX 4050-class. Avoid RTX 2050 above 10-11 juta.',
		target_specs: {
			cpu: 'Ryzen 5 H-series',
			gpu: 'RTX 4050',
			ram: '16GB',
			storage: '512GB NVMe',
			screen: '15.6" 144Hz',
			thermal: 'Dual-fan',
			upgradeability: 'RAM slot preferred'
		},
		picks: [
			{
				label: 'BEST_OVERALL',
				name: 'Lenovo LOQ RTX 4050',
				expected_price_idr: 14500000,
				why: 'Clean budget entry',
				caveat: 'Check RAM config',
				evidence_refs: [0]
			},
			{
				label: 'CHEAPER_SAFE',
				name: 'Acer Nitro V RTX 4050',
				expected_price_idr: 13800000,
				why: 'Cheaper if available',
				caveat: 'Watch thermals',
				evidence_refs: [0]
			}
		],
		avoid: [{ pattern: 'RTX 2050 above 10-11 juta', reason: 'Old entry GPU' }],
		deal_rules: ['Demand RTX 4050+ at this budget'],
		evidence: [
			{
				title: 'Mock market scan',
				url: 'https://example.com/market',
				quote_or_fact: 'RTX 4050 available from 13-15 juta',
				relevance: 'Price bracket'
			}
		],
		confidence: 'MEDIUM',
		next_action: 'Send listing links for final judgment'
	};

	const MOCK_PHASE1_COMPARISON: Phase1Json = {
		mode: 'COMPARISON',
		query: 'Lenovo LOQ vs Acer Nitro V',
		winner: 'Lenovo LOQ RTX 4050',
		loser: 'Acer Nitro V RTX 4050',
		verdict: 'CLOSE_CALL',
		reason: 'LOQ wins on cooling and build. Nitro V only if meaningfully cheaper.',
		compared: [
			{
				name: 'Lenovo LOQ RTX 4050',
				price_idr: 14500000,
				strengths: ['Better chassis'],
				flaws: ['Pricier'],
				verdict: 'APPROVED'
			},
			{
				name: 'Acer Nitro V RTX 4050',
				price_idr: 13800000,
				strengths: ['Cheaper'],
				flaws: ['Thermal concerns'],
				verdict: 'CAUTION'
			}
		],
		evidence: [
			{
				title: 'Mock comparison',
				url: 'https://example.com/vs',
				quote_or_fact: 'LOQ thermals measured better',
				relevance: 'Thermal test'
			}
		],
		confidence: 'MEDIUM'
	};

	const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

	/** Turn URLs in text into clickable <a> tags */
	const linkifyText = (text: string): string => {
		return text.replace(
			/(https?:\/\/[^\s]+)/g,
			'<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
		);
	};

	/** Shorten long queries (especially URLs) for sidebar display */
	const shortenQuery = (query: string, max = 50): string => {
		// If it contains a URL, extract domain + short label
		const urlMatch = query.match(/https?:\/\/([^/\s]+)(\/[^\s]*)?/);
		if (urlMatch) {
			const domain = urlMatch[1].replace('www.', '');
			const rest = query.replace(urlMatch[0], '').trim();
			const label = rest ? `${domain} — ${rest}` : `${domain} link`;
			return label.length > max ? label.slice(0, max - 1) + '…' : label;
		}
		return query.length > max ? query.slice(0, max - 1) + '…' : query;
	};

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
		if (upper.includes('APPROVED') || upper.includes('WINNER') || upper.includes('CLEAR'))
			return 'verdict-approved';
		if (upper.includes('CAUTION') || upper.includes('CLOSE') || upper.includes('PICKS'))
			return 'verdict-caution';
		if (upper.includes('WASTE') || upper.includes('BOTH_BAD') || upper.includes('AVOID'))
			return 'verdict-waste';
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

	// ── API response → UI result adapters ──
	const apiModeToLocal = (mode: string): Intent => {
		switch (mode) {
			case 'RECOMMENDATION':
				return 'recommendation';
			case 'COMPARISON':
				return 'comparison';
			default:
				return 'verdict';
		}
	};

	const adaptVerdictResult = (r: Record<string, unknown>): VerdictResult => ({
		mode: 'VERDICT',
		title: (r.name as string) ?? 'Listing verdict',
		badge: (r.verdict as string) ?? 'CAUTION',
		fatal_flaw: (r.fatal_flaw as string) ?? 'Unknown',
		why_it_matters: (r.summary as string) ?? '',
		better_target: (r.better_target as string) ?? 'Check alternatives at same price bracket.',
		next_action: 'Send listing link and BLEP will judge final pick.'
	});

	const buildShopLinks = (picks: { name: string }[]): { label: string; url: string }[] => {
		const links: { label: string; url: string }[] = [];
		const topPicks = picks.slice(0, 3);
		for (const pick of topPicks) {
			const q = encodeURIComponent(pick.name);
			links.push(
				{ label: `${pick.name} — Tokopedia`, url: `https://www.tokopedia.com/search?q=${q}` },
				{ label: `${pick.name} — Shopee`, url: `https://shopee.co.id/search?keyword=${q}` }
			);
		}
		return links;
	};

	const adaptRecommendationResult = (r: Record<string, unknown>): RecommendationResult => {
		const ts = r.target_specs as Record<string, string> | undefined;
		const buyTarget = ts ? Object.values(ts).filter(Boolean) : ['Check target specs in evidence'];
		const picks = (r.picks as { name: string }[]) ?? [];
		return {
			mode: 'RECOMMENDATION',
			title: (r.recommendation_summary as string) ?? 'Recommendation target',
			summary: (r.recommendation_summary as string) ?? '',
			buy_target: buyTarget,
			avoid: (r.avoid as { pattern: string; reason: string }[]) ?? [],
			deal_rules: (r.deal_rules as string[]) ?? [],
			next_action: (r.next_action as string) ?? 'Send listing links for final judgment.',
			shop_links: picks.length > 0 ? buildShopLinks(picks) : undefined
		};
	};

	const adaptComparisonResult = (r: Record<string, unknown>): ComparisonResult => {
		const compared =
			(r.compared as {
				name: string;
				strengths?: string[];
				flaws?: string[];
				points?: string[];
			}[]) ?? [];
		return {
			mode: 'COMPARISON',
			title: (r.reason as string) ?? 'Comparison',
			badge: (r.verdict as string) ?? 'CLOSE_CALL',
			summary: (r.reason as string) ?? '',
			compared: compared.map((c) => ({
				name: c.name,
				points: [
					...(c.strengths ?? []),
					...(c.flaws?.map((f) => `⚠ ${f}`) ?? []),
					...(c.points ?? [])
				]
			})),
			winner_row: `Winner: ${(r.winner as string) ?? 'TBD'}`,
			next_action: 'Send both listing links for final judgment.'
		};
	};

	const adaptApiResult = (
		apiResult: Record<string, unknown>
	): { result: MockResult; intent: Intent } => {
		const mode = (apiResult.mode as string) ?? 'VERDICT';
		const intent = apiModeToLocal(mode);
		let result: MockResult;
		switch (mode) {
			case 'RECOMMENDATION':
				result = adaptRecommendationResult(apiResult);
				break;
			case 'COMPARISON':
				result = adaptComparisonResult(apiResult);
				break;
			default:
				result = adaptVerdictResult(apiResult);
				break;
		}
		return { result, intent };
	};

	async function runLiveScan(query: string) {
		if (!query.trim() || mode === 'running') return;

		const runId = crypto.randomUUID();
		mode = 'running';
		activeHistoryId = null;
		lastScanQuery = query;
		startThinkingCycle();

		// Reset error state on new scan
		scanErrorCode = null;
		scanStage = null;
		scanTraceId = null;

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
				'BLEP is tired, ask again later!',
				'BLEPpp?! Oh, no BLEP is tired. Ask again later?',
				'Sorry buddy, ask me again later okay?',
				'My silicon brain is completely out of juice. Try again later!',
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

		// Use client-side intent guess for log steps; API may override later
		const guessedIntent = detectIntent(query);
		toolSteps = TOOL_STEPS_BY_INTENT[guessedIntent].map((step) => ({
			...step,
			status: 'queued' as const
		}));

		startElapsedTimer();
		scrollToBottom();

		// Fetch-aware agentic log simulation
		let fetchDone = false;
		let fetchResult: Record<string, unknown> | null = null;
		let fetchError: Error | null = null;

		// Errors that must abort scan entirely (no fallback card)
		const HARD_ABORT_ERRORS = new Set(['quota_blocked', 'rate_limited', 'cooldown', 'bad_auth']);

		const ERROR_MESSAGES: Record<string, string> = {
			quota_blocked: 'Brain Juice empty. Try again later.',
			rate_limited: 'Too many requests. Wait a moment.',
			cooldown: 'BLEP is cooling down. Wait 15s.',
			bad_auth: 'Auth failed. Try refreshing.'
		};

		const runFetch = async () => {
			try {
				const headers: Record<string, string> = { 'Content-Type': 'application/json' };
				const res = await fetch('/api/scan', {
					method: 'POST',
					headers,
					body: JSON.stringify({ query })
				});
				const data = await res.json();

				if (!res.ok) {
					const errCode = data?.error as string | undefined;

					// Hard abort: quota/rate/cooldown → no card, just error bubble
					if (errCode && HARD_ABORT_ERRORS.has(errCode)) {
						const retryHint = data?.retry_after_seconds
							? ` Wait ${data.retry_after_seconds}s.`
							: '';
						throw new Error((ERROR_MESSAGES[errCode] ?? errCode) + retryHint);
					}

					// Soft fail: scraping/LLM died but backend sent fallback result → accept it
					if (data?.result) {
						fetchResult = data;
						return;
					}

					// No result at all → hard error
					throw new Error(errCode ?? `HTTP ${res.status}`);
				}

				fetchResult = data;
			} catch (err) {
				fetchError = err instanceof Error ? err : new Error('unknown');
			} finally {
				fetchDone = true;
			}
		};

		const isFallback = () => fetchResult != null && fetchResult.ok === false;

		const simulateAgenticLogs = async () => {
			const pools = AGENT_LOG_POOLS[guessedIntent];
			const lastIdx = toolSteps.length - 1;

			for (let i = 0; i < toolSteps.length; i++) {
				// Fetch done → flush remaining instantly with honest statuses
				if (fetchDone && i > 0) {
					for (let j = i; j < toolSteps.length; j++) {
						if (fetchError) {
							// Hard error: mark remaining as skipped, last as fail
							toolSteps[j].status = j === lastIdx ? 'fail' : 'skipped';
							toolSteps[j].output = j === lastIdx ? 'scan aborted.' : 'skipped.';
						} else if (isFallback()) {
							// Soft fail: mark remaining done but last as fallback
							toolSteps[j].status = j === lastIdx ? 'fallback' : 'done';
							toolSteps[j].output =
								j === lastIdx
									? `fallback: ${(fetchResult as Record<string, unknown>)?.error_code ?? 'unknown'}`
									: pickRandom(pools[j]);
						} else {
							toolSteps[j].status = 'done';
							toolSteps[j].output = pickRandom(pools[j]);
						}
					}
					return;
				}

				toolSteps[i].status = 'running';

				if (i === lastIdx && !fetchDone) {
					// Last step: hold + pulse until fetch resolves
					const baseLabel = toolSteps[i].label;
					let dots = 0;
					const pulseInterval = setInterval(() => {
						dots = (dots + 1) % 4;
						toolSteps[i].label = baseLabel + '.'.repeat(dots);
					}, 400);

					while (!fetchDone) {
						await delay(100);
					}
					clearInterval(pulseInterval);
					toolSteps[i].label = baseLabel;

					// Match output to fetch outcome with honest status
					if (fetchError) {
						toolSteps[i].status = 'fail';
						toolSteps[i].output = 'scan aborted.';
					} else if (isFallback()) {
						toolSteps[i].status = 'fallback';
						toolSteps[i].output =
							`fallback: ${(fetchResult as Record<string, unknown>)?.error_code ?? 'unknown'}`;
					} else {
						toolSteps[i].status = 'done';
						toolSteps[i].output = pickRandom(pools[i]);
					}
				} else {
					// Normal step: short delay if fetch already done, otherwise show progress
					await delay(fetchDone ? 10 + Math.random() * 40 : 400 + Math.random() * 800);
					toolSteps[i].status = 'done';
					toolSteps[i].output = pickRandom(pools[i]);
				}
			}
		};

		// Fire both in parallel
		const fetchPromise = runFetch();
		const logsPromise = simulateAgenticLogs();
		await Promise.all([fetchPromise, logsPromise]);

		// Flush any stragglers — respect honest statuses
		for (const step of toolSteps) {
			const terminal = new Set(['done', 'fail', 'skipped', 'fallback']);
			if (!terminal.has(step.status)) {
				step.status = fetchError ? 'skipped' : 'done';
			}
		}

		try {
			stopElapsedTimer();

			if (fetchError) throw fetchError;
			if (!fetchResult) throw new Error('No response from API');

			const apiData: Record<string, unknown> = fetchResult;
			const apiResult = apiData.result as Record<string, unknown>;
			if (!apiResult) {
				throw new Error((apiData.error as string) ?? 'No result from API');
			}

			// Capture error state from backend response
			if (apiData.ok === false) {
				scanErrorCode = (apiData.error_code as string) ?? null;
				scanStage = (apiData.stage as string) ?? null;
				scanTraceId = (apiData.traceId as string) ?? null;
			}

			// Update brainJuice from backend quota — but ignore fake/declined quotas
			const quota = apiData.quota as { remaining?: number; limit?: number } | undefined;
			const apiMode = (apiData.mode as string) ?? '';
			if (
				quota?.remaining != null &&
				apiMode !== 'declined' &&
				apiMode !== 'mock' &&
				(quota.limit ?? 0) < 900
			) {
				brainJuice = quota.remaining;
				if (quota.limit) brainJuiceMax = quota.limit;
			}

			// Adapt API output → UI card shapes
			const { result, intent: resolvedIntent } = adaptApiResult(apiResult);
			const phase1Json = apiResult as Phase1Json;

			// Build content summary — short TLDR for the bubble, card has full details
			let content = '';
			const isDeclined = apiMode === 'declined';
			if (isDeclined) {
				// Friendly decline — no scary card
				const declineVariants = [
					"BLEP couldn't understand that one. Try pasting a laptop listing, specs, or ask something like 'gaming laptop 15 juta'.",
					"Hmm, BLEP needs a hardware question. Try 'rekomendasi laptop coding 10 juta' or paste a listing link.",
					'BLEP is having a hard time with that. Mind rephrasing? Try mentioning a device, budget, or paste a link.'
				];
				content = declineVariants[Math.floor(Math.random() * declineVariants.length)];
				// No result card for declined — just show message
				messages = messages.map((m) =>
					m.id === `${runId}-assistant`
						? { ...m, status: 'done' as const, content, result: null, phase1Json: null }
						: m
				);
				mode = 'done';
				stopThinkingCycle();
				scrollToBottom();
				return;
			} else if (isFallback()) {
				const stageLabel = scanStage ?? 'unknown';
				content = `Live scan hit a bump at ${stageLabel}. Fallback result below — not final.`;
			} else if (resolvedIntent === 'comparison') {
				content = 'Comparison complete. See the breakdown below.';
			} else if (resolvedIntent === 'recommendation') {
				content = 'Here are your options. Full breakdown below.';
			} else {
				const v = (apiResult.verdict as string) ?? 'CAUTION';
				const roast = (apiResult.roast as string) ?? '';
				content = roast || `Verdict: ${v}. Details below.`;
			}

			messages = messages.map((m) =>
				m.id === `${runId}-assistant`
					? { ...m, status: 'done' as const, content, result, phase1Json }
					: m
			);

			selectedMode = resolvedIntent;

			// Save to sidebar history — build human-readable badge
			let verdictLabel: string;
			if (resolvedIntent === 'recommendation') {
				verdictLabel = 'PICKS READY';
			} else if (resolvedIntent === 'comparison') {
				const rawVerdict = (apiResult.verdict as string) ?? 'COMPARISON';
				const winner = (apiResult.winner as string) ?? '';
				if (rawVerdict === 'BOTH_BAD') {
					verdictLabel = 'BOTH BAD';
				} else if (winner) {
					// Truncate long winner names
					const short = winner.length > 20 ? winner.slice(0, 18) + '…' : winner;
					verdictLabel = `${short} wins`;
				} else if (rawVerdict === 'CLOSE_CALL') {
					verdictLabel = 'CLOSE CALL';
				} else {
					verdictLabel = rawVerdict.replace(/_/g, ' ');
				}
			} else {
				verdictLabel = (apiResult.verdict as string) ?? 'CAUTION';
			}
			saveToHistory(query, verdictLabel);
		} catch (err) {
			stopElapsedTimer();
			for (const step of toolSteps) {
				const terminal = new Set(['done', 'fail', 'skipped', 'fallback']);
				if (!terminal.has(step.status)) step.status = 'fail';
			}
			const msg = err instanceof Error ? err.message : 'Something went wrong';
			messages = messages.map((m) =>
				m.id === `${runId}-assistant`
					? { ...m, status: 'error' as const, content: `Scan failed: ${msg}` }
					: m
			);
			// Preserve input for retry
			if (!draftInput.trim() && lastScanQuery) {
				draftInput = lastScanQuery;
			}
		} finally {
			stopThinkingCycle();
			mode = 'done';
			scrollToBottom();
		}
	}

	const handleSubmit = () => {
		if (!draftInput.trim()) return;
		if (composerMode === 'doubt') {
			sendDoubtQuestion(draftInput.trim());
		} else {
			if (mode !== 'running') runLiveScan(draftInput.trim());
		}
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

	// ── Phase 2 doubt mode functions ──
	const enterDoubtMode = () => {
		if (!activePhase1Json) return;
		composerMode = 'doubt';
		draftInput = '';
		requestAnimationFrame(() => textareaEl?.focus());
	};

	const exitDoubtMode = () => {
		composerMode = 'scan';
		draftInput = '';
		doubtMessages = [];
		doubtLoading = false;
		doubtError = '';
		showRescanCta = false;
	};

	const sendDoubtQuestion = async (question: string) => {
		if (!question.trim() || doubtLoading || doubtMaxed || !activePhase1Json) return;

		const q = question.trim();
		draftInput = '';
		doubtError = '';

		doubtMessages = [...doubtMessages, { role: 'user', content: q }];
		doubtLoading = true;
		scrollToBottom();

		try {
			const historyForApi = doubtMessages
				.slice(0, -1)
				.map((m) => ({ role: m.role, content: m.content }));

			const chatHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: chatHeaders,
				body: JSON.stringify({
					originalInput: activeOriginalInput,
					phase1Result: activePhase1Json,
					messages: historyForApi,
					question: q
				})
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => ({ error: 'unknown' }));
				throw new Error(errBody.error || `HTTP ${res.status}`);
			}

			const data = await res.json();
			if (!data.ok) throw new Error(data.error || 'chat_failed');

			doubtMessages = [...doubtMessages, { role: 'assistant', content: data.reply }];
			syncDoubtToHistory();

			if (data.needsNewScan) {
				showRescanCta = true;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Something went wrong';
			doubtError = `BLEP choked: ${msg}. Try again.`;
		} finally {
			doubtLoading = false;
			scrollToBottom();
		}
	};

	const handleDoubtChip = (chip: string) => {
		sendDoubtQuestion(chip);
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
		// Reset doubt state
		composerMode = 'scan';
		doubtMessages = [];
		doubtLoading = false;
		doubtError = '';
		showRescanCta = false;
		// Reset error state
		scanErrorCode = null;
		scanStage = null;
		scanTraceId = null;

		lastScanQuery = null;
	};

	const handleNewScanClick = () => {
		// Capture context before clearing
		const contextQuery = lastScanQuery || activeOriginalInput || '';
		clearScanContext();
		activeHero = heroVariants[Math.floor(Math.random() * heroVariants.length)];
		activeSidebarView = 'new_scan';
		if (contextQuery) {
			draftInput = contextQuery;
		}
		requestAnimationFrame(() => textareaEl?.focus());
	};

	const loadHistoryItem = (entry: HistoryEntry) => {
		activeSidebarView = 'history';
		activeHistoryId = entry.id;
		draftInput = '';
		mode = 'done';

		// Restore doubt messages from history if present
		const savedDoubt = entry.doubtMessages ?? [];
		doubtMessages = savedDoubt;
		doubtLoading = false;
		doubtError = '';
		showRescanCta = false;
		composerMode = savedDoubt.length > 0 ? 'doubt' : 'scan';

		// Restore full saved state if available (real scans)
		if (entry.savedMessages && entry.savedMessages.length > 0) {
			messages = entry.savedMessages;
			toolSteps = entry.savedToolSteps ?? [];
			selectedMode = entry.savedMode ?? 'verdict';
		} else {
			// Legacy/mock fallback for entries without saved state
			const intent: Intent =
				entry.savedMode ??
				(entry.verdict === 'RECOMMENDATION'
					? 'recommendation'
					: entry.verdict.toLowerCase().includes('win') ||
						  entry.verdict.toLowerCase().includes('close') ||
						  entry.verdict.toLowerCase().includes('both bad')
						? 'comparison'
						: 'verdict');
			selectedMode = intent;
			const mockResult =
				intent === 'recommendation'
					? MOCK_RECOMMENDATION
					: intent === 'comparison'
						? adaptComparisonResult(MOCK_PHASE1_COMPARISON)
						: MOCK_VERDICT;
			const mockPhase1 =
				intent === 'recommendation'
					? MOCK_PHASE1_RECOMMENDATION
					: intent === 'comparison'
						? MOCK_PHASE1_COMPARISON
						: MOCK_PHASE1_VERDICT;
			messages = [
				{ id: 'hist-user', role: 'user', content: entry.query, timestamp: entry.timestamp - 5000 },
				{
					id: 'hist-blep',
					role: 'blep',
					status: 'done',
					content: entry.query,
					timestamp: entry.timestamp,
					result: mockResult,
					phase1Json: mockPhase1
				}
			];
			toolSteps = TOOL_STEPS_BY_INTENT[intent].map((step, i) => ({
				...step,
				status: 'done' as const,
				output: pickRandom(AGENT_LOG_POOLS[intent][i])
			}));
		}
		scrollToBottom();
	};

	// ── Phase 2 derived state ──
	const doubtTurnCount = $derived(doubtMessages.filter((m) => m.role === 'user').length);
	const doubtMaxed = $derived(doubtTurnCount >= MAX_DOUBT_TURNS);
	const activePhase1Json = $derived.by(() => {
		const last = messages.findLast((m) => m.role === 'blep' && m.phase1Json);
		return last?.phase1Json ?? null;
	});
	const activeOriginalInput = $derived(messages.find((m) => m.role === 'user')?.content ?? '');

	const canSubmit = $derived(
		draftInput.trim().length > 0 &&
			(composerMode === 'doubt' ? !doubtLoading && !doubtMaxed : mode !== 'running')
	);
	const collapsed = $derived(!sidebarExpanded || isMobileRail);
	const sidebarWidth = $derived(collapsed ? '68px' : '292px');
	const activityWidth = $derived(activityOpen ? '320px' : '0px');
	const composerPlaceholder = $derived(
		composerMode === 'doubt'
			? 'Ask why, challenge seller claim, or paste changed price/spec'
			: modeByIntent(selectedMode).placeholder
	);

	onMount(() => {
		document.documentElement.classList.add('app-lock');
		document.body.classList.add('app-lock');

		// Sync quota from server (IP-based)
		syncQuotaFromServer();

		textareaEl?.focus();

		// Inject template query parameter if present in URL
		const urlParams = new URLSearchParams(window.location.search);
		const initialQuery = urlParams.get('q');
		if (initialQuery) {
			draftInput = initialQuery;
			const guessedIntent = detectIntent(initialQuery);
			selectedMode = guessedIntent;
		}
		const mediaQuery = window.matchMedia('(max-width: 980px)');
		const syncMobileRail = () => {
			isMobileRail = mediaQuery.matches;
		};

		syncMobileRail();
		mediaQuery.addEventListener('change', syncMobileRail);

		const interval = setInterval(() => {
			now = new Date();
		}, 60000);

		// Keyboard shortcut: press 'x' to enter doubt mode (not while typing)
		const handleGlobalKeydown = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
				return;
			if (e.key === 'x' && mode === 'done' && activePhase1Json && composerMode === 'scan') {
				e.preventDefault();
				enterDoubtMode();
			}
		};
		window.addEventListener('keydown', handleGlobalKeydown);

		// Close context menu on click outside
		const handleClickOutside = (e: MouseEvent) => {
			if (contextMenuId && !(e.target as HTMLElement)?.closest('.history-actions-wrap')) {
				contextMenuId = null;
			}
		};
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.documentElement.classList.remove('app-lock');
			document.body.classList.remove('app-lock');
			mediaQuery.removeEventListener('change', syncMobileRail);
			window.removeEventListener('keydown', handleGlobalKeydown);
			document.removeEventListener('click', handleClickOutside);
			clearInterval(interval);
			stopElapsedTimer();
			stopThinkingCycle();
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
						<li
							class="activity-step"
							class:step-done={step.status === 'done'}
							class:step-fail={step.status === 'fail'}
							class:step-skipped={step.status === 'skipped'}
							class:step-fallback={step.status === 'fallback'}
						>
							<div class="activity-step-head">
								<code class="activity-step-name {fontMono}">{step.name}</code>
								<span
									class="activity-step-status {fontMono}"
									class:step-running={step.status === 'running'}
									class:step-queued={step.status === 'queued'}
									class:step-status-fail={step.status === 'fail'}
									class:step-status-skipped={step.status === 'skipped'}
									class:step-status-fallback={step.status === 'fallback'}
								>
									{step.status.toUpperCase()}
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
		{#if composerMode === 'doubt'}
			<div class="doubt-mode-pill">
				<div class="doubt-pill-left">
					<span class="doubt-pill-icon" aria-hidden="true">✕</span>
					<span class="doubt-pill-text {fontMono}"
						>Doubting current verdict · Chat only · No Brain Juice</span
					>
				</div>
				<button type="button" class="doubt-pill-exit btnGhost" onclick={exitDoubtMode}>
					Back to new scan
				</button>
			</div>

			{#if doubtMessages.length === 0 && !doubtMaxed}
				<div class="doubt-chips-row">
					{#each DOUBT_CHIPS as chip (chip)}
						<button
							type="button"
							class="doubt-chip {fontBody}"
							onclick={() => handleDoubtChip(chip)}
							disabled={doubtLoading}
						>
							{chip}
						</button>
					{/each}
				</div>
			{/if}
		{/if}

		<div class="composer-box">
			<label for="blep-input" class="sr-only">Your hardware question</label>
			<textarea
				id="blep-input"
				bind:this={textareaEl}
				bind:value={draftInput}
				onkeydown={handleKeydown}
				disabled={mode === 'running' || doubtLoading || (composerMode === 'doubt' && doubtMaxed)}
				placeholder={composerPlaceholder}
				class="composer-textarea {fontBody}"
				style="min-height: 80px; padding: 12px;"
			></textarea>
			<div class="composer-actions-row">
				{#if composerMode === 'doubt' && doubtTurnCount > 0}
					<span class="doubt-turn-badge {fontMono}">{doubtTurnCount}/{MAX_DOUBT_TURNS} doubts</span>
				{/if}
				<button
					class="btnPrimary composer-primary"
					onclick={handleSubmit}
					disabled={!canSubmit}
					type="button"
				>
					{#if composerMode === 'doubt'}
						{doubtLoading ? 'Asking...' : 'Ask BLEP'}
					{:else}
						{mode === 'running' ? 'Asking...' : 'Ask BLEP'}
					{/if}
				</button>
			</div>
		</div>

		{#if composerMode === 'scan' && messages.length === 0}
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

<!-- TODO PROD: wrap with <AuthGuard> for Google OAuth -->
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

		<!-- TODO PROD: add user avatar + sign out here when OAuth is enabled -->

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

		<div class="sidebar-header-row">
			<div class="sidebar-label {fontMono}">{showArchived ? 'Archived' : 'History'}</div>
			<button
				type="button"
				class="sidebar-archive-toggle {fontMono}"
				onclick={() => (showArchived = !showArchived)}
				aria-label={showArchived ? 'Show active scans' : 'Show archived scans'}
			>
				{showArchived ? 'Active' : 'Archived'}
			</button>
		</div>

		<ul class="sidebar-history">
			{#if visibleHistory.length === 0}
				<li class="sidebar-empty-hint {fontMono}">
					{showArchived ? 'No archived scans.' : 'No scans yet.'}
				</li>
			{/if}
			{#each visibleHistory as entry (entry.id)}
				<li class="sidebar-history-li" class:is-pinned={entry.pinned}>
					<button
						class="sidebar-history-item"
						class:active={activeHistoryId === entry.id}
						onclick={() => loadHistoryItem(entry)}
						type="button"
						aria-label={entry.query}
					>
						{#if entry.pinned}
							<span class="pin-icon" aria-label="Pinned" title="Pinned">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="lucide lucide-pin"
								>
									<path
										d="M9 10.76a2 2 0 0 1-1.11 1.79L4 15h16l-3.89-2.45A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.76Z"
									/>
									<path d="M12 17v5" />
								</svg>
							</span>
						{:else}
							<span class="history-dot {verdictColor(entry.verdict)}" aria-hidden="true"></span>
						{/if}
						<span class="history-copy">
							<span class="history-query {fontBody}">{shortenQuery(entry.query)}</span>
							<span class="history-badge {fontMono} {verdictColor(entry.verdict)}"
								>{entry.verdict}</span
							>
						</span>
					</button>
					<div class="history-actions-wrap">
						<button
							type="button"
							class="history-menu-btn {fontMono}"
							onclick={(e) => {
								e.stopPropagation();
								contextMenuId = contextMenuId === entry.id ? null : entry.id;
							}}
							aria-label="Chat actions"
							aria-expanded={contextMenuId === entry.id}>⋯</button
						>
						{#if contextMenuId === entry.id}
							<div class="history-context-menu" role="menu">
								<button
									type="button"
									class="ctx-item {fontBody}"
									onclick={(e) => {
										e.stopPropagation();
										togglePin(entry.id);
									}}
									role="menuitem"
								>
									<span class="ctx-icon">
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="lucide lucide-pin"
										>
											<path
												d="M9 10.76a2 2 0 0 1-1.11 1.79L4 15h16l-3.89-2.45A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.76Z"
											/>
											<path d="M12 17v5" />
										</svg>
									</span>
									{entry.pinned ? 'Unpin' : 'Pin chat'}
								</button>
								{#if entry.archived}
									<button
										type="button"
										class="ctx-item {fontBody}"
										onclick={(e) => {
											e.stopPropagation();
											unarchiveEntry(entry.id);
										}}
										role="menuitem"
									>
										<span class="ctx-icon">
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="lucide lucide-archive"
											>
												<rect width="20" height="5" x="2" y="3" rx="1" />
												<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
												<path d="M10 12h4" />
											</svg>
										</span> Unarchive
									</button>
								{:else}
									<button
										type="button"
										class="ctx-item {fontBody}"
										onclick={(e) => {
											e.stopPropagation();
											archiveEntry(entry.id);
										}}
										role="menuitem"
									>
										<span class="ctx-icon">
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="lucide lucide-archive"
											>
												<rect width="20" height="5" x="2" y="3" rx="1" />
												<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
												<path d="M10 12h4" />
											</svg>
										</span> Archive
									</button>
								{/if}
								<button
									type="button"
									class="ctx-item ctx-delete {fontBody}"
									onclick={(e) => {
										e.stopPropagation();
										deleteEntry(entry.id);
									}}
									role="menuitem"
								>
									<span class="ctx-icon">
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="lucide lucide-trash-2"
										>
											<path d="M3 6h18" />
											<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
											<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
											<line x1="10" x2="10" y1="11" y2="17" />
											<line x1="14" x2="14" y1="11" y2="17" />
										</svg>
									</span> Delete
								</button>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</aside>

	<main class="main-column">
		<header class="main-actions" aria-label="App actions">
			<div
				class="brain-badge {fontMono}"
				aria-label={`Brain Juice ${brainJuice} of ${brainJuiceMax}`}
				data-tooltip={tooltipText}
			>
				<span class="brain-dot" class:active={brainJuice > 0}></span>
				BRAIN JUICE {brainJuice}/{brainJuiceMax}
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
									<div class="msg-row msg-user" in:fly={{ y: 10, duration: 160 }}>
										<div class="msg-bubble-user {fontBody}">
											<p>{@html linkifyText(msg.content)}</p>
										</div>
									</div>

									{#if messages[idx + 1] && messages[idx + 1].role === 'blep'}
										{@const blepMsg = messages[idx + 1]}
										<div class="msg-row msg-blep" in:fly={{ y: 10, duration: 160 }}>
											<div class="msg-blep-block">
												<span class="msg-blep-label {fontMono}">BLEP</span>
												{#if blepMsg.status === 'loading'}
													<p class="msg-blep-content thinking {fontBody}">{thinkingPhrase}</p>
												{:else}
													<p class="msg-blep-content {fontBody}">{blepMsg.content}</p>
												{/if}
											</div>
										</div>

										{#if blepMsg.result}
											<div class="result-card" in:fly={{ y: 16, duration: 220 }}>
												{#if scanErrorCode}
													<div class="scan-error-banner">
														<div class="scan-error-header">
															<span class="scan-error-icon" aria-hidden="true">⚠</span>
															<span class="scan-error-title {fontDisplay}">Live scan failed</span>
														</div>
														<div class="scan-error-details {fontMono}">
															<span>Broke at: <strong>{scanStage ?? 'unknown'}</strong></span>
															<span>Error: <strong>{scanErrorCode}</strong></span>
															{#if scanTraceId}
																<span>Trace: <strong>{scanTraceId}</strong></span>
															{/if}
														</div>
														<p class="scan-error-explain {fontBody}">
															BLEP returned a safe fallback, not a final verdict. Do not buy based
															on this result alone.
														</p>
														<button
															type="button"
															class="btnSecondary scan-error-retry"
															onclick={() => {
																if (lastScanQuery) runLiveScan(lastScanQuery);
															}}
															disabled={mode === 'running' || !lastScanQuery}
														>
															Retry live scan
														</button>
													</div>
												{/if}
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
														<p class="result-strong {fontBody}">
															Press ✕ Doubt this below to argue with the verdict, or start a new
															scan.
														</p>
													</div>
												{:else if blepMsg.result.mode === 'RECOMMENDATION'}
													{@const result = blepMsg.result as RecommendationResult}
													<header class="result-header">
														<h2 class="result-title {fontDisplay}">{result.title}</h2>
														<span class="result-badge {fontDisplay} verdict-approved"
															>RECOMMENDATION</span
														>
													</header>
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
														<p class="result-strong {fontBody}">
															Press ✕ Doubt this to ask questions, or scan a specific listing for
															final judgment.
														</p>
													</div>
													{#if result.shop_links && result.shop_links.length > 0}
														<div class="shop-links-section">
															<span class="result-label {fontMono}">Go shopping</span>
															<div class="shop-links-grid">
																{#each result.shop_links as link (link.url)}
																	<a
																		href={link.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="shop-link {fontBody}"
																	>
																		{link.label} ↗
																	</a>
																{/each}
															</div>
														</div>
													{/if}
												{:else}
													{@const result = blepMsg.result as ComparisonResult}
													{@const compBadgeLabel =
														result.badge === 'BOTH_BAD'
															? 'BOTH BAD'
															: result.badge === 'CLOSE_CALL'
																? 'CLOSE CALL'
																: result.badge === 'CLEAR_WIN'
																	? 'CLEAR WIN'
																	: result.badge.replace(/_/g, ' ')}
													<header class="result-header">
														<h2 class="result-title {fontDisplay}">{result.title}</h2>
														<span class="result-badge {fontDisplay} {verdictColor(result.badge)}"
															>{compBadgeLabel}</span
														>
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

											{#if blepMsg.phase1Json && blepMsg.result}
												<FollowUpChat
													{doubtMessages}
													isLoading={doubtLoading}
													errorMsg={doubtError}
													{showRescanCta}
													turnCount={doubtTurnCount}
													maxTurns={MAX_DOUBT_TURNS}
													isDoubtActive={composerMode === 'doubt'}
													onDoubtClick={enterDoubtMode}
													onRescan={() => {
														const lastUserMsg = messages.findLast((mm) => mm.role === 'user');
														const contextQuery = lastUserMsg?.content ?? lastScanQuery ?? '';
														exitDoubtMode();
														draftInput = contextQuery;
														requestAnimationFrame(() => textareaEl?.focus());
													}}
												/>
											{/if}
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

	.sidebar-user {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px 12px;
		border-bottom: 1px solid rgba(17, 17, 17, 0.08);
		margin-bottom: 4px;
	}

	.sidebar-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.sidebar-avatar-fallback {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-ink);
		color: var(--color-paper);
		display: inline-grid;
		place-items: center;
		font-size: 12px;
		font-weight: 900;
		flex-shrink: 0;
	}

	.sidebar-user-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.sidebar-user-name {
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--color-ink);
	}

	.sidebar-logout {
		border: 0;
		background: transparent;
		color: rgba(17, 17, 17, 0.4);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		padding: 0;
		text-align: left;
	}

	.sidebar-logout:hover {
		color: var(--color-ink);
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

	.sidebar-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 14px;
		width: 100%;
		max-height: 30px;
		transition: max-height 180ms ease;
	}

	.sidebar.collapsed .sidebar-header-row {
		max-height: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.sidebar-label {
		padding: 8px 2px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(17, 17, 17, 0.42);
		max-height: 30px;
		overflow: hidden;
	}

	.sidebar-archive-toggle {
		border: 0;
		background: transparent;
		color: rgba(17, 17, 17, 0.42);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		padding: 4px 6px;
		margin-top: 2px;
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.sidebar-archive-toggle:hover {
		color: var(--color-ink);
		background: rgba(17, 17, 17, 0.06);
	}

	.sidebar-history {
		list-style: none;
		margin: 0;
		padding: 0 8px 16px;
		overflow-y: auto;
		width: 100%;
		transition: padding 180ms ease;
		flex: 1 1 0%;
		min-height: 0;
	}

	.sidebar.collapsed .sidebar-history {
		padding: 0 0 16px;
	}

	.sidebar-empty-hint {
		padding: 10px 14px;
		color: rgba(17, 17, 17, 0.35);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		list-style: none;
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

	/* ── History actions: pin / archive / delete ── */
	.sidebar-history-li {
		position: relative;
		display: flex;
		align-items: stretch;
	}

	.sidebar-history-li .sidebar-history-item {
		flex: 1;
		min-width: 0;
	}

	.sidebar-history-li.is-pinned {
		border-left: 2px solid var(--color-ink);
	}

	.pin-icon {
		width: 12px;
		height: 12px;
		margin-top: 4px;
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--color-ink);
		transition:
			width 180ms ease,
			height 180ms ease,
			margin 180ms ease;
	}

	.pin-icon :global(svg) {
		width: 12px;
		height: 12px;
		display: block;
		transition:
			width 180ms ease,
			height 180ms ease;
	}

	.sidebar.collapsed .pin-icon {
		width: 16px;
		height: 16px;
		margin: 0;
	}

	.sidebar.collapsed .pin-icon :global(svg) {
		width: 16px;
		height: 16px;
	}

	.history-actions-wrap {
		position: relative;
		flex: 0 0 auto;
		display: flex;
		align-items: flex-start;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.sidebar-history-li:hover .history-actions-wrap,
	.sidebar-history-li:focus-within .history-actions-wrap,
	.history-actions-wrap:has(.history-context-menu) {
		opacity: 1;
	}

	.history-menu-btn {
		width: 28px;
		height: 28px;
		margin-top: 8px;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font-size: 16px;
		font-weight: 900;
		cursor: pointer;
		display: inline-grid;
		place-items: center;
		opacity: 0.4;
		transition:
			opacity 100ms ease,
			background 100ms ease;
	}

	.history-menu-btn:hover {
		opacity: 1;
		background: rgba(17, 17, 17, 0.08);
	}

	.history-context-menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 80;
		min-width: 140px;
		background: var(--color-paper);
		border: 1.5px solid var(--color-ink);
		box-shadow: 3px 3px 0 rgba(17, 17, 17, 0.12);
		display: flex;
		flex-direction: column;
		padding: 4px 0;
	}

	.ctx-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font-size: 12.5px;
		font-weight: 600;
		padding: 7px 12px;
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
	}

	.ctx-item:hover {
		background: rgba(17, 17, 17, 0.06);
	}

	.ctx-item.ctx-delete {
		color: #b91c1c;
	}

	.ctx-item.ctx-delete:hover {
		background: rgba(185, 28, 28, 0.08);
	}

	.ctx-icon {
		width: 14px;
		height: 14px;
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: currentColor;
	}

	.ctx-icon :global(svg) {
		width: 14px;
		height: 14px;
		display: block;
	}

	.sidebar.collapsed .history-actions-wrap {
		display: none;
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
		transition:
			opacity 150ms ease,
			visibility 150ms ease;
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
		word-break: break-word;
	}

	:global(.chat-link) {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
		word-break: break-all;
	}

	:global(.chat-link:hover) {
		opacity: 0.7;
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

	.shop-links-section {
		margin-top: 12px;
		padding: 12px;
		border: 1px solid rgba(17, 17, 17, 0.12);
		background: var(--color-paper);
	}

	.shop-links-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
	}

	.shop-link {
		display: inline-block;
		padding: 6px 14px;
		border: 1.5px solid var(--color-ink);
		background: transparent;
		color: var(--color-ink);
		font-size: 0.8rem;
		font-weight: 700;
		text-decoration: none;
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.shop-link:hover {
		background: var(--color-ink);
		color: var(--color-paper);
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

	/* ── Doubt Mode Composer ── */
	.doubt-mode-pill {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		padding: 10px 14px;
		margin-bottom: 8px;
		border: 1.5px solid var(--color-ink);
		background: var(--color-paper-dark);
	}

	.doubt-pill-left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.doubt-pill-icon {
		font-size: 0.8rem;
		opacity: 0.6;
		flex-shrink: 0;
	}

	.doubt-pill-text {
		color: rgba(17, 17, 17, 0.6);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.doubt-pill-exit {
		flex-shrink: 0;
		font-size: 0.75rem;
		min-height: 32px;
		padding: 0 10px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.doubt-chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}

	.doubt-chip {
		border: 1px solid rgba(17, 17, 17, 0.18);
		background: transparent;
		color: rgba(17, 17, 17, 0.7);
		padding: 5px 12px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.doubt-chip:hover:not(:disabled) {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-paper);
	}

	.doubt-chip:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.doubt-turn-badge {
		color: rgba(17, 17, 17, 0.4);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin-right: auto;
		align-self: center;
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

	.activity-step-status.step-status-fail {
		border-color: #ef4444;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}

	.activity-step-status.step-status-skipped {
		border-style: dashed;
		opacity: 0.7;
	}

	.activity-step-status.step-status-fallback {
		border-color: #f59e0b;
		color: #b45309;
		background: rgba(245, 158, 11, 0.15);
	}

	/* ── Error Banner ── */
	.scan-error-banner {
		margin: 16px 24px 0;
		padding: 16px;
		background: rgba(17, 17, 17, 0.04);
		border: 1px dashed var(--color-ink);
	}

	.scan-error-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		color: #ef4444;
	}

	.scan-error-title {
		font-size: 14px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.scan-error-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 11px;
		color: rgba(17, 17, 17, 0.7);
		margin-bottom: 12px;
	}

	.scan-error-explain {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-ink);
		margin: 0 0 16px 0;
		line-height: 1.4;
	}

	.scan-error-retry {
		width: 100%;
		min-height: 36px;
		font-size: 12px;
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

		.history-dot,
		.pin-icon {
			width: 16px;
			height: 16px;
			margin: 0;
		}

		.pin-icon :global(svg) {
			width: 16px;
			height: 16px;
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
