import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildFallbackVerdict, buildMockVerdict } from '$lib/blep/mock';
import { blepScanRequestSchema } from '$lib/blep/schema';
import type { BlepQuotaCheck, BlepScanResponse, BlepVerdict } from '$lib/blep/types';
import { blepEnv } from '$lib/server/env';
import { BlepApiError, blepError, safeParseJson, type BlepErrorCode } from '$lib/server/errors';
import { collectSources } from '$lib/server/firecrawl';
import { verifyBearerToken } from '$lib/server/firebase-admin';
import { generateVerdict } from '$lib/server/gemini';
import { checkDailyQuota, hashClientAddress } from '$lib/server/quota';

const defaultQuota = (): BlepQuotaCheck => ({
	allowed: true,
	remaining: Math.max(blepEnv.dailyLimit - 1, 0),
	limit: blepEnv.dailyLimit
});

const buildFallbackResponse = (
	error: BlepErrorCode,
	quota: BlepQuotaCheck = defaultQuota(),
	query = 'Unknown device'
): BlepScanResponse => ({
	ok: false,
	mode: 'fallback',
	error,
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	sources: [],
	verdict: buildFallbackVerdict(query)
});

const buildMockFallbackResponse = (
	query: string,
	urls: string[],
	quota: BlepQuotaCheck
): BlepScanResponse => ({
	ok: false,
	mode: 'fallback',
	error: 'mock_mode_enabled',
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
	console.info('[blep api] scan done');
	return json(body, init);
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	console.info('[blep api] scan started');

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
		console.info(`[blep quota] ${quota.allowed ? 'allowed' : 'blocked'}`);

		if (!quota.allowed) {
			return respond(buildFallbackResponse('quota_exhausted', quota, queryForFallback), {
				status: 429
			});
		}

		if (blepEnv.useMock) {
			return respond(buildMockFallbackResponse(parsed.data.query, parsed.data.urls ?? [], quota));
		}

		const sourceResult = await collectSources(parsed.data.query, parsed.data.urls);
		console.info(
			`[blep scrape] sources count ${sourceResult.degraded ? 0 : sourceResult.sources.length}`
		);

		if (sourceResult.degraded) {
			return respond(buildFallbackResponse('live_scrape_failed', quota, queryForFallback));
		}

		const { verdict } = await generateVerdict(parsed.data.query, sourceResult.sources);

		return respond(
			buildLiveResponse(
				quota,
				sourceResult.sources.map((source) => ({ title: source.title, url: source.url })),
				verdict
			)
		);
	} catch {
		return respond(buildFallbackResponse('live_scan_failed', quota, queryForFallback));
	}
};
