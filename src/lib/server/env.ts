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
	useMock: env.BLEP_USE_MOCK !== 'false'
} as const;
