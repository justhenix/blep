/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Reset all Firestore and LibSQL/Turso quota documents for today.
 * Usage: node scripts/reset-quota.cjs
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// Read .env manually
const envPath = resolve(__dirname, '..', '.env');
let envContent = '';
try {
	envContent = readFileSync(envPath, 'utf-8');
} catch {
	console.warn('[reset-quota] Could not read .env file');
}

const env = {};
if (envContent) {
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
}

const today = new Date().toISOString().slice(0, 10);

async function main() {
	let performedReset = false;

	// 1. Reset LibSQL/Turso Quota
	const tursoUrl = env.TURSO_DATABASE_URL;
	const tursoToken = env.TURSO_AUTH_TOKEN;

	if (tursoUrl) {
		console.log(`[reset-quota] Resetting LibSQL/Turso quotas for ${today}...`);
		try {
			const { createClient } = require('@libsql/client');
			const client = createClient({
				url: tursoUrl,
				authToken: tursoToken || undefined
			});
			const res = await client.execute({
				sql: 'DELETE FROM quotas WHERE date = ?',
				args: [today]
			});
			console.log(`[reset-quota] LibSQL reset success: deleted ${res.rowsAffected} row(s).`);
			client.close();
			performedReset = true;
		} catch (err) {
			console.error('[reset-quota] LibSQL reset failed:', err.message);
		}
	}

	if (!performedReset) {
		console.error(
			'[reset-quota] No active database configuration found in .env (TURSO_DATABASE_URL required).'
		);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('[reset-quota] Error running script:', err);
	process.exit(1);
});
