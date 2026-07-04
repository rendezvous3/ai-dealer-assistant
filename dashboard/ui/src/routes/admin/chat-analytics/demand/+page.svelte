<script lang="ts">
	import DashboardShellV3 from '$lib/components/dashboard-v3/DashboardShellV3.svelte';
	import InsightShellV3 from '$lib/components/insights-v3/InsightShellV3.svelte';
	import InsightCardV3 from '$lib/components/insights-v3/InsightCardV3.svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let rows: any[] = [];
	let rollups: any = { make: [], body_type: [], fuel_type: [], priority: [] };
	let total = 0;
	let loading = true;

	$: limit = data.limit ?? 25;
	$: offset = data.offset ?? 0;
	$: currentPage = Math.floor(offset / limit) + 1;
	$: totalPages = Math.ceil(total / limit);
	$: filters = data.filters ?? { search: '', source: '', startedAfter: '', startedBefore: '', lane: '' };
	$: lane = filters.lane || (browser ? localStorage.getItem('chat_analytics_lane') : null) || 'qa';
	let searchInput = '';
	$: searchInput = filters.search;

	async function fetchData() {
		loading = true;
		const params = new URLSearchParams();
		params.set('limit', String(limit));
		params.set('offset', String(offset));
		if (filters.search) params.set('search', filters.search);
		if (filters.source) params.set('source', filters.source);
		if (filters.startedAfter) params.set('started_after', filters.startedAfter);
		if (filters.startedBefore) params.set('started_before', filters.startedBefore);
		if (lane) params.set('lane', lane);
		try {
			const res = await fetch(`/admin/chat-analytics/_api/product-demand?${params}`);
			const json = res.ok ? await res.json() : null;
			rows = json?.demand ?? [];
			total = json?.total ?? 0;
			rollups = json?.rollups ?? rollups;
		} catch {
			rows = [];
			total = 0;
		}
		loading = false;
	}

	$: if (browser) {
		data;
		fetchData();
	}

	onMount(() => {
		if (!filters.lane) {
			const stored = localStorage.getItem('chat_analytics_lane');
			if (stored && stored !== 'qa') {
				const params = new URLSearchParams(window.location.search);
				params.set('lane', stored);
				goto(`${window.location.pathname}?${params}`, { replaceState: true });
			}
		}
	});

	function switchLane(newLane: string) {
		localStorage.setItem('chat_analytics_lane', newLane);
		const params = new URLSearchParams(window.location.search);
		params.set('lane', newLane);
		goto(`${window.location.pathname}?${params}`);
	}

	function buildParams(overrides: Record<string, string> = {}) {
		const p = new URLSearchParams();
		p.set('limit', String(limit));
		const s = overrides.search !== undefined ? overrides.search : searchInput;
		const source = overrides.source !== undefined ? overrides.source : filters.source;
		const sa = overrides.startedAfter !== undefined ? overrides.startedAfter : filters.startedAfter;
		const sb = overrides.startedBefore !== undefined ? overrides.startedBefore : filters.startedBefore;
		if (s) p.set('search', s);
		if (source) p.set('source', source);
		if (sa) p.set('started_after', sa);
		if (sb) p.set('started_before', sb);
		p.set('lane', lane);
		return p;
	}

	function applyFilters(overrides: Record<string, string> = {}) {
		const p = buildParams(overrides);
		p.set('offset', '0');
		goto(`/admin/chat-analytics/demand?${p}`);
	}

	function goPage(newOffset: number) {
		const p = buildParams();
		p.set('offset', String(newOffset));
		goto(`/admin/chat-analytics/demand?${p}`);
	}

	function fmtDate(iso: string | null | undefined) {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function topLabel(items: any[]) {
		return items?.[0]?.label ?? '—';
	}
</script>

<DashboardShellV3 pageTitle="Chat Analytics">
	<div class="mb-4 flex items-center justify-between">
		<div></div>
		<div class="flex overflow-hidden rounded-md border {lane === 'prod' ? 'border-rose-500/30' : 'border-white/[0.07]'}">
			<button on:click={() => switchLane('qa')} class="cursor-pointer px-3 py-1 text-xs {lane === 'qa' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">QA</button>
			<button on:click={() => switchLane('prod')} class="cursor-pointer border-l px-3 py-1 text-xs {lane === 'prod' ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : 'border-white/[0.07] text-[#525252]'}">PROD</button>
		</div>
	</div>

	<div class="mb-6 flex flex-wrap gap-1 border-b border-white/[0.07]">
		<a href="/admin/chat-analytics?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Overview</a>
		<div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Vehicle Demand</div>
		<a href="/admin/chat-analytics/product-lookups?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicle Lookups</a>
		<a href="/admin/chat-analytics/general-questions?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">General Questions</a>
		<a href="/admin/chat-analytics/queries?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Raw Queries</a>
		<a href="/admin/chat-analytics/unresolved?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Unresolved</a>
		<a href="/admin/chat-analytics/products?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicles</a>
		<a href="/admin/chat-analytics/sessions?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Sessions</a>
		<a href="/admin/chat-analytics/guided-flow?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Guided Flow</a>
		<a href="/admin/chat-analytics/compliance?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Compliance</a>
	</div>

	<div class="mb-6 flex flex-wrap items-center gap-3">
		<input type="text" placeholder="Search demand…" bind:value={searchInput} on:keydown={(e) => { if (e.key === 'Enter') applyFilters(); }} class="h-8 w-56 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] placeholder-[#525252] outline-none focus:border-white/[0.15]" />
		<div class="flex overflow-hidden rounded-lg border border-white/[0.07]">
			<button on:click={() => applyFilters({ source: '' })} class="h-8 cursor-pointer px-3 text-xs {filters.source === '' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">All</button>
			<button on:click={() => applyFilters({ source: 'chat' })} class="h-8 cursor-pointer border-l border-white/[0.07] px-3 text-xs {filters.source === 'chat' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">Chat</button>
			<button on:click={() => applyFilters({ source: 'guided_flow' })} class="h-8 cursor-pointer border-l border-white/[0.07] px-3 text-xs {filters.source === 'guided_flow' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">Guided</button>
		</div>
		<input type="date" value={filters.startedAfter} on:change={(e) => applyFilters({ startedAfter: e.currentTarget.value })} class="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#737373] [color-scheme:dark] outline-none focus:border-white/[0.15]" />
		<input type="date" value={filters.startedBefore} on:change={(e) => applyFilters({ startedBefore: e.currentTarget.value })} class="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#737373] [color-scheme:dark] outline-none focus:border-white/[0.15]" />
	</div>

	<InsightShellV3 title="Demand Rollups" caption="Most requested vehicle attributes" cols={4}>
		<InsightCardV3 label="Top Make" value={topLabel(rollups.make)} sub={`${rollups.make?.[0]?.count ?? 0} requests`} />
		<InsightCardV3 label="Top Body" value={topLabel(rollups.body_type)} sub={`${rollups.body_type?.[0]?.count ?? 0} requests`} />
		<InsightCardV3 label="Top Fuel" value={topLabel(rollups.fuel_type)} sub={`${rollups.fuel_type?.[0]?.count ?? 0} requests`} />
		<InsightCardV3 label="Top Priority" value={topLabel(rollups.priority)} sub={`${rollups.priority?.[0]?.count ?? 0} requests`} />
	</InsightShellV3>

	<div class="mt-7 overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead><tr class="border-b border-white/[0.05]">
					<th class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase">Demand</th>
					<th class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase">Type</th>
					<th class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase">Requests</th>
					<th class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase">Sessions</th>
					<th class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase">No Match</th>
					<th class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase">Examples</th>
					<th class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase">Last Seen</th>
				</tr></thead>
				<tbody class="divide-y divide-white/[0.04]">
					{#if loading}
						<tr><td colspan="7" class="px-5 py-12 text-center text-sm text-[#737373]">Loading vehicle demand…</td></tr>
					{:else if rows.length === 0}
						<tr><td colspan="7" class="px-5 py-12 text-center text-sm text-[#737373]">No demand data for this range.</td></tr>
					{:else}
						{#each rows as row}
							<tr class="transition hover:bg-white/[0.02]">
								<td class="px-4 py-3 text-[#f5f5f5]">{row.label}</td>
								<td class="px-3 py-3 text-[#737373]">{row.demand_type}</td>
								<td class="px-3 py-3 text-right text-[#f5f5f5]">{row.requests}</td>
								<td class="px-3 py-3 text-right text-[#737373]">{row.sessions}</td>
								<td class="px-3 py-3 text-right text-[#737373]">{row.no_match_count}</td>
								<td class="max-w-[360px] px-3 py-3 text-[#737373]">{row.example_queries?.join(' | ') || '—'}</td>
								<td class="px-3 py-3 text-right text-[#737373]">{fmtDate(row.last_seen)}</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	{#if totalPages > 1}
		<div class="mt-4 flex items-center justify-between text-xs text-[#737373]">
			<span>Page {currentPage} of {totalPages}</span>
			<div class="flex gap-2">
				<button on:click={() => goPage(Math.max(0, offset - limit))} disabled={offset === 0} class="rounded border border-white/[0.07] px-3 py-1 disabled:opacity-30">Previous</button>
				<button on:click={() => goPage(offset + limit)} disabled={offset + limit >= total} class="rounded border border-white/[0.07] px-3 py-1 disabled:opacity-30">Next</button>
			</div>
		</div>
	{/if}
</DashboardShellV3>
