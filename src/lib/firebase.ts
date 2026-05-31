/**
 * Firebase client SDK — browser-only init for Google Auth.
 *
 * Config uses PUBLIC_ env vars (safe to expose in client builds).
 * Set these in .env:
 *   PUBLIC_FIREBASE_API_KEY
 *   PUBLIC_FIREBASE_AUTH_DOMAIN
 *   PUBLIC_FIREBASE_PROJECT_ID
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	signInWithPopup,
	signOut as firebaseSignOut,
	GoogleAuthProvider,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID
} from '$env/static/public';

const firebaseConfig = {
	apiKey: PUBLIC_FIREBASE_API_KEY,
	authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: PUBLIC_FIREBASE_PROJECT_ID
};

let app: FirebaseApp;

const getApp = () => {
	if (app) return app;
	const [existing] = getApps();
	app = existing ?? initializeApp(firebaseConfig);
	return app;
};

export const auth = () => getAuth(getApp());

export const signInWithGoogle = async (): Promise<User> => {
	const provider = new GoogleAuthProvider();
	const result = await signInWithPopup(auth(), provider);
	return result.user;
};

export const signOutUser = () => firebaseSignOut(auth());

export const getIdToken = async (): Promise<string | null> => {
	const user = auth().currentUser;
	if (!user) return null;
	return user.getIdToken();
};

export const onAuthChange = (callback: (user: User | null) => void) => {
	return onAuthStateChanged(auth(), callback);
};
