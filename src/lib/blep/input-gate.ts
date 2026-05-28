import type { BlepVerdict } from './types';

export type ScanInputGateReason =
	| 'tech_hardware'
	| 'tech_listing_url'
	| 'too_short'
	| 'non_tech'
	| 'prompt_injection'
	| 'unsupported_category';

export type ScanInputGateResult = {
	allowed: boolean;
	reason: ScanInputGateReason;
	confidence: 'high' | 'medium' | 'low';
	score: number;
};

const DENY_PHRASES = [
	'ignore previous',
	'system prompt',
	'act as',
	'jailbreak',
	'roleplay',
	'pretend you are',
	'developer message'
] as const;

const UNSUPPORTED_CATEGORY_TERMS = [
	'food',
	'recipe',
	'nasi',
	'goreng',
	'travel',
	'hotel',
	'dating',
	'politics',
	'homework',
	'essay',
	'medical',
	'legal',
	'finance',
	'stock',
	'crypto',
	'religion'
] as const;

const HARDWARE_TERMS = [
	'laptop',
	'notebook',
	'pc',
	'desktop',
	'monitor',
	'phone',
	'tablet',
	'gpu',
	'cpu',
	'ram',
	'ssd',
	'hdd',
	'router',
	'keyboard',
	'mouse',
	'headset'
] as const;

const BRAND_TERMS = [
	'thinkpad',
	'ideapad',
	'macbook',
	'chromebook',
	'acer',
	'asus',
	'lenovo',
	'dell',
	'hp',
	'axioo',
	'msi',
	'gigabyte',
	'apple',
	'samsung',
	'xiaomi'
] as const;

const PLATFORM_TERMS = [
	'ryzen',
	'intel',
	'core i3',
	'core i5',
	'core i7',
	'core i9',
	'xeon',
	'celeron',
	'pentium',
	'nvidia',
	'geforce',
	'radeon',
	'rtx',
	'gtx'
] as const;

const BUYING_INTENT_TERMS = [
	'worth it',
	'used',
	'secondhand',
	'listing',
	'buy',
	'price',
	'murah',
	'bekas',
	'bagus gak',
	'worth buying'
] as const;

const WORKLOAD_TERMS = [
	'blender',
	'gaming',
	'editing',
	'render',
	'coding',
	'office',
	'school'
] as const;

const SPEC_PATTERNS = [/\b\d{1,3}\s?(gb|tb)\b/i, /\bddr[2-5]\b/i, /\bnvme\b/i] as const;

const MODEL_PATTERNS = [
	/\bryzen\s?[3579]\s?\d{4}[a-z]*\b/i,
	/\br[3579]\s?\d{4}[a-z]*\b/i,
	/\bi[3579][-\s]?\d{4,5}[a-z]*\b/i,
	/\bcore\s?i[3579]\b/i,
	/\bintel\s+core\s+(ultra\s+)?[3579]\b/i,
	/\bcore\s+(ultra\s+)?[3579]\b/i,
	/\bcore\s+(ultra\s+)?[3579]\s+\d{3}[a-z]?\b/i,
	/\b(m1|m2|m3|m4)\b/i,
	/\b(rtx|gtx|rx)\s?\d{3,4}\b/i,
	/\buhd\s?graphics\b/i,
	/\biris\s?xe\b/i,
	/\b\d{4,5}(hs|hx|kf|u|h|g|x|f|k|p)\b/i
] as const;

const MARKETPLACE_HOST_TERMS = [
	'tokopedia',
	'shopee',
	'bukalapak',
	'lazada',
	'blibli',
	'olx',
	'carousell',
	'ebay',
	'amazon',
	'facebook',
	'mercari',
	'aliexpress'
] as const;

const TECH_HOST_TERMS = [
	'lenovo',
	'dell',
	'hp',
	'acer',
	'asus',
	'apple',
	'samsung',
	'xiaomi',
	'msi',
	'gigabyte',
	'amd',
	'intel',
	'nvidia',
	'notebookcheck',
	'tomshardware',
	'anandtech',
	'pcmag',
	'techspot',
	'gsmarena',
	'rtings',
	'reddit',
	'youtube',
	'youtu.be',
	'ifixit'
] as const;

