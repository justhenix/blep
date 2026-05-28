import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { blepEnv } from './env';
import { getFirebaseDb } from './firebase-admin';

export type AbuseCheckResult =
	| { allowed: true; remaining: number; limit: number }
	| {
			allowed: false;
			reason: 'cooldown' | 'rate_limited';
			remaining: number;
			limit: number;
			retryAfterSeconds: number;
	  };

const todayKey = () => new Date().toISOString().slice(0, 10);

const docId = (identityHash: string) => `${identityHash}_${todayKey()}`;

const expiryMs = () => Date.now() + 25 * 60 * 60 * 1000;

const safeErrorCode = (error: unknown) =>
	error && typeof error === 'object' && 'code' in error
		? String((error as { code: unknown }).code)
		: 'unknown';

const millis = (value: unknown) => {
	if (value instanceof Timestamp) return value.toMillis();
	if (typeof value === 'number') return value;

	return 0;
};

export const checkAndRecordAbuse = async (identityHash: string): Promise<AbuseCheckResult> => {
	const limit = blepEnv.abuseDailyLimit;
	const cooldownMs = blepEnv.cooldownSeconds * 1000;

	try {
		const db = getFirebaseDb();
		const doc = db.collection('abuse').doc(docId(identityHash));

		return await db.runTransaction(async (tx) => {
			const snap = await tx.get(doc);
			const now = Date.now();
			const data = snap.exists ? (snap.data() ?? {}) : {};
			const count = Number(data.count ?? 0);
			const lastRequestAt = millis(data.lastRequestAt);
			const blockedUntil = millis(data.blockedUntil);

			if (count >= limit) {
				return {
					allowed: false,
					reason: 'rate_limited',
					remaining: 0,
					limit,
					retryAfterSeconds: 60 * 60
				} as const;
			}

			if (cooldownMs > 0 && (now < blockedUntil || now - lastRequestAt < cooldownMs)) {
				const retryMs = Math.max(blockedUntil - now, cooldownMs - (now - lastRequestAt), 1000);

				return {
					allowed: false,
					reason: 'cooldown',
					remaining: Math.max(limit - count, 0),
					limit,
					retryAfterSeconds: Math.ceil(retryMs / 1000)
				} as const;
			}

			const nextCount = count + 1;
			const nextBlockedUntil = cooldownMs > 0 ? now + cooldownMs : 0;

			tx.set(
				doc,
				{
					count: nextCount,
					lastRequestAt: FieldValue.serverTimestamp(),
					blockedUntil: nextBlockedUntil
						? Timestamp.fromMillis(nextBlockedUntil)
						: FieldValue.delete(),
					expiresAt: Timestamp.fromMillis(expiryMs()),
					createdAt: snap.exists
						? (data.createdAt ?? FieldValue.serverTimestamp())
						: FieldValue.serverTimestamp()
				},
				{ merge: true }
			);

			return {
				allowed: true,
				remaining: Math.max(limit - nextCount, 0),
				limit
			} as const;
		});
	} catch (error) {
		console.warn(`[blep abuse] check failed code=${safeErrorCode(error)}`);

		return { allowed: true, remaining: limit, limit };
	}
};
