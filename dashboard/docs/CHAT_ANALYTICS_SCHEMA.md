# Chat Analytics Schema Contract

Last updated: May 7, 2026
Last live schema confirmation: March 18, 2026 via `vectorizer-qa` D1 `PRAGMA table_info(...)`
Database: `vectorizer-qa`

This file is the source-of-truth contract for the chat analytics tables written by the backend analytics pipeline.

Current lane model:
- QA backend writes to `vectorizer-qa`
- prod backend writes to a separate prod D1 database
- QA and prod analytics must not share one D1 database
- schema must stay identical across both lanes

Maintenance rule:
- Any change to chat analytics D1 tables, columns, defaults, or interpretation rules must update this file in the same change.
- If the schema or interpretation rules change, update [CHAT_ANALYTICS_DASHBOARD_PROMPT.md](/Users/bojanjovanovic/Desktop/Svelte/AiChatBot/CHAT_ANALYTICS_DASHBOARD_PROMPT.md) too.
- If the schema changes, the dashboard project must be told to update its read model and UI assumptions.
- If a new analytics lane is enabled, keep it on the same schema contract and document the lane separation here.

## Model Catalog Maintenance

- Last reviewed: March 20, 2026
- Fast-model constants updated on this date:
  - OpenAI `gpt-5-mini` replaces `gpt-4o-mini`
  - Google `gemini-2.5-flash-lite` was added to the backend model registry
- Periodically re-check official OpenAI, Google Gemini, xAI, and Groq model catalogs and proactively bring it to the maintainer's attention.
- When backend model constants change, update [backend/src/types-and-constants.ts](/Users/bojanjovanovic/Desktop/Svelte/AiChatBot/backend/src/types-and-constants.ts) comments and the maintained Markdown docs in the same change.

## Confirmed Tables

### `chat_sessions`
Includes NY OCM age-gate funnel columns.
Meaning:
- One row per chat visit / session.

Confirmed columns:
- `session_id` `TEXT` primary key
- `store_id` `TEXT`
- `source_page` `TEXT`
- `started_at` `TEXT` not null
- `ended_at` `TEXT`
- `message_count` `INTEGER` not null default `0`
- `sequence_count` `INTEGER` not null default `0`
- `last_activity_at` `TEXT` not null
- `age_gate_rendered_at` `TEXT` (nullable; ISO8601). Set when the age gate is shown to the visitor. Server writes must preserve the first render timestamp with `COALESCE`.
- `age_confirmed_at` `TEXT` (nullable; ISO8601). Set when the user clicks "I'm 21 or older" in the chatbot age gate. NULL means either (a) the user has not yet confirmed in this session, or (b) this session predates the age-gate retrofit. Once set, it is preserved across re-confirmation attempts (server uses `COALESCE` to keep the first timestamp).
- `age_declined_at` `TEXT` (nullable; ISO8601). Set only when the user explicitly declines the age gate. If the gate was rendered and neither `age_confirmed_at` nor `age_declined_at` is set, treat the session as abandoned / no decision, not as a compliance failure.
- `created_at` `TEXT` not null
- `updated_at` `TEXT` not null

Indexes:
- `idx_chat_sessions_age_gate_rendered_at` on `age_gate_rendered_at` — supports gate render coverage and funnel ordering checks.
- `idx_chat_sessions_age_confirmed_at` on `age_confirmed_at` — supports OCM evidence queries ("what fraction of sessions confirmed 21+?").
- `idx_chat_sessions_age_declined_at` on `age_declined_at` — supports explicit-decline reporting.

### `chat_messages`
Meaning:
- One row per user-authored message plus the backend handling for that ask.
- This table is the main source for Queries analytics.
- `assistant_response_text` is stored on the same row; assistant bubbles are not stored as separate rows in v1.

Confirmed columns:
- `message_id` `TEXT` primary key
- `session_id` `TEXT` not null
- `search_sequence_id` `TEXT` not null
- `message_index` `INTEGER` not null
- `user_text_raw` `TEXT`
- `user_text_normalized` `TEXT`
- `assistant_response_text` `TEXT`
- `predicted_cue` `TEXT`
- `predicted_intent` `TEXT`
- `predicted_filters_json` `TEXT`
- `semantic_search` `TEXT`
- `product_query` `TEXT`
- `result_count` `INTEGER`
- `pre_rank_count` `INTEGER`
- `final_rank_count` `INTEGER`
- `latency_ms` `INTEGER`
- `status` `TEXT`
- `error_code` `TEXT`
- `fallback_reason` `TEXT`
- `created_at` `TEXT` not null
- `updated_at` `TEXT` not null

