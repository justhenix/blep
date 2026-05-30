<svelte:head>
	<title>Privacy | BLEP</title>
</svelte:head>

<main class="min-h-screen bg-neutral-100 px-4 py-6 text-black sm:px-6 lg:px-8">
	<article
		class="mx-auto max-w-3xl rounded-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0_#000] sm:p-7"
	>
		<p class="mb-2 font-display text-xs font-bold tracking-[0.22em] uppercase">BLEP PRIVACY</p>
		<h1 class="font-display text-4xl leading-none font-bold tracking-tight">Privacy Policy</h1>
		<p class="mt-3 font-body text-sm">Draft for hackathon demo. Last updated: May 28, 2026.</p>

		<section class="mt-6 grid gap-5 font-body text-sm leading-relaxed">
			<div>
				<h2 class="mb-2 font-display text-base font-bold">What BLEP Processes</h2>
				<p>
					BLEP processes device/listing text you submit and optional URLs you provide so it can
					generate a hardware purchase verdict.
				</p>
			</div>

			<div>
				<h2 class="mb-2 font-display text-base font-bold">Live Mode Services</h2>
				<p>
					In live mode, BLEP may send your query, source page content, and related source metadata
					to Firecrawl and Gemini. Mock mode uses local mock results and does not call those
					services.
				</p>
			</div>

			<div>
				<h2 class="mb-2 font-display text-base font-bold">Quota, Cache, Abuse Data</h2>
				<p>
					Firebase/Firestore may store quota, cache, and abuse-control metadata. The backend is
					built to hash request identity for quota and abuse checks, so raw IP addresses should not
					be stored by BLEP application code.
				</p>
			</div>

			<div>
				<h2 class="mb-2 font-display text-base font-bold">Caching</h2>
				<p>
					BLEP may cache verdicts and source summaries for cost control, speed, and demo stability.
					Cache entries can include verdict JSON, source titles, source URLs, timestamps, and hashes
					derived from request input.
				</p>
			</div>

			<div>
				<h2 class="mb-2 font-display text-base font-bold">Data Sale</h2>
				<p>BLEP does not sell user data.</p>
			</div>

			<div>
				<h2 class="mb-2 font-display text-base font-bold">Demo Disclaimer</h2>
				<p>
					BLEP is a hackathon/demo prototype. Privacy controls are kept simple for launch and should
					be reviewed before any real public production rollout.
				</p>
			</div>

			<div>
				<h2 class="mb-2 font-display text-base font-bold">Contact</h2>
				<p>Contact placeholder: replace with maintainer email or project contact before launch.</p>
			</div>
		</section>
	</article>
</main>
