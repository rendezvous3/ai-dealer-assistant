# AI Dealer Assistant

An embeddable AI-powered car dealership sales assistant. Built as a POC demonstrating metadata-first vehicle search (no embeddings/vectors), multi-provider LLM routing, and a guided discovery flow that maps natural shopper language to structured SQL filters.

## Local Terminal Note

On this Mac, `node`, `npm`, `npx`, and `wrangler` may be missing in a fresh terminal until `nvm` is activated. Before running any Node/Wrangler command in a new terminal, run:

```bash
nvm use --lts
```

## Architecture

```
client/                   -> Svelte 5 embeddable widget (Vite build -> widget.js)
backend/                  -> Hono + Cloudflare Workers API
dashboard/                -> Self-contained analytics dashboard UI + read-only API
Svelte-Component-Library/ -> Reusable UI components (ProductCard, ChatWidget, GuidedFlow, etc.)
backend/db/               -> D1 schema and seed data (28 demo vehicles)
```

**Infrastructure:**
- 1 Cloudflare Worker (`dealer-chat-backend`)
- 1 product D1 database (`vehicle-catalog`) — sole product data source, 28 demo vehicles
- 1 analytics D1 database (`dealer-chat-analytics`) — chat session analytics
- No vectorization, no embeddings, no cron jobs

## Key Concepts

### Metadata-First Search
All vehicle search is pure SQL against D1. No vector similarity, no embeddings. Filters map directly to SQL WHERE clauses with a 7-tier fallback cascade. LLM re-ranking fires only when >3 results need ordering.

### CODEX Cue System
The streaming LLM emits trigger phrases when it detects a recommendation-ready query (ANCHOR + 1 REFINER rule). The frontend detects the cue and fires intent extraction → recommendations.

**ANCHOR** = vehicle condition, body style, or named make/model  
**REFINER** = use case, priority, price, drive type, or fuel type

**CODEX summary format**: `[Condition] [Body type] [Use case] [Priority] [Drive] [Fuel] [under/around Price]`

### Multi-Provider LLM Routing
Stream endpoint → Grok (xAI). Intent extraction → Groq. Re-ranking → Grok. Each endpoint has its own provider for optimal speed/quality.

### Profile System
`PROFILE_TYPE` env var selects between:
- **Merchant Advisor** (`MERCHANT`) — searches across all brands; Mountain Motors (default)
- **Brand Concierge** (`brand_concierge`) — constrains queries to a single brand; Summit Ford (Ford-only)

### Guided Flow
5-step car discovery flow: Condition → Use Case → Body Style → Priorities → Budget.
Translates shopper intent ("great in Seattle winters") directly into SQL filters (AWD, SUV) without exposing field names.

## Model Catalog Maintenance

- Last reviewed: May 2026
- Periodically re-check official xAI (Grok), Groq, Google Gemini, and OpenAI model catalogs.
- When backend model constants change, update `backend/src/types-and-constants.ts`.

## Quick Start

```bash
nvm use --lts

# Backend (terminal 1)
cd backend
npm install
npx wrangler d1 execute vehicle-catalog --local --file=db/schema.sql
npx wrangler d1 execute vehicle-catalog --local --file=db/seed.sql
npm run dev:local   # starts on port 9174

# Client (terminal 2)
cd client
npm install
npm run dev   # starts on port 5173
```

## D1 Setup

Local development uses a local D1 by default (`npm run dev:local`). For remote QA:

```bash
cd backend
npx wrangler d1 execute vehicle-catalog --remote --file=db/schema.sql
npx wrangler d1 execute vehicle-catalog --remote --file=db/seed.sql
npm run dev   # --remote flag, writes to QA cloud D1
```

## API Routes

| Route | Purpose |
|-------|---------|
| `GET /` | Health check — returns dealer name |
| `GET /chat/config` | Returns profile config (quick-starts, guided flow, catalog facets) |
| `POST /chat/stream` | SSE streaming conversation (car consultant persona) |
| `POST /chat/intent` | Structured vehicle filter extraction from CODEX summary |
| `POST /chat/recommendations` | Vehicle SQL search + optional LLM re-ranking |
| `POST /chat/product-lookup` | Name-based vehicle search (make/model/trim) |
| `POST /feedback` | User feedback collection |

## Verification Checklist

1. `GET /chat/config` → Mountain Motors profile with car quick-starts and catalog facets
2. `POST /chat/stream` with "reliable SUV for my family under $40k" → CODEX fires
3. `POST /chat/intent` with CODEX → `{ body_type: "suv", use_case_tags: ["family"], price_max: 40000 }`
4. `POST /chat/recommendations` → matching vehicles from D1
5. Widget guided flow: 5 steps → submit → CODEX → vehicle cards render
6. "Surprise Me" quick-start → immediate recommendations

## Embedding the Widget

```html
<script
  type="module"
  src="https://your-domain.com/widget.js"
  data-api="https://dealer-chat-backend.your-account.workers.dev"
  data-store="mountain-motors"
  data-launcher-label="Open AI Dealer Assistant"
></script>
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5 + TypeScript + Vite |
| Backend | Hono + Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| LLM (stream) | Grok (xAI) — conversational quality |
| LLM (intent) | Groq — fast structured extraction |
| LLM (rerank) | Grok (xAI) — ranking reasoning |
| Persistence | localStorage (client-side chat history) |
