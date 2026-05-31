import { GoogleGenAI, Type, type Schema } from '@google/genai';
import {
	BLEP_COMPARISON_SYSTEM_PROMPT,
	BLEP_RECOMMENDATION_SYSTEM_PROMPT,
	BLEP_SYSTEM_PROMPT,
	buildBlepPrompt,
	buildComparisonPrompt,
	buildRecommendationPrompt
} from '$lib/blep/prompt';
import {
	blepComparisonSchema,
	blepRecommendationSchema,
	blepVerdictSchema
} from '$lib/blep/schema';
import type { BlepIntentResult } from '$lib/blep/intent';
import type {
	BlepComparison,
	BlepPhase1Output,
	BlepRecommendation,
	BlepSource,
	BlepVerdict
} from '$lib/blep/types';
import { blepEnv } from './env';

export type GeminiFailureCode = 'gemini_failed' | 'schema_failed';

class GeminiVerdictError extends Error {
	constructor(
		readonly code: GeminiFailureCode,
		readonly stage: 'call' | 'parse' | 'schema'
	) {
		super(code);
		this.name = 'GeminiVerdictError';
	}
}

const evidenceItemSchema: Schema = {
	type: Type.OBJECT,
	required: ['title', 'url', 'quote_or_fact', 'relevance'],
	properties: {
		title: { type: Type.STRING },
		url: { type: Type.STRING },
		quote_or_fact: { type: Type.STRING },
		relevance: { type: Type.STRING }
	}
};

const verdictResponseSchema: Schema = {
	type: Type.OBJECT,
	required: [
		'name',
		'verdict',
		'landfill_year',
		'fatal_flaw',
		'specs',
		'roast',
		'summary',
		'evidence'
	],
	propertyOrdering: [
		'name',
		'verdict',
		'landfill_year',
		'fatal_flaw',
		'specs',
		'roast',
		'summary',
		'evidence'
	],
	properties: {
		name: { type: Type.STRING },
		verdict: { type: Type.STRING, enum: ['APPROVED', 'CAUTION', 'WASTE'] },
		landfill_year: { type: Type.INTEGER },
		fatal_flaw: { type: Type.STRING },
		specs: {
			type: Type.OBJECT,
			required: ['upgradeable', 'thermal', 'forum_score'],
			properties: {
				upgradeable: { type: Type.BOOLEAN },
				thermal: { type: Type.STRING },
				forum_score: { type: Type.INTEGER, minimum: 1, maximum: 10 }
			}
		},
		roast: { type: Type.STRING },
		summary: { type: Type.STRING },
		evidence: {
			type: Type.ARRAY,
			minItems: '1',
			maxItems: '5',
			items: evidenceItemSchema
		}
	}
};

const recommendationResponseSchema: Schema = {
	type: Type.OBJECT,
	required: [
		'query',
		'parsed_need',
		'recommendation_summary',
		'target_specs',
		'picks',
		'avoid',
		'deal_rules',
		'evidence',
		'confidence',
		'next_action'
	],
	properties: {
		query: { type: Type.STRING },
		parsed_need: {
			type: Type.OBJECT,
			required: ['category', 'use_case', 'budget_idr', 'market', 'hard_constraints'],
			properties: {
				category: { type: Type.STRING },
				use_case: { type: Type.STRING },
				budget_idr: { type: Type.INTEGER, nullable: true },
				market: { type: Type.STRING },
				hard_constraints: { type: Type.ARRAY, items: { type: Type.STRING } }
			}
		},
		recommendation_summary: { type: Type.STRING },
		target_specs: {
			type: Type.OBJECT,
			required: ['cpu', 'gpu', 'ram', 'storage', 'screen', 'thermal', 'upgradeability'],
			properties: {
				cpu: { type: Type.STRING },
				gpu: { type: Type.STRING },
				ram: { type: Type.STRING },
				storage: { type: Type.STRING },
				screen: { type: Type.STRING },
				thermal: { type: Type.STRING },
				upgradeability: { type: Type.STRING }
			}
		},
		picks: {
			type: Type.ARRAY,
			minItems: '2',
			maxItems: '4',
			items: {
				type: Type.OBJECT,
				required: ['label', 'name', 'expected_price_idr', 'why', 'caveat', 'evidence_refs'],
				properties: {
					label: {
						type: Type.STRING,
						enum: ['BEST_OVERALL', 'CHEAPER_SAFE', 'STRETCH_PICK', 'USED_OPTION']
					},
					name: { type: Type.STRING },
					expected_price_idr: { type: Type.INTEGER, nullable: true },
					why: { type: Type.STRING },
					caveat: { type: Type.STRING },
					evidence_refs: { type: Type.ARRAY, items: { type: Type.INTEGER } }
				}
			}
		},
		avoid: {
			type: Type.ARRAY,
			minItems: '1',
			maxItems: '6',
			items: {
				type: Type.OBJECT,
				required: ['pattern', 'reason'],
				properties: {
					pattern: { type: Type.STRING },
					reason: { type: Type.STRING }
				}
			}
		},
		deal_rules: { type: Type.ARRAY, minItems: '1', maxItems: '6', items: { type: Type.STRING } },
		evidence: { type: Type.ARRAY, maxItems: '8', items: evidenceItemSchema },
		confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] },
		next_action: { type: Type.STRING }
	}
};

