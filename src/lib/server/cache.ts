import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { BlepVerdict } from '$lib/blep/types';
import { blepVerdictSchema } from '$lib/blep/schema';
import { blepEnv } from './env';
import { getFirebaseDb } from './firebase-admin';

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

const normalizeQuery = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeUrls = (urls: string[]) =>
	[...urls]
		.map((url) => url.trim())
		.filter(Boolean)
		.map((url) => url.replace(/\/+$/u, '').toLowerCase())
		.sort();

export const buildCacheKey = ({ query, urls }: CacheKeyInput) => {
	const normalizedQuery = normalizeQuery(query);
	const normalizedUrls = normalizeUrls(urls);
	const queryHash = sha256(`q:${normalizedQuery}`);
	const urlsHash = sha256(`u:${normalizedUrls.join('|')}`);
	const cacheKey = sha256(`${queryHash}::${urlsHash}::${blepEnv.promptVersion}`);

	return { cacheKey, queryHash, urlsHash };
};

const cacheTtlMs = () => blepEnv.cacheTtlHours * 60 * 60 * 1000;

const isExpired = (expiresAt: unknown) => {
	if (expiresAt instanceof Timestamp) return expiresAt.toMillis() < Date.now();
	if (typeof expiresAt === 'number') return expiresAt < Date.now();

	return true;
};

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

export const lookupCache = async ({ query, urls }: CacheKeyInput): Promise<CacheLookupResult> => {
	const { cacheKey } = buildCacheKey({ query, urls });

	try {
		const db = getFirebaseDb();
		const doc = db.collection('scan_cache').doc(cacheKey);
		const snap = await doc.get();

		if (!snap.exists) return { hit: false, cacheKey };

		const data = snap.data() ?? {};

		if (isExpired(data.expiresAt)) return { hit: false, cacheKey };

		const verdictResult = blepVerdictSchema.safeParse(data.verdict);
		if (!verdictResult.success) return { hit: false, cacheKey };

		const sources = safeSourceList(data.sources);

		void doc
			.update({
				hitCount: FieldValue.increment(1),
				lastHitAt: FieldValue.serverTimestamp()
			})
			.catch(() => undefined);

		return {
			hit: true,
			cacheKey,
			verdict: verdictResult.data,
			sources
		};
	} catch (error) {
		console.warn(
			`[blep cache] lookup failed code=${
				error && typeof error === 'object' && 'code' in error
					? String((error as { code: unknown }).code)
					: 'unknown'
			}`
		);
		return { hit: false, cacheKey };
	}
};

export const storeCache = async (
	input: CacheKeyInput,
	verdict: BlepVerdict,
	sources: { title: string; url: string }[]
) => {
	const { cacheKey, queryHash, urlsHash } = buildCacheKey(input);

	try {
		const db = getFirebaseDb();
		const doc = db.collection('scan_cache').doc(cacheKey);
		const expiresAt = Timestamp.fromMillis(Date.now() + cacheTtlMs());

		await doc.set(
			{
				cacheKey,
				queryHash,
				urlsHash,
				verdict,
				sources,
				createdAt: FieldValue.serverTimestamp(),
				expiresAt,
				hitCount: 0,
				lastHitAt: FieldValue.serverTimestamp(),
				promptVersion: blepEnv.promptVersion
			},
			{ merge: true }
		);

		return cacheKey;
	} catch (error) {
		console.warn(
			`[blep cache] store failed code=${
				error && typeof error === 'object' && 'code' in error
					? String((error as { code: unknown }).code)
					: 'unknown'
			}`
		);

		return cacheKey;
	}
};
