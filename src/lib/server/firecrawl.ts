import type { BlepSource } from '$lib/blep/types';
import {
	BLEP_FIRECRAWL_REQUEST_TIMEOUT_MS,
	BLEP_MAX_SOURCES,
	BLEP_MIN_LIVE_SOURCES,
	BLEP_SOURCE_MARKDOWN_MAX_CHARS
} from './constants';
import { blepEnv } from './env';

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2';

type FirecrawlResult = {
	title?: unknown;
	url?: unknown;
	sourceURL?: unknown;
	markdown?: unknown;
	content?: unknown;
	description?: unknown;
	metadata?: {
		title?: unknown;
		sourceURL?: unknown;
		url?: unknown;
		description?: unknown;
	};
};

type FirecrawlResponse = {
	success?: boolean;
	data?: unknown;
	results?: unknown;
};

export type FirecrawlFailureCode = 'firecrawl_failed' | 'no_sources';

export type SourceCollection = {
	sources: BlepSource[];
	status: 'ok' | FirecrawlFailureCode;
};

class FirecrawlRequestError extends Error {}

const withTimeout = async (
	url: string,
	init: RequestInit,
	timeoutMs = BLEP_FIRECRAWL_REQUEST_TIMEOUT_MS
) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
};

const firecrawlPost = async (path: string, body: unknown): Promise<FirecrawlResponse> => {
	if (!blepEnv.firecrawlApiKey) throw new FirecrawlRequestError('firecrawl_missing_key');

	const response = await withTimeout(`${FIRECRAWL_BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${blepEnv.firecrawlApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) throw new FirecrawlRequestError('firecrawl_request_failed');

	const json = (await response.json()) as FirecrawlResponse;

	if (json.success === false) throw new FirecrawlRequestError('firecrawl_unsuccessful');

	return json;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const extractItems = (value: unknown): unknown[] => {
	if (Array.isArray(value)) return value;

	const record = asRecord(value);
	if (!record) return [];

	if ('url' in record || 'sourceURL' in record || 'markdown' in record || 'content' in record) {
		return [record];
	}

	return ['data', 'results', 'web', 'items']
		.flatMap((key) => extractItems(record[key]))
		.filter(Boolean);
};

const normalizeSource = (item: unknown): BlepSource | null => {
	const record = asRecord(item) as FirecrawlResult | null;
	if (!record) return null;

	const metadata = asRecord(record.metadata);
	const url =
		asString(record.url) ||
		asString(record.sourceURL) ||
		asString(metadata?.sourceURL) ||
		asString(metadata?.url);
	if (!url) return null;

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return null;
	}

	const markdown =
		asString(record.markdown) ||
		asString(record.content) ||
		asString(record.description) ||
		asString(metadata?.description);
	if (!markdown.trim()) return null;

	return {
		title: asString(record.title) || asString(metadata?.title) || parsedUrl.hostname,
		url,
		markdown: markdown.trim().slice(0, BLEP_SOURCE_MARKDOWN_MAX_CHARS)
	};
};

const uniqueSources = (sources: BlepSource[]) => {
	const seen = new Set<string>();

	return sources.filter((source) => {
		if (seen.has(source.url)) return false;
		seen.add(source.url);
		return true;
	});
};

const scrapeUrl = async (url: string): Promise<BlepSource | null> => {
	const result = await firecrawlPost('/scrape', {
		url,
		formats: ['markdown']
	});

	return normalizeSource(extractItems(result)[0]);
};

const searchQuery = async (query: string, limit: number): Promise<BlepSource[]> => {
	if (limit <= 0) return [];

	const result = await firecrawlPost('/search', {
		query: `${query} specs review forum known issues price`,
		limit,
		scrapeOptions: {
			formats: ['markdown']
		}
	});

	return extractItems(result)
		.map(normalizeSource)
		.filter((source): source is BlepSource => Boolean(source));
};

/** Retry search once before giving up */
const searchWithRetry = async (query: string, limit: number): Promise<BlepSource[]> => {
	try {
		return await searchQuery(query, limit);
	} catch (firstError) {
		console.warn(`[blep firecrawl] search attempt 1 failed, retrying...`);
		try {
			return await searchQuery(query, limit);
		} catch {
			console.warn(`[blep firecrawl] search attempt 2 failed`);
			throw firstError;
		}
	}
};

export const collectSources = async (
	query: string,
	urls: string[] = []
): Promise<SourceCollection> => {
	let searchFailed = false;
	const provided = urls.slice(0, BLEP_MAX_SOURCES);
	const scraped = await Promise.allSettled(provided.map(scrapeUrl));
	const sources = scraped
		.filter(
			(result): result is PromiseFulfilledResult<BlepSource | null> => result.status === 'fulfilled'
		)
		.map((result) => result.value)
		.filter((source): source is BlepSource => Boolean(source));

	if (sources.length < BLEP_MAX_SOURCES) {
		try {
			const searched = await searchWithRetry(query, BLEP_MAX_SOURCES);
			sources.push(...searched);
		} catch {
			searchFailed = true;
		}
	}

	const unique = uniqueSources(sources).slice(0, BLEP_MAX_SOURCES);

	// Always return whatever we have — let the caller decide whether to proceed.
	// Status tells the caller what happened, but we no longer kill the pipeline here.
	if (unique.length < BLEP_MIN_LIVE_SOURCES) {
		return {
			sources: unique,
			status: searchFailed ? 'firecrawl_failed' : 'no_sources'
		};
	}

	return { sources: unique, status: 'ok' };
};
