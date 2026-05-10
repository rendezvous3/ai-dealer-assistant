import type {
	ComplianceEventsQuery,
	ComplianceEventsResponse,
	ComplianceRangeQuery,
	ComplianceSummaryResponse,
	ComplianceTuningQuery,
	Resource,
	SessionDetailQuery,
	SessionDetailResponse
} from './types';

function emptyResource<T>(): Resource<T> {
	return {
		data: null,
		status: 'idle',
		error: null,
		requestId: 0
	};
}

function normalize(value: string | number | boolean | null | undefined): string {
	return value === null || value === undefined ? '' : String(value);
}

function keyFromParts(parts: Record<string, string | number | boolean | null | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(parts)) {
		params.set(key, normalize(value));
	}
	return params.toString();
}

function rangeParams(query: ComplianceRangeQuery): URLSearchParams {
	const params = new URLSearchParams();
	if (query.startedAfter) params.set('started_after', query.startedAfter);
	if (query.startedBefore) params.set('started_before', query.startedBefore);
	params.set('lane', query.lane);
	return params;
}

export function complianceSummaryKey(query: ComplianceRangeQuery): string {
	return keyFromParts({
		lane: query.lane,
		started_after: query.startedAfter,
		started_before: query.startedBefore
	});
}

export const complianceFiltersKey = complianceSummaryKey;

export function complianceTuningKey(query: ComplianceTuningQuery): string {
	return keyFromParts({
		lane: query.lane,
		started_after: query.startedAfter,
		started_before: query.startedBefore,
		near_miss_score_max: query.nearMissScoreMax
	});
}

export function complianceEventsKey(query: ComplianceEventsQuery): string {
	return keyFromParts({
		lane: query.lane,
		started_after: query.startedAfter,
		started_before: query.startedBefore,
		event_type: query.eventType,
		category: query.category,
		matched_stem: query.matchedStem,
		tier: query.tier,
		layer: query.layer,
		session_id: query.sessionId,
		limit: query.limit,
		offset: query.offset
	});
}

export function sessionDetailKey(query: SessionDetailQuery): string {
	return keyFromParts({
		lane: query.lane,
		session_id: query.sessionId
	});
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Request failed with ${response.status}`);
	}
	return response.json() as Promise<T>;
}

class ChatAnalyticsStore {
	complianceSummaryByKey = $state<Record<string, Resource<ComplianceSummaryResponse>>>({});
	complianceEventsByKey = $state<Record<string, Resource<ComplianceEventsResponse>>>({});
	complianceFiltersByKey = $state<Record<string, Resource<any>>>({});
	complianceTuningByKey = $state<Record<string, Resource<any>>>({});
	sessionDetailByKey = $state<Record<string, Resource<SessionDetailResponse>>>({});

	private inflight = new Map<string, Promise<void>>();

	getComplianceSummary(key: string): Resource<ComplianceSummaryResponse> {
		return this.complianceSummaryByKey[key] ?? emptyResource();
	}

	getComplianceEvents(key: string): Resource<ComplianceEventsResponse> {
		return this.complianceEventsByKey[key] ?? emptyResource();
	}

	getComplianceFilters(key: string): Resource<any> {
		return this.complianceFiltersByKey[key] ?? emptyResource();
	}

	getComplianceTuning(key: string): Resource<any> {
		return this.complianceTuningByKey[key] ?? emptyResource();
	}

	getSessionDetail(key: string): Resource<SessionDetailResponse> {
		return this.sessionDetailByKey[key] ?? emptyResource();
	}

	ensureComplianceSummary(query: ComplianceRangeQuery): Promise<void> {
		const key = complianceSummaryKey(query);
		const qs = rangeParams(query).toString();
		return this.ensureResource(
			this.complianceSummaryByKey,
			`compliance-summary:${key}`,
			key,
			`/admin/chat-analytics/_api/compliance/summary${qs ? `?${qs}` : ''}`,
			(data) => data ?? { selected: {}, last_7_days: {}, last_30_days: {}, total: {}, daily: [] }
		);
	}

	ensureComplianceEvents(query: ComplianceEventsQuery): Promise<void> {
		const key = complianceEventsKey(query);
		const params = rangeParams(query);
		params.set('limit', String(query.limit));
		params.set('offset', String(query.offset));
		if (query.eventType) params.set('event_type', query.eventType);
		if (query.category) params.set('category', query.category);
		if (query.matchedStem) params.set('matched_stem', query.matchedStem);
		if (query.tier) params.set('tier', query.tier);
		if (query.layer) params.set('layer', query.layer);
		if (query.sessionId) params.set('session_id', query.sessionId);

		return this.ensureResource(
			this.complianceEventsByKey,
			`compliance-events:${key}`,
			key,
			`/admin/chat-analytics/_api/compliance/events?${params}`,
			(data) => data ?? { events: [], total: 0 }
		);
	}

	ensureComplianceFilters(query: ComplianceRangeQuery): Promise<void> {
		const key = complianceFiltersKey(query);
		const qs = rangeParams(query).toString();
		return this.ensureResource(
			this.complianceFiltersByKey,
			`compliance-filters:${key}`,
			key,
			`/admin/chat-analytics/_api/compliance/filters${qs ? `?${qs}` : ''}`,
			(data) => data ?? {}
		);
	}

	ensureComplianceTuning(query: ComplianceTuningQuery): Promise<void> {
		const key = complianceTuningKey(query);
		const params = rangeParams(query);
		params.set('near_miss_score_max', String(query.nearMissScoreMax));
		return this.ensureResource(
			this.complianceTuningByKey,
			`compliance-tuning:${key}`,
			key,
			`/admin/chat-analytics/_api/compliance/tuning?${params}`,
			(data) => data ?? {}
		);
	}

	ensureSessionDetail(query: SessionDetailQuery): Promise<void> {
		const key = sessionDetailKey(query);
		const qs = query.lane ? `?lane=${query.lane}` : '';
		return this.ensureResource(
			this.sessionDetailByKey,
			`session-detail:${key}`,
			key,
			`/admin/chat-analytics/_api/sessions/${encodeURIComponent(query.sessionId)}${qs}`,
			(data) => data ?? { session: null, messages: [], events: [] }
		);
	}

	private ensureResource<T>(
		bucket: Record<string, Resource<T>>,
		inflightKey: string,
		key: string,
		url: string,
		normalizeData: (data: T | null) => T
	): Promise<void> {
		const existing = bucket[key];
		if (
			existing?.status === 'success' ||
			existing?.status === 'loading' ||
			existing?.status === 'refreshing' ||
			existing?.status === 'error'
		) {
			return this.inflight.get(inflightKey) ?? Promise.resolve();
		}

		const requestId = (existing?.requestId ?? 0) + 1;
		bucket[key] = {
			data: existing?.data ?? null,
			status: existing?.data ? 'refreshing' : 'loading',
			error: null,
			requestId
		};

		const request = fetchJson<T>(url)
			.then((data) => {
				if (bucket[key]?.requestId !== requestId) return;
				bucket[key] = {
					data: normalizeData(data),
					status: 'success',
					error: null,
					requestId
				};
			})
			.catch((error: Error) => {
				if (bucket[key]?.requestId !== requestId) return;
				bucket[key] = {
					data: existing?.data ?? null,
					status: 'error',
					error: error.message,
					requestId
				};
			})
			.finally(() => {
				if (this.inflight.get(inflightKey) === request) {
					this.inflight.delete(inflightKey);
				}
			});

		this.inflight.set(inflightKey, request);
		return request;
	}
}

export const chatAnalyticsStore = new ChatAnalyticsStore();
