import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '25', 10);
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	const search = url.searchParams.get('search') || '';
	const source = url.searchParams.get('source') || '';
	const startedAfter = url.searchParams.get('started_after') || '';
	const startedBefore = url.searchParams.get('started_before') || '';
	const lane = url.searchParams.get('lane') || '';

	return {
		limit,
		offset,
		filters: { search, source, startedAfter, startedBefore, lane }
	};
};
