import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	classifyScanInput,
	createDeclineVerdict,
	type ScanInputGateResult
} from '$lib/blep/input-gate';
import { routeIntent, type BlepIntentResult } from '$lib/blep/intent';
import { buildFallbackVerdict, buildMockNeedsInput, buildMockOutput } from '$lib/blep/mock';
import { blepScanRequestSchema } from '$lib/blep/schema';
import type {
	BlepPhase1Output,
	BlepQuotaCheck,
	BlepScanResponse,
	BlepSource
} from '$lib/blep/types';
import { checkAndRecordAbuse } from '$lib/server/abuse';
import { lookupCache, storeCache } from '$lib/server/cache';
import { blepEnv } from '$lib/server/env';
import { BlepApiError, blepError, safeParseJson, type BlepErrorCode } from '$lib/server/errors';
import { collectSources } from '$lib/server/firecrawl';
import { verifyBearerToken } from '$lib/server/firebase-admin';
import { generatePhase1, getGeminiErrorCode } from '$lib/server/gemini';
import { checkDailyQuota, consumeDailyQuota } from '$lib/server/quota';
import { getRequestIdentity, type RequestIdentity } from '$lib/server/request-identity';

const defaultQuota = (): BlepQuotaCheck => ({
	allowed: true,
	remaining: blepEnv.dailyLimit,
	limit: blepEnv.dailyLimit
});

const mockQuota = (): BlepQuotaCheck => ({
	allowed: true,
	remaining: 999,
	limit: 999
});

const verdictCompat = (result: BlepPhase1Output) =>
	result.mode === 'VERDICT' ? { verdict: result } : {};

const buildFallbackResponse = (
	error: BlepErrorCode,
	quota: BlepQuotaCheck = defaultQuota(),
	query = 'Unknown device',
	sources: { title: string; url: string }[] = [],
	retryAfterSeconds?: number
): BlepScanResponse => {
	const result = buildFallbackVerdict(query);

	return {
		ok: false,
		mode: 'fallback',
		error,
		quota: {
			remaining: quota.remaining,
			limit: quota.limit
		},
		intent: 'VERDICT_SCAN',
		sources,
		result,
		...verdictCompat(result),
		...(typeof retryAfterSeconds === 'number' ? { retry_after_seconds: retryAfterSeconds } : {})
	};
};

const buildMockResponse = (
	quota: BlepQuotaCheck,
	intent: BlepIntentResult,
	result: BlepPhase1Output
): BlepScanResponse => ({
	ok: true,
	mode: 'mock',
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	intent: intent.intent,
	sources: [],
	result,
	...verdictCompat(result)
});

const buildLiveResponse = (
	quota: BlepQuotaCheck,
	intent: BlepIntentResult,
	sources: { title: string; url: string }[],
	result: BlepPhase1Output,
	cached = false
): BlepScanResponse => ({
	ok: true,
	mode: 'live',
	cached,
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	intent: intent.intent,
	sources,
	result,
	...verdictCompat(result)
});

// NEEDS_INPUT short-circuits before any paid call. Outer mode mirrors env so the
// demo badge stays honest, but no quota/Firecrawl/Gemini is touched.
const buildNeedsInputResponse = (intent: BlepIntentResult): BlepScanResponse => {
	const result = buildMockNeedsInput();
	const quota = blepEnv.useMock ? mockQuota() : defaultQuota();

	return {
		ok: true,
		mode: blepEnv.useMock ? 'mock' : 'live',
		cached: false,
		quota: {
			remaining: quota.remaining,
			limit: quota.limit
		},
		intent: intent.intent,
		sources: [],
		result
	};
};

const buildDeclinedResponse = (gate: ScanInputGateResult): BlepScanResponse => {
	const result = createDeclineVerdict();

	return {
		ok: false,
		mode: 'declined',
		error: 'non_tech_input',
		gate: {
			reason: gate.reason,
			confidence: gate.confidence
		},
		quota: {
			remaining: 999,
			limit: 999
		},
		intent: 'VERDICT_SCAN',
		sources: [],
		result,
		...verdictCompat(result)
	};
};

