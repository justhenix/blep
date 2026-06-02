import { createClient, type Client } from '@libsql/client';
import { env } from '$env/dynamic/private';

let _client: Client | null = null;
let _initialized = false;

/**
 * Get (or create) the Turso/LibSQL database client.
 * Returns null when TURSO_DATABASE_URL is not set — callers degrade gracefully.
 */
export function getDb(): Client | null {
	if (_client) return _client;

	const url = getEnvVar('TURSO_DATABASE_URL');
	if (!url) {
		console.warn('[blep db] TURSO_DATABASE_URL missing — database disabled');
		return null;
	}

	_client = createClient({
		url,
		authToken: getEnvVar('TURSO_AUTH_TOKEN') ?? undefined
	});

	return _client;
}

/** Read env var at runtime (SvelteKit dynamic import not available here). */
function getEnvVar(name: string): string | undefined {
	// Node process.env works at runtime; SvelteKit dynamic private env can also be imported.
	return env[name] ?? undefined;
}

// ─── Schema DDL ───────────────────────────────────────────

const SCHEMA_SQL = [
	`CREATE TABLE IF NOT EXISTS scan_cache (
		key          TEXT PRIMARY KEY,
		query_hash   TEXT NOT NULL,
		urls_hash    TEXT NOT NULL,
		verdict      TEXT NOT NULL,
		sources      TEXT NOT NULL DEFAULT '[]',
		created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
		expires_at   INTEGER NOT NULL,
		hit_count    INTEGER NOT NULL DEFAULT 0,
		last_hit_at  INTEGER NOT NULL DEFAULT (unixepoch()),
		prompt_version TEXT NOT NULL DEFAULT 'v1'
	)`,
	`CREATE TABLE IF NOT EXISTS quotas (
		subject      TEXT NOT NULL,
		date         TEXT NOT NULL,
		used         INTEGER NOT NULL DEFAULT 0,
		"limit"      INTEGER NOT NULL DEFAULT 3,
		updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
		created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (subject, date)
	)`,
	`CREATE TABLE IF NOT EXISTS abuse (
		identity_hash  TEXT NOT NULL,
		date           TEXT NOT NULL,
		count          INTEGER NOT NULL DEFAULT 0,
		last_request_at INTEGER NOT NULL DEFAULT (unixepoch()),
		blocked_until   INTEGER,
		expires_at      INTEGER NOT NULL,
		created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (identity_hash, date)
	)`
];

/**
 * Run table creation DDL. Idempotent — safe to call on every cold start.
 * Returns true if init succeeded, false if DB unavailable.
 */
export async function initDb(): Promise<boolean> {
	if (_initialized) return true;

	const db = getDb();
	if (!db) return false;

	try {
		for (const sql of SCHEMA_SQL) {
			await db.execute(sql);
		}
		_initialized = true;
		console.log('[blep db] schema initialized');
		return true;
	} catch (error) {
		console.error('[blep db] schema init failed:', error);
		return false;
	}
}
