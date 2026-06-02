import { z } from 'zod';

const httpUrlSchema = z
	.string()
	.trim()
	.url()
	.refine((value) => {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}, 'URL must use http or https');

const maxSentenceCount = (value: string, max: number) => {
	const text = value.trim();
	if (!text) return false;

	const sentenceEndings = text.match(/[.!?]+(?=\s|$)/g);
	const count = sentenceEndings?.length ?? 1;

	return count <= max;
};

const confidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
const nullablePriceSchema = z.number().int().min(0).nullable();

export const blepEvidenceSchema = z
	.object({
		title: z.string().trim().min(1),
		url: httpUrlSchema,
		quote_or_fact: z.string().trim().min(1),
		relevance: z.string().trim().min(1)
	})
	.strict();

export const blepVerdictSchema = z
	.object({
		mode: z.literal('VERDICT').default('VERDICT'),
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
		evidence: z.array(blepEvidenceSchema).min(1).max(3)
	})
	.strict();

export const blepRecommendationSchema = z
	.object({
		mode: z.literal('RECOMMENDATION').default('RECOMMENDATION'),
		query: z.string().trim().min(1),
		parsed_need: z
			.object({
				category: z.string().trim().min(1),
				use_case: z.string().trim().min(1),
				budget_idr: nullablePriceSchema,
				market: z.string().trim().min(1),
				hard_constraints: z.array(z.string().trim().min(1)).max(8)
			})
			.strict(),
		recommendation_summary: z.string().trim().min(1),
		target_specs: z
			.object({
				cpu: z.string().trim().min(1),
				gpu: z.string().trim().min(1),
				ram: z.string().trim().min(1),
				storage: z.string().trim().min(1),
				screen: z.string().trim().min(1),
				thermal: z.string().trim().min(1),
				upgradeability: z.string().trim().min(1)
			})
			.strict(),
		picks: z
			.array(
				z
					.object({
						label: z.enum(['BEST_OVERALL', 'CHEAPER_SAFE', 'STRETCH_PICK', 'USED_OPTION']),
						name: z.string().trim().min(1),
						expected_price_idr: nullablePriceSchema,
						why: z.string().trim().min(1),
						caveat: z.string().trim().min(1),
						evidence_refs: z.array(z.number().int().min(0)).max(8)
					})
					.strict()
			)
			.min(2)
			.max(4),
		avoid: z
			.array(
				z
					.object({
						pattern: z.string().trim().min(1),
						reason: z.string().trim().min(1)
					})
					.strict()
			)
			.min(1)
			.max(3),
		deal_rules: z.array(z.string().trim().min(1)).min(1).max(3),
		evidence: z.array(blepEvidenceSchema).max(3),
		confidence: confidenceSchema,
		next_action: z.string().trim().min(1)
	})
	.strict();

export const blepComparisonSchema = z
	.object({
		mode: z.literal('COMPARISON').default('COMPARISON'),
		query: z.string().trim().min(1),
		winner: z.string().trim().min(1),
		loser: z.string().trim().min(1),
		verdict: z.enum(['CLEAR_WIN', 'CLOSE_CALL', 'BOTH_BAD']),
		reason: z.string().trim().min(1),
		compared: z
			.array(
				z
					.object({
						name: z.string().trim().min(1),
						price_idr: nullablePriceSchema,
						strengths: z.array(z.string().trim().min(1)).max(6),
						flaws: z.array(z.string().trim().min(1)).max(6),
						verdict: z.enum(['APPROVED', 'CAUTION', 'WASTE'])
					})
					.strict()
			)
			.min(2)
			.max(4),
		evidence: z.array(blepEvidenceSchema).max(3),
		confidence: confidenceSchema
	})
	.strict();

export const blepNeedsInputSchema = z
	.object({
		mode: z.literal('NEEDS_INPUT').default('NEEDS_INPUT'),
		reason: z.string().trim().min(1),
		questions: z.array(z.string().trim().min(1)).min(1).max(2),
		examples: z.array(z.string().trim().min(1)).min(1).max(4)
	})
	.strict();

export const blepPhase1OutputSchema = z.discriminatedUnion('mode', [
	blepVerdictSchema,
	blepRecommendationSchema,
	blepComparisonSchema,
	blepNeedsInputSchema
]);

export const blepScanRequestSchema = z
	.object({
		query: z.string().trim().max(500),
		urls: z.array(httpUrlSchema).max(5).optional()
	})
	.strict();
