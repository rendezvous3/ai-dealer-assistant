<script lang="ts">
	import DashboardShellV3 from '$lib/components/dashboard-v3/DashboardShellV3.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let queries: any[] = [];
	let total = 0;
	let buckets: string[] = [];
	let loading = true;

	$: limit = data.limit ?? 25;
	$: offset = data.offset ?? 0;
	$: currentPage = Math.floor(offset / limit) + 1;
	$: totalPages = Math.ceil(total / limit);
	$: filters = data.filters ?? {
		search: '',
		bucket: '',
		unresolvedOnly: false,
		startedAfter: '',
		startedBefore: '',
		lane: ''
	};
	$: lane = filters.lane || (browser ? localStorage.getItem('chat_analytics_lane') : null) || 'qa';

	async function fetchData() {
		loading = true;
		const params = new URLSearchParams();
		params.set('limit', String(limit));
		params.set('offset', String(offset));
		if (filters.search) params.set('search', filters.search);
		if (filters.bucket) params.set('bucket', filters.bucket);
		if (filters.unresolvedOnly) params.set('unresolved_only', 'true');
		if (filters.startedAfter) params.set('started_after', filters.startedAfter);
		if (filters.startedBefore) params.set('started_before', filters.startedBefore);
		if (lane) params.set('lane', lane);

		try {
			const [qRes, bRes] = await Promise.all([
				fetch(`/admin/chat-analytics/_api/queries?${params}`)
					.then((r) => (r.ok ? r.json() : null))
					.catch(() => null),
				fetch(`/admin/chat-analytics/_api/buckets${lane ? `?lane=${lane}` : ''}`)
					.then((r) => (r.ok ? r.json() : null))
					.catch(() => null)
			]);
			queries = qRes?.queries ?? [];
			total = qRes?.total ?? 0;
			buckets = bRes?.buckets ?? [];
		} catch {
			queries = [];
			total = 0;
			buckets = [];
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

	let searchInput = '';
	$: searchInput = filters.search;

	let bucketOpen = false;

	function buildParams(overrides: Record<string, string | boolean> = {}): URLSearchParams {
		const p = new URLSearchParams();
		p.set('limit', String(limit));
		const s = overrides.search !== undefined ? String(overrides.search) : searchInput;
		const b = overrides.bucket !== undefined ? String(overrides.bucket) : filters.bucket;
		const u =
			overrides.unresolvedOnly !== undefined ? overrides.unresolvedOnly : filters.unresolvedOnly;
		const sa =
			overrides.startedAfter !== undefined ? String(overrides.startedAfter) : filters.startedAfter;
		const sb =
			overrides.startedBefore !== undefined
				? String(overrides.startedBefore)
				: filters.startedBefore;
		if (s) p.set('search', s);
		if (b) p.set('bucket', b);
		if (u) p.set('unresolved_only', 'true');
		if (sa) p.set('started_after', sa);
		if (sb) p.set('started_before', sb);
		p.set('lane', lane);
		return p;
	}

	function applyFilters(overrides: Record<string, string | boolean> = {}) {
		const p = buildParams(overrides);
		p.set('offset', '0');
		goto(`/admin/chat-analytics/queries?${p}`);
	}

	function goPage(newOffset: number) {
		const p = buildParams();
		p.set('offset', String(newOffset));
		goto(`/admin/chat-analytics/queries?${p}`);
	}

	function fmtDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:window
	on:click={() => {
		bucketOpen = false;
	}}
/>

<DashboardShellV3 pageTitle="Chat Analytics">
	<!-- Lane toggle -->
	<div class="mb-4 flex items-center justify-between">
		<div></div>
		<div
			class="flex overflow-hidden rounded-md border {lane === 'prod'
				? 'border-rose-500/30'
				: 'border-white/[0.07]'}"
		>
			<button
				on:click={() => switchLane('qa')}
				class="cursor-pointer px-3 py-1 text-xs {lane === 'qa'
					? 'bg-[#1f1f1f] text-[#f5f5f5]'
					: 'text-[#525252]'}">QA</button
			>
			<button
				on:click={() => switchLane('prod')}
				class="cursor-pointer border-l px-3 py-1 text-xs {lane === 'prod'
					? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
					: 'border-white/[0.07] text-[#525252]'}">PROD</button
			>
		</div>
	</div>

	<!-- Tab strip -->
	<div class="mb-6 flex flex-wrap gap-1 border-b border-white/[0.07]">
		<a
			href="/admin/chat-analytics?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Overview</a
		>
		<a
			href="/admin/chat-analytics/demand?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicle Demand</a
		>
		<a
			href="/admin/chat-analytics/product-lookups?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicle Lookups</a
		>
		<a
			href="/admin/chat-analytics/general-questions?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">General Questions</a
		>
		<div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Raw Queries</div>
		<a
			href="/admin/chat-analytics/unresolved?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Unresolved</a
		>
		<a
			href="/admin/chat-analytics/products?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicles</a
		>
		<a
			href="/admin/chat-analytics/sessions?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Sessions</a
		>
		<a
			href="/admin/chat-analytics/guided-flow?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Guided Flow</a
		>
		<a
			href="/admin/chat-analytics/compliance?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Compliance</a
		>
	</div>

	<!-- Filter bar -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<input
			type="text"
			placeholder="Search queries…"
			bind:value={searchInput}
			on:keydown={(e) => {
				if (e.key === 'Enter') applyFilters();
			}}
			class="h-8 w-48 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] placeholder-[#525252] outline-none focus:border-white/[0.15]"
		/>
		<!-- Bucket dropdown -->
		<div class="relative">
			<button
				on:click|stopPropagation={() => {
				bucketOpen = !bucketOpen;
			}}
				class="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] transition hover:border-white/[0.15]"
			>
				<span class={filters.bucket ? 'text-[#f5f5f5]' : 'text-[#525252]'}
					>{filters.bucket || 'All Buckets'}</span
				>
				<svg
					class="h-3 w-3 text-[#525252]"
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"><path d="M3 4.5 L6 7.5 L9 4.5" /></svg
				>
			</button>
			{#if bucketOpen}
				<div
					class="absolute top-full left-0 z-20 mt-1 min-w-[180px] rounded-lg border border-white/[0.07] bg-[#141414] py-1 shadow-lg shadow-black/40"
				>
					<button
						on:click={() => {
							bucketOpen = false;
							applyFilters({ bucket: '' });
						}}
						class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.04] {filters.bucket ===
						''
							? 'text-[#f5f5f5]'
							: 'text-[#737373]'}"
					>
						{#if filters.bucket === ''}<span class="text-[#f5f5f5]">✓</span>{:else}<span class="w-3"
							></span>{/if}
						All Buckets
					</button>
					{#each buckets as b}
						<button
							on:click={() => {
								bucketOpen = false;
								applyFilters({ bucket: b });
							}}
							class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.04] {filters.bucket ===
							b
								? 'text-[#f5f5f5]'
								: 'text-[#737373]'}"
						>
							{#if filters.bucket === b}<span class="text-[#f5f5f5]">✓</span>{:else}<span
									class="w-3"
								></span>{/if}
							{b}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<!-- Unresolved toggle -->
		<button
			on:click={() => applyFilters({ unresolvedOnly: !filters.unresolvedOnly })}
			class="flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs transition
        {filters.unresolvedOnly
				? 'border-white/[0.15] bg-white/[0.06] text-[#f5f5f5]'
				: 'border-white/[0.07] bg-[#141414] text-[#525252] hover:border-white/[0.15] hover:text-[#737373]'}"
		>
			<span
				class="flex h-3.5 w-3.5 items-center justify-center rounded border {filters.unresolvedOnly
					? 'border-white/[0.3] bg-white/[0.1]'
					: 'border-white/[0.1]'}"
			>
				{#if filters.unresolvedOnly}
					<svg
						class="h-2.5 w-2.5 text-[#f5f5f5]"
						viewBox="0 0 10 10"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"><path d="M2 5 L4 7 L8 3" /></svg
					>
				{/if}
			</span>
			Unresolved only
		</button>
		<!-- Date range -->
		<div class="flex items-center gap-1.5">
			<input
				type="date"
				value={filters.startedAfter}
				on:change={(e) => applyFilters({ startedAfter: e.currentTarget.value })}
				class="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#737373] uppercase [color-scheme:dark] outline-none focus:border-white/[0.15]"
			/>
			<span class="text-xs text-[#525252]">–</span>
			<input
				type="date"
				value={filters.startedBefore}
				on:change={(e) => applyFilters({ startedBefore: e.currentTarget.value })}
				class="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#737373] uppercase [color-scheme:dark] outline-none focus:border-white/[0.15]"
			/>
		</div>
		{#if filters.search || filters.bucket || filters.unresolvedOnly || filters.startedAfter || filters.startedBefore}
			<button
				on:click={() => {
					searchInput = '';
					applyFilters({
						search: '',
						bucket: '',
						unresolvedOnly: false,
						startedAfter: '',
						startedBefore: ''
					});
				}}
				class="h-8 cursor-pointer rounded-lg border border-white/[0.07] px-3 text-xs text-[#737373] transition hover:border-white/[0.15] hover:text-white"
				>Clear</button
			>
		{/if}
	</div>

	<!-- Queries table -->
	<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
		<div class="overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-white/[0.05]">
						<th
							class="px-4 py-2.5 text-left font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>Query</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>Searches</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>Results Shown</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>Clicks</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							title="Clicks / Results Shown">CTR</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>No Vehicle Match</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>Unresolved</th
						>
						<th
							class="px-3 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase"
							>Last Seen</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/[0.04]">
					{#if loading}
						<tr>
							<td colspan="8" class="px-5 py-12 text-center">
								<div class="flex items-center justify-center gap-3 text-sm text-[#737373]">
									<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
										<circle
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="2"
											stroke-opacity="0.2"
										/>
										<path
											d="M12 2a10 10 0 0 1 10 10"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
										/>
									</svg>
									Loading queries…
								</div>
							</td>
						</tr>
					{:else}
						{#each queries as q}
							<tr class="transition hover:bg-white/[0.02]">
								<td class="px-4 py-3 text-[#f5f5f5]">{q.query}</td>
								<td class="px-3 py-3 text-right text-[#737373] tabular-nums">{q.searches}</td>
								<td class="px-3 py-3 text-right text-[#737373] tabular-nums">{q.results_shown}</td>
								<td class="px-3 py-3 text-right text-[#737373] tabular-nums">{q.clicks}</td>
								<td class="px-3 py-3 text-right text-[#737373] tabular-nums">{q.ctr}%</td>
								<td
									class="px-3 py-3 text-right tabular-nums {q.no_results_count > 0
										? 'text-rose-400'
										: 'text-[#525252]'}">{q.no_results_count}</td
								>
								<td
									class="px-3 py-3 text-right tabular-nums {q.unresolved_count > 0
										? 'text-yellow-400'
										: 'text-[#525252]'}">{q.unresolved_count}</td
								>
								<td class="px-3 py-3 text-right text-[#737373]">{fmtDate(q.last_seen)}</td>
							</tr>
						{:else}
							<tr
								><td colspan="8" class="px-5 py-8 text-center text-sm text-[#737373]"
									>No queries found</td
								></tr
							>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="mt-4 flex items-center justify-between text-xs text-[#737373]">
			<span>{total} total queries</span>
			<div class="flex gap-2">
				<button
					disabled={offset === 0}
					on:click={() => goPage(Math.max(0, offset - limit))}
					class="rounded-lg border border-white/[0.07] px-3 py-1.5 transition hover:border-white/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
					>Previous</button
				>
				<span class="flex items-center gap-1 px-2">
					Page
					<input
						type="number"
						value={currentPage}
						min="1"
						max={totalPages}
						on:change={(e) => {
							const pg = Math.max(1, Math.min(totalPages, parseInt(e.currentTarget.value) || 1));
							goPage((pg - 1) * limit);
						}}
						class="w-12 [appearance:textfield] rounded border border-white/[0.07] bg-[#141414] px-1.5 py-0.5 text-center text-xs text-[#f5f5f5] tabular-nums outline-none focus:border-white/[0.15] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					/>
					of {totalPages}
				</span>
				<button
					disabled={offset + limit >= total}
					on:click={() => goPage(offset + limit)}
					class="rounded-lg border border-white/[0.07] px-3 py-1.5 transition hover:border-white/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
					>Next</button
				>
			</div>
		</div>
	{/if}
</DashboardShellV3>