const TECH_PATH_TERMS = [
	'product',
	'products',
	'spec',
	'specs',
	'review',
	'laptop',
	'notebook',
	'desktop',
	'monitor',
	'phone',
	'tablet',
	'gpu',
	'cpu',
	'ssd',
	'ram',
	'keyboard',
	'mouse',
	'headset',
	'thinkpad',
	'macbook',
	'aspire',
	'ideapad',
	'geforce',
	'radeon',
	'rtx',
	'gtx'
] as const;

const SHORT_HARDWARE_PATTERNS = [/\bm[1-4]\b/i, /\bhp\b/i, /\bpc\b/i] as const;
const repeatedPunctuationPattern = /[!?.,:;]{2,}/g;
const whitespacePattern = /\s+/g;
const urlPattern = /https?:\/\/[^\s]+/gi;
const meaningfulPattern = /[a-z0-9]/g;
const noisePattern = /[a-z0-9\s]/g;
const tokenPattern = /[a-z0-9]+(?:-[a-z0-9]+)?/g;
const digitPattern = /\d/;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const withGlobal = (pattern: RegExp) =>
	new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

const termPattern = (term: string) => {
	const pattern = escapeRegExp(term).replace(/\s+/g, '\\s+');

	return new RegExp(`\\b${pattern}\\b`, 'i');
};

const toTermPatterns = (terms: readonly string[]) => terms.map(termPattern);

const DENY_PATTERNS = toTermPatterns(DENY_PHRASES);
const UNSUPPORTED_CATEGORY_PATTERNS = toTermPatterns(UNSUPPORTED_CATEGORY_TERMS);
const HARDWARE_PATTERNS = toTermPatterns(HARDWARE_TERMS);
const BRAND_PATTERNS = toTermPatterns(BRAND_TERMS);
const PLATFORM_PATTERNS = toTermPatterns(PLATFORM_TERMS);
const BUYING_INTENT_PATTERNS = toTermPatterns(BUYING_INTENT_TERMS);
const WORKLOAD_PATTERNS = toTermPatterns(WORKLOAD_TERMS);
const TECH_PATH_PATTERNS = toTermPatterns(TECH_PATH_TERMS);
const SPEC_HIT_PATTERNS = SPEC_PATTERNS.map(withGlobal);

const normalizeScanInput = (query: string) =>
	query
		.toLowerCase()
		.trim()
		.replace(repeatedPunctuationPattern, (match) => match[0] ?? '')
		.replace(whitespacePattern, ' ');

const hasPattern = (text: string, patterns: readonly RegExp[]) =>
	patterns.some((pattern) => pattern.test(text));

const parseUrl = (value: string): URL | null => {
	try {
		return new URL(value.trim());
	} catch {
		return null;
	}
};

const countTermScore = (text: string, patterns: readonly RegExp[], points: number) =>
	patterns.reduce((score, pattern) => score + (pattern.test(text) ? points : 0), 0);

const countPatternHits = (text: string, patterns: readonly RegExp[]) =>
	patterns.reduce((hits, pattern) => hits + (text.match(pattern)?.length ?? 0), 0);

const extractUrlCandidates = (query: string, urls: string[]) => [
	...new Set([...urls, ...(query.match(urlPattern) ?? [])])
];

const urlLooksTech = (url: URL) => {
	const host = url.hostname.toLowerCase();
	const path = `${url.pathname} ${url.search}`.toLowerCase();

	return (
		MARKETPLACE_HOST_TERMS.some((term) => host.includes(term)) ||
		TECH_HOST_TERMS.some((term) => host.includes(term)) ||
		hasPattern(path, TECH_PATH_PATTERNS)
	);
};

const scoreUrls = (query: string, urls: string[] = []) => {
	const usefulUrls = extractUrlCandidates(query, urls).flatMap((candidate) => {
		const url = parseUrl(candidate);
		return url && urlLooksTech(url) ? [url] : [];
	});
	return {
		hasTechUrl: usefulUrls.length > 0,
		score: usefulUrls.length * 3
	};
};

const hasMostlyNoise = (text: string, meaningfulLength: number) => {
	const symbolLength = text.replace(noisePattern, '').length;

	return meaningfulLength > 0 && symbolLength > meaningfulLength * 2;
};

const confidenceFor = (score: number, denyFirst = false): ScanInputGateResult['confidence'] => {
	if (denyFirst || score >= 5) return 'high';
	if (score >= 3) return 'medium';

	return 'low';
};

