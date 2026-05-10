<script lang="ts">
	import DashboardShellV3 from '$lib/components/dashboard-v3/DashboardShellV3.svelte';
	import InsightShellV3 from '$lib/components/insights-v3/InsightShellV3.svelte';
	import InsightCardV3 from '$lib/components/insights-v3/InsightCardV3.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let events: any[] = [];
	let querySummary: any[] = [];
	let summary = { submitted: 0, completed: 0, completion_rate: 0, unique_sessions: 0 };
	let eventsTotal = 0;
	let loading = true;

	$: limit = data.limit ?? 25;
	$: offset = data.offset ?? 0;
	$: currentPage = Math.floor(offset / limit) + 1;
	$: filters = data.filters ?? { search: '', startedAfter: '', startedBefore: '', lane: '', tab: 'events', eventType: '' };
	$: lane = filters.lane || (browser ? localStorage.getItem('chat_analytics_lane') : null) || 'qa';
	$: activeTab = filters.tab === 'queries' ? 'queries' : 'events';
	$: activeTotal = activeTab === 'events' ? eventsTotal : querySummary.length;
	$: totalPages = Math.ceil(activeTotal / limit);

	async function fetchData() {
		loading = true;
		const params = new URLSearchParams();
		params.set('limit', String(limit));
		params.set('offset', String(offset));
		if (filters.search) params.set('search', filters.search);
		if (filters.startedAfter) params.set('started_after', filters.startedAfter);
		if (filters.startedBefore) params.set('started_before', filters.startedBefore);
		if (filters.eventType) params.set('event_type', filters.eventType);
		if (lane) params.set('lane', lane);

		try {
			const res = await fetch(`/admin/chat-analytics/_api/guided-flow?${params}`)
				.then((r) => (r.ok ? r.json() : null))
				.catch(() => null);
			events = res?.events ?? [];
			querySummary = res?.query_summary ?? [];
			summary = res?.summary ?? { submitted: 0, completed: 0, completion_rate: 0, unique_sessions: 0 };
			eventsTotal = res?.events_total ?? 0;
		} catch {
			events = [];
			querySummary = [];
			summary = { submitted: 0, completed: 0, completion_rate: 0, unique_sessions: 0 };
			eventsTotal = 0;
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

	function buildParams(overrides: Record<string, string> = {}): URLSearchParams {
		const p = new URLSearchParams();
		p.set('limit', String(limit));
		const s = overrides.search !== undefined ? overrides.search : searchInput;
		const sa = overrides.startedAfter !== undefined ? overrides.startedAfter : filters.startedAfter;
		const sb = overrides.startedBefore !== undefined ? overrides.startedBefore : filters.startedBefore;
		const tab = overrides.tab !== undefined ? overrides.tab : activeTab;
		const eventType = overrides.eventType !== undefined ? overrides.eventType : filters.eventType;
		if (s) p.set('search', s);
		if (sa) p.set('started_after', sa);
		if (sb) p.set('started_before', sb);
		if (tab) p.set('tab', tab);
		if (eventType) p.set('event_type', eventType);
		p.set('lane', lane);
		return p;
	}

	function applyFilters(overrides: Record<string, string> = {}) {
		const p = buildParams(overrides);
		p.set('offset', '0');
		goto(`/admin/chat-analytics/guided-flow?${p}`);
	}

	function goPage(newOffset: number) {
		const p = buildParams();
		p.set('offset', String(newOffset));
		goto(`/admin/chat-analytics/guided-flow?${p}`);
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

	function sessionDetailHref(id: string | null | undefined): string {
		if (!id) return '';
		const params = new URLSearchParams();
		params.set('lane', lane);
		params.set('return_to', `/admin/chat-analytics/guided-flow?lane=${lane}`);
		params.set('return_label', 'Guided Flow');
		return `/admin/chat-analytics/sessions/${encodeURIComponent(id)}?${params}`;
	}

	function eventLabel(type: string): string {
		if (type === 'guided_flow_submitted') return 'submitted';
		if (type === 'guided_flow_completed') return 'completed';
		return type || '—';
	}

	$: totalFlows = summary.submitted ?? 0;
	$: completedFlows = summary.completed ?? 0;
	$: completionRate = summary.completion_rate ?? 0;
	$: uniqueFlowSessions = summary.unique_sessions ?? 0;
</script>

<DashboardShellV3 pageTitle="Chat Analytics">
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

	<div class="mb-6 flex gap-1 border-b border-white/[0.07]">
		<a href="/admin/chat-analytics?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Overview</a>
		<a href="/admin/chat-analytics/queries?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Queries</a>
		<a href="/admin/chat-analytics/unresolved?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Unresolved</a>
		<a href="/admin/chat-analytics/products?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Products</a>
		<a href="/admin/chat-analytics/sessions?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Sessions</a>
		<div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Guided Flow</div>
		<a href="/admin/chat-analytics/compliance?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Compliance</a>
	</div>

	{#if loading}
		<div class="flex items-center justify-center gap-3 py-16 text-sm text-[#737373]">
			<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.2" />
				<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			</svg>
			Loading guided flow analytics…
		</div>
	{:else}
		<InsightShellV3 title="Guided Flow Summary" caption="Wine discovery via guided flow steps" cols={4}>
			<InsightCardV3 label="Submitted" value={totalFlows.toLocaleString()} sub="completed forms" />
			<InsightCardV3 label="Completed" value={completedFlows.toLocaleString()} sub="results returned" />
			<InsightCardV3 label="Completion Rate" value={`${completionRate}%`} sub="submitted to results" tone={completionRate >= 80 || totalFlows === 0 ? 'green' : 'yellow'} />
			<InsightCardV3 label="Unique Sessions" value={uniqueFlowSessions.toLocaleString()} sub="sessions with submissions" />
		</InsightShellV3>

		<div class="mt-7 flex gap-6 border-b border-white/[0.07]">
			<button
				on:click={() => applyFilters({ tab: 'events' })}
				class="cursor-pointer border-b-2 px-1 pb-3 text-sm font-medium transition {activeTab === 'events'
					? 'border-white text-white'
					: 'border-transparent text-[#737373] hover:text-white'}">Events</button>
			<button
				on:click={() => applyFilters({ tab: 'queries', eventType: '' })}
				class="cursor-pointer border-b-2 px-1 pb-3 text-sm font-medium transition {activeTab === 'queries'
					? 'border-white text-white'
					: 'border-transparent text-[#737373] hover:text-white'}">Queries</button>
		</div>

		<div class="mt-6 flex flex-wrap items-center gap-3">
			{#if activeTab === 'events'}
				<div class="flex overflow-hidden rounded-lg border border-white/[0.07]">
					<button on:click={() => applyFilters({ eventType: '', tab: 'events' })} class="h-8 cursor-pointer px-3 text-xs {filters.eventType === '' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">All</button>
					<button on:click={() => applyFilters({ eventType: 'guided_flow_submitted', tab: 'events' })} class="h-8 cursor-pointer border-l border-white/[0.07] px-3 text-xs {filters.eventType === 'guided_flow_submitted' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">Submitted</button>
					<button on:click={() => applyFilters({ eventType: 'guided_flow_completed', tab: 'events' })} class="h-8 cursor-pointer border-l border-white/[0.07] px-3 text-xs {filters.eventType === 'guided_flow_completed' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">Completed</button>
				</div>
			{/if}
			<input
				type="text"
				placeholder={activeTab === 'events' ? 'Search event query…' : 'Search guided queries…'}
				bind:value={searchInput}
				on:keydown={(e) => { if (e.key === 'Enter') applyFilters(); }}
				class="h-8 w-56 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] placeholder-[#525252] outline-none focus:border-white/[0.15]"
			/>
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
			{#if filters.search || filters.startedAfter || filters.startedBefore || filters.eventType}
				<button
					on:click={() => {
						searchInput = '';
						applyFilters({ search: '', startedAfter: '', startedBefore: '', eventType: '' });
					}}
					class="h-8 cursor-pointer rounded-lg border border-white/[0.07] px-3 text-xs text-[#737373] transition hover:border-white/[0.15] hover:text-white"
				>Clear</button>
			{/if}
		</div>

		<div class="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					{#if activeTab === 'events'}
						<thead>
							<tr class="border-b border-white/[0.05]">
								<th class="px-4 py-2.5 text-left font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase">Event</th>
								<th class="px-4 py-2.5 text-left font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase">Session</th>
								<th class="px-4 py-2.5 text-right font-medium tracking-widest whitespace-nowrap text-[#525252] uppercase">Occurred</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.04]">
							{#each events as ev}
								<tr class="transition hover:bg-white/[0.02]">
									<td class="px-4 py-3">
										<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium {ev.event_type === 'guided_flow_completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}">
											{eventLabel(ev.event_type)}
										</span>
									</td>
									<td class="px-4 py-3">
										{#if ev.session_id}
											<a href={sessionDetailHref(ev.session_id)} class="cursor-pointer font-mono text-[#737373] transition hover:text-white" title={ev.session_id}>{truncateId(ev.session_id)}</a>
										{:else}
											<span class="font-mono text-[#737373]">—</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-right text-[#737373]">{fmtDate(ev.occurred_at)}</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="px-5 py-8 text-center text-sm text-[#737373]">No guided flow events found</td></tr>
							{/each}
						</tbody>
					{:else}
						<thead>
							<tr class="border-b border-white/[0.05]">
								<th class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase">Query</th>
								<th class="px-4 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase">Submissions</th>
								<th class="px-4 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase">Last Seen</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.04]">
							{#each querySummary as row}
								<tr class="transition hover:bg-white/[0.02]">
									<td class="px-4 py-3 text-[#f5f5f5]">{row.query}</td>
									<td class="px-4 py-3 text-right text-[#737373] tabular-nums">{row.count}</td>
									<td class="px-4 py-3 text-right text-[#737373]">{fmtDate(row.last_seen)}</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="px-5 py-8 text-center text-sm text-[#737373]">No guided flow queries found</td></tr>
							{/each}
						</tbody>
					{/if}
				</table>
			</div>
		</div>

		{#if totalPages > 1}
			<div class="mt-4 flex items-center justify-between text-xs text-[#737373]">
				<span>{activeTotal} total {activeTab === 'events' ? 'events' : 'queries'}</span>
				<div class="flex gap-2">
					<button disabled={offset === 0} on:click={() => goPage(Math.max(0, offset - limit))} class="rounded-lg border border-white/[0.07] px-3 py-1.5 transition hover:border-white/[0.15] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
					<span class="flex items-center gap-1 px-2">
						Page
						<input type="number" value={currentPage} min="1" max={totalPages} on:change={(e) => { const pg = Math.max(1, Math.min(totalPages, parseInt(e.currentTarget.value) || 1)); goPage((pg - 1) * limit); }} class="w-12 [appearance:textfield] rounded border border-white/[0.07] bg-[#141414] px-1.5 py-0.5 text-center text-xs text-[#f5f5f5] tabular-nums outline-none focus:border-white/[0.15] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
						of {totalPages}
					</span>
					<button disabled={offset + limit >= activeTotal} on:click={() => goPage(offset + limit)} class="rounded-lg border border-white/[0.07] px-3 py-1.5 transition hover:border-white/[0.15] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
				</div>
			</div>
		{/if}
	{/if}
</DashboardShellV3>