### `chat_search_sequences`
Meaning:
- One row per related chain of messages around the same user need.
- This table is the source for unresolved and sequence-quality analytics.
- This table is not the source for the Queries tab.

Confirmed columns:
- `search_sequence_id` `TEXT` primary key
- `session_id` `TEXT` not null
- `started_at` `TEXT` not null
- `ended_at` `TEXT`
- `status` `TEXT` not null default `'open'`
- `first_message_id` `TEXT`
- `last_message_id` `TEXT`
- `message_count` `INTEGER` not null default `0`
- `resolved_query_text` `TEXT`
- `resolved_query_normalized` `TEXT`
- `resolved_bucket_label` `TEXT`
- `resolved_product_id` `TEXT`
- `cue_verdict` `TEXT` not null default `'unknown'`
- `intent_verdict` `TEXT` not null default `'unknown'`
- `recommendation_verdict` `TEXT` not null default `'unknown'`
- `satisfaction_verdict` `TEXT` not null default `'open'`
- `reason_codes_json` `TEXT`
- `created_at` `TEXT` not null
- `updated_at` `TEXT` not null

### `chat_message_products`
Meaning:
- One row per product shown for a given message.
- This table powers Products analytics and message/session drilldown.

Confirmed columns:
- `message_product_id` `TEXT` primary key
- `message_id` `TEXT` not null
- `session_id` `TEXT` not null
- `search_sequence_id` `TEXT` not null
- `product_id` `TEXT`
- `product_name` `TEXT`
- `brand` `TEXT`
- `category` `TEXT`
- `subcategory` `TEXT`
- `rank_position` `INTEGER`
- `source_kind` `TEXT`
- `shown_at` `TEXT` not null
- `clicked_at` `TEXT`
- `external_clicked_at` `TEXT`

### `chat_events`
Meaning:
- Append-only interaction/event log.

Confirmed columns:
- `event_id` `TEXT` primary key
- `session_id` `TEXT` not null
- `message_id` `TEXT`
- `search_sequence_id` `TEXT`
- `event_type` `TEXT` not null
- `product_id` `TEXT`
- `rank_position` `INTEGER`
- `payload_json` `TEXT`
- `occurred_at` `TEXT` not null

## Interpretation Rules

These rules are part of the schema contract for downstream consumers.

### Queries tab
- Source: `chat_messages`
- Group by: `user_text_normalized`
- Display text source: `user_text_raw` or normalized representative
- Timestamp source: `created_at`
- Exclude low-signal confirmation messages such as:
  - `yes`
  - `yeah`
  - `yep`
  - `ok`
  - `okay`
  - `sure`
  - `that one`
  - `this one`

### Sessions tab
- Source: `chat_sessions`
- One row per `session_id`
- Session detail must load `chat_messages` by `session_id`, ordered by `message_index ASC`
- Session detail should attach:
  - products from `chat_message_products` by `message_id`
  - events from `chat_events` by `session_id` and/or `message_id`

### Unresolved tab
- Source: `chat_search_sequences`
- Only include rows where `status = 'unresolved'`
- `status = 'open'` is not unresolved
- A clarification inside an open sequence is not unresolved by itself

### Products tab
- Source: `chat_message_products`
- Aggregate by `product_id` and/or `product_name`
- Use:
  - `shown_at`
  - `clicked_at`
  - `external_clicked_at`
  - `rank_position`

### Sequence semantics
- `chat_search_sequences` groups related messages for one user need
- It should be used for:
  - unresolved analysis
  - quality verdicts
  - reformulation chains
- Genuine no-product-match / no-results analytics must use structured sequence reasons:
  `reason_codes_json` containing `"no_results"`.
- Do not infer no-results from `chat_messages.result_count IS NULL` or `COALESCE(result_count, 0) = 0`; compliance refusals and other non-search messages can have null result counts.
- It should not be used as the primary source of “most searched queries”

### Compliance event types

The following `event_type` values are emitted by the NY OCM compliance gate (introduced in the chatbot retrofit). They are append-only entries on `chat_events` and never contain raw user text — only structured metadata in `payload_json`.

