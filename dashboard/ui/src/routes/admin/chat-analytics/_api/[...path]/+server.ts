import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const qs = url.searchParams.toString();
  const rawBase = env.CHAT_ANALYTICS_API_URL || 'http://127.0.0.1:9184';
  const base = rawBase.replace(/\/$/, '');
  const upstream = `${base}/chat-analytics/${params.path}${qs ? `?${qs}` : ''}`;

  const res = await fetch(upstream)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  return json(res ?? {});
};
