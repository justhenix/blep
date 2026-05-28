import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildFallbackVerdict, buildMockVerdict } from '$lib/blep/mock';
import { blepScanRequestSchema } from '$lib/blep/schema';
import type { BlepQuotaCheck, BlepScanResponse, BlepSource, BlepVerdict } from '$lib/blep/types';
import { blepEnv } from '$lib/server/env';
import { BlepApiError, blepError, safeParseJson, type BlepErrorCode } from '$lib/server/errors';
import { collectSources } from '$lib/server/firecrawl';
import { verifyBearerToken } from '$lib/server/firebase-admin';
import { generateVerdict, getGeminiErrorCode } from '$lib/server/gemini';
import { checkDailyQuota, consumeDailyQuota, hashClientAddress } from '$lib/server/quota';

const defaultQuota = (): BlepQuotaCheck => ({
	allowed: true,
	remaining: Math.max(blepEnv.dailyLimit - 1, 0),
	limit: blepEnv.dailyLimit
});

const buildFallbackResponse = (
	error: BlepErrorCode,
	quota: BlepQuotaCheck = defaultQuota(),
	query = 'Unknown device',
	sources: { title: string; url: string }[] = []
): BlepScanResponse => ({
	ok: false,
	mode: 'fallback',
	error,
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	sources,
	verdict: buildFallbackVerdict(query)
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

const getClientAddressSafe = (getClientAddress: () => string) => {
	try {
		return getClientAddress();
	} catch {
		return null;
	}
};

const buildLiveResponse = (
	quota: BlepQuotaCheck,
	sources: { title: string; url: string }[],
	verdict: BlepVerdict
): BlepScanResponse => ({
	ok: true,
	mode: 'live',
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
	console.info(`[blep api] final mode=${mode}`);
	return json(body, init);
};

const sourceSummaries = (sources: BlepSource[]) =>
	sources.map((source) => ({ title: source.title, url: source.url }));

const safeTitle = (title: string) => title.replace(/\s+/g, ' ').trim().slice(0, 120);

const logEnvStatus = () => {
	console.info(
		`[blep env] gemini=${Boolean(blepEnv.geminiApiKey)} firecrawl=${Boolean(blepEnv.firecrawlApiKey)} firebase=${Boolean(blepEnv.firebaseProjectId || blepEnv.googleApplicationCredentials)}`
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

const logSafeError = (label: string, error: unknown) => {
	const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
	const parts = ['name', 'code', 'reason', 'domain']
		.map((key) => (record[key] ? `${key}=${String(record[key])}` : ''))
		.filter(Boolean)
		.join(' ');

	console.warn(`[blep api] ${label}${parts ? ` ${parts}` : ''}`);
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
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
	let quota = defaultQuota();

	if (blepEnv.useMock) {
		logQuotaStatus(quota);
		return respond(buildMockResponse(parsed.data.query, parsed.data.urls ?? [], quota));
	}

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
		const clientAddress = getClientAddressSafe(getClientAddress);
		const quotaSubject = decodedToken?.uid ?? hashClientAddress(clientAddress);

		quota = await checkDailyQuota(quotaSubject);
		logQuotaStatus(quota);

		if (!quota.allowed) {
			return respond(buildFallbackResponse('quota_blocked', quota, queryForFallback), {
				status: 429
			});
		}

		const sourceResult = await collectSources(parsed.data.query, parsed.data.urls);
		logScrapeStatus(sourceResult.status, sourceResult.sources);
		const sources = sourceSummaries(sourceResult.sources);

		if (sourceResult.status !== 'ok') {
			return respond(
				buildFallbackResponse(sourceResult.status, quota, queryForFallback, sources)
			);
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

		return respond(buildLiveResponse(quota, sources, verdict));
	} catch (error) {
		logSafeError('live_error', error);
		return respond(buildFallbackResponse('unknown', quota, queryForFallback));
	}
};
