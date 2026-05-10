<script lang="ts">
	import DashboardShellV3 from '$lib/components/dashboard-v3/DashboardShellV3.svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	export let data: PageData;

	$: lane = data.lane || (browser ? localStorage.getItem('chat_analytics_lane') : null) || 'qa';
	$: sessionId = data.sessionId;
	$: backHref = data.returnTo || `/admin/chat-analytics/sessions?lane=${lane}`;
	$: backLabel = data.returnLabel || 'Sessions';

	let detail: any = null;
	let loading = true;
	let loadError = '';
	let lastFetchKey = '';

	$: if (browser && sessionId) {
		const key = `${lane}:${sessionId}`;
		if (key !== lastFetchKey) {
			lastFetchKey = key;
			void fetchSessionDetail(key);
		}
	}

	$: session = detail?.session ?? null;
	$: messages = detail?.messages ?? [];
	$: events = detail?.events ?? [];

	async function fetchSessionDetail(fetchKey: string) {
		loading = true;
		loadError = '';
		detail = null;
		const params = lane ? `?lane=${encodeURIComponent(lane)}` : '';
		try {
			const res = await fetch(`/admin/chat-analytics/_api/sessions/${encodeURIComponent(sessionId)}${params}`);
			if (!res.ok) throw new Error(`Request failed with ${res.status}`);
			const json = await res.json();
			if (fetchKey !== lastFetchKey) return;
			detail = json ?? { session: null, messages: [], events: [] };
		} catch (error) {
			if (fetchKey !== lastFetchKey) return;
			loadError = error instanceof Error ? error.message : 'Unable to load session.';
			detail = { session: null, messages: [], events: [] };
		} finally {
			if (fetchKey === lastFetchKey) loading = false;
		}
	}

	// Group events by message_id for inline display
	$: eventsByMsg = events.reduce(
		(acc: Record<string, typeof events>, e: any) => {
			const mid = e.message_id || '__session__';
			(acc[mid] = acc[mid] || []).push(e);
			return acc;
		},
		{} as Record<string, typeof events>
	);

	function fmtDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function fmtShortDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function statusColor(status: string): string {
		if (status === 'success' || status === 'ok') return 'text-emerald-400';
		if (status === 'fallback' || status === 'error') return 'text-rose-400';
		return 'text-[#737373]';
	}

	function eventFilterHref(ev: any): string {
		const params = new URLSearchParams();
		params.set('limit', '25');
		params.set('event_type', ev.event_type || 'compliance_refusal_strict');
		params.set('lane', lane);
		params.set('offset', '0');
		if (sessionId) params.set('session_id', sessionId);
		return `/admin/chat-analytics/compliance?${params}`;
	}

	function eventPayloadItems(ev: any): { label: string; value: string }[] {
		const payload = ev.payload ?? {};
		const items: { label: string; value: string }[] = [];
		const add = (label: string, value: unknown) => {
			if (value === null || value === undefined || value === '') return;
			items.push({ label, value: String(value) });
		};

		if (ev.event_type === 'compliance_near_miss') {
			add('token', payload.token_stem);
			add('nearest', payload.nearest_stem);
			add('distance', payload.score);
			return items;
		}

		if (ev.event_type === 'age_gate_bypass_detected') {
			add('violation', payload.violation);
			add('first message', payload.first_message_at);
			add('gate rendered', payload.age_gate_rendered_at);
			add('confirmed', payload.age_confirmed_at);
			add('declined', payload.age_declined_at);
			return items;
		}

		if (
			ev.event_type === 'compliance_refusal_strict' ||
			ev.event_type === 'compliance_disclaimer_attached' ||
			ev.event_type === 'bot_output_therapeutic_drift'
		) {
			add('category', payload.category);
			add('stem', payload.matched_stem);
			add('tier', payload.tier);
			add('layer', payload.layer);
			add('score', payload.score);
			return items;
		}

		if (ev.event_type === 'bot_output_slang_sanitized') {
			add('replacements', payload.replacement_count);
			if (Array.isArray(payload.terms)) {
				add('terms', payload.terms.map((term: any) => `${term.term}:${term.count}`).join(', '));
			}
			return items;
		}

		if (ev.event_type === 'warning_rendered') {
			add('warning', payload.warning_index);
		}
		return items;
	}
</script>

