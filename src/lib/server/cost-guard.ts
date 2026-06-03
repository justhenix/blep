/**
 * Global daily cost guard.
 *
 * Caps total AI API calls across ALL users per day.
 * When cap is hit → all scans return fallback, zero Vertex AI charges.
 *
 * Uses in-memory counter (resets on server restart) + DB for persistence.
 * In-memory is the fast path; DB is the durable path.
 */

import { blepEnv } from './env';
import { getDb } from './db';

const todayKey = () => new Date().toISOString().slice(0, 10);

// ─── In-memory fast path ───────────────────────────────
let memDate = todayKey();
let memCount = 0;

function resetIfNewDay(): void {
	const today = todayKey();
	if (memDate !== today) {
		memDate = today;
		memCount = 0;
	}
}

// ─── Public API ────────────────────────────────────────

/** Check if global cap allows another scan. Does NOT consume. */
export function isGlobalCapReached(): boolean {
	resetIfNewDay();
	return memCount >= blepEnv.globalDailyCap;
}

/** Consume one global scan slot. Returns { allowed, remaining, cap }. */
export async function consumeGlobalCap(): Promise<{
	allowed: boolean;
	remaining: number;
	cap: number;
}> {
	resetIfNewDay();

	const cap = blepEnv.globalDailyCap;

	if (memCount >= cap) {
		console.warn(`[blep cost-guard] GLOBAL CAP REACHED (${memCount}/${cap}). Blocking AI calls.`);
		return { allowed: false, remaining: 0, cap };
	}

	memCount++;

	// Persist to DB (best-effort, non-blocking)
	persistToDb(memCount).catch((err) => console.warn('[blep cost-guard] DB persist failed:', err));

	const remaining = Math.max(cap - memCount, 0);
	console.info(`[blep cost-guard] global scan ${memCount}/${cap} (${remaining} remaining)`);

	return { allowed: true, remaining, cap };
}

/** Get current global usage stats. */
export function getGlobalUsage(): { used: number; cap: number; remaining: number } {
	resetIfNewDay();
	const cap = blepEnv.globalDailyCap;
	return { used: memCount, cap, remaining: Math.max(cap - memCount, 0) };
}

// ─── DB persistence (best-effort) ──────────────────────

async function persistToDb(count: number): Promise<void> {
	const db = getDb();
	if (!db) return;

	const date = todayKey();
	const nowUnix = Math.floor(Date.now() / 1000);

	await db.execute({
		sql: `INSERT INTO global_usage (date, scan_count, updated_at)
		      VALUES (?, ?, ?)
		      ON CONFLICT(date) DO UPDATE SET
		        scan_count = excluded.scan_count,
		        updated_at = excluded.updated_at`,
		args: [date, count, nowUnix]
	});
}

/** Load today's count from DB on startup. Call once during server init. */
export async function loadGlobalCountFromDb(): Promise<void> {
	const db = getDb();
	if (!db) return;

	const date = todayKey();
	try {
		const row = await db.execute({
			sql: `SELECT scan_count FROM global_usage WHERE date = ?`,
			args: [date]
		});

		if (row.rows.length) {
			memCount = Number(row.rows[0].scan_count ?? 0);
			memDate = date;
			console.info(`[blep cost-guard] loaded global count from DB: ${memCount}`);
		}
	} catch {
		console.warn('[blep cost-guard] failed to load from DB, starting from 0');
	}
}
