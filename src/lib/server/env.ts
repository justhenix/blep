import { env } from '$env/dynamic/private';

const parsePositiveInt = (value: string | undefined, fallback: number) => {
	const parsed = Number(value ?? '');

	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
	const parsed = Number(value ?? '');

	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const blepEnv = {
	geminiApiKey: env.GEMINI_API_KEY,
	firecrawlApiKey: env.FIRECRAWL_API_KEY,
	firebaseProjectId: env.FIREBASE_PROJECT_ID,
	googleApplicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS,
	dailyLimit: parsePositiveInt(env.BLEP_DAILY_LIMIT, 2),
	useMock: env.BLEP_USE_MOCK === 'true',
	demoMode: env.BLEP_DEMO_MODE === 'true',
	geminiModelMain: env.GEMINI_MODEL_MAIN ?? 'gemini-3.1-flash-lite',
	geminiModelBackup: env.GEMINI_MODEL_BACKUP ?? 'gemini-2.5-flash-lite',
	geminiModelDemo: env.GEMINI_MODEL_DEMO ?? 'gemini-3.5-flash',
	hashSalt: env.BLEP_HASH_SALT ?? '',
	cooldownSeconds: parseNonNegativeInt(env.BLEP_COOLDOWN_SECONDS, 15),
	abuseDailyLimit: parsePositiveInt(env.BLEP_ABUSE_DAILY_LIMIT, 10),
	cacheTtlHours: parsePositiveInt(env.BLEP_CACHE_TTL_HOURS, 24),
	promptVersion: env.BLEP_PROMPT_VERSION ?? 'v1'
} as const;

/**
 * Whether Firebase Admin credentials are available.
 * When false, quota/cache/abuse checks are bypassed gracefully.
 */
export const firebaseAvailable = Boolean(
	blepEnv.firebaseProjectId || blepEnv.googleApplicationCredentials
);

/**
 * Validate that required API keys exist for live mode.
 * Returns list of missing keys. Empty list = all good.
 */
export const validateLiveEnv = (): string[] => {
	if (blepEnv.useMock) return [];

	const missing: string[] = [];

	if (!blepEnv.geminiApiKey) missing.push('GEMINI_API_KEY');
	if (!blepEnv.firecrawlApiKey) missing.push('FIRECRAWL_API_KEY');

	if (!firebaseAvailable) {
		console.warn(
			'[blep env] Firebase credentials missing — quota/cache/abuse bypassed in live mode'
		);
	}

	return missing;
};
