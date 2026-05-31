<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col bg-paper text-ink selection:bg-ink selection:text-paper">
	{@render children()}
</div>
