# Chat Analytics Dashboard Handoff Prompt

Last updated: May 7, 2026
Schema source of truth: [CHAT_ANALYTICS_SCHEMA.md](/Users/bojanjovanovic/Desktop/Svelte/AiChatBot/CHAT_ANALYTICS_SCHEMA.md)

## Model Catalog Maintenance

- Last reviewed: March 20, 2026
- Fast-model constants updated on this date:
  - OpenAI `gpt-5-mini` replaces `gpt-4o-mini`
  - Google `gemini-2.5-flash-lite` was added to the backend model registry
- Periodically re-check official OpenAI, Google Gemini, xAI, and Groq model catalogs and proactively bring it to the maintainer's attention.
- When backend model constants change, update [backend/src/types-and-constants.ts](/Users/bojanjovanovic/Desktop/Svelte/AiChatBot/backend/src/types-and-constants.ts) comments and the maintained Markdown docs in the same change.

Use this prompt when handing the dashboard/FastAPI project the live chat analytics contract.

## Prompt

Prepare Chat Analytics to consume real Cloudflare D1 data instead of dummy data.

Lane model:
- QA analytics live in a QA D1 database
- prod analytics live in a separate prod D1 database
- QA and prod analytics must not be mixed in one read model by default
- if the dashboard needs to inspect both, add an explicit `QA | PROD` lane selector and query only one lane at a time

Use this D1 schema as the source of truth:
- `chat_sessions`
- `chat_messages`
- `chat_search_sequences`
- `chat_message_products`
- `chat_events`

Important interpretation rules:
- `chat_messages` is the main source for the Queries tab.
- One `chat_messages` row represents one user-authored message plus the backend handling and final assistant response for that ask.
- `chat_search_sequences` is for unresolved/sequence-quality analysis, not the primary source for Queries.
- The Unresolved tab must only use `chat_search_sequences` where `status = 'unresolved'`.
- Do not treat `open` sequences as unresolved.
- Do not treat `clarification` inside an open sequence as unresolved by itself.
- Sessions should represent full chat visits from `chat_sessions`, not a flattened latest-query summary.

Build or update these screens:

### 1. Overview
- Aggregate from `chat_messages` and `chat_search_sequences`
- Total Queries = count of filtered query messages, not count of sequences
- No-results / No Product Match rate = count of `chat_search_sequences` whose structured `reason_codes_json` contains `"no_results"` divided by filtered search sequences. Do **not** infer no-results from `chat_messages.result_count IS NULL` or `COALESCE(result_count, 0) = 0`; compliance refusals and other non-search messages can have null result counts.
- Compliance refusals = separate `chat_events` rows where `event_type = 'compliance_refusal_strict'`; show them as their own Overview signal, not as no-results.
- Click-through rate = clicks / results shown using `chat_message_products`
- Unresolved rate = count of `chat_search_sequences` with `status = 'unresolved'`
- Top bucket = based on query/message grouping, not latest sequence text

### 2. Queries
- Source: `chat_messages`
- Group by `user_text_normalized`
- Exclude low-signal confirmations such as:
  - `yes`, `yeah`, `yep`, `ok`, `okay`, `sure`, `that one`, `this one`
- Show:
  - query
  - searches
  - results shown
  - clicks
  - ctr
  - unresolved count
  - last seen
- Use `created_at` for time-based aggregation

### 3. Unresolved
- Source: `chat_search_sequences`
- Only rows with `status = 'unresolved'`
- Show:
  - `resolved_query_text`
  - `reason_codes_json`
  - `message_count`
  - `cue_verdict`
  - `intent_verdict`
  - `recommendation_verdict`
  - `satisfaction_verdict`
  - `started_at`
  - `ended_at`

### 4. Products
- Source: `chat_message_products`
- Aggregate by `product_id` and/or `product_name`
- Show:
  - mentions
  - clicks
  - external clicks
  - ctr
  - last seen

### 5. Sessions
- Source: `chat_sessions`
- One row per `session_id`
- Show:
  - session_id
  - message_count
  - sequence_count
  - total results shown
  - total clicks
  - reformulated yes/no
  - exited yes/no
  - started_at
  - last_activity_at

### 6. Session detail
- Clicking a session row should open a detail page or drawer
- Load `chat_messages` for the session ordered by `message_index ASC`
- For each message show:
  - `user_text_raw`
  - `assistant_response_text`
  - `predicted_cue`
  - `predicted_intent`
  - `result_count`
  - `status`
  - `fallback_reason`
  - `created_at`
- Under each message show products from `chat_message_products` ordered by `rank_position`
- Also show related `chat_events` ordered by `occurred_at`

### Read-layer requirements
- Build read-only FastAPI endpoints over Cloudflare D1
- Visualize fields returned by the API
- Do not invent new classification logic in the dashboard
- Tolerate nulls
- Keep existing UI structure and styling; this is a data interpretation update, not a redesign
- If QA and prod are both exposed, keep the selected lane in URL/state and never mix their rows in the same table

### 7. Compliance

This tab surfaces NY OCM evidence and counsel-tuning signals from the chatbot's compliance gate.

