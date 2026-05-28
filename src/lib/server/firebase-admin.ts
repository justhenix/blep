import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { blepEnv } from './env';

const getFirebaseCredential = () =>
	blepEnv.googleApplicationCredentials
		? cert(blepEnv.googleApplicationCredentials)
		: applicationDefault();

const getFirebaseApp = (): App => {
	const [app] = getApps();

	if (app) return app;

	return initializeApp({
		credential: getFirebaseCredential(),
		projectId: blepEnv.firebaseProjectId || undefined
	});
};

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp());

export const getFirebaseDb = (): Firestore => getFirestore(getFirebaseApp());

export const verifyBearerToken = async (
	authorization: string | null
): Promise<DecodedIdToken | null> => {
	if (!authorization) return null;

	const [scheme, token] = authorization.split(' ');

	if (scheme !== 'Bearer' || !token) {
		throw new Error('invalid_auth_header');
	}

	return getFirebaseAuth().verifyIdToken(token);
};
