export type BlepErrorCode =
	| 'bad_json'
	| 'bad_input'
	| 'bad_auth'
	| 'quota_exhausted'
	| 'mock_mode_enabled'
	| 'live_scrape_failed'
	| 'live_scan_failed';

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
