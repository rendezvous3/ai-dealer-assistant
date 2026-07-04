<script lang="ts">
  import DashboardShellV3 from "$lib/components/dashboard-v3/DashboardShellV3.svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  export let data: PageData;

  let sessions: any[] = [];
  let total = 0;
  let loading = true;

  $: limit = data.limit ?? 25;
  $: offset = data.offset ?? 0;
  $: currentPage = Math.floor(offset / limit) + 1;
  $: totalPages = Math.ceil(total / limit);
  $: filters = data.filters ?? { search: "", startedAfter: "", startedBefore: "", browserToken: "", lane: "" };
  $: lane = filters.lane || (browser ? localStorage.getItem("chat_analytics_lane") : null) || "qa";

  async function fetchData() {
    loading = true;
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (filters.search) params.set("search", filters.search);
    if (filters.startedAfter) params.set("started_after", filters.startedAfter);
    if (filters.startedBefore) params.set("started_before", filters.startedBefore);
    if (filters.browserToken) params.set("browser_token", filters.browserToken);
    if (lane) params.set("lane", lane);

    try {
      const res = await fetch(`/admin/chat-analytics/_api/sessions?${params}`);
      if (res.ok) {
        const json = await res.json();
        sessions = json.sessions ?? [];
        total = json.total ?? 0;
      }
    } catch {
      sessions = [];
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
      const stored = localStorage.getItem("chat_analytics_lane");
      if (stored && stored !== "qa") {
        const params = new URLSearchParams(window.location.search);
        params.set("lane", stored);
        goto(`${window.location.pathname}?${params}`, { replaceState: true });
      }
    }
  });

  function switchLane(newLane: string) {
    localStorage.setItem("chat_analytics_lane", newLane);
    const params = new URLSearchParams(window.location.search);
    params.set("lane", newLane);
    goto(`${window.location.pathname}?${params}`);
  }

  let searchInput = "";
  $: searchInput = filters.search;

  function buildParams(overrides: Record<string, string> = {}): URLSearchParams {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    const s = overrides.search !== undefined ? overrides.search : searchInput;
    const sa = overrides.startedAfter !== undefined ? overrides.startedAfter : filters.startedAfter;
    const sb = overrides.startedBefore !== undefined ? overrides.startedBefore : filters.startedBefore;
    const bt = overrides.browserToken !== undefined ? overrides.browserToken : filters.browserToken;
    if (s) p.set("search", s);
    if (sa) p.set("started_after", sa);
    if (sb) p.set("started_before", sb);
    if (bt) p.set("browser_token", bt);
    p.set("lane", lane);
    return p;
  }

  function applyFilters(overrides: Record<string, string> = {}) {
    const p = buildParams(overrides);
    p.set("offset", "0");
    goto(`/admin/chat-analytics/sessions?${p}`);
  }

  function goPage(newOffset: number) {
    const p = buildParams();
    p.set("offset", String(newOffset));
    goto(`/admin/chat-analytics/sessions?${p}`);
  }

  function truncateId(id: string): string {
    return id.length > 12 ? id.slice(0, 12) + "…" : id;
  }

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }
</script>

