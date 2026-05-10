# AI Dealer Assistant

## Port Registry — Read First When Cloning

Each POC in this workspace owns a fixed port. **Never change a port without updating both wrangler.toml and this table.** When starting a new POC, pick the next unused `97xx` port and register it here before writing any code.

| Service | Port | Config file |
|---------|------|-------------|
| **Dealer backend** (`dealer-chat-backend`) | **9743** | `backend/wrangler.toml` |
| Dashboard analytics API | 9184 | `dashboard/api/wrangler.toml` |
| Client widget (Vite) | 5173 | Vite default |
| Dashboard UI (Vite) | 5174 | Vite default |

**Wine POC ports (for reference — do not reuse):**
| Wine backend | 9174 | `wine-poc/backend/wrangler.toml` |

**Clone checklist — run before `npm run dev:local`:**
```bash
lsof -ti :9743 | xargs kill -9 2>/dev/null; echo "port 9743 clear"
```

**Next available POC port: 9753** (register it here when you use it)

---

## Local Terminal Note

On this Mac, `node`, `npm`, `npx`, and `wrangler` may be missing in a fresh terminal until `nvm` is activated. Before running any Node/Wrangler command in a new terminal, run:

```bash
nvm use --lts
```

## Project Overview

This is a POC embeddable AI car dealership sales assistant. The widget delivers a consultative vehicle shopping experience:
- Answers general questions about vehicles, financing, and the dealership
- Detects when the customer is ready for recommendations (CODEX system)
- Streams natural, conversational responses
- Displays rich vehicle cards inline when recommendations are made
- Supports a 5-step guided flow as an alternative to open-ended chat
- Persists the entire conversation across page refreshes via localStorage

The system is built as **three components**:

1. **Backend API** (`backend/`) — Hono + Cloudflare Workers
2. **Frontend Widget** (`client/`) — Svelte 5 embeddable chat widget
3. **Component Library** (`Svelte-Component-Library/`) — Reusable UI components

**No vectorization.** All vehicle search is metadata-first via D1 SQL queries. No embeddings, no similarity scores.

## Model Catalog Maintenance

- Last reviewed: May 2026
- Periodically re-check official xAI (Grok), Groq, Google Gemini, and OpenAI model catalogs.
- When backend model constants change, update `backend/src/types-and-constants.ts`.

## Architecture

### Infrastructure

- **1 Cloudflare Worker** (`dealer-chat-backend`) — single wrangler.toml
- **1 D1 database** (`vehicle-catalog`) — the vehicle inventory
- **No cron jobs** — pure SQL search, no scheduled sync
- **No QA/prod split** — single deployment lane
- **No Vectorize binding** — no vector DB

### Profile System

`PROFILE_TYPE` env var selects runtime behavior:
- **Merchant Advisor** (`merchant_advisor`) — searches across all brands (default, Mountain Motors)
- **Brand Concierge** (`brand_concierge`) — constrains all queries to a single brand (Summit Ford, Ford-only)

Config lives in `backend/src/profiles/`.

### Backend API (`backend/src/index.ts`)

**Technology**: TypeScript + Hono + Cloudflare Workers

**Routes**:
- `/chat/stream` — SSE streaming conversation (car consultant persona). Emits CODEX cues to trigger intent.
- `/chat/intent` — Structured vehicle filter extraction from conversation CODEX summary.
- `/chat/recommendations` — Vehicle search via D1 SQL + optional LLM re-ranking (fires when >3 results).
- `/chat/product-lookup` — Name-based vehicle search. Confidence by result count (1=confident, 2-3=clarify, 0=not found).
- `/feedback` — User feedback collection.

**Bindings**:
```typescript
interface Bindings {
  CEREBRAS_API_KEY_PROD: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GROK_API_KEY?: string;
  RESEND_API_KEY: string;
  VEHICLES_DB: D1Database;
  PROFILE_TYPE?: string;
}
```

### Vehicle Search (`backend/src/vehicle-search.ts`)

Pure SQL search against D1. Four functions:
- `searchVehicles(db, filters, limit)` — parameterized SQL with WHERE clauses for all vehicle dimensions
- `searchVehiclesWithFallback(db, filters, limit)` — 7-tier cascade (see below)
- `lookupVehicleByName(db, query, limit)` — LIKE-based make/model/trim search
- `surpriseMe(db, filters, limit)` — random selection with partial filters

**7-Tier Fallback Cascade**:
1. Full filter match (all active filters)
2. Drop priority_tags
3. Drop use_case_tags
4. Drop drive_type, fuel_type
5. Keep only condition + body_type + price
6. Keep only body_type + price
7. Price only (broadest anchor)

