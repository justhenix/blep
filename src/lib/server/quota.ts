import type { BlepQuotaCheck } from '$lib/blep/types';
import { blepEnv } from './env';
import { getDb } from './db';

const todayKey = () => new Date().toISOString().slice(0, 10);

const bypassQuota = (): BlepQuotaCheck => {
	console.warn('[blep quota] DB unavailable — quota bypassed');
	return { allowed: true, remaining: blepEnv.dailyLimit, limit: blepEnv.dailyLimit };
};

export const checkDailyQuota = async (subject: string): Promise<BlepQuotaCheck> => {
	const db = getDb();
	if (!db) return bypassQuota();

	const limit = blepEnv.dailyLimit;
	const date = todayKey();

	try {
		const row = await db.execute({
			sql: `SELECT used FROM quotas WHERE subject = ? AND date = ?`,
			args: [subject, date]
		});

		const used = row.rows.length ? Number(row.rows[0].used ?? 0) : 0;

		return {
			allowed: used < limit,
			remaining: Math.max(limit - used, 0),
			limit
		};
	} catch (error) {
		console.warn('[blep quota] check failed:', error);
		return bypassQuota();
	}
};

export const consumeDailyQuota = async (subject: string): Promise<BlepQuotaCheck> => {
	const db = getDb();
	if (!db) return bypassQuota();

	const limit = blepEnv.dailyLimit;
	const date = todayKey();
	const nowUnix = Math.floor(Date.now() / 1000);

	try {
		// UPSERT: insert w/ used=1 or increment existing
		await db.execute({
			sql: `INSERT INTO quotas (subject, date, used, "limit", updated_at, created_at)
			      VALUES (?, ?, 1, ?, ?, ?)
			      ON CONFLICT(subject, date) DO UPDATE SET
			        used = quotas.used + 1,
			        updated_at = excluded.updated_at`,
			args: [subject, date, limit, nowUnix, nowUnix]
		});

		// Read back to get accurate count
		const row = await db.execute({
			sql: `SELECT used FROM quotas WHERE subject = ? AND date = ?`,
			args: [subject, date]
		});

		const used = row.rows.length ? Number(row.rows[0].used ?? 0) : 1;

		if (used > limit) {
			return { allowed: false, remaining: 0, limit };
		}

		return {
			allowed: true,
			remaining: Math.max(limit - used, 0),
			limit
		};
	} catch (error) {
		console.warn('[blep quota] consume failed:', error);
		return bypassQuota();
	}
};
