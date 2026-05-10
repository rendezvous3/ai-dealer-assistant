<script lang="ts">
	import DashboardShellV3 from '$lib/components/dashboard-v3/DashboardShellV3.svelte';
	import InsightShellV3 from '$lib/components/insights-v3/InsightShellV3.svelte';
	import InsightCardV3 from '$lib/components/insights-v3/InsightCardV3.svelte';
	import FilterDropdown from './FilterDropdown.svelte';
	import {
		chatAnalyticsStore,
		complianceEventsKey,
		complianceFiltersKey,
		complianceSummaryKey,
		complianceTuningKey
	} from '$lib/chat-analytics/store.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	const defaultEventTypes = [
		'age_gate_rendered',
		'age_declined',
		'age_gate_bypass_detected',
		'compliance_refusal_strict',
		'compliance_disclaimer_attached',
		'compliance_near_miss',
		'bot_output_therapeutic_drift',
		'bot_output_slang_sanitized',
		'warning_rendered'
	];

	const emptyMetrics = {
		total_sessions: 0,
		age_gate_tracking_live: false,
		age_decline_tracking_live: false,
		age_gate_rendered_sessions: 0,
		age_gate_render_rate: 0,
		age_declined_sessions: 0,
		age_declined_rate: 0,
		age_gate_abandoned_sessions: 0,
		age_gate_abandoned_rate: 0,
		age_confirmed_sessions: 0,
		age_confirmation_rate: 0,
		age_acceptance_rate: 0,
		active_sessions: 0,
		age_confirmed_active_sessions: 0,
		active_age_confirmation_rate: 0,
		valid_age_order_sessions: 0,
		allowed_chat_rate: 0,
		age_gate_rendered_events: 0,
		age_declined_events: 0,
		age_gate_bypass_events: 0,
		age_gate_bypass_messages: 0,
		age_gate_bypass_sessions: 0,
		strict_refusal_events: 0,
		strict_refusal_messages: 0,
		strict_refusal_sessions: 0,
		disclaimers_attached: 0,
		near_misses: 0,
		near_misses_high_signal: 0,
		near_miss_high_signal_messages: 0,
		output_drift: 0,
		slang_sanitized_events: 0,
		slang_replacements: 0,
		product_recommendation_messages: 0,
		warning_rendered_messages: 0,
		warning_render_rate: 0,
		product_recommendation_sessions: 0,
		warning_rendered_sessions: 0,
		warning_session_rate: 0
	};

	const disclaimerTermsActive = 0;
	const nearMissScoreMax = 2;

	const emptySummary = {
		selected: emptyMetrics,
		last_7_days: emptyMetrics,
		last_30_days: emptyMetrics,
		total: emptyMetrics,
		daily: []
	};
	const idleResource = { data: null, status: 'idle', error: null, requestId: 0 } as const;

	$: limit = data.limit ?? 25;
	$: offset = data.offset ?? 0;
	$: currentPage = Math.floor(offset / limit) + 1;
	$: totalPages = Math.ceil(total / limit);
	$: filters = data.filters ?? {
		eventType: 'compliance_refusal_strict',
		category: '',
		matchedStem: '',
		tier: '',
		layer: '',
		sessionId: '',
		startedAfter: '',
		startedBefore: '',
		lane: ''
	};
	$: lane = filters.lane || (browser ? localStorage.getItem('chat_analytics_lane') : null) || 'qa';
	$: rangeQuery = {
		lane,
		startedAfter: filters.startedAfter,
		startedBefore: filters.startedBefore
	};
	$: eventsQuery = {
		...rangeQuery,
		limit,
		offset,
		eventType: filters.eventType,
		category: filters.category,
		matchedStem: filters.matchedStem,
		tier: filters.tier,
		layer: filters.layer,
		sessionId: filters.sessionId
	};
	$: tuningQuery = {
		...rangeQuery,
		nearMissScoreMax
	};
	$: summaryKey = complianceSummaryKey(rangeQuery);
	$: filtersKey = complianceFiltersKey(rangeQuery);
	$: tuningKey = complianceTuningKey(tuningQuery);
	$: eventsKey = complianceEventsKey(eventsQuery);
	$: summaryResource = chatAnalyticsStore.complianceSummaryByKey[summaryKey] ?? idleResource;
	$: filtersResource = chatAnalyticsStore.complianceFiltersByKey[filtersKey] ?? idleResource;
	$: tuningResource = chatAnalyticsStore.complianceTuningByKey[tuningKey] ?? idleResource;
	$: eventsResource = chatAnalyticsStore.complianceEventsByKey[eventsKey] ?? idleResource;
	$: summary = summaryResource.data ?? emptySummary;
	$: filterOptions = filtersResource.data ?? {};
	$: tuning = tuningResource.data ?? {};
	$: eventData = eventsResource.data ?? { events: [], total: 0 };
	$: events = eventData.events ?? [];
	$: total = eventData.total ?? 0;
	$: loading =
		!summaryResource.data &&
		(summaryResource.status === 'idle' || summaryResource.status === 'loading');
	$: eventsLoading =
		!eventsResource.data &&
		(eventsResource.status === 'idle' || eventsResource.status === 'loading');
	$: eventsRefreshing = eventsResource.status === 'refreshing';
	$: selected = summary?.selected ?? emptyMetrics;
	$: daily = summary?.daily ?? [];
	$: eventOptions = filterOptions.event_types?.length
		? filterOptions.event_types
		: defaultEventTypes;
	$: eventFiltersActive =
		filters.eventType !== 'compliance_refusal_strict' ||
		Boolean(filters.category) ||
		Boolean(filters.matchedStem) ||
		Boolean(filters.tier) ||
		Boolean(filters.layer) ||
		Boolean(filters.sessionId);
	$: dailyMax = Math.max(
		1,
		...daily.map(
			(d: any) =>
				(d.age_gate_rendered_sessions ?? 0) +
				(d.strict_refusal_events ?? 0) +
				(d.age_gate_bypass_events ?? 0) +
				(d.disclaimers_attached ?? 0) +
				(d.near_misses ?? 0) +
				(d.output_drift ?? 0) +
				(d.slang_sanitized_events ?? 0) +
				(d.warning_rendered_messages ?? 0)
		)
	);

	$: if (browser) {
		rangeQuery;
		eventsQuery;
		tuningQuery;
		chatAnalyticsStore.ensureComplianceSummary(rangeQuery);
		chatAnalyticsStore.ensureComplianceFilters(rangeQuery);
		chatAnalyticsStore.ensureComplianceTuning(tuningQuery);
		chatAnalyticsStore.ensureComplianceEvents(eventsQuery);
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

	function buildParams(overrides: Record<string, string> = {}): URLSearchParams {
		const p = new URLSearchParams();
		p.set('limit', String(limit));
		const eventType = overrides.eventType !== undefined ? overrides.eventType : filters.eventType;
		const category = overrides.category !== undefined ? overrides.category : filters.category;
		const matchedStem =
			overrides.matchedStem !== undefined ? overrides.matchedStem : filters.matchedStem;
		const tier = overrides.tier !== undefined ? overrides.tier : filters.tier;
		const layer = overrides.layer !== undefined ? overrides.layer : filters.layer;
		const sessionId = overrides.sessionId !== undefined ? overrides.sessionId : filters.sessionId;
		const startedAfter =
			overrides.startedAfter !== undefined ? overrides.startedAfter : filters.startedAfter;
		const startedBefore =
			overrides.startedBefore !== undefined ? overrides.startedBefore : filters.startedBefore;
		if (eventType) p.set('event_type', eventType);
		if (category) p.set('category', category);
		if (matchedStem) p.set('matched_stem', matchedStem);
		if (tier) p.set('tier', tier);
		if (layer) p.set('layer', layer);
		if (sessionId) p.set('session_id', sessionId);
		if (startedAfter) p.set('started_after', startedAfter);
		if (startedBefore) p.set('started_before', startedBefore);
		p.set('lane', lane);
		return p;
	}

	function applyFilters(overrides: Record<string, string> = {}) {
		const p = buildParams(overrides);
		p.set('offset', '0');
		goto(`/admin/chat-analytics/compliance?${p}`);
	}

	function goPage(newOffset: number) {
		const p = buildParams();
		p.set('offset', String(newOffset));
		goto(`/admin/chat-analytics/compliance?${p}`);
	}

	function clearDateFilters() {
		applyFilters({
			startedAfter: '',
			startedBefore: ''
		});
	}

	function clearEventFilters() {
		applyFilters({
			eventType: 'compliance_refusal_strict',
			category: '',
			matchedStem: '',
			tier: '',
			layer: '',
			sessionId: ''
		});
	}

	function fmtDate(iso: string | null | undefined): string {
		if (!iso) return '-';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function fmtDay(day: string): string {
		if (!day) return '-';
		return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	}

	function fmtEventType(value: string): string {
		return value.replaceAll('_', ' ');
	}

	function truncateId(id: string | null | undefined): string {
		if (!id) return '-';
		return id.length > 12 ? `${id.slice(0, 12)}...` : id;
	}

	function sessionDetailHref(id: string): string {
		const params = new URLSearchParams();
		params.set('lane', lane);
		params.set('return_to', complianceReturnHref());
		params.set('return_label', 'Compliance');
		return `/admin/chat-analytics/sessions/${encodeURIComponent(id)}?${params}`;
	}

	function complianceReturnHref(): string {
		const params = buildParams();
		params.set('offset', String(offset));
		return `/admin/chat-analytics/compliance?${params}`;
	}

	function openSession(id: string | null | undefined) {
		if (!id) return;
		goto(sessionDetailHref(id));
	}

	function handleSessionRowKeydown(event: KeyboardEvent, id: string | null | undefined) {
		if (!id) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openSession(id);
		}
	}

	function warningTone(rate: number): 'default' | 'green' | 'yellow' | 'red' {
		if (rate >= 95) return 'green';
		if (rate >= 80) return 'yellow';
		return 'red';
	}

	function hasNoSessions(metrics: any): boolean {
		return (metrics?.total_sessions ?? 0) === 0;
	}

	function gateTrackingAvailable(metrics: any): boolean {
		return Boolean(metrics?.age_gate_tracking_live) || hasNoSessions(metrics);
	}

	function declineTrackingAvailable(metrics: any): boolean {
		return Boolean(metrics?.age_decline_tracking_live) || hasNoSessions(metrics);
	}

	function liveRateValue(live: boolean, rate: number): string {
		return live ? `${rate}%` : 'Pending';
	}

	function gateRenderTone(
		live: boolean,
		rate: number,
		denominator: number
	): 'default' | 'green' | 'yellow' | 'red' {
		if (!live || denominator === 0) return 'default';
		if (rate >= 99) return 'green';
		if (rate >= 95) return 'yellow';
		return 'red';
	}

	function allowedChatTone(
		live: boolean,
		rate: number,
		activeSessions: number,
		bypassEvents: number
	): 'default' | 'green' | 'yellow' | 'red' {
		if (!live || activeSessions === 0) return 'default';
		if (bypassEvents > 0) return 'red';
		return rate >= 99 ? 'green' : 'red';
	}

	function bypassTone(count: number): 'default' | 'green' | 'yellow' | 'red' {
		return count > 0 ? 'red' : 'green';
	}

	function shouldShowScoreColumn(eventType: string): boolean {
		return eventType === 'compliance_near_miss';
	}

	function primaryStemHeader(eventType: string): string {
		if (eventType === 'age_gate_bypass_detected') return 'Violation';
		if (eventType === 'age_gate_rendered' || eventType === 'age_declined') return 'Signal';
		return eventType === 'compliance_near_miss' ? 'Token Stem' : 'Category';
	}

	function secondaryStemHeader(eventType: string): string {
		if (eventType === 'age_gate_bypass_detected') return 'First Message';
		if (eventType === 'age_gate_rendered' || eventType === 'age_declined') return 'Gate Detail';
		return eventType === 'compliance_near_miss' ? 'Nearest Stem' : 'Matched Stem';
	}

	function primaryStemValue(event: any): string {
		if (filters.eventType === 'age_gate_bypass_detected') return event.violation ?? '-';
		if (filters.eventType === 'age_gate_rendered') return 'gate rendered';
		if (filters.eventType === 'age_declined') return 'declined';
		return filters.eventType === 'compliance_near_miss'
			? (event.token_stem ?? '-')
			: (event.category ?? '-');
	}

	function secondaryStemValue(event: any): string {
		if (filters.eventType === 'age_gate_bypass_detected') return fmtDate(event.first_message_at);
		if (filters.eventType === 'age_gate_rendered' || filters.eventType === 'age_declined')
			return '-';
		return filters.eventType === 'compliance_near_miss'
			? (event.nearest_stem ?? '-')
			: (event.matched_stem ?? '-');
	}

	function barWidth(value: number): number {
		return Math.max(2, Math.round((value / dailyMax) * 100));
	}
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
		<a
			href="/admin/chat-analytics?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Overview</a
		>
		<a
			href="/admin/chat-analytics/queries?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Queries</a
		>
		<a
			href="/admin/chat-analytics/unresolved?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Unresolved</a
		>
		<a
			href="/admin/chat-analytics/products?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Products</a
		>
		<a
			href="/admin/chat-analytics/sessions?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Sessions</a
		>
		<a
			href="/admin/chat-analytics/guided-flow?lane={lane}"
			class="px-4 py-2 text-sm text-[#737373] transition hover:text-white">Guided Flow</a
		>
		<div class="border-b-2 border-white px-4 py-2 text-sm font-medium text-white">Compliance</div>
	</div>

	<div class="mb-6 flex flex-wrap items-center gap-3">
		<div class="text-xs tracking-widest text-[#525252] uppercase">Page Range</div>
		<div class="flex items-center gap-1.5">
			<input
				type="date"
				value={filters.startedAfter}
				on:change={(e) => applyFilters({ startedAfter: e.currentTarget.value })}
				class="date-input h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#f5f5f5] [color-scheme:dark] outline-none focus:border-white/[0.15]"
			/>
			<span class="text-xs text-[#525252]">-</span>
			<input
				type="date"
				value={filters.startedBefore}
				on:change={(e) => applyFilters({ startedBefore: e.currentTarget.value })}
				class="date-input h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-[#141414] px-2 text-xs text-[#f5f5f5] [color-scheme:dark] outline-none focus:border-white/[0.15]"
			/>
		</div>

		{#if filters.startedAfter || filters.startedBefore}
			<button
				on:click={clearDateFilters}
				class="h-8 cursor-pointer rounded-lg border border-white/[0.07] px-3 text-xs text-[#737373] transition hover:border-white/[0.15] hover:text-white"
				>Clear</button
			>
		{/if}
		<div class="text-xs text-[#525252]">
			applies to evidence cards, signals, trend, and event log
		</div>
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
			Loading compliance analytics...
		</div>
	{:else}
		<div class="space-y-6">
			<div class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-4">
				<div class="mb-4 flex items-center justify-between">
					<div class="text-xs tracking-widest text-[#8a8a8a] uppercase">Age Gate Funnel</div>
					<div class="text-xs text-[#8a8a8a]">
						{gateTrackingAvailable(selected) ? `${lane.toUpperCase()} lane` : 'tracking pending'}
					</div>
				</div>
				<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
					<InsightCardV3
						label="Gate Render Coverage"
						value={liveRateValue(gateTrackingAvailable(selected), selected.age_gate_render_rate)}
						sub={gateTrackingAvailable(selected)
							? `${selected.age_gate_rendered_sessions.toLocaleString()} / ${selected.total_sessions.toLocaleString()} sessions`
							: 'awaiting age_gate_rendered_at'}
						tone={gateRenderTone(
							gateTrackingAvailable(selected),
							selected.age_gate_render_rate,
							selected.total_sessions
						)}
					/>
					<InsightCardV3
						label="Allowed Into Chat"
						value={liveRateValue(gateTrackingAvailable(selected), selected.allowed_chat_rate)}
						sub={gateTrackingAvailable(selected)
							? `${selected.valid_age_order_sessions.toLocaleString()} / ${selected.active_sessions.toLocaleString()} active sessions`
							: 'requires render + confirm order'}
						tone={allowedChatTone(
							gateTrackingAvailable(selected),
							selected.allowed_chat_rate,
							selected.active_sessions,
							selected.age_gate_bypass_events
						)}
					/>
					<InsightCardV3
						label="Accepted Age Gate"
						value={liveRateValue(gateTrackingAvailable(selected), selected.age_acceptance_rate)}
						sub={gateTrackingAvailable(selected)
							? `${selected.age_confirmed_sessions.toLocaleString()} / ${selected.age_gate_rendered_sessions.toLocaleString()} rendered sessions`
							: 'confirmation tracking only'}
					/>
					<InsightCardV3
						label="Declined Age Gate"
						value={declineTrackingAvailable(selected)
							? `${selected.age_declined_rate}%`
							: 'Pending'}
						sub={declineTrackingAvailable(selected)
							? `${selected.age_declined_sessions.toLocaleString()} / ${selected.age_gate_rendered_sessions.toLocaleString()} rendered sessions`
							: 'awaiting age_declined_at'}
						tone={selected.age_declined_sessions > 0 ? 'yellow' : 'default'}
					/>
					<InsightCardV3
						label="No Decision"
						value={gateTrackingAvailable(selected)
							? selected.age_gate_abandoned_sessions.toLocaleString()
							: 'Pending'}
						sub={gateTrackingAvailable(selected)
							? 'rendered, no accept/decline/message'
							: 'requires gate render tracking'}
					/>
					<InsightCardV3
						label="Bypass Flags"
						value={selected.age_gate_bypass_events.toLocaleString()}
						sub={`${selected.age_gate_bypass_sessions.toLocaleString()} sessions`}
						tone={bypassTone(selected.age_gate_bypass_events)}
					/>
				</div>
			</div>

			<div
				class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-3 text-xs leading-5 text-[#737373]"
			>
				Age compliance is evaluated as an ordered funnel: gate rendered, age accepted or declined,
				and chat access only after confirmation. Declines and abandoned gates are not failures. Only
				bypass flags are red compliance failures.
			</div>

			<div class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-4">
				<div class="mb-4 flex items-center justify-between">
					<div class="text-xs tracking-widest text-[#8a8a8a] uppercase">Alcohol Compliance Evidence</div>
					<div class="text-xs text-[#8a8a8a]">{lane.toUpperCase()} lane</div>
				</div>
				<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
					<InsightCardV3
						label="Strict Events"
						value={selected.strict_refusal_events.toLocaleString()}
						sub="matched terms refused"
					/>
					<InsightCardV3
						label="Refused Messages"
						value={selected.strict_refusal_messages.toLocaleString()}
						sub="distinct message_id"
					/>
					<InsightCardV3
						label="Refused Sessions"
						value={selected.strict_refusal_sessions.toLocaleString()}
						sub="distinct session_id"
					/>
					<InsightCardV3
						label="Warning Render"
						value="{selected.warning_render_rate}%"
						sub="{selected.warning_rendered_messages.toLocaleString()} / {selected.product_recommendation_messages.toLocaleString()} product messages"
						tone={warningTone(selected.warning_render_rate)}
					/>
					<InsightCardV3
						label="Warning Sessions"
						value="{selected.warning_session_rate}%"
						sub="{selected.warning_rendered_sessions.toLocaleString()} / {selected.product_recommendation_sessions.toLocaleString()} product sessions"
						tone={warningTone(selected.warning_session_rate)}
					/>
				</div>
			</div>

			<div
				class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-3 text-xs leading-5 text-[#737373]"
			>
				Strict refusal counts are deterministic gate catches only. Phrase-based underage, crisis,
				and abuse handling that occurs through prompt fallback is not represented in
				`compliance_refusal_strict`, so these counts are a lower bound.
			</div>

			<InsightShellV3 title="Compliance Signals" caption="structured event payloads only" cols={5}>
				<InsightCardV3
					label="Disclaimers"
					value={selected.disclaimers_attached.toLocaleString()}
					sub={`${disclaimerTermsActive} active terms configured`}
					tone={disclaimerTermsActive === 0 ? 'yellow' : 'default'}
				/>
				<InsightCardV3
					label="Near Misses"
					value={selected.near_misses.toLocaleString()}
					sub={`${selected.near_miss_high_signal_messages.toLocaleString()} distinct messages at score <= ${nearMissScoreMax}`}
				/>
				<InsightCardV3
					label="Output Drift"
					value={selected.output_drift.toLocaleString()}
					sub="manual review required"
					tone={selected.output_drift > 0 ? 'yellow' : 'green'}
				/>
				<InsightCardV3
					label="Slang Events"
					value={selected.slang_sanitized_events.toLocaleString()}
					sub="sanitizer fired"
					tone={selected.slang_sanitized_events > 0 ? 'yellow' : 'green'}
				/>
				<InsightCardV3
					label="Slang Replacements"
					value={selected.slang_replacements.toLocaleString()}
					sub="total replacements"
				/>
			</InsightShellV3>

			<div
				class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-3 text-xs leading-5 text-[#737373]"
			>
				`warning_index` is currently always variant 0; warning rotation is not implemented yet.
				Output drift rows that match allowed wine guidance or crisis-resource text should be
				reviewed before treating them as true drift.
			</div>

			<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
				<div class="border-b border-white/[0.05] px-4 py-3">
					<h3 class="text-sm font-medium text-[#f5f5f5]">Daily Compliance Trend</h3>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-white/[0.05]">
								<th
									class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Day</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Gate</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Accepted</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Allowed</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Declined</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>No Decision</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Bypass</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Strict</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Warnings</th
								>
								<th
									class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Volume</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.04]">
							{#each daily as row}
								<tr class="transition hover:bg-white/[0.02]">
									<td class="px-4 py-3 text-[#f5f5f5]">{fmtDay(row.day)}</td>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.age_gate_rendered_sessions}/{row.total_sessions}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.age_confirmed_sessions}/{row.age_gate_rendered_sessions}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.valid_age_order_sessions}/{row.active_sessions}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.age_declined_sessions}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.age_gate_abandoned_sessions}</td
									>
									<td
										class="px-3 py-3 text-right tabular-nums {row.age_gate_bypass_events > 0
											? 'text-rose-400'
											: 'text-[#737373]'}">{row.age_gate_bypass_events}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.strict_refusal_events}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.warning_rendered_messages}/{row.product_recommendation_messages}</td
									>
									<td class="px-4 py-3">
										<div class="h-1.5 w-32 rounded-full bg-white/[0.05]">
											<div
												class="h-1.5 rounded-full bg-[#a3a3a3]"
												style={`width: ${barWidth((row.age_gate_rendered_sessions ?? 0) + (row.age_gate_bypass_events ?? 0) + (row.strict_refusal_events ?? 0) + (row.warning_rendered_messages ?? 0))}%`}
											></div>
										</div>
									</td>
								</tr>
							{:else}
								<tr
									><td colspan="10" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No daily compliance activity found</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
				<div class="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
					<h3 class="text-sm font-medium text-[#f5f5f5]">Compliance Events</h3>
					<div class="flex items-center gap-3">
						{#if eventsLoading}
							<span class="text-xs text-[#525252]">Loading...</span>
						{:else if eventsRefreshing}
							<span class="text-xs text-[#525252]">Updating...</span>
						{/if}
						<span class="text-xs text-[#737373] tabular-nums">{total.toLocaleString()} rows</span>
					</div>
				</div>
				<div class="border-b border-white/[0.05] px-4 py-3">
					<div class="mb-2 text-xs tracking-widest text-[#525252] uppercase">Event Log Filters</div>
					<div class="flex flex-wrap items-center gap-3">
						<FilterDropdown
							value={filters.eventType}
							options={eventOptions}
							placeholder="Event type"
							formatOption={fmtEventType}
							onSelect={(value) => applyFilters({ eventType: value })}
						/>
						<FilterDropdown
							value={filters.category}
							options={filterOptions.categories ?? []}
							placeholder="All categories"
							emptyLabel="All categories"
							onSelect={(value) => applyFilters({ category: value })}
						/>
						<FilterDropdown
							value={filters.matchedStem}
							options={filterOptions.matched_stems ?? []}
							placeholder="All stems"
							emptyLabel="All stems"
							onSelect={(value) => applyFilters({ matchedStem: value })}
						/>
						<FilterDropdown
							value={filters.tier}
							options={filterOptions.tiers ?? []}
							placeholder="All tiers"
							emptyLabel="All tiers"
							onSelect={(value) => applyFilters({ tier: value })}
						/>
						<FilterDropdown
							value={filters.layer}
							options={filterOptions.layers ?? []}
							placeholder="All layers"
							emptyLabel="All layers"
							onSelect={(value) => applyFilters({ layer: value })}
						/>
						<input
							type="text"
							value={filters.sessionId}
							placeholder="Session ID"
							on:change={(e) => applyFilters({ sessionId: e.currentTarget.value.trim() })}
							class="h-8 w-56 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] outline-none placeholder:text-[#525252] focus:border-white/[0.15]"
						/>
						{#if eventFiltersActive}
							<button
								on:click={clearEventFilters}
								class="h-8 cursor-pointer rounded-lg border border-white/[0.07] px-3 text-xs text-[#737373] transition hover:border-white/[0.15] hover:text-white"
								>Clear event filters</button
							>
						{/if}
					</div>
				</div>
				<div class="overflow-x-auto transition-opacity {eventsRefreshing ? 'opacity-60' : ''}">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-white/[0.05]">
								<th
									class="px-4 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Occurred</th
								>
								<th
									class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Session</th
								>
								<th
									class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Message</th
								>
								<th
									class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Event</th
								>
								<th
									class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>{primaryStemHeader(filters.eventType)}</th
								>
								<th
									class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>{secondaryStemHeader(filters.eventType)}</th
								>
								<th
									class="px-3 py-2.5 text-left font-medium tracking-widest text-[#525252] uppercase"
									>Tier</th
								>
								<th
									class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
									>Layer</th
								>
								{#if shouldShowScoreColumn(filters.eventType)}
									<th
										class="px-3 py-2.5 text-right font-medium tracking-widest text-[#525252] uppercase"
										>Edit Distance</th
									>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.04]">
							{#if eventsLoading}
								<tr
									><td
										colspan={shouldShowScoreColumn(filters.eventType) ? 9 : 8}
										class="px-5 py-8 text-center text-sm text-[#737373]"
										>Loading compliance events...</td
									></tr
								>
							{:else}
								{#each events as event}
									<tr
										class="transition hover:bg-white/[0.02] {event.session_id
											? 'cursor-pointer focus:bg-white/[0.03] focus:outline-none'
											: ''}"
										role={event.session_id ? 'link' : undefined}
										tabindex={event.session_id ? 0 : undefined}
										aria-label={event.session_id ? `Open session ${event.session_id}` : undefined}
										title={event.session_id ? 'Open session transcript' : undefined}
										on:click={() => openSession(event.session_id)}
										on:keydown={(e) => handleSessionRowKeydown(e, event.session_id)}
									>
										<td
											class="px-4 py-3 whitespace-nowrap text-[#737373] {event.session_id
												? 'cursor-pointer'
												: ''}"
											title={event.session_id ? 'Open session transcript' : undefined}
											>{fmtDate(event.occurred_at)}</td
										>
										<td class="px-3 py-3">
											{#if event.session_id}
												<a
													href={sessionDetailHref(event.session_id)}
													on:click={(e) => {
														e.preventDefault();
														e.stopPropagation();
														openSession(event.session_id);
													}}
													class="cursor-pointer font-mono text-[#737373] transition hover:text-white"
													title={event.session_id}>{truncateId(event.session_id)}</a
												>
											{:else}
												<span class="font-mono text-[#737373]">-</span>
											{/if}
										</td>
										<td class="px-3 py-3 font-mono text-[#737373]" title={event.message_id ?? ''}
											>{truncateId(event.message_id)}</td
										>
										<td class="px-3 py-3 text-[#737373]">{fmtEventType(event.event_type)}</td>
										<td class="px-3 py-3 text-[#f5f5f5]">{primaryStemValue(event)}</td>
										<td class="px-3 py-3 text-[#f5f5f5]">{secondaryStemValue(event)}</td>
										<td class="px-3 py-3 text-[#737373]">{event.tier ?? '-'}</td>
										<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
											>{event.layer ?? '-'}</td
										>
										{#if shouldShowScoreColumn(filters.eventType)}
											<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
												>{event.score ?? '-'}</td
											>
										{/if}
									</tr>
								{:else}
									<tr
										><td
											colspan={shouldShowScoreColumn(filters.eventType) ? 9 : 8}
											class="px-5 py-8 text-center text-sm text-[#737373]"
											>No compliance events found</td
										></tr
									>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>

			{#if totalPages > 1}
				<div class="flex items-center justify-between text-xs text-[#737373]">
					<span>{total} total events</span>
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
									const pg = Math.max(
										1,
										Math.min(totalPages, parseInt(e.currentTarget.value) || 1)
									);
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

			<div class="grid gap-6 xl:grid-cols-2">
				<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
					<div class="border-b border-white/[0.05] px-4 py-3">
						<h3 class="text-sm font-medium text-[#f5f5f5]">Age Gate Bypass by Violation</h3>
					</div>
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-white/[0.05]"
								><th class="px-4 py-2.5 text-left tracking-widest text-[#525252] uppercase"
									>Violation</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Events</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Messages</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Sessions</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Last</th
								></tr
							></thead
						>
						<tbody class="divide-y divide-white/[0.04]">
							{#each tuning.age_gate_bypass_by_violation ?? [] as row}
								<tr
									><td class="px-4 py-3 text-rose-300">{row.violation}</td><td
										class="px-3 py-3 text-right text-[#737373] tabular-nums">{row.event_count}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.message_count}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.session_count}</td
									><td class="px-3 py-3 text-right text-[#737373]">{fmtDate(row.last_seen_at)}</td
									></tr
								>
							{:else}
								<tr
									><td colspan="5" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No age gate bypass events</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
					<div class="border-b border-white/[0.05] px-4 py-3">
						<h3 class="text-sm font-medium text-[#f5f5f5]">Strict Refusals by Category and Stem</h3>
					</div>
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-white/[0.05]"
								><th class="px-4 py-2.5 text-left tracking-widest text-[#525252] uppercase"
									>Category</th
								><th class="px-3 py-2.5 text-left tracking-widest text-[#525252] uppercase">Stem</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Events</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Messages</th
								></tr
							></thead
						>
						<tbody class="divide-y divide-white/[0.04]">
							{#each tuning.strict_by_category_stem ?? [] as row}
								<tr
									><td class="px-4 py-3 text-[#f5f5f5]">{row.category}</td><td
										class="px-3 py-3 text-[#737373]">{row.matched_stem}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.event_count}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.message_count}</td
									></tr
								>
							{:else}
								<tr
									><td colspan="4" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No strict refusals</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
					<div class="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
						<h3 class="text-sm font-medium text-[#f5f5f5]">Near Misses by Nearest Stem</h3>
						<span class="text-xs text-[#737373]">score &lt;= {nearMissScoreMax}</span>
					</div>
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-white/[0.05]"
								><th class="px-4 py-2.5 text-left tracking-widest text-[#525252] uppercase"
									>Nearest Stem</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Events</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Messages</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Avg Score</th
								></tr
							></thead
						>
						<tbody class="divide-y divide-white/[0.04]">
							{#each tuning.near_misses_by_nearest_stem ?? [] as row}
								<tr
									><td class="px-4 py-3 text-[#f5f5f5]">{row.nearest_stem}</td><td
										class="px-3 py-3 text-right text-[#737373] tabular-nums">{row.event_count}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.message_count}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.avg_score ?? '-'}</td
									></tr
								>
							{:else}
								<tr
									><td colspan="4" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No near misses</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
					<div class="border-b border-white/[0.05] px-4 py-3">
						<h3 class="text-sm font-medium text-[#f5f5f5]">Output Drift by Matched Stem</h3>
					</div>
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-white/[0.05]"
								><th class="px-4 py-2.5 text-left tracking-widest text-[#525252] uppercase">Stem</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Events</th
								></tr
							></thead
						>
						<tbody class="divide-y divide-white/[0.04]">
							{#each tuning.output_drift_by_matched_stem ?? [] as row}
								<tr
									><td class="px-4 py-3 text-[#f5f5f5]">{row.matched_stem}</td><td
										class="px-3 py-3 text-right text-[#737373] tabular-nums">{row.event_count}</td
									></tr
								>
							{:else}
								<tr
									><td colspan="2" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No output drift</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
					<div class="border-b border-white/[0.05] px-4 py-3">
						<h3 class="text-sm font-medium text-[#f5f5f5]">Slang Sanitized by Term</h3>
					</div>
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-white/[0.05]"
								><th class="px-4 py-2.5 text-left tracking-widest text-[#525252] uppercase">Term</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Events</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Replacements</th
								></tr
							></thead
						>
						<tbody class="divide-y divide-white/[0.04]">
							{#each tuning.slang_sanitized_by_term ?? [] as row}
								<tr
									><td class="px-4 py-3 text-[#f5f5f5]">{row.term}</td><td
										class="px-3 py-3 text-right text-[#737373] tabular-nums">{row.event_count}</td
									><td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.replacement_count}</td
									></tr
								>
							{:else}
								<tr
									><td colspan="3" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No slang sanitization</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="overflow-hidden rounded-xl border border-white/[0.07] bg-[#111111]">
				<div class="border-b border-white/[0.05] px-4 py-3">
					<h3 class="text-sm font-medium text-[#f5f5f5]">Refused Sessions</h3>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead
							><tr class="border-b border-white/[0.05]"
								><th class="px-4 py-2.5 text-left tracking-widest text-[#525252] uppercase"
									>Session</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Events</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Messages</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>First</th
								><th class="px-3 py-2.5 text-right tracking-widest text-[#525252] uppercase"
									>Last</th
								></tr
							></thead
						>
						<tbody class="divide-y divide-white/[0.04]">
							{#each tuning.refused_sessions ?? [] as row}
								<tr class="transition hover:bg-white/[0.02]">
									<td class="px-4 py-3"
										><a
											href={sessionDetailHref(row.session_id)}
											on:click={(e) => {
												e.preventDefault();
												openSession(row.session_id);
											}}
											class="cursor-pointer font-mono text-[#f5f5f5] transition hover:text-white"
											title={row.session_id}>{truncateId(row.session_id)}</a
										></td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums">{row.event_count}</td
									>
									<td class="px-3 py-3 text-right text-[#737373] tabular-nums"
										>{row.message_count}</td
									>
									<td class="px-3 py-3 text-right text-[#737373]"
										>{fmtDate(row.first_refusal_at)}</td
									>
									<td class="px-3 py-3 text-right text-[#737373]">{fmtDate(row.last_refusal_at)}</td
									>
								</tr>
							{:else}
								<tr
									><td colspan="5" class="px-5 py-8 text-center text-sm text-[#737373]"
										>No refused sessions</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</DashboardShellV3>

<style>
	.date-input,
	.date-input::-webkit-calendar-picker-indicator,
	.date-input::-webkit-datetime-edit,
	.date-input::-webkit-datetime-edit-fields-wrapper,
	.date-input::-webkit-datetime-edit-text,
	.date-input::-webkit-datetime-edit-month-field,
	.date-input::-webkit-datetime-edit-day-field,
	.date-input::-webkit-datetime-edit-year-field {
		cursor: pointer;
	}
</style>
