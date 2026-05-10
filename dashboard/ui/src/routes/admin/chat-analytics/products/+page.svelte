<script lang="ts">
  import DashboardShellV3 from "$lib/components/dashboard-v3/DashboardShellV3.svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  export let data: PageData;

  let products: any[] = [];
  let total = 0;
  let loading = true;

  $: limit = data.limit ?? 25;
  $: offset = data.offset ?? 0;
  $: currentPage = Math.floor(offset / limit) + 1;
  $: totalPages = Math.ceil(total / limit);
  $: sortBy = data.sortBy ?? "";
  $: sortDir = data.sortDir ?? "";
  $: filters = data.filters ?? { search: "", startedAfter: "", startedBefore: "", lane: "" };
  $: lane = filters.lane || (browser ? localStorage.getItem("chat_analytics_lane") : null) || "qa";

  async function fetchData() {
    loading = true;
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (filters.search) params.set("search", filters.search);
    if (filters.startedAfter) params.set("started_after", filters.startedAfter);
    if (filters.startedBefore) params.set("started_before", filters.startedBefore);
    if (sortBy) params.set("sort_by", sortBy);
    if (sortDir) params.set("sort_dir", sortDir);
    if (lane) params.set("lane", lane);

    try {
      const res = await fetch(`/admin/chat-analytics/_api/products?${params}`);
      if (res.ok) {
        const json = await res.json();
        products = json.products ?? [];
        total = json.total ?? 0;
      }
    } catch {
      products = [];
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
    const sb2 = overrides.sort_by !== undefined ? overrides.sort_by : sortBy;
    const sd = overrides.sort_dir !== undefined ? overrides.sort_dir : sortDir;
    if (s) p.set("search", s);
    if (sa) p.set("started_after", sa);
    if (sb) p.set("started_before", sb);
    if (sb2) p.set("sort_by", sb2);
    if (sd) p.set("sort_dir", sd);
    p.set("lane", lane);
    return p;
  }

  function toggleSort(col: string) {
    let newDir = "desc";
    if (sortBy === col) {
      newDir = sortDir === "desc" ? "asc" : "desc";
    }
    const p = buildParams({ sort_by: col, sort_dir: newDir });
    p.set("offset", "0");
    goto(`/admin/chat-analytics/products?${p}`);
  }

  function applyFilters(overrides: Record<string, string> = {}) {
    const p = buildParams(overrides);
    p.set("offset", "0");
    goto(`/admin/chat-analytics/products?${p}`);
  }

  function goPage(newOffset: number) {
    const p = buildParams();
    p.set("offset", String(newOffset));
    goto(`/admin/chat-analytics/products?${p}`);
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
  <div class="mb-6 flex gap-1 border-b border-white/[0.07]">
    <a href="/admin/chat-analytics?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Overview</a>
    <a href="/admin/chat-analytics/queries?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Queries</a>
    <a href="/admin/chat-analytics/unresolved?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Unresolved</a>
    <div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Products</div>
    <a href="/admin/chat-analytics/sessions?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Sessions</a>
    <a href="/admin/chat-analytics/guided-flow?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Guided Flow</a>
    <a href="/admin/chat-analytics/compliance?lane={lane}" class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Compliance</a>
  </div>

  <!-- Filter bar -->
  <div class="mb-6 flex flex-wrap items-center gap-3">
    <input type="text" placeholder="Search products…" bind:value={searchInput}
      on:keydown={(e) => { if (e.key === "Enter") applyFilters(); }}
      class="h-8 w-56 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] placeholder-[#525252] outline-none focus:border-white/[0.15]" />
    <div class="flex items-center gap-1.5">
      <input type="date" value={filters.startedAfter} on:change={(e) => applyFilters({ startedAfter: e.currentTarget.value })}
        class="h-8 rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#737373] uppercase outline-none focus:border-white/[0.15] cursor-pointer [color-scheme:dark]" />
      <span class="text-xs text-[#525252]">–</span>
      <input type="date" value={filters.startedBefore} on:change={(e) => applyFilters({ startedBefore: e.currentTarget.value })}
        class="h-8 rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#737373] uppercase outline-none focus:border-white/[0.15] cursor-pointer [color-scheme:dark]" />
    </div>
    {#if filters.search || filters.startedAfter || filters.startedBefore}
      <button on:click={() => { searchInput = ""; applyFilters({ search: "", startedAfter: "", startedBefore: "" }); }}
        class="h-8 rounded-lg border border-white/[0.07] px-3 text-xs text-[#737373] transition hover:border-white/[0.15] hover:text-white cursor-pointer">Clear</button>
    {/if}
  </div>

  <!-- Products table -->
  <div class="rounded-xl border border-white/[0.07] bg-[#111111] overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-white/[0.05]">
            <th class="px-4 py-2.5 text-left font-medium text-[#525252] uppercase tracking-widest">
              <button on:click={() => toggleSort("product")} class="inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-[#737373]">
                Product
                <svg class="h-3 w-3 {sortBy === 'product' ? 'text-[#737373]' : 'text-[#3a3a3a]'}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if sortBy === "product" && sortDir === "asc"}<path d="M8 12V4M4 8l4-4 4 4"/>{:else}<path d="M8 4v8M4 8l4 4 4-4"/>{/if}
                </svg>
              </button>
            </th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">
              <button on:click={() => toggleSort("mentions")} class="ml-auto inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-[#737373]">
                Mentions
                <svg class="h-3 w-3 {sortBy === 'mentions' ? 'text-[#737373]' : 'text-[#3a3a3a]'}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if sortBy === "mentions" && sortDir === "asc"}<path d="M8 12V4M4 8l4-4 4 4"/>{:else}<path d="M8 4v8M4 8l4 4 4-4"/>{/if}
                </svg>
              </button>
            </th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">
              <button on:click={() => toggleSort("clicks")} class="ml-auto inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-[#737373]">
                Clicks
                <svg class="h-3 w-3 {sortBy === 'clicks' ? 'text-[#737373]' : 'text-[#3a3a3a]'}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if sortBy === "clicks" && sortDir === "asc"}<path d="M8 12V4M4 8l4-4 4 4"/>{:else}<path d="M8 4v8M4 8l4 4 4-4"/>{/if}
                </svg>
              </button>
            </th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">
              <button on:click={() => toggleSort("external_clicks")} class="ml-auto inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-[#737373]">
                External Clicks
                <svg class="h-3 w-3 {sortBy === 'external_clicks' ? 'text-[#737373]' : 'text-[#3a3a3a]'}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if sortBy === "external_clicks" && sortDir === "asc"}<path d="M8 12V4M4 8l4-4 4 4"/>{:else}<path d="M8 4v8M4 8l4 4 4-4"/>{/if}
                </svg>
              </button>
            </th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest" title="Clicks / Mentions">
              <button on:click={() => toggleSort("ctr")} class="ml-auto inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-[#737373]">
                CTR
                <svg class="h-3 w-3 {sortBy === 'ctr' ? 'text-[#737373]' : 'text-[#3a3a3a]'}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if sortBy === "ctr" && sortDir === "asc"}<path d="M8 12V4M4 8l4-4 4 4"/>{:else}<path d="M8 4v8M4 8l4 4 4-4"/>{/if}
                </svg>
              </button>
            </th>
            <th class="px-3 py-2.5 text-right font-medium text-[#525252] uppercase tracking-widest">
              <button on:click={() => toggleSort("last_seen")} class="ml-auto inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-[#737373]">
                Last Seen
                <svg class="h-3 w-3 {sortBy === 'last_seen' ? 'text-[#737373]' : 'text-[#3a3a3a]'}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if sortBy === "last_seen" && sortDir === "asc"}<path d="M8 12V4M4 8l4-4 4 4"/>{:else}<path d="M8 4v8M4 8l4 4 4-4"/>{/if}
                </svg>
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/[0.04]">
          {#if loading}
            <tr>
              <td colspan="6" class="px-5 py-12 text-center">
                <div class="flex items-center justify-center gap-3 text-sm text-[#737373]">
                  <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.2" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  Loading products…
                </div>
              </td>
            </tr>
          {:else}
            {#each products as p}
              <tr class="transition hover:bg-white/[0.02]">
                <td class="px-4 py-3 text-[#f5f5f5]">{p.product}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{p.mentions}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{p.clicks}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{p.external_clicks}</td>
                <td class="px-3 py-3 text-right tabular-nums text-[#737373]">{p.ctr}%</td>
                <td class="px-3 py-3 text-right text-[#737373]">{fmtDate(p.last_seen)}</td>
              </tr>
            {:else}
              <tr><td colspan="6" class="px-5 py-8 text-center text-sm text-[#737373]">No products found</td></tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-4 flex items-center justify-between text-xs text-[#737373]">
      <span>{total} total products</span>
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
