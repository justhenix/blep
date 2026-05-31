export type BlepErrorCode =
	| 'bad_json'
	| 'bad_input'
	| 'bad_auth'
	| 'non_tech_input'
	| 'quota_blocked'
	| 'cooldown'
	| 'rate_limited'
	| 'mock_mode_enabled'
	| 'firecrawl_failed'
	| 'no_sources'
	| 'gemini_failed'
	| 'json_parse_failed'
	| 'zod_failed'
	| 'schema_failed'
	| 'env_missing'
	| 'unknown';

/** Typed error codes surfaced in API response for frontend consumption */
export type ScanErrorCode =
	| 'ENV_MISSING'
	| 'FIRECRAWL_FAILED'
	| 'GEMINI_FAILED'
	| 'JSON_PARSE_FAILED'
	| 'ZOD_FAILED'
	| 'QUOTA_FAILED'
	| 'NO_SOURCES'
	| 'UNKNOWN';

/** Map internal BlepErrorCode → public ScanErrorCode */
export const toScanErrorCode = (code: BlepErrorCode): ScanErrorCode => {
	switch (code) {
		case 'env_missing':
			return 'ENV_MISSING';
		case 'firecrawl_failed':
			return 'FIRECRAWL_FAILED';
		case 'no_sources':
			return 'NO_SOURCES';
		case 'gemini_failed':
			return 'GEMINI_FAILED';
		case 'json_parse_failed':
			return 'JSON_PARSE_FAILED';
		case 'zod_failed':
		case 'schema_failed':
			return 'ZOD_FAILED';
		case 'quota_blocked':
		case 'rate_limited':
		case 'cooldown':
			return 'QUOTA_FAILED';
		default:
			return 'UNKNOWN';
	}
};

export class BlepApiError extends Error {
	constructor(
		readonly code: BlepErrorCode,
		readonly status: number,
		readonly publicMessage: string
	) {
		super(code);
		this.name = 'BlepApiError';
	}
}

export const blepError = (code: BlepErrorCode, status = 500, message: string = code) =>
	new BlepApiError(code, status, message);

export const safeParseJson = async (request: Request): Promise<unknown> => {
	try {
		return await request.json();
	} catch {
		throw blepError('bad_json', 400, 'Send valid JSON body.');
	}
};
