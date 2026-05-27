import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { buildBlepPrompt, BLEP_SYSTEM_PROMPT } from '$lib/blep/prompt';
import { blepVerdictSchema } from '$lib/blep/schema';
import type { BlepSource, BlepVerdict } from '$lib/blep/types';
import { blepEnv } from './env';

class GeminiValidationError extends Error {}

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
	if (!blepEnv.geminiApiKey) throw new Error('gemini_missing_key');

	return new GoogleGenAI({ apiKey: blepEnv.geminiApiKey });
};

const stripJsonFence = (text: string) =>
	text
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '');

const parseGeminiVerdict = (text: string, sources: BlepSource[]): BlepVerdict => {
	try {
		const parsed: unknown = JSON.parse(stripJsonFence(text));
		const verdict = blepVerdictSchema.parse(parsed);
		const sourceUrls = new Set(sources.map((source) => source.url));

		for (const evidence of verdict.evidence) {
			if (!sourceUrls.has(evidence.url)) {
				throw new Error('evidence_source_mismatch');
			}
		}

		return verdict;
	} catch {
		throw new GeminiValidationError('gemini_invalid_json_or_schema');
	}
};

const generateWithModel = async (model: string, query: string, sources: BlepSource[]) => {
	const ai = getClient();
	const response = await ai.models.generateContent({
		model,
		contents: buildBlepPrompt(query, sources),
		config: {
			systemInstruction: BLEP_SYSTEM_PROMPT,
			responseMimeType: 'application/json',
			responseSchema: verdictResponseSchema,
			temperature: 0.2,
			maxOutputTokens: 1600
		}
	});

	const text = response.text;
	if (!text) throw new GeminiValidationError('gemini_empty_response');

	const verdict = parseGeminiVerdict(text, sources);
	console.info(`[blep gemini] model used ${model}`);

	return { verdict, model };
};

export const generateVerdict = async (
	query: string,
	sources: BlepSource[]
): Promise<{ verdict: BlepVerdict; model: string }> => {
	const primaryModel = blepEnv.demoMode ? blepEnv.geminiModelDemo : blepEnv.geminiModelMain;

	try {
		return await generateWithModel(primaryModel, query, sources);
	} catch (error) {
		if (!(error instanceof GeminiValidationError)) throw error;
		if (blepEnv.geminiModelBackup === primaryModel) throw error;

		return generateWithModel(blepEnv.geminiModelBackup, query, sources);
	}
};
