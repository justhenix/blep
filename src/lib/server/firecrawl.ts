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
	title?: string;
	url?: string;
	markdown?: string;
	content?: string;
	description?: string;
	metadata?: {
		title?: string;
		sourceURL?: string;
		url?: string;
		description?: string;
	};
};

type FirecrawlResponse = {
	success?: boolean;
	data?: FirecrawlResult | FirecrawlResult[];
};

export type SourceCollection = {
	sources: BlepSource[];
	degraded: boolean;
};

const fallbackSource: BlepSource = {
	title: 'Live scrape failed',
	url: 'https://example.com/blep/live-scrape-failed',
	markdown:
		'Live scrape failed. BLEP must return fallback verdict instead of pretending research happened.'
};

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
	if (!blepEnv.firecrawlApiKey) throw new Error('firecrawl_missing_key');

	const response = await withTimeout(`${FIRECRAWL_BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${blepEnv.firecrawlApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) throw new Error('firecrawl_request_failed');

	const json = (await response.json()) as FirecrawlResponse;

	if (json.success === false) throw new Error('firecrawl_unsuccessful');

	return json;
};

const normalizeSource = (item: FirecrawlResult): BlepSource | null => {
	const url = item.url ?? item.metadata?.sourceURL ?? item.metadata?.url;
	if (!url) return null;

	const markdown =
		item.markdown ?? item.content ?? item.description ?? item.metadata?.description ?? '';
	if (!markdown.trim()) return null;

	return {
		title: item.title ?? item.metadata?.title ?? new URL(url).hostname,
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
		formats: ['markdown'],
		onlyMainContent: true,
		timeout: BLEP_FIRECRAWL_REQUEST_TIMEOUT_MS
	});

	return normalizeSource(Array.isArray(result.data) ? result.data[0] : (result.data ?? {}));
};

const searchQuery = async (query: string, limit: number): Promise<BlepSource[]> => {
	const result = await firecrawlPost('/search', {
		query: `${query} specs review reddit forum known issues price`,
		limit,
		sources: ['web'],
		scrapeOptions: {
			formats: [{ type: 'markdown' }],
			onlyMainContent: true,
			timeout: BLEP_FIRECRAWL_REQUEST_TIMEOUT_MS
		}
	});

	const data = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];

	return data.map(normalizeSource).filter((source): source is BlepSource => Boolean(source));
};

export const collectSources = async (
	query: string,
	urls: string[] = []
): Promise<SourceCollection> => {
	try {
		const provided = urls.slice(0, BLEP_MAX_SOURCES);
		const scraped = await Promise.allSettled(provided.map(scrapeUrl));
		const sources = scraped
			.filter(
				(result): result is PromiseFulfilledResult<BlepSource | null> =>
					result.status === 'fulfilled'
			)
			.map((result) => result.value)
			.filter((source): source is BlepSource => Boolean(source));

		if (sources.length < 3 && provided.length < BLEP_MAX_SOURCES) {
			const searched = await searchQuery(query, BLEP_MAX_SOURCES - sources.length);
			sources.push(...searched);
		}

		const unique = uniqueSources(sources).slice(0, BLEP_MAX_SOURCES);

		if (unique.length < BLEP_MIN_LIVE_SOURCES) {
			return { sources: [fallbackSource], degraded: true };
		}

		return { sources: unique, degraded: false };
	} catch {
		return { sources: [fallbackSource], degraded: true };
	}
};
