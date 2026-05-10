export type ResourceStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error';

export type Resource<T> = {
	data: T | null;
	status: ResourceStatus;
	error: string | null;
	requestId: number;
};

export type ComplianceRangeQuery = {
	lane: string;
	startedAfter: string;
	startedBefore: string;
};

export type ComplianceEventsQuery = ComplianceRangeQuery & {
	limit: number;
	offset: number;
	eventType: string;
	category: string;
	matchedStem: string;
	tier: string;
	layer: string;
	sessionId: string;
};

export type ComplianceTuningQuery = ComplianceRangeQuery & {
	nearMissScoreMax: number;
};

export type ComplianceSummaryResponse = {
	selected: any;
	last_7_days: any;
	last_30_days: any;
	total: any;
	daily: any[];
};

export type ComplianceEventsResponse = {
	events: any[];
	total: number;
};

export type SessionDetailQuery = {
	lane: string;
	sessionId: string;
};

export type SessionDetailResponse = {
	session: any | null;
	messages: any[];
	events: any[];
};
