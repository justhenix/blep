<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	type AuthUser = {
		uid: string;
		email: string | null;
		displayName: string | null;
		photoURL: string | null;
	};

	type Props = {
		children: import('svelte').Snippet<[{ user: AuthUser; idToken: string }]>;
	};

	let { children }: Props = $props();

	let user = $state<AuthUser | null>(null);
	let idToken = $state<string | null>(null);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			const { onAuthChange, getIdToken } = await import('$lib/firebase');

			onAuthChange(async (firebaseUser) => {
				if (firebaseUser) {
					user = {
						uid: firebaseUser.uid,
						email: firebaseUser.email,
						displayName: firebaseUser.displayName,
						photoURL: firebaseUser.photoURL
					};
					idToken = await getIdToken();
				} else {
					user = null;
					idToken = null;
				}
				loading = false;
			});
		} catch (err) {
			console.error('[blep auth] Firebase init failed:', err);
			loading = false;
			error = 'Firebase config error. Check PUBLIC_FIREBASE_* vars in .env.';
		}
	});

	const handleSignIn = async () => {
		error = '';
		try {
			const { signInWithGoogle } = await import('$lib/firebase');
			await signInWithGoogle();
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Sign-in failed';
			if (msg.includes('popup-closed') || msg.includes('cancelled-popup')) {
				error = 'Sign-in popup closed. Try again.';
			} else if (msg.includes('internal-error') || msg.includes('invalid-api-key')) {
				error = 'Firebase API key issue. Check PUBLIC_FIREBASE_API_KEY in .env — must be a Browser key from Firebase Console > Project Settings > Web app.';
			} else if (msg.includes('unauthorized-domain')) {
				error = 'Add localhost to Firebase Console > Authentication > Settings > Authorized domains.';
			} else if (msg.includes('operation-not-allowed')) {
				error = 'Google Sign-In not enabled. Enable it in Firebase Console > Authentication > Sign-in method > Google.';
			} else if (msg.includes('network-request-failed')) {
				error = 'Network error. Check your connection.';
			} else {
				error = msg;
			}
		}
	};
</script>

{#if loading}
	<div class="auth-loading">
		<div class="auth-loading-inner">
			<img src="/logo-main.svg" alt="" class="auth-logo-pulse" />
			<p class="auth-loading-text font-mono-ui">Waking up BLEP...</p>
		</div>
	</div>
{:else if user && idToken}
	{@render children({ user, idToken })}
{:else}
	<div class="auth-gate" in:fly={{ y: 20, duration: 200 }}>
		<div class="auth-gate-card">
			<img src="/logo-main.svg" alt="" class="auth-gate-logo" />
			<h1 class="auth-gate-title font-display">BLEP</h1>
			<p class="auth-gate-subtitle font-body">
				Hardware court is in session.<br />Sign in to start judging deals.
			</p>

			<button type="button" class="auth-google-btn font-display" onclick={handleSignIn}>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<path
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
						fill="#4285F4"
					/>
					<path
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						fill="#34A853"
					/>
					<path
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						fill="#FBBC05"
					/>
					<path
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						fill="#EA4335"
					/>
				</svg>
				Sign in with Google
			</button>

			{#if error}
				<p class="auth-error font-mono-ui">{error}</p>
			{/if}

			<p class="auth-hint font-mono-ui">Free · 3 scans/day · No spam</p>
		</div>
	</div>
{/if}

<style>
	.auth-loading {
		height: 100dvh;
		display: grid;
		place-items: center;
		background: var(--color-paper);
	}

	.auth-loading-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.auth-logo-pulse {
		width: 48px;
		height: 48px;
		animation: pulse-scale 1.2s ease-in-out infinite;
	}

	@keyframes pulse-scale {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.7;
		}
		50% {
			transform: scale(1.08);
			opacity: 1;
		}
	}

	.auth-loading-text {
		color: rgba(17, 17, 17, 0.45);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.auth-gate {
		height: 100dvh;
		display: grid;
		place-items: center;
		background: var(--color-paper);
		padding: 24px;
	}

	.auth-gate-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		max-width: 360px;
		text-align: center;
	}

	.auth-gate-logo {
		width: 64px;
		height: 64px;
	}

	.auth-gate-title {
		margin: 0;
		font-size: 2.4rem;
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--color-ink);
	}

	.auth-gate-subtitle {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.5;
		color: rgba(17, 17, 17, 0.55);
	}

	.auth-google-btn {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 12px 28px;
		border: 2px solid var(--color-ink);
		background: var(--color-paper);
		color: var(--color-ink);
		font-size: 0.92rem;
		font-weight: 800;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease;
		margin-top: 8px;
	}

	.auth-google-btn:hover {
		background: var(--color-ink);
		color: var(--color-paper);
	}

	.auth-google-btn:hover svg path {
		fill: var(--color-paper);
	}

	.auth-error {
		margin: 0;
		color: #b91c1c;
		font-size: 11px;
		font-weight: 700;
	}

	.auth-hint {
		margin: 0;
		color: rgba(17, 17, 17, 0.35);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
</style>
