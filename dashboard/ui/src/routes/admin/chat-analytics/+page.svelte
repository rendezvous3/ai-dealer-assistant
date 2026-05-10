<script lang="ts">
	import DashboardShellV3 from '$lib/components/dashboard-v3/DashboardShellV3.svelte';
	import InsightShellV3 from '$lib/components/insights-v3/InsightShellV3.svelte';
	import InsightCardV3 from '$lib/components/insights-v3/InsightCardV3.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	const emptyOverview = {
		total_queries: 0,
		total_sessions: 0,
		unique_users: 0,
		no_results_rate: 0,
		no_results_count: 0,
		search_sequence_count: 0,
		click_through_rate: 0,
		unresolved_rate: 0,
		strict_refusal_events: 0,
		strict_refusal_messages: 0,
		strict_refusal_sessions: 0,
		top_buckets: [] as { bucket: string; count: number }[],
		no_result_sequences: [] as any[],
		strict_refusal_samples: [] as any[],
		prev_total_queries: null as number | null,
		prev_total_sessions: null as number | null,
		prev_no_results_rate: null as number | null,
		prev_click_through_rate: null as number | null,
		prev_unresolved_rate: null as number | null
	};

	let overview = { ...emptyOverview };
	let buckets: string[] = [];
	let loading = true;

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
		const filterParams = new URLSearchParams();
		if (filters.search) filterParams.set('search', filters.search);
		if (filters.bucket) filterParams.set('bucket', filters.bucket);
		if (filters.unresolvedOnly) filterParams.set('unresolved_only', 'true');
		if (filters.startedAfter) filterParams.set('started_after', filters.startedAfter);
		if (filters.startedBefore) filterParams.set('started_before', filters.startedBefore);
		if (lane) filterParams.set('lane', lane);
		const qs = filterParams.toString();

		try {
			const [ovRes, bRes] = await Promise.all([
				fetch(`/admin/chat-analytics/_api/overview${qs ? `?${qs}` : ''}`)
					.then((r) => (r.ok ? r.json() : null))
					.catch(() => null),
				fetch(`/admin/chat-analytics/_api/buckets${lane ? `?lane=${lane}` : ''}`)
					.then((r) => (r.ok ? r.json() : null))
					.catch(() => null)
			]);
			overview = ovRes ?? { ...emptyOverview };
			if (!overview.top_buckets) overview.top_buckets = [];
			buckets = bRes?.buckets ?? [];
		} catch {
			overview = { ...emptyOverview };
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

	function applyFilters(overrides: Record<string, string | boolean> = {}) {
		const p = new URLSearchParams();
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
		const qs = p.toString();
		goto(`/admin/chat-analytics${qs ? `?${qs}` : ''}`);
	}

	function noResultsTone(rate: number): 'default' | 'green' | 'yellow' | 'red' {
		if (rate >= 30) return 'red';
		if (rate >= 15) return 'yellow';
		return 'green';
	}

	function ctrTone(rate: number): 'default' | 'green' | 'yellow' | 'red' {
		if (rate >= 40) return 'green';
		if (rate >= 20) return 'yellow';
		return 'red';
	}

	function unresolvedTone(rate: number): 'default' | 'green' | 'yellow' | 'red' {
		if (rate >= 25) return 'red';
		if (rate >= 10) return 'yellow';
		return 'green';
	}

	function refusalTone(count: number): 'default' | 'green' | 'yellow' | 'red' {
		return count > 0 ? 'yellow' : 'green';
	}

	function fmtDelta(current: number, previous: number | null | undefined): string {
		if (previous == null) return '';
		const diff = current - previous;
		if (Math.abs(diff) < 0.05) return '— 0%';
		const arrow = diff > 0 ? '▲' : '▼';
		return `${arrow} ${Math.abs(diff).toFixed(1)}%`;
	}

	function fmtQueryDelta(current: number, previous: number | null | undefined): string {
		if (previous == null) return '';
		const diff = current - previous;
		if (diff === 0) return '— 0';
		const arrow = diff > 0 ? '▲' : '▼';
		return `${arrow} ${Math.abs(diff).toLocaleString()} vs prior period`;
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

	function truncateId(id: string | null | undefined): string {
		if (!id) return '—';
		return id.length > 12 ? `${id.slice(0, 12)}...` : id;
	}

	function overviewReturnHref(): string {
		const p = new URLSearchParams();
		if (filters.search) p.set('search', filters.search);
		if (filters.bucket) p.set('bucket', filters.bucket);
		if (filters.unresolvedOnly) p.set('unresolved_only', 'true');
		if (filters.startedAfter) p.set('started_after', filters.startedAfter);
		if (filters.startedBefore) p.set('started_before', filters.startedBefore);
		p.set('lane', lane);
		const qs = p.toString();
		return `/admin/chat-analytics${qs ? `?${qs}` : ''}`;
	}

	function sessionDetailHref(id: string | null | undefined): string {
		if (!id) return '';
		const params = new URLSearchParams();
		params.set('lane', lane);
		params.set('return_to', overviewReturnHref());
		params.set('return_label', 'Overview');
		return `/admin/chat-analytics/sessions/${encodeURIComponent(id)}?${params}`;
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
	<div class="mb-6 flex gap-1 border-b border-white/[0.07]">
		<div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Overview</div>
		<a
			href="/admin/chat-analytics/queries?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white"
		>
			Queries
		</a>
		<a
			href="/admin/chat-analytics/unresolved?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white"
		>
			Unresolved
		</a>
		<a
			href="/admin/chat-analytics/products?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white"
		>
			Products
		</a>
		<a
			href="/admin/chat-analytics/sessions?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white"
		>
			Sessions
		</a>
		<a
			href="/admin/chat-analytics/guided-flow?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white"
		>
			Guided Flow
		</a>
		<a
			href="/admin/chat-analytics/compliance?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white"
		>
			Compliance
		</a>
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

		<!-- Custom bucket dropdown -->
		<div class="relative">
			<button
				on:click|stopPropagation={() => {
				bucketOpen = !bucketOpen;
			}}
				class="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] transition hover:border-white/[0.15]"
			>
				<span class={filters.bucket ? 'text-[#f5f5f5]' : 'text-[#525252]'}>
					{filters.bucket || 'All Buckets'}
				</span>
				<svg
					class="h-3 w-3 text-[#525252]"
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path d="M3 4.5 L6 7.5 L9 4.5" />
				</svg>
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

		<!-- Custom toggle for unresolved only -->
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
						stroke-width="1.5"
					>
						<path d="M2 5 L4 7 L8 3" />
					</svg>
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
				class="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#f5f5f5] [color-scheme:dark] outline-none focus:border-white/[0.15]"
			/>
			<span class="text-xs text-[#525252]">–</span>
			<input
				type="date"
				value={filters.startedBefore}
				on:change={(e) => applyFilters({ startedBefore: e.currentTarget.value })}
				class="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#f5f5f5] [color-scheme:dark] outline-none focus:border-white/[0.15]"
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
			>
				Clear
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="flex items-center justify-center gap-3 py-16 text-sm text-[#737373]">
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
			Loading analytics…
		</div>
	{:else}
		<!-- KPI cards -->
		<InsightShellV3
			title="Search KPIs"
			caption="Search outcomes; compliance refusals are separated"
			cols={5}
		>
			<InsightCardV3
				label="Unique Users"
				value={overview.unique_users.toLocaleString()}
				sub="distinct browsers"
			/>
			<InsightCardV3
				label="Sessions"
				value={overview.total_sessions.toLocaleString()}
				sub={overview.prev_total_sessions != null
					? fmtQueryDelta(overview.total_sessions, overview.prev_total_sessions)
					: 'total chat sessions'}
			/>
			<InsightCardV3
				label="Total Queries"
				value={overview.total_queries.toLocaleString()}
				sub={fmtQueryDelta(overview.total_queries, overview.prev_total_queries)}
			/>
			<InsightCardV3
				label="No Product Match"
				value="{overview.no_results_rate}%"
				sub={`${overview.no_results_count.toLocaleString()} / ${overview.search_sequence_count.toLocaleString()} search sequences${overview.prev_no_results_rate != null ? ` · ${fmtDelta(overview.no_results_rate, overview.prev_no_results_rate)}` : ''}`}
				tone={noResultsTone(overview.no_results_rate)}
			/>
			<InsightCardV3
				label="Compliance Refusals"
				value={overview.strict_refusal_messages.toLocaleString()}
				sub={`${overview.strict_refusal_events.toLocaleString()} term events / ${overview.strict_refusal_sessions.toLocaleString()} sessions`}
				tone={refusalTone(overview.strict_refusal_messages)}
			/>
			<InsightCardV3
				label="Click-Through Rate"
				value="{overview.click_through_rate}%"
				sub="{fmtDelta(
					overview.click_through_rate,
					overview.prev_click_through_rate
				)}{overview.prev_click_through_rate != null ? ' · ' : ''}clicks / impressions"
				tone={ctrTone(overview.click_through_rate)}
			/>
			<InsightCardV3
				label="Unresolved Rate"
				value="{overview.unresolved_rate}%"
				sub={fmtDelta(overview.unresolved_rate, overview.prev_unresolved_rate)}
				tone={unresolvedTone(overview.unresolved_rate)}
			/>
			<InsightCardV3
				label="Top Bucket"
				value={overview.top_buckets[0]?.bucket ?? '—'}
				sub="{overview.top_buckets[0]?.count ?? 0} queries"
			/>
		</InsightShellV3>

		<!-- Top Query Buckets mini-table -->
		<div class="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
			<div class="border-b border-white/[0.05] px-4 py-3">
				<h3 class="text-sm font-medium text-[#f5f5f5]">Top Query Buckets</h3>
			</div>
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-white/[0.05]">
						<th class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
							>Bucket</th
						>
						<th class="px-4 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
							>Queries</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/[0.04]">
					{#each overview.top_buckets as bucket}
						<tr class="transition hover:bg-white/[0.02]">
							<td class="px-4 py-3 text-[#f5f5f5]">{bucket.bucket}</td>
							<td class="px-4 py-3 text-right text-[#737373] tabular-nums">{bucket.count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="mt-6 grid gap-6 xl:grid-cols-2">
			<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
				<div class="border-b border-white/[0.05] px-4 py-3">
					<h3 class="text-sm font-medium text-[#f5f5f5]">Recent No Product Matches</h3>
				</div>
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-white/[0.05]">
							<th class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
								>Query</th
							>
							<th class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
								>Session</th
							>
							<th class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
								>Meaning</th
							>
							<th
								class="px-4 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
								>Started</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.04]">
						{#each overview.no_result_sequences ?? [] as row}
							<tr class="transition hover:bg-white/[0.02]">
								<td class="px-4 py-3 text-[#f5f5f5]">{row.query || '—'}</td>
								<td class="px-3 py-3">
									{#if row.session_id}
										<a
											href={sessionDetailHref(row.session_id)}
											class="cursor-pointer font-mono text-[#737373] transition hover:text-white"
											title={row.session_id}>{truncateId(row.session_id)}</a
										>
									{:else}
										<span class="font-mono text-[#737373]">—</span>
									{/if}
								</td>
								<td class="px-3 py-3 text-[#737373]">
									search ran; zero products
									{#if row.reasons?.length}
										<span class="ml-1 text-[#525252]">({row.reasons.join(', ')})</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right text-[#737373]">{fmtDate(row.started_at)}</td>
							</tr>
						{:else}
							<tr
								><td colspan="4" class="px-5 py-8 text-center text-sm text-[#737373]"
									>No product-match misses found</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
				<div class="border-b border-white/[0.05] px-4 py-3">
					<h3 class="text-sm font-medium text-[#f5f5f5]">Recent Compliance Refusals</h3>
				</div>
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-white/[0.05]">
							<th class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
								>Session</th
							>
							<th class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
								>Category</th
							>
							<th class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
								>Matched Stem</th
							>
							<th
								class="px-4 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
								>Occurred</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.04]">
						{#each overview.strict_refusal_samples ?? [] as row}
							<tr class="transition hover:bg-white/[0.02]">
								<td class="px-4 py-3">
									{#if row.session_id}
										<a
											href={sessionDetailHref(row.session_id)}
											class="cursor-pointer font-mono text-[#737373] transition hover:text-white"
											title={row.session_id}>{truncateId(row.session_id)}</a
										>
									{:else}
										<span class="font-mono text-[#737373]">—</span>
									{/if}
								</td>
								<td class="px-3 py-3 text-[#f5f5f5]">{row.category || '—'}</td>
								<td class="px-3 py-3 text-[#f5f5f5]">{row.matched_stem || '—'}</td>
								<td class="px-4 py-3 text-right text-[#737373]">{fmtDate(row.occurred_at)}</td>
							</tr>
						{:else}
							<tr
								><td colspan="4" class="px-5 py-8 text-center text-sm text-[#737373]"
									>No compliance refusals found</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</DashboardShellV3>
