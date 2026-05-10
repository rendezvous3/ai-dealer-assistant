import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '25', 10);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const rawEventType = url.searchParams.get('event_type') || '';
	const eventType =
		rawEventType && rawEventType !== 'age_confirmed' ? rawEventType : 'compliance_refusal_strict';
	const category = url.searchParams.get('category') || '';
	const matchedStem = url.searchParams.get('matched_stem') || '';
	const tier = url.searchParams.get('tier') || '';
	const layer = url.searchParams.get('layer') || '';
	const sessionId = url.searchParams.get('session_id') || '';
	const startedAfter = url.searchParams.get('started_after') || '';
	const startedBefore = url.searchParams.get('started_before') || '';
	const lane = url.searchParams.get('lane') || '';

	return {
		limit,
		offset,
		filters: {
			eventType,
			category,
			matchedStem,
			tier,
			layer,
			sessionId,
			startedAfter,
			startedBefore,
			lane
		}
	};
};
