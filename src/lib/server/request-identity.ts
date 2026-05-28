import { createHash } from 'node:crypto';
import { blepEnv } from './env';

export type RequestIdentitySource = 'x-forwarded-for' | 'x-real-ip' | 'unknown';

export type RequestIdentity = {
	identityHash: string;
	ipSource: RequestIdentitySource;
	userAgentFamily: string;
};

const DEV_FALLBACK_SALT = 'change-me-local-dev';

let warnedAboutMissingSalt = false;

const resolveSalt = () => {
	if (blepEnv.hashSalt) return blepEnv.hashSalt;

	if (!warnedAboutMissingSalt) {
		console.warn('[blep privacy] BLEP_HASH_SALT missing; using dev fallback');
		warnedAboutMissingSalt = true;
	}

	return DEV_FALLBACK_SALT;
};

const sha256Hex = (value: string) =>
	createHash('sha256').update(`${resolveSalt()}::${value}`).digest('hex');

const isPrivateIpv4 = (ip: string) => {
	if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false;

	const parts = ip.split('.').map((part) => Number(part));

	if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;

	const [a, b] = parts;

	if (a === 10) return true;
	if (a === 127) return true;
	if (a === 0) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;

	return false;
};

const isPrivateIpv6 = (ip: string) => {
	const lower = ip.toLowerCase();

	if (lower === '::1' || lower === '::') return true;
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
	if (lower.startsWith('fe80')) return true;

	return false;
};

const looksPublic = (ip: string) => {
	if (!ip) return false;
	if (ip.includes(':')) return !isPrivateIpv6(ip);

	return !isPrivateIpv4(ip);
};

const normalizeIp = (raw: string) => {
	const trimmed = raw.trim().replace(/^"|"$/g, '');

	if (!trimmed) return '';

	const noBrackets =
		trimmed.startsWith('[') && trimmed.includes(']')
			? trimmed.slice(1, trimmed.indexOf(']'))
			: trimmed;
	const stripped = noBrackets.replace(/^::ffff:/i, '');
	const portStripped =
		!stripped.includes(':') || /^\[?[0-9a-f:]+\]?$/i.test(stripped)
			? stripped
			: stripped.split(':')[0];

	return portStripped.toLowerCase();
};

const pickForwardedFor = (header: string | null): string | null => {
	if (!header) return null;

	const candidates = header
		.split(',')
		.map((entry) => normalizeIp(entry))
		.filter(Boolean);

	const publicHit = candidates.find(looksPublic);

	return publicHit ?? candidates[0] ?? null;
};

const detectUserAgentFamily = (userAgent: string): string => {
	const lower = userAgent.toLowerCase();

	if (!lower) return 'unknown';
	if (lower.includes('googlebot') || lower.includes('bingbot') || lower.includes('crawler'))
		return 'bot';
	if (lower.includes('curl')) return 'curl';
	if (lower.includes('postman')) return 'postman';
	if (lower.includes('node-fetch') || lower.includes('axios')) return 'script';
	if (lower.includes('edg/')) return 'edge';
	if (lower.includes('chrome/')) return 'chrome';
	if (lower.includes('firefox/')) return 'firefox';
	if (lower.includes('safari/')) return 'safari';

	return 'other';
};

export const getRequestIdentity = (request: Request): RequestIdentity => {
	const forwarded = pickForwardedFor(request.headers.get('x-forwarded-for'));
	const realIp = forwarded ? null : normalizeIp(request.headers.get('x-real-ip') ?? '');

	let ipSource: RequestIdentitySource = 'unknown';
	let ip = '';

	if (forwarded) {
		ipSource = 'x-forwarded-for';
		ip = forwarded;
	} else if (realIp) {
		ipSource = 'x-real-ip';
		ip = realIp;
	}

	const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 256);

	return {
		identityHash: sha256Hex(
			`identity:${ipSource}:${ip || 'unknown'}:ua:${userAgent || 'unknown'}`
		).slice(0, 32),
		ipSource,
		userAgentFamily: detectUserAgentFamily(userAgent)
	};
};