<DashboardShellV3 pageTitle="Chat Analytics">
  <!-- Lane toggle -->
  <div class="mb-4 flex items-center justify-between">
    <div></div>
    <div class="flex overflow-hidden rounded-md border {lane === 'prod' ? 'border-rose-500/30' : 'border-white/[0.07]'}">
      <button on:click={() => switchLane('qa')}
        class="cursor-pointer px-3 py-1 text-xs {lane === 'qa' ? 'bg-[#1f1f1f] text-[#f5f5f5]' : 'text-[#525252]'}">QA</button>
      <button on:click={() => switchLane('prod')}
        class="cursor-pointer px-3 py-1 text-xs border-l {lane === 'prod' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'text-[#525252] border-white/[0.07]'}">PROD</button>
    </div>
  </div>

  <!-- Tab strip -->
  <div class="mb-6 flex flex-wrap gap-1 border-b border-white/[0.07]">
    <a href="/admin/chat-analytics?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Overview</a>
    <a href="/admin/chat-analytics/demand?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicle Demand</a>
    <a href="/admin/chat-analytics/product-lookups?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicle Lookups</a>
    <a href="/admin/chat-analytics/general-questions?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">General Questions</a>
    <a href="/admin/chat-analytics/queries?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Raw Queries</a>
    <a href="/admin/chat-analytics/unresolved?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Unresolved</a>
    <a href="/admin/chat-analytics/products?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Vehicles</a>
    <div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Sessions</div>
    <a href="/admin/chat-analytics/guided-flow?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Guided Flow</a>
    <a href="/admin/chat-analytics/compliance?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Compliance</a>
  </div>

  <!-- Filter bar -->
  <div class="mb-6 flex flex-wrap items-center gap-3">
    <input
      type="text"
      placeholder="Search sessions or queries…"
      bind:value={searchInput}
      on:keydown={(e) => { if (e.key === "Enter") applyFilters(); }}
      class="h-8 w-64 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] placeholder-[#525252] outline-none focus:border-white/[0.15]"
    />
    <input
      type="text"
      placeholder="Browser token…"
      value={filters.browserToken}
      on:change={(e) => applyFilters({ browserToken: e.currentTarget.value })}
      class="h-8 w-40 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs font-mono text-[#f5f5f5] placeholder-[#525252] outline-none focus:border-white/[0.15]"
    />
    <div class="flex items-center gap-1.5">
      <input type="date" value={filters.startedAfter} on:change={(e) => applyFilters({ startedAfter: e.currentTarget.value })}
        class="h-8 rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#f5f5f5] outline-none focus:border-white/[0.15] cursor-pointer [color-scheme:dark]" />
      <span class="text-xs text-[#525252]">–</span>
      <input type="date" value={filters.startedBefore} on:change={(e) => applyFilters({ startedBefore: e.currentTarget.value })}
        class="h-8 rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#f5f5f5] outline-none focus:border-white/[0.15] cursor-pointer [color-scheme:dark]" />
    </div>
    {#if filters.search || filters.startedAfter || filters.startedBefore || filters.browserToken}
      <button
        on:click={() => { searchInput = ""; applyFilters({ search: "", startedAfter: "", startedBefore: "", browserToken: "" }); }}
        class="h-8 rounded-lg border border-white/[0.07] px-3 text-xs text-[#737373] transition hover:border-white/[0.15] hover:text-white cursor-pointer"
      >Clear</button>
    {/if}
  </div>

  <!-- Sessions table -->
  <div class="rounded-xl border border-white/[0.07] bg-[#111111] overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-white/[0.05]">
            <th class="px-4 py-2.5 text-left font-medium text-[#525252] uppercase tracking-widest">Session ID</th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">Messages</th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">Sequences</th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">Results</th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">Clicks</th>
            <th class="px-3 py-2.5 text-center font-medium text-[#525252] uppercase tracking-widest">Reformulated</th>
            <th class="px-3 py-2.5 text-center font-medium text-[#525252] uppercase tracking-widest">Unresolved</th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">Started</th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">Last Activity</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/[0.04]">
          {#if loading}
            <tr>
              <td colspan="9" class="px-5 py-12 text-center">
                <div class="flex items-center justify-center gap-3 text-sm text-[#737373]">
                  <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  Loading sessions…
                </div>
              </td>
            </tr>
          {:else}
            {#each sessions as s}
              <tr class="cursor-pointer transition hover:bg-white/[0.02]" on:click={() => goto(`/admin/chat-analytics/sessions/${s.session_id}?lane=${lane}`)}>
                <td class="px-4 py-3 font-mono text-[#737373]" title={s.session_id}>{truncateId(s.session_id)}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{s.message_count}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{s.sequence_count}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{s.results_shown}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{s.clicks}</td>
                <td class="px-3 py-3 text-center">
                  {#if s.reformulated}<span class="text-emerald-400">✓</span>{:else}<span class="text-[#525252]">—</span>{/if}
                </td>
                <td class="px-3 py-3 text-center">
                  {#if s.exited}<span class="text-rose-400">✗</span>{:else}<span class="text-emerald-400">✓</span>{/if}
                </td>
                <td class="px-3 py-3 text-right text-[#737373]">{fmtDate(s.started_at)}</td>
                <td class="px-3 py-3 text-right text-[#737373]">{fmtDate(s.last_activity_at)}</td>
              </tr>
            {:else}
              <tr><td colspan="9" class="px-5 py-8 text-center text-sm text-[#737373]">No sessions found</td></tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-4 flex items-center justify-between text-xs text-[#737373]">
      <span>{total} total sessions</span>
      <div class="flex gap-2">
        <button disabled={offset === 0} on:click={() => goPage(Math.max(0, offset - limit))}
          class="rounded-lg border border-white/[0.07] px-3 py-1.5 transition hover:border-white/[0.15] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span class="flex items-center gap-1 px-2">
          Page
          <input type="number" value={currentPage} min="1" max={totalPages}
            on:change={(e) => { const pg = Math.max(1, Math.min(totalPages, parseInt(e.currentTarget.value) || 1)); goPage((pg - 1) * limit); }}
            class="w-12 rounded border border-white/[0.07] bg-[#141414] px-1.5 py-0.5 text-center text-xs tabular-nums text-[#f5f5f5] outline-none focus:border-white/[0.15] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          of {totalPages}
        </span>
        <button disabled={offset + limit >= total} on:click={() => goPage(offset + limit)}
          class="rounded-lg border border-white/[0.07] px-3 py-1.5 transition hover:border-white/[0.15] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  {/if}
</DashboardShellV3>
