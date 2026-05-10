import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url }) => {
	const lane = url.searchParams.get('lane') || '';
	const rawReturnTo = url.searchParams.get('return_to') || '';
	const returnTo = rawReturnTo.startsWith('/admin/chat-analytics/') ? rawReturnTo : '';
	const returnLabel = url.searchParams.get('return_label') || '';

	return {
		sessionId: params.sessionId,
		lane,
		returnTo,
		returnLabel
	};
};