const comparisonResponseSchema: Schema = {
	type: Type.OBJECT,
	required: ['query', 'winner', 'loser', 'verdict', 'reason', 'compared', 'evidence', 'confidence'],
	properties: {
		query: { type: Type.STRING },
		winner: { type: Type.STRING },
		loser: { type: Type.STRING },
		verdict: { type: Type.STRING, enum: ['CLEAR_WIN', 'CLOSE_CALL', 'BOTH_BAD'] },
		reason: { type: Type.STRING },
		compared: {
			type: Type.ARRAY,
			minItems: '2',
			maxItems: '4',
			items: {
				type: Type.OBJECT,
				required: ['name', 'price_idr', 'strengths', 'flaws', 'verdict'],
				properties: {
					name: { type: Type.STRING },
					price_idr: { type: Type.INTEGER, nullable: true },
					strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
					flaws: { type: Type.ARRAY, items: { type: Type.STRING } },
					verdict: { type: Type.STRING, enum: ['APPROVED', 'CAUTION', 'WASTE'] }
				}
			}
		},
		evidence: { type: Type.ARRAY, maxItems: '8', items: evidenceItemSchema },
		confidence: { type: Type.STRING, enum: ['HIGH', 'MEDIUM', 'LOW'] }
	}
};

const getClient = () => {
	if (!blepEnv.geminiApiKey) throw new GeminiVerdictError('gemini_failed', 'call');

	return new GoogleGenAI({ apiKey: blepEnv.geminiApiKey });
};

const stripJsonFence = (text: string) =>
	text
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '');

const extractJsonText = (text: string) => {
	const stripped = stripJsonFence(text);
	const firstBrace = stripped.indexOf('{');
	const lastBrace = stripped.lastIndexOf('}');

	if (firstBrace < 0 || lastBrace <= firstBrace) {
		throw new GeminiVerdictError('schema_failed', 'parse');
	}

	return stripped.slice(firstBrace, lastBrace + 1);
};

const assertEvidenceFromSources = (evidence: { url: string }[], sources: BlepSource[]) => {
	const sourceUrls = new Set(sources.map((source) => source.url));

	for (const item of evidence) {
		if (!sourceUrls.has(item.url)) {
			throw new GeminiVerdictError('schema_failed', 'schema');
		}
	}
};

type ModeConfig<T extends BlepPhase1Output> = {
	systemPrompt: string;
	responseSchema: Schema;
	maxOutputTokens: number;
	buildPrompt: (query: string, sources: BlepSource[], intent: BlepIntentResult) => string;
	parse: (raw: unknown, sources: BlepSource[]) => T;
};

const parseWith = <T extends BlepPhase1Output>(
	zodParse: (raw: unknown) => { success: true; data: T } | { success: false },
	getEvidence: (data: T) => { url: string }[]
) => {
	return (raw: unknown, sources: BlepSource[]): T => {
		const result = zodParse(raw);
		if (!result.success) {
			throw new GeminiVerdictError('schema_failed', 'schema');
		}

		assertEvidenceFromSources(getEvidence(result.data), sources);

		return result.data;
	};
};

const verdictConfig: ModeConfig<BlepVerdict> = {
	systemPrompt: BLEP_SYSTEM_PROMPT,
	responseSchema: verdictResponseSchema,
	maxOutputTokens: 1600,
	buildPrompt: (query, sources) => buildBlepPrompt(query, sources),
	parse: parseWith(
		(raw) => blepVerdictSchema.safeParse(raw),
		(data) => data.evidence
	)
};

const recommendationConfig: ModeConfig<BlepRecommendation> = {
	systemPrompt: BLEP_RECOMMENDATION_SYSTEM_PROMPT,
	responseSchema: recommendationResponseSchema,
	maxOutputTokens: 2400,
	buildPrompt: buildRecommendationPrompt,
	parse: parseWith(
		(raw) => blepRecommendationSchema.safeParse(raw),
		(data) => data.evidence
	)
};

const comparisonConfig: ModeConfig<BlepComparison> = {
	systemPrompt: BLEP_COMPARISON_SYSTEM_PROMPT,
	responseSchema: comparisonResponseSchema,
	maxOutputTokens: 2200,
	buildPrompt: buildComparisonPrompt,
	parse: parseWith(
		(raw) => blepComparisonSchema.safeParse(raw),
		(data) => data.evidence
	)
};