const respond = <T>(body: T, init?: ResponseInit) => {
	const mode =
		body && typeof body === 'object' && 'mode' in body
			? String((body as { mode: unknown }).mode)
			: 'error';
	const cached =
		body && typeof body === 'object' && 'cached' in body
			? Boolean((body as { cached: unknown }).cached)
			: false;
	if (mode !== 'declined') {
		console.info(`[blep api] final mode=${mode} cached=${cached}`);
	}

	return json(body, init);
};

const buildApiErrorResponse = (error: BlepErrorCode) => ({
	ok: false,
	error
});

const sourceSummaries = (sources: BlepSource[]) =>
	sources.map((source) => ({ title: source.title, url: source.url }));

const safeTitle = (title: string) => title.replace(/\s+/g, ' ').trim().slice(0, 120);

const safeLogValue = (value: unknown) =>
	String(value).replace(/\s+/g, ' ').trim().slice(0, 80) || 'unknown';

const logEnvStatus = () => {
	console.info(
		`[blep env] gemini=${Boolean(blepEnv.geminiApiKey)} firecrawl=${Boolean(blepEnv.firecrawlApiKey)} firebase=${Boolean(blepEnv.firebaseProjectId || blepEnv.googleApplicationCredentials)} mock=${blepEnv.useMock}`
	);
};

const logQuotaStatus = (quota: BlepQuotaCheck) => {
	console.info(
		`[blep quota] ${quota.allowed ? 'allowed' : 'blocked'} remaining=${quota.remaining}/${quota.limit}`
	);
};

const logScrapeStatus = (status: string, sources: BlepSource[]) => {
	console.info(
		`[blep scrape] status=${status} count=${sources.length} titles=${JSON.stringify(sources.map((source) => safeTitle(source.title)))}`
	);
};

const logIdentity = (identity: RequestIdentity) => {
	console.info(
		`[blep identity] ip_source=${identity.ipSource} identity_hash=${identity.identityHash.slice(0, 8)}... ua=${identity.userAgentFamily}`
	);
};

const logSafeError = (label: string, error: unknown) => {
	const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
	const parts = ['name', 'code', 'reason', 'domain']
		.map((key) => (record[key] ? `${key}=${safeLogValue(record[key])}` : ''))
		.filter(Boolean)
		.join(' ');

	console.warn(`[blep api] ${label}${parts ? ` ${parts}` : ''}`);
};

const logApiErrorCode = (label: string, code: BlepErrorCode, status: number) => {
	console.warn(`[blep api] ${label} code=${code} status=${status}`);
};