**Vehicle Filters**:
```typescript
interface VehicleFilters {
  condition?: string;        // new | used | cpo
  body_type?: string;        // sedan | suv | truck | hatchback | minivan | coupe
  make?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  drive_type?: string;       // fwd | awd | 4wd | rwd
  fuel_type?: string;        // gasoline | hybrid | electric | diesel | plug-in-hybrid
  price_min?: number;
  price_max?: number;
  mileage_max?: number;
  seats_min?: number;
  use_case_tags?: string[];  // family | commuter | adventure | commercial | performance | eco
  priority_tags?: string[];  // safety | fuel-economy | cargo | towing | tech | reliability | performance | luxury
}
```

**Tag queries**: `use_case_tags` and `priority_tags` are stored as JSON TEXT in D1 and queried with `LIKE '%"tag"%'`.

### CODEX Cue System

The stream LLM emits trigger phrases when it detects a recommendation-ready query.

**ANCHOR** = any of:
- Vehicle condition: new, used, certified pre-owned
- Body style: SUV, truck, sedan, hatchback, minivan, coupe
- Named make/model: Toyota, F-150, RAV4, Mustang, etc.

**REFINER** = any of:
- Use case: commuting, family, adventure, off-road, work, performance, eco
- Priority: safety, cargo, fuel economy, towing, reliability, tech, luxury
- Drive type: AWD, 4WD, FWD, RWD
- Fuel type: hybrid, electric, plug-in hybrid, diesel
- Mileage: under X miles
- Price: under/around/between $X

**Rule: Fire at ANCHOR + 1 REFINER. Ask at most ONE clarifying question before firing.**

Cue phrases (any one of these triggers intent extraction):
- "I completely understand what you're looking for"
- "Let me check what we have that matches your needs"
- "I'm pulling up vehicles that fit your criteria"
- "Checking our inventory based on what you described"

**CODEX summary format (strict field order)**:
```
[Condition] [Body type] [Use case] [Priority tags] [Drive type] [Fuel type] [Mileage] [under/around Price]
```
Example: "used SUV for family hauling prioritizing safety AWD under $40,000"

### Prompt Architecture (`backend/src/prompts/`)

| File | Purpose |
|------|---------|
| `stream.ts` | Car consultant persona + ANCHOR/REFINER rules + CODEX cues |
| `intentWithCue.ts` | Vehicle filter extraction from CODEX summary |
| `rerank.ts` | Vehicle re-ranking on metadata (use case, priority, budget, condition) |

### Frontend Widget (`client/src/Widget.svelte`)

**Technology**: Svelte 5 (runes) + TypeScript + Vite

**Key Features**:
- CODEX cue detection → intent → recommendations flow
- 5-step guided flow (Condition → Use Case → Body Type → Priorities → Budget)
- Rich vehicle product cards with condition/body/drive/fuel badges
- 5 car education panels in the guide menu
- localStorage persistence for entire conversation
- SSE streaming with buffered parsing

**Quick-start suggestions (Merchant Advisor)**: Family SUV under $40k, Reliable Daily Driver, Truck for Work, Best Fuel Economy, Fun to Drive, Surprise Me

**5 Guided Flow Steps**:
1. **Condition** — New | Used/Pre-Owned | Certified Pre-Owned (CPO) | Surprise Me
2. **Use Case** — Daily Commuting | Family Hauling | Weekend Adventures | Work/Commercial | Performance | Best Fuel Economy
3. **Body Style** — Sedan | SUV/Crossover | Truck | Hatchback/Wagon | Minivan | Coupe/Convertible
4. **Priorities** — Safety | Fuel Economy | Cargo/Space | Towing | Tech | Reliability | Performance | Luxury (multi-select, max 2)
5. **Budget** — Under $15k | $15k–$25k | $25k–$40k | $40k–$60k | $60k+ | Flexible

### Component Library (`Svelte-Component-Library/`)

Reusable Svelte 5 components:
- **ProductCard** — Vehicle-specific: year/make/model/trim title, condition/body_type/drive_type/fuel_type badges, mileage + engine specs, key features chips, "View Vehicle" button
- **ProductRecommendation** — Multiple layouts (compact-list, compact-grid, bubble-grid, carousel) with vehicle badges
- **GuidedFlow** — Multi-step product discovery with single-select, multi-select, price-selector
- **ChatWidget, ChatMessage, ChatBubble, ChatInput** — Chat UI primitives

### Vehicle Schema (`backend/src/vehicle-schema.ts`)

