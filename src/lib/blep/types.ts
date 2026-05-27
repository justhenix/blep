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

export type BlepScanResponse = {
	ok: true;
	mode: 'mock';
	quota: {
		remaining: number;
		limit: number;
	};
	verdict: BlepVerdict;
};
