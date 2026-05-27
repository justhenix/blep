import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildMockVerdict, fallbackVerdict } from '$lib/blep/mock';
import { blepScanRequestSchema } from '$lib/blep/schema';
import type { BlepScanResponse } from '$lib/blep/types';
import { blepEnv } from '$lib/server/env';

const buildMockResponse = (query: string, urls: string[] = []): BlepScanResponse => ({
	ok: true,
	mode: 'mock',
	quota: {
		remaining: Math.max(blepEnv.dailyLimit - 1, 0),
		limit: blepEnv.dailyLimit
	},
	verdict: buildMockVerdict(query, urls)
});

const buildFallbackResponse = (): BlepScanResponse => ({
	ok: true,
	mode: 'mock',
	quota: {
		remaining: Math.max(blepEnv.dailyLimit - 1, 0),
		limit: blepEnv.dailyLimit
	},
	verdict: fallbackVerdict
});

export const POST: RequestHandler = async ({ request }) => {
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

	try {
		return json(buildMockResponse(parsed.data.query, parsed.data.urls));
	} catch {
		return json(buildFallbackResponse());
	}
};
