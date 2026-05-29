import type { z } from 'zod';
import type { ScanInputGateReason } from './input-gate';
import type { BlepIntent } from './intent';
import type {
	blepComparisonSchema,
	blepEvidenceSchema,
	blepNeedsInputSchema,
	blepPhase1OutputSchema,
	blepRecommendationSchema,
	blepVerdictSchema
} from './schema';

export type BlepEvidence = z.infer<typeof blepEvidenceSchema>;
export type BlepVerdict = z.infer<typeof blepVerdictSchema>;
export type BlepRecommendation = z.infer<typeof blepRecommendationSchema>;
export type BlepComparison = z.infer<typeof blepComparisonSchema>;
export type BlepNeedsInput = z.infer<typeof blepNeedsInputSchema>;
export type BlepPhase1Output = z.infer<typeof blepPhase1OutputSchema>;

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

type SourceSummary = {
	title: string;
	url: string;
};

type ResultEnvelope = {
	intent: BlepIntent;
	result: BlepPhase1Output;
	// Kept for old verdict UI compatibility; present only when result.mode === 'VERDICT'.
	verdict?: BlepVerdict;
};

export type BlepLiveScanResponse = BlepQuota &
	ResultEnvelope & {
		ok: true;
		mode: 'live';
		cached?: boolean;
		sources: SourceSummary[];
	};

export type BlepMockScanResponse = BlepQuota &
	ResultEnvelope & {
		ok: true;
		mode: 'mock';
		cached?: false;
		sources: [];
	};

export type BlepFallbackScanResponse = BlepQuota &
	ResultEnvelope & {
		ok: false;
		mode: 'fallback';
		error: string;
		cached?: false;
		retry_after_seconds?: number;
		sources: SourceSummary[];
	};

export type BlepDeclinedScanResponse = BlepQuota &
	ResultEnvelope & {
		ok: false;
		mode: 'declined';
		error: 'non_tech_input';
		cached?: false;
		gate?: {
			reason: ScanInputGateReason;
			confidence: 'high' | 'medium' | 'low';
		};
		sources: [];
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
