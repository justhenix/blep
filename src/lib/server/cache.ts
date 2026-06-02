import { createHash } from 'node:crypto';
import type { BlepVerdict } from '$lib/blep/types';
import { blepVerdictSchema } from '$lib/blep/schema';
import { blepEnv } from './env';
import { getDb } from './db';

export type CacheKeyInput = {
	query: string;
	urls: string[];
};

export type CacheLookupResult =
	| {
			hit: false;
			cacheKey: string;
	  }
	| {
			hit: true;
			cacheKey: string;
			verdict: BlepVerdict;
			sources: { title: string; url: string }[];
	  };

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const normalizeCacheInput = ({ query, urls }: CacheKeyInput) => ({
	query: query.trim().toLowerCase().replace(/\s+/g, ' '),
	urls: [...urls]
		.map((url) => url.trim())
		.filter(Boolean)
		.map((url) => url.replace(/\/+$/u, '').toLowerCase())
		.sort()
});

export const buildCacheKey = ({ query, urls }: CacheKeyInput) => {
	const normalized = normalizeCacheInput({ query, urls });
	const queryHash = sha256(`q:${normalized.query}`);
	const urlsHash = sha256(`u:${normalized.urls.join('|')}`);
	const cacheKey = sha256(`${queryHash}::${urlsHash}::${blepEnv.promptVersion}`);

	return { cacheKey, queryHash, urlsHash };
};

const cacheTtlSeconds = () => blepEnv.cacheTtlHours * 60 * 60;

const safeSourceList = (raw: unknown): { title: string; url: string }[] => {
	if (!Array.isArray(raw)) return [];

	return raw
		.map((entry) => {
			if (!entry || typeof entry !== 'object') return null;
			const record = entry as Record<string, unknown>;
			const title = typeof record.title === 'string' ? record.title : '';
			const url = typeof record.url === 'string' ? record.url : '';
			if (!url) return null;

			return { title, url };
		})
		.filter((entry): entry is { title: string; url: string } => Boolean(entry));
};

const safeJsonParse = (raw: unknown): unknown => {
	if (typeof raw !== 'string') return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
};

export const lookupCache = async ({ query, urls }: CacheKeyInput): Promise<CacheLookupResult> => {
	const { cacheKey } = buildCacheKey({ query, urls });
	const db = getDb();

	if (!db) {
		console.warn('[blep cache] DB unavailable — cache bypassed');
		return { hit: false, cacheKey };
	}

	try {
		const row = await db.execute({
			sql: `SELECT verdict, sources, expires_at FROM scan_cache WHERE key = ?`,
			args: [cacheKey]
		});

		if (!row.rows.length) return { hit: false, cacheKey };

		const data = row.rows[0];
		const nowUnix = Math.floor(Date.now() / 1000);

		if (typeof data.expires_at === 'number' && data.expires_at < nowUnix) {
			return { hit: false, cacheKey };
		}

		const verdictResult = blepVerdictSchema.safeParse(safeJsonParse(data.verdict));
		if (!verdictResult.success) return { hit: false, cacheKey };

		const sources = safeSourceList(safeJsonParse(data.sources));

		// Fire-and-forget hit counter bump
		void db
			.execute({
				sql: `UPDATE scan_cache SET hit_count = hit_count + 1, last_hit_at = unixepoch() WHERE key = ?`,
				args: [cacheKey]
			})
			.catch(() => undefined);

		return {
			hit: true,
			cacheKey,
			verdict: verdictResult.data,
			sources
		};
	} catch (error) {
		console.warn(`[blep cache] lookup failed:`, error);
		return { hit: false, cacheKey };
	}
};

export const storeCache = async (
	input: CacheKeyInput,
	verdict: BlepVerdict,
	sources: { title: string; url: string }[]
) => {
	const { cacheKey, queryHash, urlsHash } = buildCacheKey(input);
	const db = getDb();

	if (!db) {
		console.warn('[blep cache] DB unavailable — cache store skipped');
		return cacheKey;
	}

	try {
		const nowUnix = Math.floor(Date.now() / 1000);
		const expiresAt = nowUnix + cacheTtlSeconds();

		await db.execute({
			sql: `INSERT INTO scan_cache (key, query_hash, urls_hash, verdict, sources, created_at, expires_at, hit_count, last_hit_at, prompt_version)
			      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
			      ON CONFLICT(key) DO UPDATE SET
			        verdict = excluded.verdict,
			        sources = excluded.sources,
			        expires_at = excluded.expires_at,
			        last_hit_at = excluded.last_hit_at,
			        prompt_version = excluded.prompt_version`,
			args: [
				cacheKey,
				queryHash,
				urlsHash,
				JSON.stringify(verdict),
				JSON.stringify(sources),
				nowUnix,
				expiresAt,
				nowUnix,
				blepEnv.promptVersion
			]
		});

		return cacheKey;
	} catch (error) {
		console.warn(`[blep cache] store failed:`, error);

		return cacheKey;
	}
};
