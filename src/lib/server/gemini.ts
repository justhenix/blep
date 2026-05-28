import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { buildBlepPrompt, BLEP_SYSTEM_PROMPT } from '$lib/blep/prompt';
import { blepVerdictSchema } from '$lib/blep/schema';
import type { BlepSource, BlepVerdict } from '$lib/blep/types';
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
			items: {
				type: Type.OBJECT,
				required: ['title', 'url', 'quote_or_fact', 'relevance'],
				properties: {
					title: { type: Type.STRING },
					url: { type: Type.STRING },
					quote_or_fact: { type: Type.STRING },
					relevance: { type: Type.STRING }
				}
			}
		}
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

const parseGeminiVerdict = (text: string, sources: BlepSource[]): BlepVerdict => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(extractJsonText(text));
	} catch {
		throw new GeminiVerdictError('schema_failed', 'parse');
	}

	const schemaResult = blepVerdictSchema.safeParse(parsed);
	if (!schemaResult.success) {
		throw new GeminiVerdictError('schema_failed', 'schema');
	}

	const verdict = schemaResult.data;
	const sourceUrls = new Set(sources.map((source) => source.url));

	for (const evidence of verdict.evidence) {
		if (!sourceUrls.has(evidence.url)) {
			throw new GeminiVerdictError('schema_failed', 'schema');
		}
	}

	return verdict;
};

const generateWithModel = async (model: string, query: string, sources: BlepSource[]) => {
	const ai = getClient();
	let response: Awaited<ReturnType<typeof ai.models.generateContent>>;

	try {
		response = await ai.models.generateContent({
			model,
			contents: buildBlepPrompt(query, sources),
			config: {
				systemInstruction: BLEP_SYSTEM_PROMPT,
				responseMimeType: 'application/json',
				responseSchema: verdictResponseSchema,
				temperature: 0.2,
				candidateCount: 1,
				maxOutputTokens: 1600
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
		const verdict = parseGeminiVerdict(text, sources);
		console.info(`[blep gemini] model=${model} call=ok parse=ok schema=ok`);

		return { verdict, model };
	} catch (error) {
		const stage = error instanceof GeminiVerdictError ? error.stage : 'schema';
		console.info(
			`[blep gemini] model=${model} call=ok parse=${stage === 'parse' ? 'failed' : 'ok'} schema=${stage === 'schema' ? 'failed' : 'skipped'}`
		);
		throw error;
	}
};

export const generateVerdict = async (
	query: string,
	sources: BlepSource[]
): Promise<{ verdict: BlepVerdict; model: string }> => {
	const primaryModel = blepEnv.demoMode ? blepEnv.geminiModelDemo : blepEnv.geminiModelMain;
	const models = [primaryModel, blepEnv.geminiModelBackup].filter(
		(model, index, all) => all.indexOf(model) === index
	);
	let lastError: GeminiVerdictError | null = null;

	for (const model of models) {
		try {
			return await generateWithModel(model, query, sources);
		} catch (error) {
			if (!(error instanceof GeminiVerdictError)) {
				throw new GeminiVerdictError('gemini_failed', 'call');
			}

			lastError = error;
		}
	}

	throw lastError ?? new GeminiVerdictError('gemini_failed', 'call');
};

export const getGeminiErrorCode = (error: unknown): GeminiFailureCode =>
	error instanceof GeminiVerdictError ? error.code : 'gemini_failed';
