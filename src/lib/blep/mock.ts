import { blepVerdictSchema } from './schema';
import type { BlepVerdict } from './types';

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

const mockVerdictPresets: Record<MockVerdictKind, Omit<BlepVerdict, 'name' | 'evidence'>> = {
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
