# Wine Sommelier AI Chat Widget

An embeddable AI-powered wine recommendation chatbot. Built as a POC demonstrating metadata-first product search (no embeddings/vectors), multi-provider LLM routing, and guided flow product discovery.

## Local Terminal Note

On this Mac, `node`, `npm`, `npx`, and `wrangler` may be missing in a fresh terminal until `nvm` is activated. Before running any Node/Wrangler command in a new terminal, run:

```bash
nvm use --lts
```

## Architecture

```
client/                  -> Svelte 5 embeddable widget (Vite build -> widget.js)
backend/                 -> Hono + Cloudflare Workers API
dashboard/               -> Self-contained analytics dashboard UI + read-only API
Svelte-Component-Library/ -> Reusable UI components (ProductCard, ChatWidget, GuidedFlow, etc.)
backend/db/              -> D1 schema and seed data
```

**Infrastructure:**
- 1 Cloudflare Worker (`wine-chat-backend`)
- 1 product D1 database (`wine-catalog`) -- sole product data source
- 1 analytics D1 database (`wine-chat-analytics`) -- shared QA cloud store for localhost and deployed QA analytics
- No vectorization, no embeddings, no cron jobs

## Key Concepts

### Metadata-First Search
All product search is pure SQL against D1. No vector similarity, no embeddings. Filters map directly to SQL WHERE clauses. LLM re-ranking fires only when >3 results need ordering.

### CODEX Cue System
The streaming LLM emits trigger phrases when it detects a recommendation-ready query (2/3 rule: wine style + flavor + body/occasion). The frontend detects the cue and fires intent extraction -> recommendations.

### Multi-Provider LLM Routing
Supports Groq, Cerebras, Google, OpenAI, and Grok. Each endpoint (stream, intent, rerank) has its own provider assignment for optimal speed/quality tradeoffs.

### Profile System
`PROFILE_TYPE` env var selects between:
- **Brand Concierge** -- constrains all queries to a single winery's catalog
- **Merchant Advisor** -- searches across all brands (default)

### Guided Flow
5-step wine discovery flow: Wine Style -> Occasion -> Flavor Profile -> Body -> Price. "Surprise Me" options leave dimensions open for sommelier's choice.

## Model Catalog Maintenance

- Last reviewed: March 20, 2026
- Fast-model constants updated on this date:
  - OpenAI `gpt-5-mini` replaces `gpt-4o-mini`
  - Google `gemini-2.5-flash-lite` was added to the backend model registry
- Periodically re-check official OpenAI, Google Gemini, xAI, and Groq model catalogs.
- When backend model constants change, update `backend/src/types-and-constants.ts`.

## Quick Start

```bash
# Backend
cd backend
npm install
npm run dev

# Client (separate terminal)
cd client
npm install
npm run dev
```

## D1 Setup

Local development defaults to QA cloud D1 so localhost and deployed QA contribute to the same analytics pool. Running `npm run dev` in `backend/` runs `wrangler dev --remote`.

Product/catalog data is also expected in remote QA for normal UI testing:

```bash
cd backend
npx wrangler d1 execute wine-catalog --remote --file=db/schema.sql
npx wrangler d1 execute wine-catalog --remote --file=db/seed.sql
```

Use `npm run dev:local` only for isolated schema experiments that should not write to QA cloud D1.

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /chat/stream` | SSE streaming conversation |
| `POST /chat/intent` | Structured filter extraction from conversation |
| `POST /chat/recommendations` | Wine search + optional LLM re-ranking |
| `POST /chat/product-lookup` | Name-based wine search |
| `POST /feedback` | User feedback collection |

## Embedding the Widget

```html
<script type="module" src="https://your-domain.com/widget.js" data-api="https://api..." data-store="wine-shop"></script>
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5 + TypeScript + Vite |
| Backend | Hono + Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| LLM | Multi-provider (Groq, Cerebras, Google, OpenAI, Grok) |
| Persistence | localStorage (client-side chat history) |