const denied = (
	reason: Exclude<ScanInputGateReason, 'tech_hardware' | 'tech_listing_url'>,
	score: number,
	denyFirst = false
): ScanInputGateResult => ({
	allowed: false,
	reason,
	confidence: confidenceFor(score, denyFirst),
	score
});

const allowed = (
	reason: Extract<ScanInputGateReason, 'tech_hardware' | 'tech_listing_url'>,
	score: number
): ScanInputGateResult => ({
	allowed: true,
	reason,
	confidence: confidenceFor(score),
	score
});

export function classifyScanInput(query: string, urls: string[] = []): ScanInputGateResult {
	const normalized = normalizeScanInput(query);
	const meaningfulLength = (normalized.match(meaningfulPattern) ?? []).length;
	const hasShortHardware = hasPattern(normalized, SHORT_HARDWARE_PATTERNS);

	// deny-first
	if (!normalized || (meaningfulLength < 3 && !hasShortHardware)) {
		return denied('too_short', 0, true);
	}

	if (hasPattern(normalized, DENY_PATTERNS)) {
		return denied('prompt_injection', 0, true);
	}

	// score hardware evidence
	const directHardwareScore = countTermScore(normalized, HARDWARE_PATTERNS, 3);
	const brandScore = countTermScore(normalized, BRAND_PATTERNS, 3);
	const platformScore = countTermScore(normalized, PLATFORM_PATTERNS, 2);
	const modelScore = countTermScore(normalized, MODEL_PATTERNS, 3);
	const chipModelScore = platformScore + modelScore;
	const specHits = countPatternHits(normalized, SPEC_HIT_PATTERNS);
	const specScore = specHits * 2 + (specHits >= 2 ? 1 : 0);
	const hardwareScore = directHardwareScore + brandScore + platformScore + modelScore;
	const buyingScore = countTermScore(normalized, BUYING_INTENT_PATTERNS, 2);
	const workloadScore = hardwareScore > 0 ? countTermScore(normalized, WORKLOAD_PATTERNS, 1) : 0;
	const urlScore = scoreUrls(normalized, urls);
	const score = hardwareScore + specScore + buyingScore + workloadScore + urlScore.score;
	const hasHardwareEvidence = hardwareScore + specScore > 0;

	if (normalized === 'ambatukam') {
		return denied('non_tech', score, true);
	}

	if (hasMostlyNoise(normalized, meaningfulLength)) {
		return denied('non_tech', score, true);
	}

	if (
		!hasHardwareEvidence &&
		!urlScore.hasTechUrl &&
		hasPattern(normalized, UNSUPPORTED_CATEGORY_PATTERNS)
	) {
		return denied('unsupported_category', score, true);
	}

	const tokens = normalized.match(tokenPattern) ?? [];

	if (
		tokens.length === 1 &&
		!digitPattern.test(normalized) &&
		!hasHardwareEvidence &&
		!urlScore.hasTechUrl
	) {
		return denied('non_tech', score, true);
	}

	// decide
	if (
		score >= 3 ||
		chipModelScore >= 3 ||
		(hardwareScore >= 2 && buyingScore + workloadScore + specScore >= 1) ||
		(score >= 2 && urlScore.hasTechUrl)
	) {
		return allowed(
			urlScore.hasTechUrl && hardwareScore === 0 ? 'tech_listing_url' : 'tech_hardware',
			score
		);
	}

	return denied('non_tech', score);
}

export function createDeclineVerdict(currentYear = new Date().getFullYear()): BlepVerdict {
	return {
		name: 'Not a hardware listing',
		verdict: 'CAUTION',
		landfill_year: currentYear,
		fatal_flaw: 'BLEP only judges tech hardware purchase decisions.',
		specs: {
			upgradeable: false,
			thermal: 'Not applicable',
			forum_score: 1
		},
		roast: 'BLEP judges devices, not vibes. Bring hardware specs.',
		summary: 'This input does not look like a tech hardware listing or purchase question.',
		evidence: [
			{
				title: 'Input declined',
				url: 'https://example.com/blep/input-gate',
				quote_or_fact: 'No live research was performed because the input is outside BLEP scope.',
				relevance: 'Prevents wasted Firecrawl/Gemini calls and keeps BLEP focused.'
			}
		]
	};
}