- Sources: `chat_sessions` for age-gate funnel evidence, `chat_events` for compliance signal rows, and `chat_message_products` plus `warning_rendered` events for warning coverage.
- Counters (last 7d / 30d / total):
  - **Gate render coverage** — use `chat_sessions.started_at` for date filtering. Numerator: `COUNT(chat_sessions WHERE age_gate_rendered_at IS NOT NULL)`. Denominator: `COUNT(chat_sessions)`. This is the primary "was the gate shown to everyone who opened chat?" evidence card.
  - **Allowed into chat** — numerator: active sessions (`message_count > 0`) with valid timestamp order: `age_gate_rendered_at <= age_confirmed_at <= first chat_messages.created_at`. Denominator: active sessions (`message_count > 0`). This should be green only when effectively 100% and no bypass flags exist.
  - **Accepted age gate** — numerator: `COUNT(chat_sessions WHERE age_confirmed_at IS NOT NULL)`. Denominator: rendered sessions (`age_gate_rendered_at IS NOT NULL`). This is an acceptance funnel metric, not a red compliance-failure metric.
  - **Declined age gate** — numerator: `COUNT(chat_sessions WHERE age_declined_at IS NOT NULL)`. Denominator: rendered sessions. Render yellow/neutral, not red.
  - **No decision / abandoned gate** — rendered sessions with no `age_confirmed_at`, no `age_declined_at`, and `message_count = 0`. Render neutral; this means the visitor did not proceed.
  - **Bypass flags** — `WHERE event_type = 'age_gate_bypass_detected'` count, plus distinct message/session counts. This is the red age-gate failure signal.
  - **Strict refusals** — `WHERE event_type = 'compliance_refusal_strict'` count
  - **Disclaimers attached** — `WHERE event_type = 'compliance_disclaimer_attached'` count
  - **Near-misses** — `WHERE event_type = 'compliance_near_miss'` count
  - **Output drift** — `WHERE event_type = 'bot_output_therapeutic_drift'` count
  - **Output slang sanitized** — `WHERE event_type = 'bot_output_slang_sanitized'` count, plus the SUM of `payload_json->>'replacement_count'`
  - **Warning render rate** — for messages with attached products (rows in `chat_message_products`), the % that have a matching `warning_rendered` event row. Should be at or near 100% in steady state; a sustained drop is the signal that the rendering pipeline broke.
  - **Warning session coverage** — for sessions with attached products, the % that have at least one `warning_rendered` event. This is the session-level OCM coverage metric; the per-message warning rate remains useful for renderer debugging.
- Time-series chart of the age funnel plus compliance counts above, daily buckets. Age-gate series use `chat_sessions.started_at` for daily bucketing. Compliance events use `chat_events.occurred_at`. Warning coverage uses `chat_message_products.shown_at`.
- Per-category breakdown for strict refusals: group by `payload_json->>'category'` (known categories include `medical_condition`, `therapeutic_verb`, `dosing`, `pregnancy`, `underage`, `crisis`, `abuse`); show top 10 matched stems within each. Do not hard-code the UI to omit unknown future categories.
- **Refused sessions:** distinct count of `session_id` where any `compliance_refusal_strict` event occurred (drilldown shows all events on that session, not the user text)
- **Page-level filters:** date range and lane apply to evidence cards, compliance signals, trend, tuning views, and event log.
- **Event-log filter controls:** scope compliance event type, `payload_json->>'category'`, `payload_json->>'matched_stem'`, `payload_json->>'tier'`, `payload_json->>'layer'`, and `session_id` directly to the event log table. Do not place these controls above the summary cards in a way that implies they affect the full page. Do not include `age_confirmed` in the event type dropdown; age confirmation is represented by `chat_sessions.age_confirmed_at` in the summary cards. Include `age_gate_rendered`, `age_declined`, and `age_gate_bypass_detected` once the backend writes them.
- **Privacy contract:** never display `user_text_raw` or assistant response text in the Compliance tab's event/tuning tables. Show only structured payload fields such as `category`, `matched_stem`, `nearest_stem`, `tier`, `layer`, optional `score`, `violation`, timestamps, and event occurrence time. Full session detail may still show the transcript because that is the existing session drilldown surface, not the compliance event table.
- **Bypass tuning view:** group `age_gate_bypass_detected` rows by `payload_json->>'violation'`; show events, distinct messages, distinct sessions, and latest occurrence. Drilldown should open the session transcript and show only structured event payload metadata for the bypass event.
- **Near-miss tuning view:** group near-miss rows by `payload_json->>'nearest_stem'`; rank by frequency; show both raw event count and `COUNT(DISTINCT message_id)`. Default the tuning view to higher-confidence rows such as `score <= 2` so low-quality distance-3 noise does not dominate.
- **Output drift tuning view:** group `bot_output_therapeutic_drift` rows by `payload_json->>'matched_stem'`; rank by frequency. If the top stem accounts for >50% of drift events, that is the signal to either tighten the corresponding prompt rule (Chunk 2 follow-up) or promote the validator to in-stream blocking. Add a caveat that canonical cannabis effects and crisis-resource text can be false positives and require manual review.
- **Slang counts:** for `bot_output_slang_sanitized`, render a per-term breakdown by exploding `payload_json->>'terms'`. Track which slang terms the LLM uses most; non-zero counts are the trigger to consider a one-line stream-prompt deletion (no additions).
- **Disclaimer branch state:** label that `NON_STRICT_TERMS` is currently empty / 0 active terms, so low `compliance_disclaimer_attached` volume means the branch is dormant.
- **Phrase-based caveat:** strict refusal counts are deterministic gate catches only. Phrase-based underage, crisis, and abuse handling routed through prompt fallback does not emit `compliance_refusal_strict`, so dashboard strict counts are lower-bound evidence rather than complete refusal totals.
- **Warning index caveat:** `warning_index` currently emits `0`; deterministic rotation across warning variants is not implemented yet. Do not build warning-variant analytics as if rotation is live.

## Maintenance Reminder

If the schema or interpretation rules change in this repo:
- update [CHAT_ANALYTICS_SCHEMA.md](/Users/bojanjovanovic/Desktop/Svelte/AiChatBot/CHAT_ANALYTICS_SCHEMA.md)
- update this prompt file
- notify the dashboard project that the contract changed
