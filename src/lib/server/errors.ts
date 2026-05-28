export type BlepErrorCode =
	| 'bad_json'
	| 'bad_input'
	| 'bad_auth'
	| 'quota_blocked'
	| 'mock_mode_enabled'
	| 'firecrawl_failed'
	| 'no_sources'
	| 'gemini_failed'
	| 'schema_failed'
	| 'unknown';

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
