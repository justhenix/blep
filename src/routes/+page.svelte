<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { BlepScanResponse } from '$lib/blep/types';

	const fakeLogs = [
		'[blep checking money saving devices...]',
		'[blep scanning forum thoughts...]',
		'[blep detecting bad spec...]',
		'[blep looking at the catalogue...]',
		'[blep reticulating splines...]'
	];

	let query = $state('');
	let urlsText = $state('');
	let loading = $state(false);
	let visibleLogs = $state<string[]>([]);
	let result = $state.raw<BlepScanResponse | null>(null);
	let errorMessage = $state('');
	let logTimer: ReturnType<typeof setInterval> | undefined;

	const parsedUrls = $derived(
		urlsText
			.split('\n')
			.map((url) => url.trim())
			.filter(Boolean)
	);

	const stopLogs = () => {
		if (logTimer) {
			clearInterval(logTimer);
			logTimer = undefined;
		}
	};

	const startLogs = () => {
		stopLogs();
		visibleLogs = [fakeLogs[0]];
		let index = 1;

		logTimer = setInterval(() => {
			if (index >= fakeLogs.length) {
				stopLogs();
				return;
			}

			visibleLogs = [...visibleLogs, fakeLogs[index]];
			index += 1;
		}, 650);
	};

	const isDeclinedResponse = (response: BlepScanResponse) =>
		response.mode === 'declined' || ('error' in response && response.error === 'non_tech_input');

	const safeEvidenceUrl = (value: string) => {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
		} catch {
			return '';
		}
	};

	const submitScan = async (event: SubmitEvent) => {
		event.preventDefault();

		if (!query.trim() || loading) return;

		loading = true;
		result = null;
		errorMessage = '';
		startLogs();

		try {
			const response = await fetch('/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: query.trim(),
					...(parsedUrls.length ? { urls: parsedUrls } : {})
				})
			});

			const data = (await response.json()) as
				| BlepScanResponse
				| { error?: string; message?: string };

			if ('verdict' in data) {
				result = data;
				errorMessage = data.ok || isDeclinedResponse(data) ? '' : data.error;
			} else {
				errorMessage = data.message ?? data.error ?? 'Scan failed.';
			}
		} catch {
			errorMessage = 'Scan failed. Backend not reachable.';
		} finally {
			loading = false;
			stopLogs();
		}
	};

	onDestroy(stopLogs);
</script>

<svelte:head>
	<title>BLEP</title>
</svelte:head>

<main class="min-h-screen bg-neutral-100 px-4 py-6 text-black sm:px-6 lg:px-8">
	<section class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[0.9fr_1.1fr]">
		<form
			class="rounded-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0_#000]"
			onsubmit={submitScan}
		>
			<p class="mb-2 text-xs font-black tracking-[0.35em] uppercase">BLEP</p>
			<h1 class="mb-4 text-4xl leading-none font-black tracking-tight">tiny hardware judge</h1>

			<label class="mb-2 block text-sm font-black" for="query">Device / listing</label>
			<textarea
				id="query"
				class="min-h-36 w-full resize-y rounded-2xl border-4 border-black bg-neutral-50 p-4 font-mono text-sm outline-none focus:bg-white"
				bind:value={query}
				placeholder="Used ThinkPad T480 i5 8GB RAM, 256GB SSD, $180"
			></textarea>

			<label class="mt-4 mb-2 block text-sm font-black" for="urls"
				>Optional URLs, one per line</label
			>
			<textarea
				id="urls"
				class="min-h-24 w-full resize-y rounded-2xl border-4 border-black bg-neutral-50 p-4 font-mono text-sm outline-none focus:bg-white"
				bind:value={urlsText}
				placeholder="https://example.com/listing"
			></textarea>

			<button
				class="mt-4 w-full rounded-2xl border-4 border-black bg-black px-4 py-3 text-sm font-black text-white uppercase disabled:cursor-not-allowed disabled:bg-neutral-500"
				type="submit"
				disabled={loading || !query.trim()}
			>
				{loading ? 'judging...' : 'judge this thing'}
			</button>

			{#if errorMessage}
				<p class="mt-3 rounded-xl border-2 border-black bg-neutral-100 p-3 font-mono text-xs">
					{errorMessage}
				</p>
			{/if}
		</form>

		<section class="grid gap-4">
			<div
				class="min-h-44 rounded-3xl border-4 border-black bg-white p-5 font-mono text-xs shadow-[8px_8px_0_#000]"
				aria-live="polite"
			>
				<p class="mb-3 font-black">agent log</p>
				{#if visibleLogs.length}
					<ul class="space-y-2">
						{#each visibleLogs as log (log)}
							<li>{log}</li>
						{/each}
					</ul>
				{:else}
					<p>[blep idle]</p>
				{/if}
			</div>

			{#if result}
				{#if isDeclinedResponse(result)}
					<article class="rounded-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0_#000]">
						<p class="text-xs font-black tracking-[0.3em] uppercase">OUT OF SCOPE</p>
						<p class="mt-3 font-mono text-sm">
							BLEP only judges tech hardware. Try a laptop, phone, PC part, or listing URL.
						</p>
					</article>
				{:else}
					<article class="rounded-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0_#000]">
						<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="text-xs font-black tracking-[0.3em] uppercase">{result.mode}</p>
								<h2 class="text-4xl font-black">{result.verdict.verdict}</h2>
							</div>
							<p class="rounded-full border-4 border-black px-4 py-2 text-sm font-black">
								quota {result.quota.remaining}/{result.quota.limit}
							</p>
						</div>

						<div class="grid gap-3 font-mono text-sm">
							<p><strong>landfill year:</strong> {result.verdict.landfill_year}</p>
							<p><strong>fatal flaw:</strong> {result.verdict.fatal_flaw}</p>
							<p>
								<strong>specs:</strong>
								upgradeable {result.verdict.specs.upgradeable ? 'yes' : 'no'}; thermal
								{result.verdict.specs.thermal}; forum score {result.verdict.specs.forum_score}/10
							</p>
							<p><strong>roast:</strong> {result.verdict.roast}</p>
							<p><strong>summary:</strong> {result.verdict.summary}</p>
						</div>

						<div class="mt-5">
							<h3 class="mb-2 text-sm font-black uppercase">evidence</h3>
							<ul class="grid gap-3">
								{#each result.verdict.evidence as evidence (`${evidence.url}-${evidence.title}`)}
									<li class="rounded-2xl border-2 border-black p-3">
										{#if safeEvidenceUrl(evidence.url)}
											<a
												class="font-black underline"
												href={safeEvidenceUrl(evidence.url)}
												target="_blank"
												rel="noopener noreferrer external nofollow"
											>
												{evidence.title}
											</a>
										{:else}
											<p class="font-black">{evidence.title}</p>
											<p class="mt-1 break-all font-mono text-xs">{evidence.url}</p>
										{/if}
										<p class="mt-1 font-mono text-xs">{evidence.quote_or_fact}</p>
										<p class="mt-1 text-xs">{evidence.relevance}</p>
									</li>
								{/each}
							</ul>
						</div>
					</article>
				{/if}
			{:else}
				<div class="rounded-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0_#000]">
					<p class="font-mono text-sm">submit device. get verdict. avoid regret purchase.</p>
				</div>
			{/if}
		</section>
	</section>
</main>