Domain constants and validation for vehicle dimensions:
- Conditions: new, used, cpo
- Body types: sedan, suv, truck, hatchback, minivan, coupe, convertible, wagon, van
- Drive types: fwd, awd, 4wd, rwd
- Fuel types: gasoline, hybrid, electric, diesel, plug-in-hybrid
- Use case tags: family, commuter, adventure, commercial, performance, eco
- Priority tags: safety, fuel-economy, cargo, towing, tech, reliability, performance, luxury

D1 schema at `backend/db/schema.sql`, seed data at `backend/db/seed.sql` (28 demo vehicles).

## Running the Project

### First-Time Setup
```bash
nvm use --lts

# Backend
cd backend
npm install
npx wrangler d1 execute vehicle-catalog --local --file=db/schema.sql
npx wrangler d1 execute vehicle-catalog --local --file=db/seed.sql
npx wrangler dev   # starts on port 9174

# Frontend (new terminal)
cd client
npm install
npm run dev   # starts on port 5173
```

### Verification Checklist
1. `GET /chat/config` → returns Mountain Motors config with car quick-starts
2. POST `/chat/stream` with "reliable SUV for my family under $40k" → CODEX fires with "used or new SUV for family prioritizing reliability under $40,000"
3. POST `/chat/intent` with that CODEX message → returns `body_type: suv, use_case_tags: [family], priority_tags: [reliability], price_max: 40000`
4. POST `/chat/recommendations` with those filters → matching vehicles from D1
5. Widget guided flow: 5 steps → submit → CODEX → recommendations render with vehicle cards
6. Quick-start "Surprise Me" → immediate recommendations

## Development Rules

### Critical Rules
- **Never use `setTimeout` for UI logic** — Use `requestAnimationFrame`, reactive `$effect`, or CSS transitions instead
- **Never break streaming** — always use buffer-based SSE parsing with `split("\n\n")` and incomplete chunk handling
- **Never send `recommendations` array to LLM** — always strip `recommendations` field from messages before sending
- **Never recommend vehicles in general chat** — only triggered when intent = "recommendation"
- **Always enrich history for context** — when a message has recommendations, include a natural summary
- **Brand Concierge make constraint**: Set `normalizedFilters.make = profile.brandName` (NOT `.brand`)
- **Vehicle name computation**: `[result.year, result.make, result.model].filter(Boolean).join(' ')` (no `.name` field)

### CSS Best Practices
- **NEVER use `!important`** — Fix CSS specificity issues properly instead
- Use CSS variables, proper specificity, and `color: inherit` to solve styling conflicts

### Accessibility (WCAG 2.1 AA Required)
- Chat log/live announcements for assistive tech
- Dialog semantics for side panels
- Keyboard operation for all custom controls
- Visible focus indicators
- Reduced-motion support via `prefers-reduced-motion`

### ChatInput Mobile Fix — DO NOT MODIFY
The ChatInput component has a carefully solved mobile tap-detection bug. Do not modify:
- Use `<input type="text">` for single-line (not textarea)
- No `backdrop-filter` on container
- Pointer-events cascade: wrapper `none`, input `auto`
- `align-items: center` (not `flex-end`)
- `touch-action: manipulation` on input and container

### Development Workflow
1. Plan the feature and propose minimal changes
2. Get approval before writing code
3. Implement one focused chunk at a time
4. Modify only necessary files
5. Verify locally (streaming, recommendations, persistence)

### Component Library Integration
- Import directly from `.svelte` files, never `.stories.ts`
- Component Library is a nested git repo — commit changes there separately
- Vite tree-shakes unused components automatically

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Frontend | Svelte 5 + TypeScript + Vite | Lightweight, reactive, ideal for embeddable widgets |
| Backend | Hono + Cloudflare Workers | Edge-fast, free tier |
| Database | Cloudflare D1 | Zero-ops SQLite, integrated with Workers |
| LLM (stream) | Grok (xAI) | Strong conversational quality |
| LLM (intent) | Groq | Fast structured extraction |
| LLM (rerank) | Grok (xAI) | Reasoning quality for vehicle ranking |
| Persistence | localStorage | Simple, private, offline-safe |

## NEXT STEPS

### IDEAS (Unvetted — research only)
- Apify AutoTrader/Cars.com scrapers for real inventory (ToS risk, needs evaluation)
- NHTSA vPIC VIN decode enrichment (free, confirmed working — needs real VINs first)
- VinAudit / EpicVIN history reports ($3–10/report) — viable for post-demo
- Cloudflare Vectorize for semantic search on vehicle descriptions (Phase 2)
- Marketcheck API for price ranking vs. local market average

### Vetted / Ready to Plan
- Dealer direct CSV/DMS export — free, legal, most accurate for real dealer partner
- Self-calculated price score (market avg from scraped set) — no third-party needed for demo
- NHTSA vPIC API — confirmed free, returns HP/drive type/body class/transmission
