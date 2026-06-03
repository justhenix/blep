/**
 * Provider-agnostic AI module using Vercel AI SDK.
 *
 * Supports: Google (Gemini), OpenAI, DeepSeek, OpenRouter, or any
 * OpenAI-compatible endpoint via OPENAI_BASE_URL.
 *
 * Provider is auto-detected from env keys at runtime.
 * Priority: GOOGLE_GENERATIVE_AI_API_KEY → DEEPSEEK_API_KEY → OPENAI_API_KEY
 *
 * Exports the same API surface as the old gemini.ts:
 *   generatePhase1(), generatePhase2Chat(), getAiErrorCode()
 */

import { generateObject, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';

import { env } from '$env/dynamic/private';

import {
	blepVerdictSchema,
	blepRecommendationSchema,
	blepComparisonSchema,
	blepPhase1OutputSchema
} from '$lib/blep/schema';
import {
	BLEP_SYSTEM_PROMPT,
	BLEP_RECOMMENDATION_SYSTEM_PROMPT,
	BLEP_COMPARISON_SYSTEM_PROMPT,
	buildBlepPrompt,
	buildRecommendationPrompt,
	buildComparisonPrompt
} from '$lib/blep/prompt';
import type { BlepIntentResult } from '$lib/blep/intent';
import type { BlepPhase1Output, BlepSource } from '$lib/blep/types';
import type { BlepErrorCode } from '$lib/server/errors';

// ─── Provider Detection ────────────────────────────────

type ProviderTag = 'vertex' | 'google' | 'deepseek' | 'openai' | 'openai-compat';

type ResolvedProvider = {
	tag: ProviderTag;
	phase1Model: ReturnType<typeof createModel>;
	phase2Model: ReturnType<typeof createModel>;
};

function getEnv(name: string): string | undefined {
	return env[name] ?? undefined;
}

function createModel(tag: ProviderTag, modelId: string) {
	switch (tag) {
		case 'vertex': {
			const vertex = createVertex({
				project: getEnv('GOOGLE_CLOUD_PROJECT') ?? 'henixhacking',
				location: getEnv('GOOGLE_CLOUD_LOCATION') ?? 'us-central1'
			});
			return vertex(modelId);
		}
		case 'google': {
			const google = createGoogleGenerativeAI({
				apiKey: getEnv('GOOGLE_GENERATIVE_AI_API_KEY') ?? getEnv('GEMINI_API_KEY') ?? ''
			});
			return google(modelId);
		}
		case 'deepseek': {
			const deepseek = createDeepSeek({
				apiKey: getEnv('DEEPSEEK_API_KEY') ?? ''
			});
			return deepseek(modelId);
		}
		case 'openai': {
			const openai = createOpenAI({
				apiKey: getEnv('OPENAI_API_KEY') ?? ''
			});
			return openai(modelId);
		}
		case 'openai-compat': {
			const compat = createOpenAI({
				apiKey: getEnv('OPENAI_API_KEY') ?? '',
				baseURL: getEnv('OPENAI_BASE_URL') ?? 'https://openrouter.ai/api/v1'
			});
			return compat(modelId);
		}
	}
}

/** Auto-detect which provider to use from env keys. */
function resolveProvider(): ResolvedProvider {
	// Vertex AI — bills through GCP project credits, NOT API key
	// Priority: use Vertex when GOOGLE_CLOUD_PROJECT is set (or USE_VERTEX=true)
	if (getEnv('USE_VERTEX') === 'true' || getEnv('GOOGLE_CLOUD_PROJECT')) {
		const phase1Id = getEnv('AI_MODEL_PHASE1') ?? 'gemini-2.5-flash';
		const phase2Id = getEnv('AI_MODEL_PHASE2') ?? 'gemini-2.5-flash-lite';
		const project = getEnv('GOOGLE_CLOUD_PROJECT') ?? 'henixhacking';
		console.info(
			`[blep ai] provider=vertex project=${project} phase1=${phase1Id} phase2=${phase2Id}`
		);
		return {
			tag: 'vertex',
			phase1Model: createModel('vertex', phase1Id),
			phase2Model: createModel('vertex', phase2Id)
		};
	}

	// Google Gemini (AI Studio — free tier, uses API key, no billing)
	if (getEnv('GOOGLE_GENERATIVE_AI_API_KEY') || getEnv('GEMINI_API_KEY')) {
		const phase1Id = getEnv('AI_MODEL_PHASE1') ?? 'gemini-3.1-flash-lite';
		const phase2Id = getEnv('AI_MODEL_PHASE2') ?? 'gemini-3.1-flash-lite';
		console.info(`[blep ai] provider=google(ai-studio) phase1=${phase1Id} phase2=${phase2Id}`);
		return {
			tag: 'google',
			phase1Model: createModel('google', phase1Id),
			phase2Model: createModel('google', phase2Id)
		};
	}

	// DeepSeek
	if (getEnv('DEEPSEEK_API_KEY')) {
		const phase1Id = getEnv('AI_MODEL_PHASE1') ?? 'deepseek-chat';
		const phase2Id = getEnv('AI_MODEL_PHASE2') ?? 'deepseek-chat';
		console.info(`[blep ai] provider=deepseek phase1=${phase1Id} phase2=${phase2Id}`);
		return {
			tag: 'deepseek',
			phase1Model: createModel('deepseek', phase1Id),
			phase2Model: createModel('deepseek', phase2Id)
		};
	}

	// OpenAI-compatible (OpenRouter, LiteLLM, vLLM, etc.)
	if (getEnv('OPENAI_API_KEY')) {
		const hasCustomBase = Boolean(getEnv('OPENAI_BASE_URL'));
		const tag: ProviderTag = hasCustomBase ? 'openai-compat' : 'openai';
		const phase1Id =
			getEnv('AI_MODEL_PHASE1') ?? (hasCustomBase ? 'google/gemini-2.5-flash' : 'gpt-4o-mini');
		const phase2Id =
			getEnv('AI_MODEL_PHASE2') ?? (hasCustomBase ? 'google/gemini-2.5-flash-lite' : 'gpt-4o-mini');
		console.info(`[blep ai] provider=${tag} phase1=${phase1Id} phase2=${phase2Id}`);
		return {
			tag,
			phase1Model: createModel(tag, phase1Id),
			phase2Model: createModel(tag, phase2Id)
		};
	}

	throw new Error(
		'[blep ai] No AI provider configured. Set one of: GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY'
	);
}

// Lazy singleton — resolved on first call.
let _provider: ResolvedProvider | null = null;

function getProvider(): ResolvedProvider {
	if (!_provider) _provider = resolveProvider();
	return _provider;
}

/** Reset cached provider (useful if env changes at runtime during tests). */
export function resetProvider(): void {
	_provider = null;
}

// ─── Phase 1: Structured Object Generation ─────────────

function getPhase1Config(intent: BlepIntentResult) {
	switch (intent.intent) {
		case 'VERDICT_SCAN':
			return {
				system: BLEP_SYSTEM_PROMPT,
				schema: blepVerdictSchema,
				buildPrompt: (q: string, s: BlepSource[]) => buildBlepPrompt(q, s)
			};
		case 'RECOMMENDATION_SCAN':
			return {
				system: BLEP_RECOMMENDATION_SYSTEM_PROMPT,
				schema: blepRecommendationSchema,
				buildPrompt: (q: string, s: BlepSource[]) => buildRecommendationPrompt(q, s, intent)
			};
		case 'COMPARISON_SCAN':
			return {
				system: BLEP_COMPARISON_SYSTEM_PROMPT,
				schema: blepComparisonSchema,
				buildPrompt: (q: string, s: BlepSource[]) => buildComparisonPrompt(q, s, intent)
			};
		default:
			return {
				system: BLEP_SYSTEM_PROMPT,
				schema: blepVerdictSchema,
				buildPrompt: (q: string, s: BlepSource[]) => buildBlepPrompt(q, s)
			};
	}
}

/**
 * Phase 1 — one-shot structured output generation.
 * Returns validated BlepPhase1Output via Vercel AI SDK `generateObject`.
 */
export async function generatePhase1(
	query: string,
	sources: BlepSource[],
	intent: BlepIntentResult
): Promise<{ result: BlepPhase1Output }> {
	const provider = getProvider();
	const config = getPhase1Config(intent);
	const userPrompt = config.buildPrompt(query, sources);

	try {
		const { object } = await generateObject({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			model: provider.phase1Model as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			schema: config.schema as any,
			system: config.system,
			prompt: userPrompt,
			temperature: 0.3,
			maxTokens: 4096
		});

		// Validate through full discriminated union (adds `mode` default)
		const validated = blepPhase1OutputSchema.parse(object);
		return { result: validated };
	} catch (error) {
		// If generateObject fails, try generateText fallback + manual JSON parse
		console.warn('[blep ai] generateObject failed, trying text fallback:', error);
		return await generatePhase1TextFallback(provider, config.system, userPrompt, intent);
	}
}

/** Fallback: use generateText + manual JSON extraction when generateObject fails. */
async function generatePhase1TextFallback(
	provider: ResolvedProvider,
	system: string,
	userPrompt: string,
	intent: BlepIntentResult
): Promise<{ result: BlepPhase1Output }> {
	const { text } = await generateText({
		model: provider.phase1Model,
		system,
		prompt: userPrompt,
		temperature: 0.3,
		maxTokens: 4096
	});

	const cleaned = text
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '');

	const firstBrace = cleaned.indexOf('{');
	const lastBrace = cleaned.lastIndexOf('}');

	if (firstBrace < 0 || lastBrace <= firstBrace) {
		throw new Error(`[blep ai] No JSON object found in model response`);
	}

	const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
	const parsed = JSON.parse(jsonStr);

	// Inject mode if missing (some models omit it)
	if (!parsed.mode) {
		const modeMap: Record<string, string> = {
			VERDICT_SCAN: 'VERDICT',
			RECOMMENDATION_SCAN: 'RECOMMENDATION',
			COMPARISON_SCAN: 'COMPARISON',
			NEEDS_INPUT: 'NEEDS_INPUT'
		};
		parsed.mode = modeMap[intent.intent] ?? 'VERDICT';
	}

	const validated = blepPhase1OutputSchema.parse(parsed);
	return { result: validated };
}

