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
	sources: {
		title: string;
		url: string;
	}[];
	verdict: BlepVerdict;
};

export type BlepMockScanResponse = BlepQuota & {
	ok: true;
	mode: 'mock';
	sources: [];
	verdict: BlepVerdict;
};

export type BlepFallbackScanResponse = BlepQuota & {
	ok: false;
	mode: 'fallback';
	error: string;
	sources: {
		title: string;
		url: string;
	}[];
	verdict: BlepVerdict;
};

export type BlepScanResponse =
	| BlepLiveScanResponse
	| BlepMockScanResponse
	| BlepFallbackScanResponse;

export type BlepQuotaCheck = {
	allowed: boolean;
	remaining: number;
	limit: number;
};
