# Chat Analytics Dashboard Suite

Self-contained analytics dashboard package for the AI Dealer Assistant POC.

This folder is intentionally split from the dealer widget runtime:

- `ui/` — SvelteKit 5 analytics dashboard, including local dashboard UI components and the Svelte compliance/session store cache.
- `api/` — read-only Cloudflare Worker API exposing `/chat-analytics/*` and reading Cloudflare D1.
- `docs/` — analytics schema and dashboard contract copied from the current chatbot analytics source of truth.
- `reference/` — reference implementation used during the port. Runtime code does not depend on it.

The dealer widget app remains in `client/`. The dealer chat/write Worker remains in `backend/`. This dashboard never writes analytics rows.

## Runtime Flow

```text
dashboard/ui
  -> /admin/chat-analytics/_api/* SvelteKit proxy
  -> dashboard/api /chat-analytics/*
  -> Cloudflare D1 analytics tables
```

The dashboard supports `lane=qa|prod`. The API resolves D1 bindings in this order:

- QA: `ANALYTICS_DB_QA`, then `ANALYTICS_DB`, then `WINE_DB_QA`, then `WINE_DB`
- PROD: `ANALYTICS_DB_PROD`, then `ANALYTICS_DB`, then `WINE_DB_PROD`, then `WINE_DB`

For a single-lane POC, bind QA and PROD to the same D1 database until separate databases exist.

## Run Locally

Install once:

```bash
cd dashboard
npm run install:all
```

Start the read-only API. The default uses remote QA cloud D1 so localhost dashboard and deployed QA read the same analytics pool:

```bash
npm run dev:api
```

In another terminal, start the UI:

```bash
npm run dev:ui
```

Open `http://127.0.0.1:5174/admin/chat-analytics`.

Use `npm run dev:api:local` only for isolated local-D1 schema experiments.

## Verification

```bash
cd dashboard
npm run check
```

Expected result: `dashboard/api` TypeScript passes and `dashboard/ui` Svelte check passes with zero errors.

## Porting To The Next POC

Copy the entire `dashboard/` folder. Then update:

- `api/wrangler.toml` D1 database ids/names.
- `ui/.env.local` if the API does not run at `http://127.0.0.1:9184`.
- `docs/` only when the analytics writer contract changes.
- Industry wording in the UI only where the business needs it; query/compliance schemas are intentionally generic.

Keep analytics writes in the chatbot backend. Keep this dashboard read-only.
