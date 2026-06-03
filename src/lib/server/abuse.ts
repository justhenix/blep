import { blepEnv } from './env';
import { getDb } from './db';

export type AbuseCheckResult =
	| { allowed: true; remaining: number; limit: number }
	| {
			allowed: false;
			reason: 'cooldown' | 'rate_limited';
			remaining: number;
			limit: number;
			retryAfterSeconds: number;
	  };

const todayKey = () => new Date().toISOString().slice(0, 10);

const expiryUnix = () => Math.floor(Date.now() / 1000) + 25 * 60 * 60;

const bypassAbuse = (limit: number): AbuseCheckResult => {
	console.warn('[blep abuse] DB unavailable — abuse check bypassed');
	return { allowed: true, remaining: limit, limit };
};

export const checkAndRecordAbuse = async (identityHash: string): Promise<AbuseCheckResult> => {
	const limit = blepEnv.abuseDailyLimit;
	const cooldownMs = blepEnv.cooldownSeconds * 1000;

	const db = getDb();
	if (!db) return bypassAbuse(limit);

	try {
		const date = todayKey();
		const nowMs = Date.now();
		const nowUnix = Math.floor(nowMs / 1000);

		// Read current state
		const row = await db.execute({
			sql: `SELECT count, last_request_at, blocked_until FROM abuse WHERE identity_hash = ? AND date = ?`,
			args: [identityHash, date]
		});

		const existing = row.rows.length ? row.rows[0] : null;
		const count = existing ? Number(existing.count ?? 0) : 0;
		const lastRequestAt = existing ? Number(existing.last_request_at ?? 0) : 0;
		const blockedUntil = existing ? Number(existing.blocked_until ?? 0) : 0;

		// Check rate limit
		if (count >= limit) {
			return {
				allowed: false,
				reason: 'rate_limited',
				remaining: 0,
				limit,
				retryAfterSeconds: 60 * 60
			} as const;
		}

		// Check cooldown (timestamps stored as unix seconds)
		const lastRequestMs = lastRequestAt * 1000;
		const blockedUntilMs = blockedUntil * 1000;

		if (cooldownMs > 0 && (nowMs < blockedUntilMs || nowMs - lastRequestMs < cooldownMs)) {
			const retryMs = Math.max(blockedUntilMs - nowMs, cooldownMs - (nowMs - lastRequestMs), 1000);

			return {
				allowed: false,
				reason: 'cooldown',
				remaining: Math.max(limit - count, 0),
				limit,
				retryAfterSeconds: Math.ceil(retryMs / 1000)
			} as const;
		}

		// Record request
		const nextCount = count + 1;
		const nextBlockedUntil = cooldownMs > 0 ? nowUnix + blepEnv.cooldownSeconds : 0;

		await db.execute({
			sql: `INSERT INTO abuse (identity_hash, date, count, last_request_at, blocked_until, expires_at, created_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?)
			      ON CONFLICT(identity_hash, date) DO UPDATE SET
			        count = excluded.count,
			        last_request_at = excluded.last_request_at,
			        blocked_until = excluded.blocked_until,
			        expires_at = excluded.expires_at`,
			args: [identityHash, date, nextCount, nowUnix, nextBlockedUntil, expiryUnix(), nowUnix]
		});

		return {
			allowed: true,
			remaining: Math.max(limit - nextCount, 0),
			limit
		} as const;
	} catch (error) {
		console.warn(`[blep abuse] check failed:`, error);

		return { allowed: true, remaining: limit, limit };
	}
};