- `age_confirmed`
  - When: the user clicked "I'm 21 or older" in the chatbot age gate.
  - The same write also sets `chat_sessions.age_confirmed_at` (idempotent — first confirmation timestamp wins).
  - `payload_json` is `NULL` for this event type. The `occurred_at` column is the audit timestamp.
  - One row per session, on first confirmation. Re-clicks within the same session are no-ops on the column but may produce additional event rows; use `MIN(occurred_at)` to dedupe if needed.
  - Dashboard interpretation: use `chat_sessions.age_confirmed_at`, not `age_confirmed` event count, for age evidence. `age_confirmed` is an audit trail row, not the primary rate source. Keep `age_confirmed` out of event-log filters because it has no category/stem/tier/layer payload.

- `age_gate_rendered`
  - When: the age gate dialog mounts for a chat session.
  - The same write sets `chat_sessions.age_gate_rendered_at` with `COALESCE` so remounts preserve the first render timestamp.
  - `payload_json` is `NULL` for this event type unless the backend adds non-content diagnostics later.
  - One row per session is preferred. If historical duplicates exist, dashboard funnel metrics must use `chat_sessions.age_gate_rendered_at` and may use `MIN(occurred_at)` only for event-log audit views.
  - Dashboard interpretation: this is the denominator for "was the gate shown?" evidence. Gate render coverage is `COUNT(chat_sessions WHERE age_gate_rendered_at IS NOT NULL) / COUNT(chat_sessions)` for the selected lane/date range.

