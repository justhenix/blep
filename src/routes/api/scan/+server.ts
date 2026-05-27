import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildMockVerdict, fallbackVerdict } from '$lib/blep/mock';
import { blepScanRequestSchema } from '$lib/blep/schema';
import type { BlepQuotaCheck, BlepScanResponse, BlepVerdict } from '$lib/blep/types';
import { blepEnv } from '$lib/server/env';
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
	error: string,
	quota: BlepQuotaCheck = defaultQuota()
): BlepScanResponse => ({
	ok: false,
	mode: 'fallback',
	error,
	quota: {
		remaining: quota.remaining,
		limit: quota.limit
	},
	sources: [],
	verdict: fallbackVerdict
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

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json(
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
		return json(
			{
				ok: false,
				error: 'bad_input',
				message: 'Send JSON body with query string and optional urls array.',
				issues: parsed.error.issues.map((issue) => ({
					path: issue.path.join('.'),
					message: issue.message
				}))
			},
			{ status: 400 }
		);
	}

	let quota = defaultQuota();

	let decodedToken: Awaited<ReturnType<typeof verifyBearerToken>>;
	try {
		decodedToken = await verifyBearerToken(request.headers.get('authorization'));
	} catch {
		return json(
			{
				ok: false,
				error: 'bad_auth',
				message: 'Use Authorization: Bearer <Firebase ID token>.'
			},
			{ status: 401 }
		);
	}

	try {
		const clientAddress = getClientAddressSafe(getClientAddress);
		const quotaSubject = decodedToken?.uid ?? hashClientAddress(clientAddress);

		quota = await checkDailyQuota(quotaSubject);

		if (!quota.allowed) {
			return json(buildFallbackResponse('quota_exhausted', quota), { status: 429 });
		}

		if (blepEnv.useMock) {
			return json(buildMockFallbackResponse(parsed.data.query, parsed.data.urls ?? [], quota));
		}

		const sourceResult = await collectSources(parsed.data.query, parsed.data.urls);

		if (sourceResult.degraded) {
			return json(buildFallbackResponse('live_scrape_failed', quota));
		}

		const verdict = await generateVerdict(parsed.data.query, sourceResult.sources);

		return json(
			buildLiveResponse(
				quota,
				sourceResult.sources.map((source) => ({ title: source.title, url: source.url })),
				verdict
			)
		);
	} catch {
		return json(buildFallbackResponse('live_scan_failed', quota));
	}
};
