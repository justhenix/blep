import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { blepEnv, firebaseAvailable } from './env';

let firebaseInitFailed = false;
let warnedNoFirebase = false;

const warnOnce = (msg: string) => {
	if (!warnedNoFirebase) {
		console.warn(msg);
		warnedNoFirebase = true;
	}
};

const getFirebaseCredential = () =>
	blepEnv.googleApplicationCredentials
		? cert(blepEnv.googleApplicationCredentials)
		: applicationDefault();

const getFirebaseApp = (): App | null => {
	if (!firebaseAvailable || firebaseInitFailed) {
		warnOnce('[blep firebase] credentials missing — Firebase bypassed');
		return null;
	}

	const [app] = getApps();

	if (app) return app;

	try {
		return initializeApp({
			credential: getFirebaseCredential(),
			projectId: blepEnv.firebaseProjectId || undefined
		});
	} catch (error) {
		firebaseInitFailed = true;
		const msg = error instanceof Error ? error.message : 'unknown';
		console.warn(`[blep firebase] init failed: ${msg.slice(0, 120)} — Firebase bypassed`);
		return null;
	}
};

export const getFirebaseAuth = (): Auth | null => {
	const app = getFirebaseApp();
	return app ? getAuth(app) : null;
};

export const getFirebaseDb = (): Firestore | null => {
	const app = getFirebaseApp();
	return app ? getFirestore(app) : null;
};

export const verifyBearerToken = async (
	authorization: string | null
): Promise<DecodedIdToken | null> => {
	if (!authorization) return null;

	const [scheme, token] = authorization.split(' ');

	if (scheme !== 'Bearer' || !token) {
		throw new Error('invalid_auth_header');
	}

	const auth = getFirebaseAuth();
	if (!auth) {
		// Firebase unavailable — skip auth verification, allow scan
		console.warn('[blep firebase] auth unavailable — skipping token verification');
		return null;
	}

	return auth.verifyIdToken(token);
};
