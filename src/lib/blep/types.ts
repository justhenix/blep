import type { ScanInputGateReason } from './input-gate';

export type BlepVerdict = {
	name: string;
	verdict: 'APPROVED' | 'CAUTION' | 'WASTE';
	landfill_year: number;
	fatal_flaw: string;
	specs: {
		upgradeable: boolean;
		thermal: string;
		forum_score: number;
	};
	roast: string;
	summary: string;
	evidence: {
		title: string;
		url: string;
		quote_or_fact: string;
		relevance: string;
	}[];
};

export type BlepScanRequest = {
	query: string;
	urls?: string[];
};

export type BlepSource = {
	title: string;
	url: string;
	markdown: string;
};

export type BlepQuota = {
	quota: {
		remaining: number;
		limit: number;
	};
};

export type BlepLiveScanResponse = BlepQuota & {
	ok: true;
	mode: 'live';
	cached?: boolean;
	sources: {
		title: string;
		url: string;
	}[];
	verdict: BlepVerdict;
};

export type BlepMockScanResponse = BlepQuota & {
	ok: true;
	mode: 'mock';
	cached?: false;
	sources: [];
	verdict: BlepVerdict;
};

export type BlepFallbackScanResponse = BlepQuota & {
	ok: false;
	mode: 'fallback';
	error: string;
	cached?: false;
	retry_after_seconds?: number;
	sources: {
		title: string;
		url: string;
	}[];
	verdict: BlepVerdict;
};

export type BlepDeclinedScanResponse = BlepQuota & {
	ok: false;
	mode: 'declined';
	error: 'non_tech_input';
	cached?: false;
	gate?: {
		reason: ScanInputGateReason;
		confidence: 'high' | 'medium' | 'low';
	};
	sources: [];
	verdict: BlepVerdict;
};

export type BlepScanResponse =
	| BlepLiveScanResponse
	| BlepMockScanResponse
	| BlepFallbackScanResponse
	| BlepDeclinedScanResponse;

export type BlepQuotaCheck = {
	allowed: boolean;
	remaining: number;
	limit: number;
};
