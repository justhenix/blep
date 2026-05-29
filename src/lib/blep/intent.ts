export type BlepIntent =
	| 'VERDICT_SCAN'
	| 'RECOMMENDATION_SCAN'
	| 'COMPARISON_SCAN'
	| 'NEEDS_INPUT';

export type BlepIntentResult = {
	intent: BlepIntent;
	budget_idr: number | null;
	use_case: string | null;
	category: string;
	devices: string[];
};

const RECOMMENDATION_TRIGGERS = [
	'rekomendasi',
	'rekomen',
	'recommend',
	'cari',
	'best',
	'under',
	'di bawah',
	'dibawah'
] as const;

const USE_CASE_TERMS: Record<string, string> = {
	gaming: 'gaming',
	game: 'gaming',
	coding: 'coding',
	ngoding: 'coding',
	programming: 'coding',
	editing: 'video/photo editing',
	edit: 'video/photo editing',
	render: 'rendering',
	rendering: 'rendering',
	design: 'design',
	desain: 'design',
	dkv: 'DKV/design',
	blender: '3D/Blender',
	'3d': '3D',
	video: 'video editing',
	office: 'office',
	kantor: 'office',
	kuliah: 'school',
	sekolah: 'school',
	school: 'school',
	student: 'school',
	mahasiswa: 'school',
	multimedia: 'multimedia'
};

const CATEGORY_TERMS: Record<string, string> = {
	laptop: 'laptop',
	notebook: 'laptop',
	pc: 'desktop PC',
	desktop: 'desktop PC',
	gpu: 'GPU',
	vga: 'GPU',
	cpu: 'CPU',
	monitor: 'monitor',
	phone: 'phone',
	hp: 'phone',
	tablet: 'tablet'
};

const SUFFIX_MULTIPLIER: Record<string, number> = {
	jutaan: 1_000_000,
	juta: 1_000_000,
	jt: 1_000_000,
	mil: 1_000_000,
	m: 1_000_000,
	rb: 1_000,
	ribu: 1_000,
	k: 1_000
};

const normalize = (query: string) => query.toLowerCase().replace(/\s+/g, ' ').trim();

const hasTerm = (text: string, term: string) =>
	new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text);

const hasAny = (text: string, terms: readonly string[]) => terms.some((term) => hasTerm(text, term));

export const parseIndonesianBudget = (query: string): number | null => {
	const text = normalize(query);

	const suffixMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(jutaan|juta|jt|mil|ribu|rb|m|k)\b/i);
	if (suffixMatch) {
		const amount = Number.parseFloat(suffixMatch[1].replace(',', '.'));
		const multiplier = SUFFIX_MULTIPLIER[suffixMatch[2].toLowerCase()] ?? 1;
		if (Number.isFinite(amount)) return Math.round(amount * multiplier);
	}

	const rupiahMatch = text.match(/rp\s?([\d.,]+)/i);
	if (rupiahMatch) {
		const digits = rupiahMatch[1].replace(/[.,]/g, '');
		const value = Number.parseInt(digits, 10);
		if (Number.isFinite(value) && value >= 100_000) return value;
	}

	const bareMatch = text.match(/\b(\d{7,9})\b/);
	if (bareMatch) return Number.parseInt(bareMatch[1], 10);

	return null;
};

const detectUseCase = (text: string): string | null => {
	for (const [term, label] of Object.entries(USE_CASE_TERMS)) {
		if (hasTerm(text, term)) return label;
	}

	return null;
};

const detectCategory = (text: string): string => {
	for (const [term, label] of Object.entries(CATEGORY_TERMS)) {
		if (hasTerm(text, term)) return label;
	}

	return 'laptop';
};

const splitComparisonDevices = (query: string): string[] => {
	const parts = query
		.split(/\b(?:vs|versus|atau|or|mending)\b|\bpilih mana\b/i)
		.map((part) => part.replace(/[?!.]+$/g, '').trim())
		.filter((part) => part.length > 0 && !/^(mending|pilih)$/i.test(part));

	return parts.slice(0, 4);
};

export function routeIntent(query: string, urls: string[] = []): BlepIntentResult {
	const text = normalize(query);
	const budget_idr = parseIndonesianBudget(query);
	const use_case = detectUseCase(text);
	const category = detectCategory(text);

	const base = { budget_idr, use_case, category, devices: [] as string[] };

	const comparisonByWord = hasAny(text, ['vs', 'versus', 'mending', 'compare', 'pilih mana']);
	const devices = splitComparisonDevices(query);
	// `atau` only counts as comparison when it actually splits two candidates.
	const comparison = comparisonByWord || (hasTerm(text, 'atau') && devices.length >= 2);

	if (comparison) {
		return { ...base, intent: 'COMPARISON_SCAN', devices };
	}

	const hasRecoKeyword = hasAny(text, RECOMMENDATION_TRIGGERS);
	const isRecommendation = hasRecoKeyword || (budget_idr !== null && use_case !== null);

	if (isRecommendation) {
		if (budget_idr === null && use_case === null) {
			return { ...base, intent: 'NEEDS_INPUT' };
		}

		return { ...base, intent: 'RECOMMENDATION_SCAN' };
	}

	return { ...base, intent: 'VERDICT_SCAN' };
}
