/**
 * Request-scoped trace logging for scan pipeline.
 * Every scan gets a unique traceId so failures can be tracked end-to-end.
 */

import { randomUUID } from 'node:crypto';

export type ScanStage =
	| 'env_loaded'
	| 'request_validated'
	| 'mode_detected'
	| 'quota_checked'
	| 'cache_checked'
	| 'firecrawl_started'
	| 'firecrawl_done'
	| 'gemini_started'
	| 'gemini_done'
	| 'zod_validated'
	| 'response_returned'
	| 'fallback_returned';

export type StageStatus = 'done' | 'fail' | 'skipped';

export type StageEntry = {
	stage: ScanStage;
	status: StageStatus;
	detail?: string;
	ts: number;
};

export type ScanTrace = {
	traceId: string;
	stages: StageEntry[];
	log: (stage: ScanStage, status: StageStatus, detail?: string) => void;
	lastFailedStage: () => ScanStage | null;
	summary: () => string;
};

export const createTrace = (): ScanTrace => {
	const traceId = randomUUID().slice(0, 12);
	const stages: StageEntry[] = [];

	const log = (stage: ScanStage, status: StageStatus, detail?: string) => {
		stages.push({ stage, status, ts: Date.now(), detail });
		const detailStr = detail ? ` detail=${detail.slice(0, 120)}` : '';
		console.info(`[blep trace:${traceId}] stage=${stage} status=${status}${detailStr}`);
	};

	const lastFailedStage = (): ScanStage | null => {
		const failed = stages.filter((s) => s.status === 'fail');
		return failed.length > 0 ? failed[failed.length - 1].stage : null;
	};

	const summary = (): string => {
		return stages.map((s) => `${s.stage}:${s.status}`).join(' → ');
	};

	return { traceId, stages, log, lastFailedStage, summary };
};
