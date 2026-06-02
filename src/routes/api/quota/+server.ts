import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkDailyQuota } from '$lib/server/quota';
import { getRequestIdentity } from '$lib/server/request-identity';

export const GET: RequestHandler = async ({ request }) => {
	const subject = getRequestIdentity(request).identityHash;
	const quota = await checkDailyQuota(subject);

	return json({
		ok: true,
		quota: {
			remaining: quota.remaining,
			limit: quota.limit
		}
	});
};
