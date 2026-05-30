<script lang="ts">
	import type { BlepRecommendation } from '$lib/blep/types';

	let { recommendation }: { recommendation: BlepRecommendation } = $props();

	const formatIdr = (value: number | null) =>
		value === null ? 'Not evidence-backed' : `Rp${value.toLocaleString('id-ID')}`;

	const labelFor = (value: string) =>
		value
			.split('_')
			.map((part) => part.charAt(0) + part.slice(1).toLowerCase())
			.join(' ');

	const specRows = $derived(Object.entries(recommendation.target_specs));
</script>

<article
	class="recommendation-card border border-ink bg-paper p-5 sm:p-6"
	aria-label="BLEP recommendation"
>
	<header class="flex flex-wrap items-start justify-between gap-4 border-b border-ink pb-5">
		<div>
			<p class="font-mono text-xs font-bold text-ink/60 uppercase">Recommendation</p>
			<h3 class="mt-1 font-display text-3xl font-bold">Gaming laptop shortlist</h3>
		</div>
		<p class="stamp -rotate-2 border border-ink bg-white px-5 py-2 uppercase">
			{recommendation.confidence}
		</p>
	</header>

	<section class="mt-5 grid gap-3 sm:grid-cols-4" aria-label="Parsed need">
		<div class="rec-chip">
			<span>Category</span>
			<strong>{recommendation.parsed_need.category}</strong>
		</div>
		<div class="rec-chip">
			<span>Use</span>
			<strong>{recommendation.parsed_need.use_case}</strong>
		</div>
		<div class="rec-chip">
			<span>Budget</span>
			<strong>{formatIdr(recommendation.parsed_need.budget_idr)}</strong>
		</div>
		<div class="rec-chip">
			<span>Market</span>
			<strong>{recommendation.parsed_need.market}</strong>
		</div>
	</section>

	<p class="mt-5 border-l-4 border-ink bg-white p-4 text-base leading-relaxed font-medium">
		{recommendation.recommendation_summary}
	</p>

	<section class="mt-5" aria-label="Target specs">
		<h4 class="section-label">Target specs</h4>
		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each specRows as [key, value] (key)}
				<div class="rec-chip">
					<span>{labelFor(key)}</span>
					<strong>{value}</strong>
				</div>
			{/each}
		</div>
	</section>

	<section class="mt-5" aria-label="Picks">
		<h4 class="section-label">Picks</h4>
		<div class="mt-3 grid gap-3">
			{#each recommendation.picks as pick (pick.label + pick.name)}
				<div class="border border-ink/35 bg-white p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="font-mono text-xs font-bold text-ink/55 uppercase">
								{labelFor(pick.label)}
							</p>
							<h5 class="mt-1 font-display text-xl font-bold">{pick.name}</h5>
						</div>
						<p class="font-mono text-xs font-bold text-ink/65 uppercase">
							{formatIdr(pick.expected_price_idr)}
						</p>
					</div>
					<p class="mt-3 text-sm leading-relaxed font-medium text-ink/80">{pick.why}</p>
					<p class="mt-2 text-sm leading-relaxed text-ink/65">{pick.caveat}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="mt-5 grid gap-4 md:grid-cols-2">
		<div>
			<h4 class="section-label">Avoid traps</h4>
			<div class="mt-3 grid gap-3">
				{#each recommendation.avoid as trap (trap.pattern)}
					<div class="border border-ink/35 bg-white p-4">
						<p class="font-display font-bold">{trap.pattern}</p>
						<p class="mt-1 text-sm leading-relaxed text-ink/65">{trap.reason}</p>
					</div>
				{/each}
			</div>
		</div>

		<div>
			<h4 class="section-label">Deal rules</h4>
			<ol class="mt-3 grid gap-3">
				{#each recommendation.deal_rules as rule (rule)}
					<li class="border border-ink/35 bg-white p-4 text-sm leading-relaxed font-medium">
						{rule}
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<footer class="mt-5 border-t border-ink/20 pt-5">
		<p class="font-mono text-xs font-bold text-ink/55 uppercase">Next action</p>
		<p class="mt-2 text-base leading-relaxed font-medium">{recommendation.next_action}</p>
	</footer>
</article>

<style>
	.stamp {
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.04em;
		box-shadow: 3px 3px 0 #111111;
	}

	.rec-chip {
		border: 1px solid rgba(17, 17, 17, 0.35);
		background: #ffffff;
		padding: 1rem;
		min-width: 0;
	}

	.rec-chip span,
	.section-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(17, 17, 17, 0.58);
	}

	.section-label {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.rec-chip strong {
		display: block;
		margin-top: 0.25rem;
		overflow-wrap: anywhere;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.25;
	}
</style>
