<script lang="ts">
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';

	type DoubtMsg = {
		role: 'user' | 'assistant';
		content: string;
	};

	type Props = {
		doubtMessages: DoubtMsg[];
		isLoading: boolean;
		errorMsg: string;
		showRescanCta: boolean;
		turnCount: number;
		maxTurns: number;
		onDoubtClick: () => void;
		onRescan: () => void;
		isDoubtActive: boolean;
	};

	let {
		doubtMessages,
		isLoading,
		errorMsg,
		showRescanCta,
		turnCount,
		maxTurns,
		onDoubtClick,
		onRescan,
		isDoubtActive
	}: Props = $props();

	let threadEl = $state<HTMLElement | null>(null);

	const DOUBT_THINKING_PHRASES = [
		'Defending the verdict...',
		'Checking evidence again...',
		'Judging your argument...',
		'Cross-checking specs...',
		'Reading seller claims...',
		'Still not impressed...'
	];
	let thinkingText = $state(DOUBT_THINKING_PHRASES[0]);

	$effect(() => {
		if (isLoading) {
			let idx = 0;
			thinkingText = DOUBT_THINKING_PHRASES[0];
			const iv = setInterval(() => {
				idx = (idx + 1) % DOUBT_THINKING_PHRASES.length;
				thinkingText = DOUBT_THINKING_PHRASES[idx];
			}, 1800);
			return () => clearInterval(iv);
		}
	});

	$effect(() => {
		// Auto-scroll thread when messages change
		if (doubtMessages.length || isLoading) {
			tick().then(() => {
				if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;
			});
		}
	});
</script>

<div class="doubt-area">
	<!-- Trigger button — always visible when result exists -->
	{#if !isDoubtActive}
		<div class="doubt-trigger-row">
			<button type="button" class="doubt-trigger btnSecondary" onclick={onDoubtClick}>
				<span class="doubt-x" aria-hidden="true">✕</span>
				Doubt this
			</button>
			<span class="doubt-hint font-mono-ui">Chat only. No Brain Juice used.</span>
		</div>
	{/if}

	<!-- Doubt thread — shows when there are messages or doubt mode active -->
	{#if doubtMessages.length > 0 || isLoading}
		<div class="doubt-thread" bind:this={threadEl} transition:fly={{ y: 10, duration: 160 }}>
			{#each doubtMessages as msg, idx (idx)}
				<div
					class="doubt-msg"
					class:doubt-msg-user={msg.role === 'user'}
					class:doubt-msg-blep={msg.role === 'assistant'}
				>
					{#if msg.role === 'assistant'}
						<span class="doubt-msg-label font-mono-ui">BLEP</span>
					{/if}
					<p class="doubt-msg-text font-body">{msg.content}</p>
				</div>
			{/each}

			{#if isLoading}
				<div class="doubt-msg doubt-msg-blep">
					<span class="doubt-msg-label font-mono-ui">BLEP</span>
					<p class="doubt-msg-text doubt-thinking font-body">{thinkingText}</p>
				</div>
			{/if}
		</div>
	{/if}

	{#if errorMsg}
		<div class="doubt-error font-mono-ui">{errorMsg}</div>
	{/if}

	{#if showRescanCta}
		<div class="doubt-rescan-row">
			<p class="doubt-rescan-hint font-body">Listing or price changed? Verify with a fresh scan.</p>
			<button type="button" class="btnPrimary doubt-rescan-btn" onclick={onRescan}>
				Run new scan
			</button>
			<span class="doubt-rescan-note font-mono-ui">This will use Brain Juice.</span>
		</div>
	{/if}

	{#if isDoubtActive && turnCount >= maxTurns}
		<div class="doubt-closed font-mono-ui">Doubt room closed. Run new scan if listing changed.</div>
	{/if}

	{#if isDoubtActive && doubtMessages.length > 0 && turnCount < maxTurns}
		<p class="doubt-turns font-mono-ui">{turnCount}/{maxTurns} doubts used</p>
	{/if}
</div>

<style>
	.doubt-area {
		width: 100%;
		margin-top: 12px;
	}

	/* ── Trigger ── */
	.doubt-trigger-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.doubt-trigger {
		gap: 8px;
	}

	.doubt-x {
		font-size: 0.85rem;
		line-height: 1;
		opacity: 0.7;
	}

	.doubt-hint {
		color: color-mix(in oklab, var(--color-ink) 42%, transparent);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* ── Thread ── */
	.doubt-thread {
		max-height: 320px;
		overflow-y: auto;
		padding: 14px 0 6px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-top: 1px solid color-mix(in oklab, var(--color-ink) 8%, transparent);
		margin-top: 14px;
	}

	.doubt-msg {
		display: flex;
		flex-direction: column;
	}

	.doubt-msg-user {
		align-items: flex-end;
	}

	.doubt-msg-user .doubt-msg-text {
		background: var(--color-ink);
		color: var(--color-paper);
		padding: 8px 14px;
		max-width: 85%;
	}

	.doubt-msg-blep {
		align-items: flex-start;
	}

	.doubt-msg-label {
		color: color-mix(in oklab, var(--color-ink) 42%, transparent);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-bottom: 2px;
	}

	.doubt-msg-blep .doubt-msg-text {
		color: var(--color-ink);
		max-width: 90%;
	}

	.doubt-msg-text {
		margin: 0;
		font-size: 0.88rem;
		font-weight: 600;
		line-height: 1.45;
		white-space: pre-wrap;
	}

	.doubt-thinking {
		color: color-mix(in oklab, var(--color-ink) 45%, transparent);
		font-style: italic;
	}

	/* ── Error ── */
	.doubt-error {
		margin: 0;
		padding: 8px 0;
		color: #b91c1c;
		font-size: 11px;
		font-weight: 700;
	}

	/* ── Rescan CTA ── */
	.doubt-rescan-row {
		padding: 14px;
		margin-top: 10px;
		border: 2px solid var(--color-mint);
		background: color-mix(in srgb, var(--color-mint) 8%, var(--color-paper));
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.doubt-rescan-hint {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-ink);
	}

	.doubt-rescan-btn {
		align-self: flex-start;
		background: var(--color-mint);
		color: var(--color-ink);
		border-color: var(--color-ink);
	}

	.doubt-rescan-btn:hover:not(:disabled) {
		background: var(--color-ink);
		color: var(--color-mint);
	}

	.doubt-rescan-note {
		color: color-mix(in oklab, var(--color-ink) 45%, transparent);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* ── Closed / Turns ── */
	.doubt-closed {
		padding: 10px 0;
		color: color-mix(in oklab, var(--color-ink) 45%, transparent);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.doubt-turns {
		margin: 0;
		padding: 6px 0 0;
		color: color-mix(in oklab, var(--color-ink) 35%, transparent);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-align: right;
	}

	/* ── Mobile ── */
	@media (max-width: 760px) {
		.doubt-trigger-row {
			flex-direction: column;
			align-items: stretch;
		}

		.doubt-trigger {
			width: 100%;
		}

		.doubt-hint {
			text-align: center;
		}

		.doubt-rescan-btn {
			align-self: stretch;
			width: 100%;
		}
	}
</style>
