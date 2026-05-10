# Dashboard UI

SvelteKit 5 analytics dashboard for chatbot query, session, product, unresolved, and compliance analytics.

The UI is self-contained inside `dashboard/ui` and includes its local V3 shell/card components under `src/lib/components`.

## API Proxy

All UI fetches go through:

```text
/admin/chat-analytics/_api/[...path]
```

That proxy forwards to `CHAT_ANALYTICS_API_URL`, defaulting to `http://127.0.0.1:9184`.

## Run

```bash
cd dashboard/ui
npm install
cp .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 5174
```

## State Model

URL parameters are the filter truth. Compliance summary, event-log pages, tuning tables, and session details use the Svelte module store in `src/lib/chat-analytics/store.svelte.ts` as an in-memory cache, so returning from session detail does not wipe already-loaded compliance dashboard data.
