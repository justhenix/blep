/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Reset all Firestore quota documents for today.
 * Usage: node scripts/reset-quota.js
 * Because well, sometimes you need to test the LIVE not just mockup
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// Read .env manually
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) continue;
	const eqIdx = trimmed.indexOf('=');
	if (eqIdx < 0) continue;
	const key = trimmed.slice(0, eqIdx).trim();
	let val = trimmed.slice(eqIdx + 1).trim();
	// Strip inline comments
	const commentIdx = val.indexOf(' #');
	if (commentIdx > 0) val = val.slice(0, commentIdx).trim();
	// Strip quotes
	val = val.replace(/^["']|["']$/g, '');
	env[key] = val;
}

const credsPath = env.GOOGLE_APPLICATION_CREDENTIALS;
const projectId = env.FIREBASE_PROJECT_ID;

if (!credsPath || !projectId) {
	console.error('Missing GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID in .env');
	process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credsPath, 'utf-8'));

initializeApp({
	credential: cert(serviceAccount),
	projectId
});

const db = getFirestore();
const today = new Date().toISOString().slice(0, 10);

async function resetQuotas() {
	console.log(`[reset-quota] Deleting all quota docs for ${today}...`);

	const quotasRef = db.collection('quotas');
	const snapshot = await quotasRef.where('date', '==', today).get();

	if (snapshot.empty) {
		console.log('[reset-quota] No quota docs found for today. Already clean.');
		return;
	}

	const batch = db.batch();
	let count = 0;

	snapshot.forEach((doc) => {
		console.log(`  deleting ${doc.id} (used=${doc.get('used')})`);
		batch.delete(doc.ref);
		count++;
	});

	await batch.commit();
	console.log(`[reset-quota] Deleted ${count} quota doc(s). Juice reset!`);
}

resetQuotas().catch((err) => {
	console.error('[reset-quota] Failed:', err.message);
	process.exit(1);
});
