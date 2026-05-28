import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildFallbackVerdict, buildMockVerdict } from '$lib/blep/mock';
import { blepScanRequestSchema } from '$lib/blep/schema';
import type { BlepQuotaCheck, BlepScanResponse, BlepSource, BlepVerdict } from '$lib/blep/types';
import { checkAndRecordAbuse } from '$lib/server/abuse';
import { lookupCache, storeCache } from '$lib/server/cache';
import { blepEnv } from '$lib/server/env';
import { BlepApiError, blepError, safeParseJson, type BlepErrorCode } from '$lib/server/errors';
import { collectSources } from '$lib/server/firecrawl';
import { verifyBearerToken } from '$lib/server/firebase-admin';
import { generateVerdict, getGeminiErrorCode } from '$lib/server/gemini';
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

const buildFallbackResponse = (
	error: BlepErrorCode,
	quota: BlepQuotaCheck = defaultQuota(),
	query = 'Unknown device',
	sources: { title: string; url: string }[] = [],
	retryAfterSeconds?: number
): BlepScanResponse => ({
	ok: false,
	mode: 'fallback',
	error,
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	sources,
	verdict: buildFallbackVerdict(query),
	...(typeof retryAfterSeconds === 'number' ? { retry_after_seconds: retryAfterSeconds } : {})
});

const buildMockResponse = (
	query: string,
	urls: string[],
	quota: BlepQuotaCheck
): BlepScanResponse => ({
	ok: true,
	mode: 'mock',
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	sources: [],
	verdict: buildMockVerdict(query, urls)
});

const buildLiveResponse = (
	quota: BlepQuotaCheck,
	sources: { title: string; url: string }[],
	verdict: BlepVerdict,
	cached = false
): BlepScanResponse => ({
	ok: true,
	mode: 'live',
	cached,
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	sources,
	verdict
});

const respond = <T>(body: T, init?: ResponseInit) => {
	const mode =
		body && typeof body === 'object' && 'mode' in body
			? String((body as { mode: unknown }).mode)
			: 'error';
	const cached =
		body && typeof body === 'object' && 'cached' in body
			? Boolean((body as { cached: unknown }).cached)
			: false;
	console.info(`[blep api] final mode=${mode} cached=${cached}`);

	return json(body, init);
};

const sourceSummaries = (sources: BlepSource[]) =>
	sources.map((source) => ({ title: source.title, url: source.url }));

const safeTitle = (title: string) => title.replace(/\s+/g, ' ').trim().slice(0, 120);

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
		.map((key) => (record[key] ? `${key}=${String(record[key])}` : ''))
		.filter(Boolean)
		.join(' ');

	console.warn(`[blep api] ${label}${parts ? ` ${parts}` : ''}`);
};

export const POST: RequestHandler = async ({ request }) => {
	console.info('[blep api] scan started');
	logEnvStatus();

	let body: unknown;

	try {
		body = await safeParseJson(request);
	} catch (error) {
		if (error instanceof BlepApiError) {
			return respond(
				{
					ok: false,
					error: error.code,
					message: error.publicMessage
				},
				{ status: error.status }
			);
		}

		return respond(
			{
				ok: false,
				error: 'bad_json',
				message: 'Send valid JSON body.'
			},
			{ status: 400 }
		);
	}

	const parsed = blepScanRequestSchema.safeParse(body);

	if (!parsed.success) {
		const inputError = blepError(
			'bad_input',
			400,
			'Send JSON body with query string and optional urls array.'
		);

		return respond(
			{
				ok: false,
				error: inputError.code,
				message: inputError.publicMessage,
				issues: parsed.error.issues.map((issue) => ({
					path: issue.path.join('.'),
					message: issue.message
				}))
			},
			{ status: 400 }
		);
	}

	const queryForFallback = parsed.data.query;
	const requestUrls = parsed.data.urls ?? [];
	let quota = defaultQuota();

	if (blepEnv.useMock) {
		console.info('[blep mock] returning mock verdict, no external calls');
		return respond(buildMockResponse(parsed.data.query, requestUrls, mockQuota()));
	}

	const identity = getRequestIdentity(request);
	logIdentity(identity);

	let decodedToken: Awaited<ReturnType<typeof verifyBearerToken>>;
	try {
		decodedToken = await verifyBearerToken(request.headers.get('authorization'));
	} catch {
		const authError = blepError('bad_auth', 401, 'Use Authorization: Bearer <Firebase ID token>.');

		return respond(
			{
				ok: false,
				error: authError.code,
				message: authError.publicMessage
			},
			{ status: authError.status }
		);
	}

	try {
		const quotaSubject = decodedToken?.uid ?? identity.identityHash;

		quota = await checkDailyQuota(quotaSubject);
		logQuotaStatus(quota);

		if (!quota.allowed) {
			return respond(buildFallbackResponse('quota_blocked', quota, queryForFallback), {
				status: 429
			});
		}

		const cacheLookup = await lookupCache({ query: parsed.data.query, urls: requestUrls });

		if (cacheLookup.hit) {
			console.info(`[blep cache] hit key=${cacheLookup.cacheKey.slice(0, 12)}...`);

			return respond(buildLiveResponse(quota, cacheLookup.sources, cacheLookup.verdict, true));
		}

		console.info(`[blep cache] miss key=${cacheLookup.cacheKey.slice(0, 12)}...`);

		const abuse = await checkAndRecordAbuse(identity.identityHash);

		if (!abuse.allowed) {
			return respond(
				buildFallbackResponse(abuse.reason, quota, queryForFallback, [], abuse.retryAfterSeconds),
				{ status: 429 }
			);
		}

		const sourceResult = await collectSources(parsed.data.query, requestUrls);
		logScrapeStatus(sourceResult.status, sourceResult.sources);
		const sources = sourceSummaries(sourceResult.sources);

		if (sourceResult.status !== 'ok') {
			return respond(buildFallbackResponse(sourceResult.status, quota, queryForFallback, sources));
		}

		let verdict: BlepVerdict;
		try {
			({ verdict } = await generateVerdict(parsed.data.query, sourceResult.sources));
		} catch (error) {
			return respond(
				buildFallbackResponse(getGeminiErrorCode(error), quota, queryForFallback, sources)
			);
		}

		quota = await consumeDailyQuota(quotaSubject);
		logQuotaStatus(quota);

		if (!quota.allowed) {
			return respond(buildFallbackResponse('quota_blocked', quota, queryForFallback, sources), {
				status: 429
			});
		}

		await storeCache({ query: parsed.data.query, urls: requestUrls }, verdict, sources);

		return respond(buildLiveResponse(quota, sources, verdict, false));
	} catch (error) {
		logSafeError('live_error', error);
		return respond(buildFallbackResponse('unknown', quota, queryForFallback));
	}
};