const logInputIssues = (issues: Array<{ path: PropertyKey[]; code: string }>) => {
	const paths = issues.map((issue) => issue.path.join('.') || 'body').slice(0, 5);
	const codes = issues.map((issue) => issue.code).slice(0, 5);
	console.warn(
		`[blep api] bad_input issue_count=${issues.length} paths=${JSON.stringify(paths)} codes=${JSON.stringify(codes)}`
	);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;

	try {
		body = await safeParseJson(request);
	} catch (error) {
		if (error instanceof BlepApiError) {
			logApiErrorCode('request_error', error.code, error.status);

			return respond(buildApiErrorResponse(error.code), { status: error.status });
		}

		logSafeError('json_error', error);

		return respond(buildApiErrorResponse('bad_json'), { status: 400 });
	}

	const parsed = blepScanRequestSchema.safeParse(body);

	if (!parsed.success) {
		const inputError = blepError('bad_input', 400);
		logInputIssues(parsed.error.issues);

		return respond(buildApiErrorResponse(inputError.code), { status: 400 });
	}

	const query = parsed.data.query;
	const requestUrls = parsed.data.urls ?? [];

	// Cost-free guard: decline before mock/cache/quota/abuse/paid calls.
	const gate = classifyScanInput(query, requestUrls);

	if (!gate.allowed) {
		console.info(`[blep gate] declined reason=${gate.reason} confidence=${gate.confidence}`);

		return respond(buildDeclinedResponse(gate));
	}

	const intent = routeIntent(query, requestUrls);
	console.info(`[blep intent] routed intent=${intent.intent}`);

	// NEEDS_INPUT exits before any quota / Firecrawl / Gemini work.
	if (intent.intent === 'NEEDS_INPUT') {
		return respond(buildNeedsInputResponse(intent));
	}

	console.info('[blep api] scan started');
	logEnvStatus();

	let quota = defaultQuota();

	// Mock exits before external services.
	if (blepEnv.useMock) {
		console.info('[blep mock] returning mock output, no external calls');
		const result = buildMockOutput(query, requestUrls, intent);

		return respond(buildMockResponse(mockQuota(), intent, result));
	}

	// Paid path starts here.
	const identity = getRequestIdentity(request);
	logIdentity(identity);

	let decodedToken: Awaited<ReturnType<typeof verifyBearerToken>>;
	try {
		decodedToken = await verifyBearerToken(request.headers.get('authorization'));
	} catch (error) {
		logSafeError('auth_error', error);
		const authError = blepError('bad_auth', 401);

		return respond(buildApiErrorResponse(authError.code), { status: authError.status });
	}

	try {
		const quotaSubject = decodedToken?.uid ?? identity.identityHash;

		quota = await checkDailyQuota(quotaSubject);
		logQuotaStatus(quota);

		if (!quota.allowed) {
			return respond(buildFallbackResponse('quota_blocked', quota, query), {
				status: 429
			});
		}

		// Cache is verdict-only; recommendation/comparison skip it to keep cache schema stable.
		const cacheable = intent.intent === 'VERDICT_SCAN';

		if (cacheable) {
			const cacheLookup = await lookupCache({ query, urls: requestUrls });

			if (cacheLookup.hit) {
				console.info(`[blep cache] hit key=${cacheLookup.cacheKey.slice(0, 12)}...`);

				return respond(
					buildLiveResponse(quota, intent, cacheLookup.sources, cacheLookup.verdict, true)
				);
			}

			console.info(`[blep cache] miss key=${cacheLookup.cacheKey.slice(0, 12)}...`);
		}

		const abuse = await checkAndRecordAbuse(identity.identityHash);

		if (!abuse.allowed) {
			return respond(
				buildFallbackResponse(abuse.reason, quota, query, [], abuse.retryAfterSeconds),
				{ status: 429 }
			);
		}

		const sourceResult = await collectSources(query, requestUrls);
		logScrapeStatus(sourceResult.status, sourceResult.sources);
		const sources = sourceSummaries(sourceResult.sources);

		if (sourceResult.status !== 'ok') {
			return respond(buildFallbackResponse(sourceResult.status, quota, query, sources));
		}

		let result: BlepPhase1Output;
		try {
			({ result } = await generatePhase1(query, sourceResult.sources, intent));
		} catch (error) {
			return respond(buildFallbackResponse(getGeminiErrorCode(error), quota, query, sources));
		}

		quota = await consumeDailyQuota(quotaSubject);
		logQuotaStatus(quota);

		if (!quota.allowed) {
			return respond(buildFallbackResponse('quota_blocked', quota, query, sources), {
				status: 429
			});
		}

		if (cacheable && result.mode === 'VERDICT') {
			await storeCache({ query, urls: requestUrls }, result, sources);
		}

		return respond(buildLiveResponse(quota, intent, sources, result, false));
	} catch (error) {
		logSafeError('live_error', error);
		return respond(buildFallbackResponse('unknown', quota, query));
	}
};
