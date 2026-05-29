import {
	blepComparisonSchema,
	blepNeedsInputSchema,
	blepRecommendationSchema,
	blepVerdictSchema
} from './schema';
import type { BlepIntentResult } from './intent';
import type {
	BlepComparison,
	BlepNeedsInput,
	BlepPhase1Output,
	BlepRecommendation,
	BlepVerdict
} from './types';

const fallbackEvidenceUrl = 'https://example.com/blep/mock-evidence';

export const buildFallbackVerdict = (query = 'Unknown device'): BlepVerdict =>
	blepVerdictSchema.parse({
		name: query.trim() || 'Unknown device',
		verdict: 'CAUTION',
		landfill_year: 2028,
		fatal_flaw: 'Research failed before BLEP could prove value.',
		specs: {
			upgradeable: false,
			thermal: 'Unknown thermal behavior.',
			forum_score: 5
		},
		roast: 'Not enough evidence. Wallet should stay in cave.',
		summary: 'BLEP could not complete scan, so verdict falls back to caution.',
		evidence: [
			{
				title: 'BLEP fallback',
				url: fallbackEvidenceUrl,
				quote_or_fact: 'Fallback result used when live scrape, quota, or model validation fails.',
				relevance: 'Keeps demo stable without pretending external research happened.'
			}
		]
	});

export const fallbackVerdict: BlepVerdict = buildFallbackVerdict();

type MockVerdictKind = 'APPROVED' | 'CAUTION' | 'WASTE';

const matchesAny = (haystack: string, needles: string[]) =>
	needles.some((needle) => haystack.includes(needle));

const classifyMockQuery = (query: string): MockVerdictKind => {
	const lower = query.toLowerCase();

	if (matchesAny(lower, ['t480', 'thinkpad'])) return 'APPROVED';
	if (matchesAny(lower, ['acer aspire', 'ddr2', '1gb', 'hdd'])) return 'WASTE';
	if (matchesAny(lower, ['axioo', 'blender', '8gb'])) return 'CAUTION';

	return 'CAUTION';
};

const mockVerdictPresets: Record<
	MockVerdictKind,
	Omit<BlepVerdict, 'mode' | 'name' | 'evidence'>
> = {
	APPROVED: {
		verdict: 'APPROVED',
		landfill_year: 2032,
		fatal_flaw: 'Battery wear typical for age but otherwise solid foundation.',
		specs: {
			upgradeable: true,
			thermal: 'Cool under daily load, fans audible only on sustained CPU stress.',
			forum_score: 9
		},
		roast: 'Boring, beige, brilliant. Cave wallet survives another season.',
		summary: 'Mock APPROVED verdict: classic upgrade-friendly chassis with strong forum reputation.'
	},
	CAUTION: {
		verdict: 'CAUTION',
		landfill_year: 2029,
		fatal_flaw: 'Mock scan sees limited upgrade path and unclear long-term value.',
		specs: {
			upgradeable: false,
			thermal: 'Acceptable for light work, risky under sustained load.',
			forum_score: 6
		},
		roast: 'Looks useful until specs start sweating. Buy only if price is cave-cheap.',
		summary:
			'Mock CAUTION verdict: usable for demo flow, but real purchase advice needs Firecrawl evidence and Gemini validation.'
	},
	WASTE: {
		verdict: 'WASTE',
		landfill_year: 2026,
		fatal_flaw: 'Soldered RAM, mechanical HDD, and dated CPU make this a landfill ticket.',
		specs: {
			upgradeable: false,
			thermal: 'Throttles fast, fans loud, paste likely cooked.',
			forum_score: 2
		},
		roast: 'E-waste cosplaying as a laptop. Cave says: walk away, save wallet.',
		summary: 'Mock WASTE verdict: heuristic flagged outdated specs and known-bad family.'
	}
};

export const buildMockVerdict = (query: string, urls: string[] = []): BlepVerdict => {
	const evidenceUrl = urls[0] ?? fallbackEvidenceUrl;
	const kind = classifyMockQuery(query);
	const preset = mockVerdictPresets[kind];

	return blepVerdictSchema.parse({
		name: query.trim() || 'Unknown device',
		...preset,
		evidence: [
			{
				title: `Mock evidence (${kind.toLowerCase()})`,
				url: evidenceUrl,
				quote_or_fact: 'Mock mode is active; no live web research was performed.',
				relevance: 'Proves response shape and validation path before AI integration.'
			}
		]
	});
};

const formatIdr = (value: number | null) =>
	value === null ? 'sesuai listing' : `Rp${value.toLocaleString('id-ID')}`;

