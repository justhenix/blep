import { env } from '$env/dynamic/private';

const parseDailyLimit = (value: string | undefined) => {
	const parsed = Number(value ?? '2');

	return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
};

export const blepEnv = {
	geminiApiKey: env.GEMINI_API_KEY,
	firecrawlApiKey: env.FIRECRAWL_API_KEY,
	firebaseProjectId: env.FIREBASE_PROJECT_ID,
	googleApplicationCredentials: env.GOOGLE_APPLICATION_CREDENTIALS,
	dailyLimit: parseDailyLimit(env.BLEP_DAILY_LIMIT),
	useMock: env.BLEP_USE_MOCK === 'true',
	demoMode: env.BLEP_DEMO_MODE === 'true',
	geminiModelMain: env.GEMINI_MODEL_MAIN ?? 'gemini-3.1-flash-lite',
	geminiModelBackup: env.GEMINI_MODEL_BACKUP ?? 'gemini-2.5-flash-lite',
	geminiModelDemo: env.GEMINI_MODEL_DEMO ?? 'gemini-3.5-flash'
} as const;