// ─── Phase 2: Follow-up Chat ───────────────────────────

/**
 * Phase 2 — Interrogation Room text generation.
 * Returns raw text (caller parses the JSON shape).
 */
export async function generatePhase2Chat(
	systemPrompt: string,
	userContent: string
): Promise<string> {
	const provider = getProvider();

	const { text } = await generateText({
		model: provider.phase2Model,
		system: systemPrompt,
		prompt: userContent,
		temperature: 0.5,
		maxTokens: 1024
	});

	return text;
}

// ─── Error Mapping ─────────────────────────────────────

/** Map AI SDK errors → BlepErrorCode (same surface as old getGeminiErrorCode). */
export function getAiErrorCode(error: unknown): BlepErrorCode {
	if (!error || typeof error !== 'object') return 'unknown';

	const record = error as Record<string, unknown>;
	const name = typeof record.name === 'string' ? record.name : '';
	const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
	const statusCode = typeof record.statusCode === 'number' ? record.statusCode : 0;

	// Rate limited
	if (statusCode === 429 || message.includes('rate limit') || message.includes('quota')) {
		return 'rate_limited';
	}

	// Auth
	if (statusCode === 401 || statusCode === 403 || message.includes('api key')) {
		return 'env_missing';
	}

	// Safety / content filter
	if (
		name === 'AI_APICallError' &&
		(message.includes('safety') || message.includes('blocked') || message.includes('filter'))
	) {
		return 'gemini_failed';
	}

	// Network / timeout
	if (
		name === 'AI_APICallError' ||
		message.includes('timeout') ||
		message.includes('network') ||
		message.includes('econnrefused')
	) {
		return 'gemini_failed';
	}

	// JSON parse / schema validation
	if (name === 'AI_JSONParseError' || name === 'AI_TypeValidationError') {
		return 'gemini_failed';
	}

	return 'unknown';
}

// ─── Backward-compat alias ─────────────────────────────

/** @deprecated Use getAiErrorCode instead */
export const getGeminiErrorCode = getAiErrorCode;