export const buildMockRecommendation = (
	query: string,
	intent: BlepIntentResult
): BlepRecommendation => {
	const useCase = intent.use_case ?? 'general use';
	const budgetLabel = formatIdr(intent.budget_idr);

	return blepRecommendationSchema.parse({
		query: query.trim() || 'rekomendasi laptop',
		parsed_need: {
			category: intent.category,
			use_case: useCase,
			budget_idr: intent.budget_idr,
			market: 'Indonesia',
			hard_constraints: []
		},
		recommendation_summary: `Mock recommendation for ${useCase} around ${budgetLabel}. Live mode adds current listing evidence.`,
		target_specs: {
			cpu: 'Ryzen 5 / Core i5 H-series (8 cores)',
			gpu: 'RTX 4050 minimum for gaming',
			ram: '16GB dual-channel',
			storage: '512GB NVMe SSD',
			screen: '15.6" 144Hz IPS',
			thermal: 'Dual-fan with acceptable sustained clocks',
			upgradeability: 'Free RAM slot + spare M.2'
		},
		picks: [
			{
				label: 'BEST_OVERALL',
				name: 'Target: RTX 4050 / 16GB / 144Hz class',
				expected_price_idr: intent.budget_idr,
				why: 'Hits the playable-modern-games bracket without overpaying for badge GPUs.',
				caveat: 'Mock pick. Exact model depends on live listing evidence.',
				evidence_refs: [0]
			},
			{
				label: 'CHEAPER_SAFE',
				name: 'Target: RTX 3050 / 16GB if much cheaper',
				expected_price_idr: null,
				why: 'Acceptable when non-GPU value (panel, build, RAM) is strong.',
				caveat: 'Only if the price gap is real, not marketing.',
				evidence_refs: [0]
			}
		],
		avoid: [
			{
				pattern: 'GTX 1650 / RTX 2050 above 10-11 juta',
				reason: 'Old GPU tier at premium price; loses to RTX 4050 class.'
			},
			{
				pattern: '8GB soldered single-channel RAM',
				reason: 'Kills multitasking and cannot be fixed later.'
			}
		],
		deal_rules: [
			'Demand RTX 4050+ at this budget before paying.',
			'Reject 8GB soldered RAM as a final config.',
			'Check sustained thermals, not just peak benchmarks.'
		],
		evidence: [
			{
				title: 'Mock recommendation evidence',
				url: fallbackEvidenceUrl,
				quote_or_fact: 'Mock mode active; no live market research was performed.',
				relevance: 'Proves recommendation card shape before live integration.'
			}
		],
		confidence: 'LOW',
		next_action: 'Send 2 listing links and BLEP will judge the final pick.'
	});
};

export const buildMockComparison = (query: string, intent: BlepIntentResult): BlepComparison => {
	const [first, second] = intent.devices;
	const winner = first || 'Option A';
	const loser = second || 'Option B';

	return blepComparisonSchema.parse({
		query: query.trim() || 'comparison',
		winner,
		loser,
		verdict: 'CLOSE_CALL',
		reason: `Mock comparison: ${winner} edges ${loser} on value, but live evidence decides the final call.`,
		compared: [
			{
				name: winner,
				price_idr: null,
				strengths: ['Better sustained thermals (mock)', 'Stronger forum reputation (mock)'],
				flaws: ['Mock data only'],
				verdict: 'CAUTION'
			},
			{
				name: loser,
				price_idr: null,
				strengths: ['Possibly cheaper (mock)'],
				flaws: ['Weaker cooling (mock)', 'Mock data only'],
				verdict: 'CAUTION'
			}
		],
		evidence: [
			{
				title: 'Mock comparison evidence',
				url: fallbackEvidenceUrl,
				quote_or_fact: 'Mock mode active; no live comparison research was performed.',
				relevance: 'Proves comparison card shape before live integration.'
			}
		],
		confidence: 'LOW'
	});
};

export const buildMockNeedsInput = (): BlepNeedsInput =>
	blepNeedsInputSchema.parse({
		reason: 'No budget or use case. BLEP cannot judge market value safely.',
		questions: ['Budget berapa?', 'Dipakai buat apa paling berat?'],
		examples: ['rekomendasi laptop gaming 15 juta', 'laptop kuliah 8 juta buat coding']
	});

export const buildMockOutput = (
	query: string,
	urls: string[],
	intent: BlepIntentResult
): BlepPhase1Output => {
	switch (intent.intent) {
		case 'RECOMMENDATION_SCAN':
			return buildMockRecommendation(query, intent);
		case 'COMPARISON_SCAN':
			return buildMockComparison(query, intent);
		case 'NEEDS_INPUT':
			return buildMockNeedsInput();
		default:
			return buildMockVerdict(query, urls);
	}
};
