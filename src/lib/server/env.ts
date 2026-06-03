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
	// AI provider — at least one required for live mode
	useVertex: env.USE_VERTEX === 'true',
	googleCloudProject: env.GOOGLE_CLOUD_PROJECT,
	googleCloudLocation: env.GOOGLE_CLOUD_LOCATION,
	geminiApiKey: env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY,
	openaiApiKey: env.OPENAI_API_KEY,
	deepseekApiKey: env.DEEPSEEK_API_KEY,
	openaiBaseUrl: env.OPENAI_BASE_URL,
	aiModelPhase1: env.AI_MODEL_PHASE1,
	aiModelPhase2: env.AI_MODEL_PHASE2,

	// Scraping
	firecrawlApiKey: env.FIRECRAWL_API_KEY,

	// Database (Turso)
	tursoUrl: env.TURSO_DATABASE_URL,
	tursoAuthToken: env.TURSO_AUTH_TOKEN,

	// Limits
	dailyLimit: parsePositiveInt(env.BLEP_DAILY_LIMIT, 3),
	globalDailyCap: parsePositiveInt(env.BLEP_GLOBAL_DAILY_CAP, 100),
	useMock: env.BLEP_USE_MOCK === 'true',
	demoMode: env.BLEP_DEMO_MODE === 'true',
	hashSalt: env.BLEP_HASH_SALT ?? '',
	cooldownSeconds: parseNonNegativeInt(env.BLEP_COOLDOWN_SECONDS, 15),
	abuseDailyLimit: parsePositiveInt(env.BLEP_ABUSE_DAILY_LIMIT, 10),
	cacheTtlHours: parsePositiveInt(env.BLEP_CACHE_TTL_HOURS, 24),
	promptVersion: env.BLEP_PROMPT_VERSION ?? 'v1'
} as const;

/**
 * Whether any AI provider key is available.
 */
export const aiAvailable = Boolean(
	blepEnv.useVertex || blepEnv.geminiApiKey || blepEnv.openaiApiKey || blepEnv.deepseekApiKey
);

/**
 * Whether database credentials are available.
 * When false, quota/cache/abuse checks are bypassed gracefully.
 */
export const dbAvailable = Boolean(blepEnv.tursoUrl);

/**
 * Validate that required API keys exist for live mode.
 * Returns list of missing keys. Empty list = all good.
 */
export const validateLiveEnv = (): string[] => {
	if (blepEnv.useMock) return [];

	const missing: string[] = [];

	if (!aiAvailable)
		missing.push('AI_PROVIDER_KEY (USE_VERTEX or GEMINI_API_KEY or OPENAI_API_KEY or DEEPSEEK_API_KEY)');
	if (!blepEnv.firecrawlApiKey) missing.push('FIRECRAWL_API_KEY');
	if (!blepEnv.hashSalt) missing.push('BLEP_HASH_SALT');

	if (!dbAvailable) {
		console.warn('[blep env] TURSO_DATABASE_URL missing — quota/cache/abuse bypassed in live mode');
	}

	return missing;
};
