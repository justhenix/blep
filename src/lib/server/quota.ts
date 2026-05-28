import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { BlepQuotaCheck } from '$lib/blep/types';
import { blepEnv } from './env';
import { getFirebaseDb } from './firebase-admin';

const todayKey = () => new Date().toISOString().slice(0, 10);

const safeDocId = (value: string) => value.replaceAll('/', '_').slice(0, 120);

export const hashClientAddress = (address: string | null | undefined) => {
	if (!address) return 'anon';

	return createHash('sha256').update(address).digest('hex').slice(0, 24);
};

export const checkDailyQuota = async (subject: string): Promise<BlepQuotaCheck> => {
	const limit = blepEnv.dailyLimit;
	const date = todayKey();
	const db = getFirebaseDb();
	const doc = db.collection('quotas').doc(`${safeDocId(subject)}_${date}`);
	const snap = await doc.get();
	const used = snap.exists ? Number(snap.get('used') ?? 0) : 0;

	return {
		allowed: used < limit,
		remaining: Math.max(limit - used, 0),
		limit
	};
};

export const consumeDailyQuota = async (subject: string): Promise<BlepQuotaCheck> => {
	const limit = blepEnv.dailyLimit;
	const date = todayKey();
	const db = getFirebaseDb();
	const doc = db.collection('quotas').doc(`${safeDocId(subject)}_${date}`);

	return db.runTransaction(async (tx) => {
		const snap = await tx.get(doc);
		const used = snap.exists ? Number(snap.get('used') ?? 0) : 0;

		if (used >= limit) {
			return { allowed: false, remaining: 0, limit };
		}

		const nextUsed = used + 1;

		tx.set(
			doc,
			{
				subject,
				date,
				used: nextUsed,
				limit,
				updatedAt: FieldValue.serverTimestamp(),
				createdAt: snap.exists ? snap.get('createdAt') : FieldValue.serverTimestamp()
			},
			{ merge: true }
		);

		return {
			allowed: true,
			remaining: Math.max(limit - nextUsed, 0),
			limit
		};
	});
};
