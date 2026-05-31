import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyBearerToken } from '$lib/server/firebase-admin';
import { checkDailyQuota } from '$lib/server/quota';
import { getRequestIdentity } from '$lib/server/request-identity';

export const GET: RequestHandler = async ({ request }) => {
	let uid: string | null = null;

	try {
		const decoded = await verifyBearerToken(request.headers.get('authorization'));
		uid = decoded?.uid ?? null;
	} catch {
		// Auth failed — fall through to identity-based quota
	}

	const subject = uid ?? getRequestIdentity(request).identityHash;
	const quota = await checkDailyQuota(subject);

	return json({
		ok: true,
		quota: {
			remaining: quota.remaining,
			limit: quota.limit
		}
	});
};
