<svelte:head>
	<title>Privacy | BLEP</title>
</svelte:head>

<main class="flex-grow px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
	<article class="mx-auto w-full max-w-3xl min-w-0">
		<header class="mb-16 border-b border-ink/15 pb-8">
			<p class="mb-4 font-mono text-xs font-bold tracking-[0.1em] text-ink/50 uppercase">
				BLEP PRIVACY
			</p>
			<h1 class="font-display text-4xl leading-tight font-bold sm:text-5xl">Privacy Policy</h1>
			<p class="mt-6 font-mono text-sm font-bold text-ink/40 uppercase">
				Draft for hackathon demo. Last updated: May 28, 2026.
			</p>
		</header>

		<section class="grid gap-10 sm:gap-12">
			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					What BLEP Processes
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					BLEP processes device/listing text you submit and optional URLs you provide so it can
					generate a hardware purchase verdict.
				</p>
			</div>

			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					Live Mode Services
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					In live mode, BLEP may send your query, source page content, and related source metadata
					to Firecrawl and Gemini. Mock mode uses local mock results and does not call those
					services.
				</p>
			</div>

			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					Quota, Cache, Abuse Data
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					Firebase/Firestore may store quota, cache, and abuse-control metadata. The backend is
					built to hash request identity for quota and abuse checks, so raw IP addresses should not
					be stored by BLEP application code.
				</p>
			</div>

			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					Caching
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					BLEP may cache verdicts and source summaries for cost control, speed, and demo stability.
					Cache entries can include verdict JSON, source titles, source URLs, timestamps, and hashes
					derived from request input.
				</p>
			</div>

			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					Data Sale
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					BLEP does not sell user data.
				</p>
			</div>

			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					Demo Disclaimer
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					BLEP is a hackathon/demo prototype. Privacy controls are kept simple for launch and should
					be reviewed before any real public production rollout.
				</p>
			</div>

			<div class="group">
				<h2
					class="mb-3 font-display text-xl font-bold transition-colors group-hover:text-ink/80 sm:text-2xl"
				>
					Contact
				</h2>
				<p class="font-body text-base leading-relaxed text-ink/70 sm:text-lg">
					Contact placeholder: replace with maintainer email or project contact before launch.
				</p>
			</div>
		</section>
	</article>
</main>
