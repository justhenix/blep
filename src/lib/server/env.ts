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
