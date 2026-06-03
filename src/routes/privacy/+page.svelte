<svelte:head>
	<title>Privacy | BLEP</title>
</svelte:head>

<main class="grow px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
	<article class="mx-auto w-full max-w-3xl min-w-0">
		<header class="mb-16 border-b border-ink/15 pb-8">
			<h1 class="font-display text-4xl leading-tight font-bold sm:text-5xl">Privacy Policy</h1>
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
					BLEP may send your query, source page content, and related source metadata to external
					service providers to generate hardware verdicts.
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
					BLEP may cache verdicts and source summaries for cost control, speed, and stability. Cache
					entries can include verdict JSON, source titles, source URLs, timestamps, and hashes
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
					Contact
				</h2>
				<div class="mt-4 flex flex-col gap-3">
					<a
						href="https://github.com/justhenix"
						target="_blank"
						rel="noopener noreferrer"
						class="focus-visible-ring inline-flex w-fit items-center gap-2.5 text-ink/70 transition-colors hover:text-ink"
					>
						<svg class="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill-rule="evenodd"
								clip-rule="evenodd"
								d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
							/>
						</svg>
						<span class="font-body text-base leading-relaxed sm:text-lg">github.com/justhenix</span>
					</a>
					<a
						href="https://x.com/heni0x"
						target="_blank"
						rel="noopener noreferrer"
						class="focus-visible-ring inline-flex w-fit items-center gap-2.5 text-ink/70 transition-colors hover:text-ink"
					>
						<svg class="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
							/>
						</svg>
						<span class="font-body text-base leading-relaxed sm:text-lg">x.com/heni0x</span>
					</a>
				</div>
			</div>
		</section>
	</article>
</main>