- `age_declined`
  - When: the user explicitly declines the age gate (including any client action mapped to an intentional decline, such as the dialog's decline handler).
  - The same write sets `chat_sessions.age_declined_at`.
  - `payload_json` is `NULL` for this event type unless the backend adds non-content diagnostics later.
  - Dashboard interpretation: declines are a separate yellow/neutral funnel outcome, not a failure. They prove the gate gave the user a way not to continue.

- `age_gate_bypass_detected`
  - When: backend validation detects timestamp ordering that indicates a visitor could send or complete a message without the proper age-gate sequence.
  - `payload_json` shape:
    - `violation` (string) — expected values include `missing_confirmation`, `confirmation_after_message`, and `no_render_before_confirmation`
    - `first_message_at` (string, optional ISO8601) — earliest `chat_messages.created_at` for the session at detection time
    - `age_gate_rendered_at` (string, optional ISO8601)
    - `age_confirmed_at` (string, optional ISO8601)
    - `age_declined_at` (string, optional ISO8601)
  - Prefer one event per `session_id` + `violation` type, with `message_id` populated when the bypass can be linked to a specific message.
  - Dashboard interpretation: this is the red age-gate compliance failure signal. The main "Allowed Into Chat" metric should be `valid_age_order_sessions / active_sessions`, where a valid active session has `age_gate_rendered_at <= age_confirmed_at <= first_message_at`.

- `compliance_refusal_strict`
  - When: user input matched a strict-tier compliance term (medical condition, therapeutic verb, dosing/medical, pregnancy, underage, crisis, abuse). The request was refused **before** any LLM call.
  - `payload_json` shape:
    - `category` (string) — one of `medical_condition`, `therapeutic_verb`, `dosing`, `pregnancy`, `underage`, `crisis`, `abuse`
    - `matched_stem` (string) — canonical stem (e.g. `anxiety`, `pain`, `prescription`)
    - `layer` (number) — 2 = exact stem match, 3 = bounded fuzzy match
    - `score` (number, optional) — Levenshtein distance, present only on layer 3 matches
    - `tier` (string) — always `strict` for this event type
  - One event row is appended **per matched term** in the same user message. A single message can therefore yield multiple `compliance_refusal_strict` rows.
  - This is the OCM evidence that no LLM-generated medical/therapeutic claim could have been served for the matched request.
  - Current limitation: phrase-based underage self-disclosures, crisis phrases, and abuse signals may be handled by prompt fallback without producing `compliance_refusal_strict` rows. Dashboard strict-refusal counts are deterministic gate catches and should be treated as a lower bound, not complete refusal totals.

- `compliance_disclaimer_attached`
  - When: user input matched a non-strict compliance term (counsel-approved retail handling). The gate did **not** block; the backend prepended a counsel-approved retail disclaimer to the streamed response and let the normal flow continue.
  - `payload_json` shape: same as `compliance_refusal_strict` (`category`, `matched_stem`, `layer`, optional `score`, `tier=non_strict`).
  - One row per matched term.
  - Default-empty until counsel populates the non-strict tier in `backend/src/compliance/complianceTerms.ts`. As of this dashboard update, `NON_STRICT_TERMS` is intentionally empty, so low disclaimer volume means the branch is dormant rather than lightly used.

- `compliance_near_miss`
  - When: a token in the user input was within Levenshtein distance ≤ 3 of a strict-tier stem but did not meet the per-stem-length fuzzy threshold (so the gate did **not** block).
  - `payload_json` shape:
    - `token_stem` (string) — the input token's stem
    - `nearest_stem` (string) — the closest strict stem
    - `score` (number) — Levenshtein distance to the nearest stem
  - Used purely as a counsel-tuning signal: if real traffic shows a stem the matcher is "almost" catching, counsel can decide to add a synonym, lower the fuzzy threshold, or accept the residual risk.
  - Dashboard interpretation: raw event counts can duplicate a single user message when multiple backend paths log the same signal. Tuning views should show distinct `message_id` counts alongside event counts and default to higher-confidence rows such as `score <= 2`.
  - This event is informational; it is never a refusal.

- `bot_output_therapeutic_drift`
  - When: the post-stream therapeutic-drift validator detected a strict-tier term in the LLM's assembled output (assistant response). The validator skips the canonical refusal message verbatim and the retail-disclaimer prefix automatically.
  - The backend appends a counsel-approved correction note to the same response (does not replace — the response was already streamed).
  - `payload_json` shape:
    - `matched_stem` (string) — canonical stem the LLM drifted into (e.g. `anxiety`, `pain`)
    - `category` (string) — same enumeration as the strict refusal categories
  - One row per response. If multiple strict terms drift in the same response, only the first match is logged (the validator returns on first hit).
  - Current caveat: canonical cannabis effect terms (for example sleep/sleepy) and crisis-resource text can be known false positives. Dashboard rows should be manually reviewed before being treated as true drift.
  - **Tuning signal:** if `bot_output_therapeutic_drift` events exceed ~0.5% of `recordStreamCompletion` events in real traffic, promote the validator to in-stream sentence-level blocking (fast-follow).

- `warning_rendered`
  - When: a NY OCM Part 129.2 warning block first mounted on a product-recommendation message in the chatbot UI. Fires exactly once per message (the client uses `$effect` with a one-shot guard).
  - Joined back to a `chat_message` row via `message_id`. The combination of `chat_messages` rows that have `chat_message_products` rows AND a matching `warning_rendered` event row is the OCM evidence that the statutory warning was actually shown.
  - `payload_json` shape:
    - `warning_index` (number) — current implementation emits `0`. The original rotation contract called for a deterministic index per `message_id`, but warning rotation is not implemented yet.
  - **Privacy:** no product names, no warning text — the dashboard renders the human-readable warning by indexing into its own copy of the array.

- `bot_output_slang_sanitized`
  - When: the in-stream slang sanitizer replaced one or more output-only-slang terms in the LLM's response (e.g. `weed` → `cannabis`, `stoner` → `cannabis customer`).
  - `payload_json` shape:
    - `replacement_count` (number) — total replacements across all terms in this response
    - `terms` (array) — `[{ term: "weed", count: 3 }, ...]` per-term breakdown
  - Fired exactly once per response, only when `replacement_count > 0`.
  - **Tuning signal:** if non-zero in real traffic, consider a one-line stream-prompt deletion as a fast-follow to stop modeling slang at all (additive prompt edits remain disallowed).

**Privacy contract:** none of these events contain `user_text_raw`, `user_text_normalized`, or any other surrounding text from either the user input or the assistant response. The dashboard may display only structured payload fields such as category, matched stem, tier, layer, score, violation, timestamps, and replacement counts. This keeps PHI/PII out of the analytics table while preserving OCM auditability.

## Recommended Verification Queries

### Verify schema live
```sql
PRAGMA table_info(chat_sessions);
PRAGMA table_info(chat_messages);
PRAGMA table_info(chat_search_sequences);
PRAGMA table_info(chat_message_products);
PRAGMA table_info(chat_events);
```

### Verify counts
```sql
SELECT 'sessions' AS metric, COUNT(*) AS count FROM chat_sessions
UNION ALL
SELECT 'messages' AS metric, COUNT(*) AS count FROM chat_messages
UNION ALL
SELECT 'search_sequences' AS metric, COUNT(*) AS count FROM chat_search_sequences
UNION ALL
SELECT 'message_products' AS metric, COUNT(*) AS count FROM chat_message_products
UNION ALL
SELECT 'events' AS metric, COUNT(*) AS count FROM chat_events;
```

### Verify recent message activity
```sql
SELECT
  message_id,
  session_id,
  user_text_raw,
  predicted_cue,
  predicted_intent,
  result_count,
  status,
  fallback_reason,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 20;
```
