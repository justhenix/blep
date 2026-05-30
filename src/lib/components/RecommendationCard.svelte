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

<article class="flex h-full flex-col justify-center" aria-label="BLEP recommendation">
	<header class="mb-6 flex flex-wrap items-start justify-between gap-4">
		<div>
			<h3 class="font-display text-4xl leading-none font-black uppercase sm:text-5xl">
				Build this instead.
			</h3>
		</div>
		<p
			class="stamp -rotate-2 border-2 border-ink bg-mint px-4 py-1.5 text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
		>
			{recommendation.confidence}
		</p>
	</header>

	<section class="mb-6 grid gap-3 sm:grid-cols-4" aria-label="Parsed need">
		<div class="flex flex-col border border-ink p-3 text-center">
			<span class="font-mono text-[10px] font-bold text-ink/60 uppercase">Category</span>
			<strong class="font-display text-sm">{recommendation.parsed_need.category}</strong>
		</div>
		<div class="flex flex-col border border-ink p-3 text-center">
			<span class="font-mono text-[10px] font-bold text-ink/60 uppercase">Use</span>
			<strong class="font-display text-sm">{recommendation.parsed_need.use_case}</strong>
		</div>
		<div class="flex flex-col border border-ink p-3 text-center">
			<span class="font-mono text-[10px] font-bold text-ink/60 uppercase">Budget</span>
			<strong class="font-display text-sm"
				>{formatIdr(recommendation.parsed_need.budget_idr)}</strong
			>
		</div>
		<div class="flex flex-col border border-ink p-3 text-center">
			<span class="font-mono text-[10px] font-bold text-ink/60 uppercase">Market</span>
			<strong class="font-display text-sm">{recommendation.parsed_need.market}</strong>
		</div>
	</section>

	<p class="mb-6 border-l-4 border-ink pl-4 text-lg leading-relaxed font-medium">
		{recommendation.recommendation_summary
			.replace(
				/Mock recommendation for [a-zA-Z\s]+ around [a-zA-Z0-9\s]+. Live mode adds current listing evidence./gi,
				'Mock recommendation. Exact model depends on live evidence.'
			)
			.trim()}
	</p>

	<section class="mb-6" aria-label="Target specs">
		<div class="grid gap-3 sm:grid-cols-2">
			{#each specRows as [key, value] (key)}
				<div class="flex flex-col gap-2 sm:flex-row sm:items-baseline">
					<strong class="font-mono text-sm uppercase">{labelFor(key)}:</strong>
					<span class="text-sm text-ink/80">{value}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="mb-6" aria-label="Picks">
		<h4 class="mb-3 font-mono text-[10px] font-bold text-ink/60 uppercase">Picks</h4>
		<div class="grid gap-3">
			{#each recommendation.picks as pick (pick.label + pick.name)}
				<div class="border border-ink bg-white p-4">
					<div class="mb-2 flex flex-wrap items-start justify-between gap-3">
						<div>
							<h5 class="font-display text-xl font-bold">{pick.name}</h5>
							<p class="font-mono text-[10px] font-bold text-ink/60 uppercase">
								{labelFor(pick.label)}
							</p>
						</div>
						<p class="font-mono text-xs font-bold text-ink uppercase">
							{formatIdr(pick.expected_price_idr)}
						</p>
					</div>
					<p class="text-sm leading-relaxed font-medium text-ink/80">{pick.why}</p>
					<p class="mt-1 text-[11px] leading-relaxed text-ink/60">
						{pick.caveat
							.replace(
								/Mock pick. Exact model depends on live listing evidence./gi,
								'Mock pick. Needs live check.'
							)
							.trim()}
					</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="grid gap-4 md:grid-cols-2">
		<div>
			<h4 class="mb-3 font-mono text-[10px] font-bold text-ink/60 uppercase">Avoid traps</h4>
			<div class="grid gap-3">
				{#each recommendation.avoid as trap (trap.pattern)}
					<div class="border border-ink bg-white p-4">
						<p class="font-display text-sm font-bold">{trap.pattern}</p>
						<p class="mt-1 text-[11px] leading-relaxed text-ink/60">{trap.reason}</p>
					</div>
				{/each}
			</div>
		</div>

		<div>
			<h4 class="mb-3 font-mono text-[10px] font-bold text-ink/60 uppercase">Deal rules</h4>
			<ol class="grid gap-3">
				{#each recommendation.deal_rules as rule (rule)}
					<li class="border border-ink bg-white p-4 text-sm leading-relaxed font-medium">
						{rule}
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<footer class="mt-6 border-t border-ink pt-5">
		<p class="mb-2 font-mono text-[10px] font-bold text-ink/60 uppercase">Next action</p>
		<p class="text-base leading-relaxed font-medium">{recommendation.next_action}</p>
	</footer>
</article>
