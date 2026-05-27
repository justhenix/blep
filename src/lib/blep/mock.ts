import { blepVerdictSchema } from './schema';
import type { BlepVerdict } from './types';

const fallbackEvidenceUrl = 'https://example.com/blep/mock-evidence';

export const fallbackVerdict: BlepVerdict = blepVerdictSchema.parse({
	name: 'Unknown device',
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
			quote_or_fact: 'Fallback result used when backend verdict generation fails.',
			relevance: 'Keeps demo stable without pretending external research happened.'
		}
	]
});

export const buildMockVerdict = (query: string, urls: string[] = []): BlepVerdict => {
	const evidenceUrl = urls[0] ?? fallbackEvidenceUrl;

	return blepVerdictSchema.parse({
		name: query,
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
			'Mock BLEP verdict: usable for demo flow, but real purchase advice needs Firecrawl evidence and Gemini validation.',
		evidence: [
			{
				title: 'Mock evidence source',
				url: evidenceUrl,
				quote_or_fact: 'Mock mode is active; no live web research was performed.',
				relevance: 'Proves response shape and validation path before AI integration.'
			}
		]
	});
};