const parseModelText = <T extends BlepPhase1Output>(
	config: ModeConfig<T>,
	text: string,
	sources: BlepSource[]
): T => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(extractJsonText(text));
	} catch {
		throw new GeminiVerdictError('schema_failed', 'parse');
	}

	return config.parse(parsed, sources);
};

const generateWithModel = async <T extends BlepPhase1Output>(
	config: ModeConfig<T>,
	model: string,
	query: string,
	sources: BlepSource[],
	intent: BlepIntentResult
): Promise<{ result: T; model: string }> => {
	const ai = getClient();
	let response: Awaited<ReturnType<typeof ai.models.generateContent>>;

	try {
		response = await ai.models.generateContent({
			model,
			contents: config.buildPrompt(query, sources, intent),
			config: {
				systemInstruction: config.systemPrompt,
				responseMimeType: 'application/json',
				responseSchema: config.responseSchema,
				temperature: 0.2,
				candidateCount: 1,
				maxOutputTokens: config.maxOutputTokens
			}
		});
	} catch {
		console.info(`[blep gemini] model=${model} call=failed parse=skipped schema=skipped`);
		throw new GeminiVerdictError('gemini_failed', 'call');
	}

	const text = response.text;
	if (!text) {
		console.info(`[blep gemini] model=${model} call=ok parse=failed schema=skipped`);
		throw new GeminiVerdictError('schema_failed', 'parse');
	}

	try {
		const result = parseModelText(config, text, sources);
		console.info(`[blep gemini] model=${model} call=ok parse=ok schema=ok`);

		return { result, model };
	} catch (error) {
		const stage = error instanceof GeminiVerdictError ? error.stage : 'schema';
		console.info(
			`[blep gemini] model=${model} call=ok parse=${stage === 'parse' ? 'failed' : 'ok'} schema=${stage === 'schema' ? 'failed' : 'skipped'}`
		);
		throw error;
	}
};

const runWithFallback = async <T extends BlepPhase1Output>(
	config: ModeConfig<T>,
	query: string,
	sources: BlepSource[],
	intent: BlepIntentResult
): Promise<{ result: T; model: string }> => {
	const primaryModel = blepEnv.demoMode ? blepEnv.geminiModelDemo : blepEnv.geminiModelMain;
	const models = [primaryModel, blepEnv.geminiModelBackup].filter(
		(model, index, all) => all.indexOf(model) === index
	);
	let lastError: GeminiVerdictError | null = null;

	for (const model of models) {
		try {
			return await generateWithModel(config, model, query, sources, intent);
		} catch (error) {
			if (!(error instanceof GeminiVerdictError)) {
				throw new GeminiVerdictError('gemini_failed', 'call');
			}

			lastError = error;
		}
	}

	throw lastError ?? new GeminiVerdictError('gemini_failed', 'call');
};

export const generateVerdict = async (
	query: string,
	sources: BlepSource[]
): Promise<{ verdict: BlepVerdict; model: string }> => {
	const { result, model } = await runWithFallback(verdictConfig, query, sources, {
		intent: 'VERDICT_SCAN',
		budget_idr: null,
		use_case: null,
		category: 'laptop',
		devices: []
	});

	return { verdict: result, model };
};

export const generatePhase1 = async (
	query: string,
	sources: BlepSource[],
	intent: BlepIntentResult
): Promise<{ result: BlepPhase1Output; model: string }> => {
	switch (intent.intent) {
		case 'RECOMMENDATION_SCAN':
			return runWithFallback(recommendationConfig, query, sources, intent);
		case 'COMPARISON_SCAN':
			return runWithFallback(comparisonConfig, query, sources, intent);
		default:
			return runWithFallback(verdictConfig, query, sources, intent);
	}
};

/**
 * Phase 2 — simple single-turn Gemini call for follow-up chat.
 * No response schema enforcement. Returns raw text.
 * Uses cheapest model (geminiModelMain).
 */
export const generatePhase2Chat = async (
	systemPrompt: string,
	userContent: string
): Promise<string> => {
	const ai = getClient();
	const model = blepEnv.geminiModelMain;

	const response = await ai.models.generateContent({
		model,
		contents: userContent,
		config: {
			systemInstruction: systemPrompt,
			temperature: 0.3,
			candidateCount: 1,
			maxOutputTokens: 600
		}
	});

	const text = response.text;
	if (!text) {
		throw new GeminiVerdictError('gemini_failed', 'call');
	}

	console.info(`[blep gemini] phase2 model=${model} call=ok`);

	return text;
};

export const getGeminiErrorCode = (error: unknown): GeminiFailureCode =>
	error instanceof GeminiVerdictError ? error.code : 'gemini_failed';
