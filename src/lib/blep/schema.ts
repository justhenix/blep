import { z } from 'zod';

const maxSentenceCount = (value: string, max: number) => {
	const text = value.trim();
	if (!text) return false;

	const sentenceEndings = text.match(/[.!?]+(?=\s|$)/g);
	const count = sentenceEndings?.length ?? 1;

	return count <= max;
};

export const blepEvidenceSchema = z
	.object({
		title: z.string().trim().min(1),
		url: z.string().trim().url(),
		quote_or_fact: z.string().trim().min(1),
		relevance: z.string().trim().min(1)
	})
	.strict();

export const blepVerdictSchema = z
	.object({
		name: z.string().trim().min(1),
		verdict: z.enum(['APPROVED', 'CAUTION', 'WASTE']),
		landfill_year: z.number().int().min(0),
		fatal_flaw: z.string().trim().min(1),
		specs: z
			.object({
				upgradeable: z.boolean(),
				thermal: z.string().trim().min(1),
				forum_score: z.number().int().min(1).max(10)
			})
			.strict(),
		roast: z
			.string()
			.trim()
			.min(1)
			.refine((value) => maxSentenceCount(value, 2), 'roast must be 2 sentences max'),
		summary: z.string().trim().min(1),
		evidence: z.array(blepEvidenceSchema).min(1).max(5)
	})
	.strict();

export const blepScanRequestSchema = z
	.object({
		query: z.string().trim().max(500),
		urls: z.array(z.string().trim().url()).max(5).optional()
	})
	.strict();