<DashboardShellV3 pageTitle="Session Detail">
	<!-- Back nav -->
	<div class="mb-5 flex items-center gap-4">
		<a
			href={backHref}
			class="cursor-pointer text-sm text-[#525252] transition hover:text-[#737373]"
		>
			← {backLabel}
		</a>
		{#if lane === 'prod'}
			<span
				class="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400"
				>PROD</span
			>
		{:else}
			<span class="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#525252]"
				>QA</span
			>
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
			Loading session…
		</div>
	{:else if !session}
		<div
			class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-12 text-center text-sm text-[#525252]"
		>
			{loadError || 'Session not found.'}
		</div>
	{:else}
		<!-- Session header card -->
		<div class="mb-6 rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-4">
			<div class="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs">
				<div>
					<span class="text-[#525252]">Session</span>
					<span class="ml-1.5 font-mono text-[#f5f5f5]">{session.session_id}</span>
				</div>
				<div>
					<span class="text-[#525252]">Messages</span>
					<span class="ml-1.5 text-[#f5f5f5] tabular-nums">{session.message_count}</span>
				</div>
				<div>
					<span class="text-[#525252]">Sequences</span>
					<span class="ml-1.5 text-[#f5f5f5] tabular-nums">{session.sequence_count}</span>
				</div>
				<div>
					<span class="text-[#525252]">Started</span>
					<span class="ml-1.5 text-[#f5f5f5]">{fmtDate(session.started_at)}</span>
				</div>
				<div>
					<span class="text-[#525252]">Last Activity</span>
					<span class="ml-1.5 text-[#f5f5f5]">{fmtDate(session.last_activity_at)}</span>
				</div>
				{#if session.store_id}
					<div>
						<span class="text-[#525252]">Store</span>
						<span class="ml-1.5 font-mono text-[#737373]">{session.store_id}</span>
					</div>
				{/if}
				{#if session.predecessor_session_id}
					<div>
						<span class="text-[#525252]">Previous Session</span>
						<a href="/admin/chat-analytics/sessions/{session.predecessor_session_id}?lane={lane}"
							class="ml-1.5 font-mono text-sky-400 transition hover:text-sky-300">{session.predecessor_session_id.length > 12 ? session.predecessor_session_id.slice(0, 12) + '…' : session.predecessor_session_id}</a>
					</div>
				{/if}
				{#if session.browser_token}
					<div>
						<span class="text-[#525252]">Browser</span>
						<a href="/admin/chat-analytics/sessions?lane={lane}&browser_token={session.browser_token}"
							class="ml-1.5 font-mono text-[#737373] transition hover:text-white">{session.browser_token.length > 12 ? session.browser_token.slice(0, 12) + '…' : session.browser_token}</a>
					</div>
				{/if}
			</div>
			{#if session.age_gate_rendered_at || session.age_confirmed_at || session.age_declined_at}
				<div class="mt-4 border-t border-white/[0.05] pt-4">
					<div class="mb-2 text-[10px] tracking-widest text-[#525252] uppercase">
						Age Gate Audit
					</div>
					<div class="flex flex-wrap gap-x-8 gap-y-2 text-xs">
						{#if session.age_gate_rendered_at}
							<div>
								<span class="text-[#525252]">Rendered</span>
								<span class="ml-1.5 text-[#f5f5f5]">{fmtDate(session.age_gate_rendered_at)}</span>
							</div>
						{/if}
						{#if session.age_confirmed_at}
							<div>
								<span class="text-[#525252]">Confirmed</span>
								<span class="ml-1.5 text-emerald-300">{fmtDate(session.age_confirmed_at)}</span>
							</div>
						{/if}
						{#if session.age_declined_at}
							<div>
								<span class="text-[#525252]">Declined</span>
								<span class="ml-1.5 text-amber-300">{fmtDate(session.age_declined_at)}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Messages timeline -->
		<div class="space-y-4">
			{#each messages as msg, i}
				<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
					<!-- Message header -->
					<div class="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
						<div class="flex items-center gap-3 text-xs">
							<span class="rounded bg-white/[0.06] px-1.5 py-0.5 text-[#737373] tabular-nums"
								>#{msg.message_index}</span
							>
							<span class={statusColor(msg.status)}>{msg.status || '—'}</span>
							{#if msg.fallback_reason}
								<span class="text-rose-400/70">{msg.fallback_reason}</span>
							{/if}
						</div>
						<div class="flex items-center gap-4 text-xs text-[#525252]">
							{#if msg.latency_ms != null}
								<span class="tabular-nums">{msg.latency_ms}ms</span>
							{/if}
							<span>{fmtShortDate(msg.created_at)}</span>
						</div>
					</div>

					<!-- User message + Assistant response -->
					<div class="space-y-3 px-5 py-4">
						<div>
							<div class="mb-1 text-[10px] tracking-widest text-[#525252] uppercase">User</div>
							<div class="text-sm text-[#f5f5f5]">{msg.user_text_raw || '—'}</div>
						</div>
						<div>
							<div class="mb-1 text-[10px] tracking-widest text-[#525252] uppercase">Assistant</div>
							<div class="text-sm whitespace-pre-wrap text-[#a3a3a3]">
								{msg.assistant_response_text || '—'}
							</div>
						</div>

						<!-- Metadata pills -->
						<div class="flex flex-wrap gap-2 pt-1">
							{#if msg.predicted_cue}
								<span
									class="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-xs text-[#a3a3a3]"
								>
									cue: {msg.predicted_cue}
								</span>
							{/if}
							{#if msg.predicted_intent}
								<span
									class="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-xs text-[#a3a3a3]"
								>
									intent: {msg.predicted_intent}
								</span>
							{/if}
							{#if msg.result_count != null}
								<span
									class="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-xs tabular-nums {msg.result_count ===
									0
										? 'text-rose-400'
										: 'text-[#a3a3a3]'}"
								>
									{msg.result_count} results
								</span>
							{/if}
						</div>
					</div>

					<!-- Products shown for this message -->
					{#if msg.products && msg.products.length > 0}
						<div class="border-t border-white/[0.05] px-5 py-3">
							<div class="mb-2 text-[10px] tracking-widest text-[#525252] uppercase">
								Products ({msg.products.length})
							</div>
							<div class="space-y-1">
								{#each msg.products as p, pi}
									<div class="flex items-center gap-3 text-xs">
										<span class="w-5 text-right text-[#3a3a3a] tabular-nums"
											>{p.rank_position ?? pi + 1}</span
										>
										<span class="text-[#f5f5f5]">{p.product_name}</span>
										{#if p.brand}
											<span class="text-[#525252]">{p.brand}</span>
										{/if}
										{#if p.category}
											<span class="text-[#525252]">· {p.category}</span>
										{/if}
										<div class="ml-auto flex gap-2">
											{#if p.clicked}
												<span class="text-emerald-400">clicked</span>
											{/if}
											{#if p.external_clicked}
												<span class="text-sky-400">external</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Events for this message -->
					{#if eventsByMsg[msg.message_id]?.length}
						<div class="border-t border-white/[0.05] px-5 py-3">
							<div class="mb-2 text-[10px] tracking-widest text-[#525252] uppercase">
								Events ({eventsByMsg[msg.message_id].length})
							</div>
							<div class="space-y-1">
								{#each eventsByMsg[msg.message_id] as ev}
									<div class="flex items-center gap-3 text-xs">
										<a
											href={eventFilterHref(ev)}
											class="cursor-pointer rounded bg-white/[0.06] px-1.5 py-0.5 text-[#a3a3a3] transition hover:bg-white/[0.1] hover:text-white"
											>{ev.event_type}</a
										>
										{#each eventPayloadItems(ev) as item}
											<span
												class="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[#737373]"
											>
												{item.label}: <span class="text-[#d4d4d4]">{item.value}</span>
											</span>
										{/each}
										{#if ev.product_id}
											<span class="font-mono text-[#525252]">{ev.product_id}</span>
										{/if}
										<span class="ml-auto text-[#525252]">{fmtShortDate(ev.occurred_at)}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div
					class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-8 text-center text-sm text-[#525252]"
				>
					No messages in this session.
				</div>
			{/each}
		</div>

		<!-- Session-level events -->
		{#if eventsByMsg['__session__']?.length}
			<div class="mt-6 rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-4">
				<div class="mb-3 text-[10px] tracking-widest text-[#525252] uppercase">
					Session Events ({eventsByMsg['__session__'].length})
				</div>
				<div class="space-y-1">
					{#each eventsByMsg['__session__'] as ev}
						<div class="flex items-center gap-3 text-xs">
							<a
								href={eventFilterHref(ev)}
								class="cursor-pointer rounded bg-white/[0.06] px-1.5 py-0.5 text-[#a3a3a3] transition hover:bg-white/[0.1] hover:text-white"
								>{ev.event_type}</a
							>
							{#each eventPayloadItems(ev) as item}
								<span
									class="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[#737373]"
								>
									{item.label}: <span class="text-[#d4d4d4]">{item.value}</span>
								</span>
							{/each}
							{#if ev.product_id}
								<span class="font-mono text-[#525252]">{ev.product_id}</span>
							{/if}
							<span class="ml-auto text-[#525252]">{fmtShortDate(ev.occurred_at)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</DashboardShellV3>
