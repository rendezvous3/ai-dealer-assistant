"""
Chat Analytics — D1 read layer.

Schema contract: see CHAT_ANALYTICS_SCHEMA.md

Key interpretation rules:
  - Queries tab: from chat_messages grouped by user_text_normalized
  - Sessions tab: from chat_sessions (one row per session)
  - Session detail: chat_messages by session_id + related products + events
  - Unresolved tab: chat_search_sequences WHERE status = 'unresolved'
  - Products tab: chat_message_products aggregated by product_name
  - Overview: aggregates from chat_messages + chat_search_sequences
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from lib.d1_client import D1ReadClient

router = APIRouter()


# ─── Shared helpers ──────────────────────────────────────────────────────────


def _client(lane: str | None = None) -> D1ReadClient:
    try:
        return D1ReadClient.for_lane(lane)
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"D1 config missing: {e}")


def _parse_json_col(value: str | None) -> dict | list | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def _safe_rate(numerator: int | float, denominator: int | float) -> float:
    if not denominator:
        return 0.0
    return round(numerator / denominator * 100, 1)


def _row_int(row: dict, key: str, default: int = 0) -> int:
    v = row.get(key)
    if v is None:
        return default
    return int(v)


def _row_float(row: dict, key: str, default: float = 0.0) -> float:
    v = row.get(key)
    if v is None:
        return default
    return float(v)


# Low-signal confirmation messages excluded from Queries aggregation
_CONFIRMATION_WORDS = {
    "yes", "yeah", "yep", "ok", "okay", "sure", "that one", "this one",
}


def _confirmation_exclusion_sql() -> str:
    """SQL clause to exclude low-signal confirmation messages."""
    quoted = ", ".join(f"'{w}'" for w in sorted(_CONFIRMATION_WORDS))
    return f"m.user_text_normalized NOT IN ({quoted})"


def _msg_where(
    *,
    search: str | None = None,
    started_after: str | None = None,
    started_before: str | None = None,
    unresolved_only: bool = False,
) -> str:
    """Build a WHERE clause for chat_messages filters."""
    q = D1ReadClient.sql_quote
    clauses: list[str] = [
        "m.user_text_normalized IS NOT NULL",
        _confirmation_exclusion_sql(),
    ]
    if search:
        clauses.append(f"m.user_text_normalized LIKE {q(f'%{search}%')}")
    if started_after:
        clauses.append(f"m.created_at >= {q(started_after)}")
    if started_before:
        clauses.append(f"m.created_at <= {q(started_before)}")
    if unresolved_only:
        clauses.append(
            "EXISTS (SELECT 1 FROM chat_search_sequences sq2"
            " WHERE sq2.search_sequence_id = m.search_sequence_id"
            " AND sq2.status = 'unresolved')"
        )
    return " WHERE " + " AND ".join(clauses)


def _reason_code_exists_sql(column: str, code: str) -> str:
    q = D1ReadClient.sql_quote
    safe_json = f"CASE WHEN {column} IS NOT NULL AND json_valid({column}) THEN {column} ELSE '[]' END"
    return f"EXISTS (SELECT 1 FROM json_each({safe_json}) AS rc WHERE rc.value = {q(code)})"


def _seq_filter_where(
    *,
    search: str | None = None,
    bucket: str | None = None,
    started_after: str | None = None,
    started_before: str | None = None,
    unresolved_only: bool = False,
) -> str:
    """Build a WHERE clause for chat_search_sequences filters."""
    q = D1ReadClient.sql_quote
    clauses: list[str] = []
    if search:
        clauses.append(
            "("
            f"resolved_query_normalized LIKE {q(f'%{search}%')}"
            f" OR resolved_query_text LIKE {q(f'%{search}%')}"
            ")"
        )
    if bucket:
        clauses.append(f"resolved_bucket_label = {q(bucket)}")
    if started_after:
        clauses.append(f"started_at >= {q(started_after)}")
    if started_before:
        clauses.append(f"started_at <= {q(started_before)}")
    if unresolved_only:
        clauses.append("status = 'unresolved'")
    return _where(clauses)


def _seq_unresolved_where(
    *,
    search: str | None = None,
    bucket: str | None = None,
    started_after: str | None = None,
    started_before: str | None = None,
) -> str:
    """WHERE clause for unresolved sequences only."""
    q = D1ReadClient.sql_quote
    clauses: list[str] = ["status = 'unresolved'"]
    if search:
        clauses.append(f"resolved_query_normalized LIKE {q(f'%{search}%')}")
    if bucket:
        clauses.append(f"resolved_bucket_label = {q(bucket)}")
    if started_after:
        clauses.append(f"started_at >= {q(started_after)}")
    if started_before:
        clauses.append(f"started_at <= {q(started_before)}")
    return " WHERE " + " AND ".join(clauses)


def _product_where(
    *,
    search: str | None = None,
    started_after: str | None = None,
    started_before: str | None = None,
) -> str:
    """Build a WHERE clause for chat_message_products filters."""
    q = D1ReadClient.sql_quote
    clauses: list[str] = []
    if search:
        clauses.append(f"product_name LIKE {q(f'%{search}%')}")
    if started_after:
        clauses.append(f"shown_at >= {q(started_after)}")
    if started_before:
        clauses.append(f"shown_at <= {q(started_before)}")
    return (" WHERE " + " AND ".join(clauses)) if clauses else ""


_PRODUCT_SORT_COLS = {
    "product": "product",
    "mentions": "mentions",
    "clicks": "clicks",
    "external_clicks": "external_clicks",
    "ctr": "ctr",
    "last_seen": "last_seen",
}


def _product_sort(sort_by: str | None, sort_dir: str | None) -> str:
    col = _PRODUCT_SORT_COLS.get(sort_by or "", "mentions")
    direction = "ASC" if sort_dir == "asc" else "DESC"
    return f"{col} {direction}"


# ─── Compliance helpers ─────────────────────────────────────────────────────


_COMPLIANCE_EVENT_TYPES = (
    "age_confirmed",
    "age_gate_rendered",
    "age_declined",
    "age_gate_bypass_detected",
    "compliance_refusal_strict",
    "compliance_disclaimer_attached",
    "compliance_near_miss",
    "bot_output_therapeutic_drift",
    "bot_output_slang_sanitized",
    "warning_rendered",
)

_COMPLIANCE_LOG_EVENT_TYPES = tuple(
    event_type for event_type in _COMPLIANCE_EVENT_TYPES if event_type != "age_confirmed"
)

_COMPLIANCE_CATEGORIES = (
    "medical_condition",
    "therapeutic_verb",
    "dosing",
    "pregnancy",
    "underage",
    "crisis",
    "abuse",
)


def _json_value(column: str, path: str) -> str:
    return (
        f"CASE WHEN {column} IS NOT NULL AND json_valid({column})"
        f" THEN json_extract({column}, '{path}') ELSE NULL END"
    )


def _json_text(column: str, path: str) -> str:
    return f"CAST({_json_value(column, path)} AS TEXT)"


def _date_after(value: str | None) -> str | None:
    if not value:
        return None
    return f"{value}T00:00:00Z" if len(value) == 10 else value


def _date_before(value: str | None) -> str | None:
    if not value:
        return None
    return f"{value}T23:59:59.999Z" if len(value) == 10 else value


def _days_ago_iso(days: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _time_clauses(
    *,
    column: str,
    started_after: str | None = None,
    started_before: str | None = None,
) -> list[str]:
    q = D1ReadClient.sql_quote
    clauses: list[str] = []
    after = _date_after(started_after)
    before = _date_before(started_before)
    if after:
        clauses.append(f"{column} >= {q(after)}")
    if before:
        clauses.append(f"{column} <= {q(before)}")
    return clauses


def _where(clauses: list[str]) -> str:
    return (" WHERE " + " AND ".join(clauses)) if clauses else ""


def _event_type_in_sql() -> str:
    q = D1ReadClient.sql_quote
    return "(" + ", ".join(q(t) for t in _COMPLIANCE_EVENT_TYPES) + ")"


def _log_event_type_in_sql() -> str:
    q = D1ReadClient.sql_quote
    return "(" + ", ".join(q(t) for t in _COMPLIANCE_LOG_EVENT_TYPES) + ")"


async def _table_columns(client: D1ReadClient, table_name: str) -> set[str]:
    rows = await client.exec_sql(f"PRAGMA table_info({table_name})")
    return {str(row.get("name")) for row in rows if row.get("name")}


def _compliance_event_where(
    *,
    event_type: str | None = None,
    category: str | None = None,
    matched_stem: str | None = None,
    tier: str | None = None,
    layer: str | None = None,
    session_id: str | None = None,
    started_after: str | None = None,
    started_before: str | None = None,
) -> str:
    q = D1ReadClient.sql_quote
    clauses = [f"e.event_type IN {_log_event_type_in_sql()}"]
    if event_type:
        if event_type not in _COMPLIANCE_LOG_EVENT_TYPES:
            clauses.append("1 = 0")
        else:
            clauses.append(f"e.event_type = {q(event_type)}")
    if category:
        clauses.append(f"{_json_text('e.payload_json', '$.category')} = {q(category)}")
    if matched_stem:
        clauses.append(
            "("
            f"{_json_text('e.payload_json', '$.matched_stem')} = {q(matched_stem)}"
            " OR "
            f"{_json_text('e.payload_json', '$.nearest_stem')} = {q(matched_stem)}"
            ")"
        )
    if tier:
        clauses.append(f"{_json_text('e.payload_json', '$.tier')} = {q(tier)}")
    if layer:
        clauses.append(f"{_json_text('e.payload_json', '$.layer')} = {q(layer)}")
    if session_id:
        clauses.append(f"e.session_id = {q(session_id)}")
    clauses.extend(
        _time_clauses(
            column="e.occurred_at",
            started_after=started_after,
            started_before=started_before,
        )
    )
    return _where(clauses)


def _parse_terms(value: object) -> list[dict]:
    parsed: object = value
    if isinstance(value, str):
        parsed = _parse_json_col(value)
    if not isinstance(parsed, list):
        return []
    terms: list[dict] = []
    for item in parsed:
        if isinstance(item, dict):
            try:
                count = int(item.get("count") or 0)
            except (TypeError, ValueError):
                count = 0
            terms.append(
                {
                    "term": item.get("term") or "",
                    "count": count,
                }
            )
    return terms


# ─── Buckets ─────────────────────────────────────────────────────────────────


@router.get("/buckets")
async def list_buckets(lane: Optional[str] = None) -> dict:
    client = _client(lane)
    rows = await client.exec_sql(
        "SELECT DISTINCT resolved_bucket_label FROM chat_search_sequences"
        " WHERE resolved_bucket_label IS NOT NULL ORDER BY resolved_bucket_label"
    )
    return {"buckets": [r["resolved_bucket_label"] for r in rows]}


# ─── Overview ────────────────────────────────────────────────────────────────


@router.get("/overview")
async def overview(
    search: Optional[str] = Query(default=None),
    bucket: Optional[str] = Query(default=None),
    unresolved_only: bool = Query(default=False),
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    client = _client(lane)

    q = D1ReadClient.sql_quote

    # Total queries = count of filtered chat_messages (excluding confirmations)
    msg_where = _msg_where(
        search=search,
        started_after=started_after,
        started_before=started_before,
        unresolved_only=unresolved_only,
    )
    bucket_join = ""
    if bucket:
        bucket_join = (
            " JOIN chat_search_sequences sq"
            " ON sq.search_sequence_id = m.search_sequence_id"
            f" AND sq.resolved_bucket_label = {q(bucket)}"
        )
    msg_agg = await client.exec_sql(
        "SELECT"
        "  COUNT(*) AS total_queries"
        f" FROM chat_messages m{bucket_join}{msg_where}"
    )
    ma = msg_agg[0] if msg_agg else {}
    total_queries = _row_int(ma, "total_queries")

    # Click-through rate from chat_message_products
    prod_time_clauses: list[str] = []
    if started_after:
        prod_time_clauses.append(f"shown_at >= {q(started_after)}")
    if started_before:
        prod_time_clauses.append(f"shown_at <= {q(started_before)}")
    prod_time_where = (" WHERE " + " AND ".join(prod_time_clauses)) if prod_time_clauses else ""
    prod_agg = await client.exec_sql(
        "SELECT"
        "  COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS total_shown,"
        "  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS total_clicks"
        f" FROM chat_message_products{prod_time_where}"
    )
    pa = prod_agg[0] if prod_agg else {}
    total_shown = _row_int(pa, "total_shown")
    total_clicks = _row_int(pa, "total_clicks")

    # Sequence-level outcomes. Genuine no-results are reason-code driven;
    # compliance refusals are separate chat_events rows and must not be inferred
    # from chat_messages.result_count being null.
    seq_where = _seq_filter_where(
        search=search,
        bucket=bucket,
        started_after=started_after,
        started_before=started_before,
        unresolved_only=unresolved_only,
    )
    no_results_clause = _reason_code_exists_sql("sq.reason_codes_json", "no_results")
    seq_agg_rows = await client.exec_sql(
        "SELECT"
        "  COUNT(*) AS total_sequences,"
        "  SUM(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) AS ur_count,"
        f"  SUM(CASE WHEN {no_results_clause} THEN 1 ELSE 0 END) AS no_results_count"
        f" FROM chat_search_sequences sq{seq_where}"
    )
    sa = seq_agg_rows[0] if seq_agg_rows else {}
    seq_total = _row_int(sa, "total_sequences")
    ur_count = _row_int(sa, "ur_count")
    nr_count = _row_int(sa, "no_results_count")

    no_result_rows = await client.exec_sql(
        "SELECT"
        "  sq.search_sequence_id,"
        "  sq.session_id,"
        "  sq.first_message_id AS message_id,"
        "  sq.resolved_query_text,"
        "  sq.resolved_query_normalized,"
        "  sq.reason_codes_json,"
        "  sq.status,"
        "  sq.recommendation_verdict,"
        "  sq.started_at"
        f" FROM chat_search_sequences sq{seq_where}"
        f" {'AND' if seq_where else 'WHERE'} {no_results_clause}"
        " ORDER BY sq.started_at DESC LIMIT 5"
    )

    # Unique users (distinct sessions)
    session_time_clauses: list[str] = []
    if started_after:
        session_time_clauses.append(f"started_at >= {q(started_after)}")
    if started_before:
        session_time_clauses.append(f"started_at <= {q(started_before)}")
    session_time_where = (" WHERE " + " AND ".join(session_time_clauses)) if session_time_clauses else ""
    session_rows = await client.exec_sql(
        f"SELECT COUNT(*) AS total_sessions FROM chat_sessions{session_time_where}"
    )
    total_sessions = _row_int(session_rows[0], "total_sessions") if session_rows else 0

    # Top buckets (from sequences)
    bucket_clauses: list[str] = []
    if started_after:
        bucket_clauses.append(f"started_at >= {q(started_after)}")
    if started_before:
        bucket_clauses.append(f"started_at <= {q(started_before)}")
    if search:
        bucket_clauses.append(
            "("
            f"resolved_query_normalized LIKE {q(f'%{search}%')}"
            f" OR resolved_query_text LIKE {q(f'%{search}%')}"
            ")"
        )
    bucket_clauses.append("resolved_bucket_label IS NOT NULL")
    if bucket:
        bucket_clauses.append(f"resolved_bucket_label = {q(bucket)}")
    bucket_where = " WHERE " + " AND ".join(bucket_clauses)
    bucket_rows = await client.exec_sql(
        "SELECT resolved_bucket_label AS bucket, COUNT(*) AS count"
        f" FROM chat_search_sequences{bucket_where}"
        " GROUP BY resolved_bucket_label ORDER BY count DESC LIMIT 10"
    )
    top_buckets = [
        {"bucket": r["bucket"], "count": _row_int(r, "count")}
        for r in bucket_rows
    ]

    no_result_sequences = []
    for r in no_result_rows:
        parsed_reasons = _parse_json_col(r.get("reason_codes_json") or "")
        no_result_sequences.append(
            {
                "search_sequence_id": r.get("search_sequence_id") or "",
                "session_id": r.get("session_id") or "",
                "message_id": r.get("message_id") or "",
                "query": r.get("resolved_query_text") or r.get("resolved_query_normalized") or "",
                "reasons": parsed_reasons if isinstance(parsed_reasons, list) else [],
                "status": r.get("status") or "",
                "recommendation_verdict": r.get("recommendation_verdict") or "",
                "started_at": r.get("started_at"),
            }
        )

    refusal_clauses = ["e.event_type = 'compliance_refusal_strict'"]
    refusal_clauses.extend(
        _time_clauses(
            column="e.occurred_at",
            started_after=started_after,
            started_before=started_before,
        )
    )
    refusal_where = _where(refusal_clauses)
    refusal_agg_rows = await client.exec_sql(
        "SELECT"
        "  COUNT(*) AS event_count,"
        "  COUNT(DISTINCT e.message_id) AS message_count,"
        "  COUNT(DISTINCT e.session_id) AS session_count"
        f" FROM chat_events e{refusal_where}"
    )
    ra = refusal_agg_rows[0] if refusal_agg_rows else {}
    strict_refusal_events = _row_int(ra, "event_count")
    strict_refusal_messages = _row_int(ra, "message_count")
    strict_refusal_sessions = _row_int(ra, "session_count")
    refusal_rows = await client.exec_sql(
        "SELECT"
        "  e.session_id,"
        "  e.message_id,"
        "  e.occurred_at,"
        f"  {_json_text('e.payload_json', '$.category')} AS category,"
        f"  {_json_text('e.payload_json', '$.matched_stem')} AS matched_stem,"
        f"  {_json_text('e.payload_json', '$.tier')} AS tier,"
        f"  {_json_text('e.payload_json', '$.layer')} AS layer"
        f" FROM chat_events e{refusal_where}"
        " ORDER BY e.occurred_at DESC LIMIT 5"
    )
    strict_refusal_samples = [
        {
            "session_id": r.get("session_id") or "",
            "message_id": r.get("message_id") or "",
            "occurred_at": r.get("occurred_at"),
            "category": r.get("category") or "",
            "matched_stem": r.get("matched_stem") or "",
            "tier": r.get("tier") or "",
            "layer": r.get("layer") or "",
        }
        for r in refusal_rows
    ]

    # Previous-period comparison
    prev_total: int | None = None
    prev_nr_rate: float | None = None
    prev_ctr: float | None = None
    prev_ur_rate: float | None = None
    prev_sessions: int | None = None

    if started_after and started_before:
        try:
            from datetime import datetime

            dt_after = datetime.fromisoformat(started_after.rstrip("Z"))
            dt_before = datetime.fromisoformat(started_before.rstrip("Z"))
            delta = dt_before - dt_after
            prev_before = dt_after
            prev_after = dt_after - delta

            prev_msg_where = _msg_where(
                search=search,
                started_after=prev_after.isoformat(),
                started_before=prev_before.isoformat(),
                unresolved_only=unresolved_only,
            )
            prev_bucket_join = ""
            if bucket:
                prev_bucket_join = (
                    " JOIN chat_search_sequences sq"
                    " ON sq.search_sequence_id = m.search_sequence_id"
                    f" AND sq.resolved_bucket_label = {q(bucket)}"
                )
            prev_msg_rows = await client.exec_sql(
                "SELECT"
                "  COUNT(*) AS total_queries"
                f" FROM chat_messages m{prev_bucket_join}{prev_msg_where}"
            )
            pma = prev_msg_rows[0] if prev_msg_rows else {}
            pt = _row_int(pma, "total_queries")
            if pt > 0:
                prev_total = pt

                prev_seq_where = _seq_filter_where(
                    search=search,
                    bucket=bucket,
                    started_after=prev_after.isoformat(),
                    started_before=prev_before.isoformat(),
                    unresolved_only=unresolved_only,
                )
                prev_no_results_clause = _reason_code_exists_sql(
                    "sq.reason_codes_json", "no_results"
                )
                prev_seq_rows = await client.exec_sql(
                    "SELECT"
                    "  COUNT(*) AS total,"
                    f"  SUM(CASE WHEN {prev_no_results_clause} THEN 1 ELSE 0 END) AS no_results_count"
                    f" FROM chat_search_sequences sq{prev_seq_where}"
                )
                psq = prev_seq_rows[0] if prev_seq_rows else {}
                prev_seq_t = _row_int(psq, "total")
                prev_nr_rate = _safe_rate(_row_int(psq, "no_results_count"), prev_seq_t)

                prev_prod_clauses = [
                    f"shown_at >= {q(prev_after.isoformat())}",
                    f"shown_at <= {q(prev_before.isoformat())}",
                ]
                prev_prod_where = " WHERE " + " AND ".join(prev_prod_clauses)
                prev_prod_rows = await client.exec_sql(
                    "SELECT"
                    "  COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS total_shown,"
                    "  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS total_clicks"
                    f" FROM chat_message_products{prev_prod_where}"
                )
                ppa = prev_prod_rows[0] if prev_prod_rows else {}
                ps = _row_int(ppa, "total_shown")
                prev_ctr = _safe_rate(_row_int(ppa, "total_clicks"), ps) if ps else 0.0

                prev_ur_clauses = [
                    "status = 'unresolved'",
                    f"started_at >= {q(prev_after.isoformat())}",
                    f"started_at <= {q(prev_before.isoformat())}",
                ]
                prev_ur_where = " WHERE " + " AND ".join(prev_ur_clauses)
                prev_ur_rows = await client.exec_sql(
                    f"SELECT COUNT(*) AS ur_count FROM chat_search_sequences{prev_ur_where}"
                )
                prev_ur = _row_int(prev_ur_rows[0], "ur_count") if prev_ur_rows else 0
                prev_ur_rate = _safe_rate(prev_ur, prev_seq_t)

                prev_sess_clauses = [
                    f"started_at >= {q(prev_after.isoformat())}",
                    f"started_at <= {q(prev_before.isoformat())}",
                ]
                prev_sess_where = " WHERE " + " AND ".join(prev_sess_clauses)
                prev_sess_rows = await client.exec_sql(
                    f"SELECT COUNT(*) AS total_sessions FROM chat_sessions{prev_sess_where}"
                )
                prev_sessions = _row_int(prev_sess_rows[0], "total_sessions") if prev_sess_rows else 0
        except Exception:
            pass

    return {
        "total_queries": total_queries,
        "total_sessions": total_sessions,
        "no_results_rate": _safe_rate(nr_count, seq_total),
        "no_results_count": nr_count,
        "search_sequence_count": seq_total,
        "click_through_rate": _safe_rate(total_clicks, total_shown),
        "unresolved_rate": _safe_rate(ur_count, seq_total),
        "strict_refusal_events": strict_refusal_events,
        "strict_refusal_messages": strict_refusal_messages,
        "strict_refusal_sessions": strict_refusal_sessions,
        "top_buckets": top_buckets,
        "no_result_sequences": no_result_sequences,
        "strict_refusal_samples": strict_refusal_samples,
        "prev_total_queries": prev_total,
        "prev_total_sessions": prev_sessions,
        "prev_no_results_rate": prev_nr_rate,
        "prev_click_through_rate": prev_ctr,
        "prev_unresolved_rate": prev_ur_rate,
    }


# ─── Queries ─────────────────────────────────────────────────────────────────


@router.get("/queries")
async def list_queries(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
    bucket: Optional[str] = Query(default=None),
    unresolved_only: bool = Query(default=False),
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    """Queries tab — grouped by user_text_normalized from chat_messages."""
    client = _client(lane)
    where = _msg_where(
        search=search,
        started_after=started_after,
        started_before=started_before,
        unresolved_only=unresolved_only,
    )
    # Bucket filter requires joining sequences
    bucket_join = ""
    if bucket:
        q = D1ReadClient.sql_quote
        bucket_join = (
            " JOIN chat_search_sequences sq"
            " ON sq.search_sequence_id = m.search_sequence_id"
            f" AND sq.resolved_bucket_label = {q(bucket)}"
        )

    count_rows = await client.exec_sql(
        "SELECT COUNT(DISTINCT m.user_text_normalized) AS total"
        f" FROM chat_messages m{bucket_join}{where}"
    )
    total = _row_int(count_rows[0], "total") if count_rows else 0
    no_results_sequence_for_message = (
        "EXISTS ("
        " SELECT 1 FROM chat_search_sequences sq4"
        " WHERE sq4.search_sequence_id = m.search_sequence_id"
        f" AND {_reason_code_exists_sql('sq4.reason_codes_json', 'no_results')}"
        ")"
    )

    rows = await client.exec_sql(
        "SELECT"
        "  m.user_text_normalized AS query,"
        "  COUNT(*) AS searches,"
        "  SUM(COALESCE(m.result_count, 0)) AS results_shown,"
        "  COALESCE(SUM(p.click_count), 0) AS clicks,"
        "  CASE WHEN SUM(COALESCE(m.result_count, 0)) > 0"
        "    THEN ROUND(COALESCE(SUM(p.click_count), 0) * 100.0"
        "      / SUM(COALESCE(m.result_count, 0)), 1)"
        "    ELSE 0 END AS ctr,"
        f"  COUNT(DISTINCT CASE WHEN {no_results_sequence_for_message}"
        " THEN m.search_sequence_id END) AS no_results_count,"
        "  SUM(CASE WHEN EXISTS ("
        "    SELECT 1 FROM chat_search_sequences sq3"
        "    WHERE sq3.search_sequence_id = m.search_sequence_id"
        "    AND sq3.status = 'unresolved'"
        "  ) THEN 1 ELSE 0 END) AS unresolved_count,"
        "  MAX(m.created_at) AS last_seen"
        f" FROM chat_messages m{bucket_join}"
        " LEFT JOIN ("
        "   SELECT message_id,"
        "     COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS click_count"
        "   FROM chat_message_products GROUP BY message_id"
        " ) p ON p.message_id = m.message_id"
        f"{where}"
        " GROUP BY m.user_text_normalized"
        f" ORDER BY searches DESC LIMIT {limit} OFFSET {offset}"
    )

    queries = [
        {
            "query": r.get("query") or "",
            "searches": _row_int(r, "searches"),
            "results_shown": _row_int(r, "results_shown"),
            "clicks": _row_int(r, "clicks"),
            "ctr": float(r.get("ctr") or 0),
            "no_results_count": _row_int(r, "no_results_count"),
            "unresolved_count": _row_int(r, "unresolved_count"),
            "last_seen": r.get("last_seen"),
        }
        for r in rows
    ]

    return {"queries": queries, "total": total}


# ─── Unresolved ──────────────────────────────────────────────────────────────


@router.get("/unresolved")
async def list_unresolved(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
    bucket: Optional[str] = Query(default=None),
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    """Unresolved tab — only chat_search_sequences with status='unresolved'."""
    client = _client(lane)
    where = _seq_unresolved_where(
        search=search,
        bucket=bucket,
        started_after=started_after,
        started_before=started_before,
    )

    count_rows = await client.exec_sql(
        f"SELECT COUNT(*) AS total FROM chat_search_sequences{where}"
    )
    total = _row_int(count_rows[0], "total") if count_rows else 0

    rows = await client.exec_sql(
        "SELECT"
        "  resolved_query_text,"
        "  resolved_query_normalized,"
        "  reason_codes_json,"
        "  message_count,"
        "  cue_verdict,"
        "  intent_verdict,"
        "  recommendation_verdict,"
        "  satisfaction_verdict,"
        "  started_at,"
        "  ended_at"
        f" FROM chat_search_sequences{where}"
        f" ORDER BY started_at DESC LIMIT {limit} OFFSET {offset}"
    )

    sequences = []
    for r in rows:
        reasons_raw = r.get("reason_codes_json") or ""
        parsed = _parse_json_col(reasons_raw)
        reasons = list(parsed) if isinstance(parsed, list) else []

        sequences.append(
            {
                "query": r.get("resolved_query_text") or r.get("resolved_query_normalized") or "",
                "reasons": reasons,
                "message_count": _row_int(r, "message_count"),
                "cue_verdict": r.get("cue_verdict") or "",
                "intent_verdict": r.get("intent_verdict") or "",
                "recommendation_verdict": r.get("recommendation_verdict") or "",
                "satisfaction_verdict": r.get("satisfaction_verdict") or "",
                "started_at": r.get("started_at"),
                "ended_at": r.get("ended_at"),
            }
        )

    return {"sequences": sequences, "total": total}


# ─── Sessions ────────────────────────────────────────────────────────────────


@router.get("/sessions")
async def list_sessions(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    """Sessions list — one row per chat_sessions row."""
    client = _client(lane)
    q = D1ReadClient.sql_quote

    clauses: list[str] = []
    if started_after:
        clauses.append(f"s.started_at >= {q(started_after)}")
    if started_before:
        clauses.append(f"s.started_at <= {q(started_before)}")
    if search:
        clauses.append(
            f"(s.session_id LIKE {q(f'%{search}%')}"
            f" OR EXISTS (SELECT 1 FROM chat_messages cm"
            f"  WHERE cm.session_id = s.session_id"
            f"  AND cm.user_text_normalized LIKE {q(f'%{search}%')}))"
        )
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""

    count_rows = await client.exec_sql(
        f"SELECT COUNT(*) AS total FROM chat_sessions s{where}"
    )
    total = _row_int(count_rows[0], "total") if count_rows else 0

    session_rows = await client.exec_sql(
        "SELECT"
        "  s.session_id,"
        "  s.message_count,"
        "  s.sequence_count,"
        "  s.started_at,"
        "  s.last_activity_at"
        f" FROM chat_sessions s{where}"
        f" ORDER BY s.started_at DESC LIMIT {limit} OFFSET {offset}"
    )

    if not session_rows:
        return {"sessions": [], "total": total}

    # Derive results_shown, clicks, reformulated, exited per session
    session_ids = [r["session_id"] for r in session_rows]
    in_list = ", ".join(q(sid) for sid in session_ids)

    # Product metrics per session
    prod_rows = await client.exec_sql(
        "SELECT session_id,"
        "  COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS results_shown,"
        "  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicks"
        f" FROM chat_message_products WHERE session_id IN ({in_list})"
        " GROUP BY session_id"
    )
    prod_by_session = {r["session_id"]: r for r in prod_rows}

    # Reformulated (session has sequence with message_count > 1)
    # Exited (session has sequence with status != 'resolved')
    seq_rows = await client.exec_sql(
        "SELECT session_id,"
        "  MAX(CASE WHEN message_count > 1 THEN 1 ELSE 0 END) AS reformulated,"
        "  MAX(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) AS has_unresolved"
        f" FROM chat_search_sequences WHERE session_id IN ({in_list})"
        " GROUP BY session_id"
    )
    seq_by_session = {r["session_id"]: r for r in seq_rows}

    sessions = []
    for row in session_rows:
        sid = row["session_id"]
        prod = prod_by_session.get(sid, {})
        seq = seq_by_session.get(sid, {})
        sessions.append(
            {
                "session_id": sid,
                "message_count": _row_int(row, "message_count"),
                "sequence_count": _row_int(row, "sequence_count"),
                "results_shown": _row_int(prod, "results_shown"),
                "clicks": _row_int(prod, "clicks"),
                "reformulated": bool(_row_int(seq, "reformulated")),
                "exited": bool(_row_int(seq, "has_unresolved")),
                "started_at": row.get("started_at"),
                "last_activity_at": row.get("last_activity_at"),
            }
        )

    return {"sessions": sessions, "total": total}


# ─── Session Detail ──────────────────────────────────────────────────────────


@router.get("/sessions/{session_id}")
async def session_detail(session_id: str, lane: Optional[str] = None) -> dict:
    """Session detail — messages + products + events for a single session."""
    client = _client(lane)
    q = D1ReadClient.sql_quote
    sid_q = q(session_id)

    # Session metadata
    session_rows = await client.exec_sql(
        f"SELECT * FROM chat_sessions WHERE session_id = {sid_q}"
    )
    if not session_rows:
        raise HTTPException(status_code=404, detail="Session not found")
    session = session_rows[0]

    # Messages ordered by message_index
    msg_rows = await client.exec_sql(
        "SELECT"
        "  message_id, message_index, user_text_raw, user_text_normalized,"
        "  assistant_response_text, predicted_cue, predicted_intent,"
        "  result_count, status, fallback_reason, latency_ms, created_at"
        f" FROM chat_messages WHERE session_id = {sid_q}"
        " ORDER BY message_index ASC"
    )

    message_ids = [r["message_id"] for r in msg_rows]

    # Products per message
    products_by_msg: dict[str, list[dict]] = {}
    if message_ids:
        mid_list = ", ".join(q(mid) for mid in message_ids)
        prod_rows = await client.exec_sql(
            "SELECT"
            "  message_id, product_name, brand, category, rank_position,"
            "  shown_at, clicked_at, external_clicked_at"
            f" FROM chat_message_products WHERE message_id IN ({mid_list})"
            " ORDER BY rank_position ASC"
        )
        for pr in prod_rows:
            mid = pr["message_id"]
            products_by_msg.setdefault(mid, []).append(
                {
                    "product_name": pr.get("product_name") or "",
                    "brand": pr.get("brand") or "",
                    "category": pr.get("category") or "",
                    "rank_position": pr.get("rank_position"),
                    "shown": pr.get("shown_at") is not None,
                    "clicked": pr.get("clicked_at") is not None,
                    "external_clicked": pr.get("external_clicked_at") is not None,
                }
            )

    # Events for the session
    event_rows = await client.exec_sql(
        "SELECT"
        "  event_id, message_id, event_type, product_id,"
        "  rank_position, payload_json, occurred_at"
        f" FROM chat_events WHERE session_id = {sid_q}"
        " ORDER BY occurred_at ASC"
    )
    events = [
        {
            "event_id": e.get("event_id"),
            "message_id": e.get("message_id"),
            "event_type": e.get("event_type") or "",
            "product_id": e.get("product_id"),
            "rank_position": e.get("rank_position"),
            "payload": _parse_json_col(e.get("payload_json")),
            "occurred_at": e.get("occurred_at"),
        }
        for e in event_rows
    ]

    # Build messages with attached products
    messages = []
    for mr in msg_rows:
        mid = mr["message_id"]
        messages.append(
            {
                "message_id": mid,
                "message_index": _row_int(mr, "message_index"),
                "user_text_raw": mr.get("user_text_raw") or "",
                "assistant_response_text": mr.get("assistant_response_text") or "",
                "predicted_cue": mr.get("predicted_cue") or "",
                "predicted_intent": mr.get("predicted_intent") or "",
                "result_count": mr.get("result_count"),
                "status": mr.get("status") or "",
                "fallback_reason": mr.get("fallback_reason") or "",
                "latency_ms": mr.get("latency_ms"),
                "created_at": mr.get("created_at"),
                "products": products_by_msg.get(mid, []),
            }
        )

    return {
        "session": {
            "session_id": session.get("session_id"),
            "store_id": session.get("store_id"),
            "source_page": session.get("source_page"),
            "started_at": session.get("started_at"),
            "ended_at": session.get("ended_at"),
            "age_gate_rendered_at": session.get("age_gate_rendered_at"),
            "age_confirmed_at": session.get("age_confirmed_at"),
            "age_declined_at": session.get("age_declined_at"),
            "message_count": _row_int(session, "message_count"),
            "sequence_count": _row_int(session, "sequence_count"),
            "last_activity_at": session.get("last_activity_at"),
        },
        "messages": messages,
        "events": events,
    }


# ─── Compliance ──────────────────────────────────────────────────────────────


async def _compliance_summary_metrics(
    client: D1ReadClient,
    *,
    started_after: str | None = None,
    started_before: str | None = None,
    session_columns: set[str] | None = None,
) -> dict:
    session_columns = session_columns or await _table_columns(client, "chat_sessions")
    has_gate_rendered = "age_gate_rendered_at" in session_columns
    has_age_declined = "age_declined_at" in session_columns
    gate_rendered_expr = "s.age_gate_rendered_at" if has_gate_rendered else "NULL"
    age_declined_expr = "s.age_declined_at" if has_age_declined else "NULL"
    session_where = _where(
        _time_clauses(
            column="s.started_at",
            started_after=started_after,
            started_before=started_before,
        )
    )
    session_rows = await client.exec_sql(
        "SELECT"
        "  COUNT(*) AS total_sessions,"
        "  SUM(CASE WHEN s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_confirmed_sessions,"
        f"  SUM(CASE WHEN {gate_rendered_expr} IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_gate_rendered_sessions,"
        f"  SUM(CASE WHEN {age_declined_expr} IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_declined_sessions,"
        "  SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 THEN 1 ELSE 0 END)"
        "    AS active_sessions,"
        "  SUM(CASE WHEN COALESCE(s.message_count, 0) > 0"
        "    AND s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_confirmed_active_sessions,"
        "  SUM(CASE WHEN COALESCE(s.message_count, 0) > 0"
        f"    AND {gate_rendered_expr} IS NOT NULL"
        "    AND s.age_confirmed_at IS NOT NULL"
        "    AND fm.first_message_at IS NOT NULL"
        f"    AND {gate_rendered_expr} <= s.age_confirmed_at"
        "    AND s.age_confirmed_at <= fm.first_message_at"
        "    THEN 1 ELSE 0 END) AS valid_age_order_sessions,"
        f"  SUM(CASE WHEN {gate_rendered_expr} IS NOT NULL"
        "    AND s.age_confirmed_at IS NULL"
        f"    AND {age_declined_expr} IS NULL"
        "    AND COALESCE(s.message_count, 0) = 0"
        "    THEN 1 ELSE 0 END) AS age_gate_abandoned_sessions"
        " FROM chat_sessions s"
        " LEFT JOIN ("
        "   SELECT session_id, MIN(created_at) AS first_message_at"
        "   FROM chat_messages GROUP BY session_id"
        " ) fm ON fm.session_id = s.session_id"
        f"{session_where}"
    )
    session = session_rows[0] if session_rows else {}
    total_sessions = _row_int(session, "total_sessions")
    age_confirmed_sessions = _row_int(session, "age_confirmed_sessions")
    age_gate_rendered_sessions = _row_int(session, "age_gate_rendered_sessions")
    age_declined_sessions = _row_int(session, "age_declined_sessions")
    active_sessions = _row_int(session, "active_sessions")
    age_confirmed_active_sessions = _row_int(
        session, "age_confirmed_active_sessions"
    )
    valid_age_order_sessions = _row_int(session, "valid_age_order_sessions")
    age_gate_abandoned_sessions = _row_int(session, "age_gate_abandoned_sessions")

    event_where = _where(
        [f"e.event_type IN {_event_type_in_sql()}"]
        + _time_clauses(
            column="e.occurred_at",
            started_after=started_after,
            started_before=started_before,
        )
    )
    replacement_expr = _json_value("e.payload_json", "$.replacement_count")
    event_rows = await client.exec_sql(
        "SELECT"
        "  COUNT(CASE WHEN e.event_type = 'age_gate_rendered' THEN 1 END)"
        "    AS age_gate_rendered_events,"
        "  COUNT(CASE WHEN e.event_type = 'age_declined' THEN 1 END)"
        "    AS age_declined_events,"
        "  COUNT(CASE WHEN e.event_type = 'age_gate_bypass_detected' THEN 1 END)"
        "    AS age_gate_bypass_events,"
        "  COUNT(DISTINCT CASE WHEN e.event_type = 'age_gate_bypass_detected'"
        "    AND e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS age_gate_bypass_messages,"
        "  COUNT(DISTINCT CASE WHEN e.event_type = 'age_gate_bypass_detected'"
        "    AND e.session_id IS NOT NULL THEN e.session_id END)"
        "    AS age_gate_bypass_sessions,"
        "  COUNT(CASE WHEN e.event_type = 'compliance_refusal_strict' THEN 1 END)"
        "    AS strict_refusal_events,"
        "  COUNT(DISTINCT CASE WHEN e.event_type = 'compliance_refusal_strict'"
        "    AND e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS strict_refusal_messages,"
        "  COUNT(DISTINCT CASE WHEN e.event_type = 'compliance_refusal_strict'"
        "    AND e.session_id IS NOT NULL THEN e.session_id END)"
        "    AS strict_refusal_sessions,"
        "  COUNT(CASE WHEN e.event_type = 'compliance_disclaimer_attached' THEN 1 END)"
        "    AS disclaimers_attached,"
        "  COUNT(CASE WHEN e.event_type = 'compliance_near_miss' THEN 1 END)"
        "    AS near_misses,"
        "  COUNT(CASE WHEN e.event_type = 'bot_output_therapeutic_drift' THEN 1 END)"
        "    AS output_drift,"
        "  COUNT(CASE WHEN e.event_type = 'bot_output_slang_sanitized' THEN 1 END)"
        "    AS slang_sanitized_events,"
        "  SUM(CASE WHEN e.event_type = 'bot_output_slang_sanitized'"
        f"    THEN CAST(COALESCE({replacement_expr}, 0) AS INTEGER)"
        "    ELSE 0 END) AS slang_replacements"
        f" FROM chat_events e{event_where}"
    )
    event = event_rows[0] if event_rows else {}

    product_clauses = [
        "p.message_id IS NOT NULL",
        "p.session_id IS NOT NULL",
    ] + _time_clauses(
        column="p.shown_at",
        started_after=started_after,
        started_before=started_before,
    )
    product_where = _where(product_clauses)
    message_warning_rows = await client.exec_sql(
        "WITH recommendation_messages AS ("
        "  SELECT DISTINCT p.message_id"
        f"  FROM chat_message_products p{product_where}"
        ")"
        " SELECT"
        "  COUNT(*) AS product_recommendation_messages,"
        "  SUM(CASE WHEN EXISTS ("
        "    SELECT 1 FROM chat_events e"
        "    WHERE e.event_type = 'warning_rendered'"
        "      AND e.message_id = recommendation_messages.message_id"
        "  ) THEN 1 ELSE 0 END) AS warning_rendered_messages"
        " FROM recommendation_messages"
    )
    message_warning = message_warning_rows[0] if message_warning_rows else {}
    product_recommendation_messages = _row_int(
        message_warning, "product_recommendation_messages"
    )
    warning_rendered_messages = _row_int(message_warning, "warning_rendered_messages")

    session_warning_rows = await client.exec_sql(
        "WITH recommendation_sessions AS ("
        "  SELECT DISTINCT p.session_id"
        f"  FROM chat_message_products p{product_where}"
        ")"
        " SELECT"
        "  COUNT(*) AS product_recommendation_sessions,"
        "  SUM(CASE WHEN EXISTS ("
        "    SELECT 1 FROM chat_events e"
        "    WHERE e.event_type = 'warning_rendered'"
        "      AND e.session_id = recommendation_sessions.session_id"
        "  ) THEN 1 ELSE 0 END) AS warning_rendered_sessions"
        " FROM recommendation_sessions"
    )
    session_warning = session_warning_rows[0] if session_warning_rows else {}
    product_recommendation_sessions = _row_int(
        session_warning, "product_recommendation_sessions"
    )
    warning_rendered_sessions = _row_int(session_warning, "warning_rendered_sessions")

    near_miss_high_signal_where = _where(
        [
            "e.event_type = 'compliance_near_miss'",
            f"CAST(COALESCE({_json_value('e.payload_json', '$.score')}, 999) AS REAL) <= 2",
        ]
        + _time_clauses(
            column="e.occurred_at",
            started_after=started_after,
            started_before=started_before,
        )
    )
    near_miss_high_signal_rows = await client.exec_sql(
        "SELECT"
        "  COUNT(*) AS near_misses_high_signal,"
        "  COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS near_miss_high_signal_messages"
        f" FROM chat_events e{near_miss_high_signal_where}"
    )
    near_miss_high_signal = (
        near_miss_high_signal_rows[0] if near_miss_high_signal_rows else {}
    )

    return {
        "total_sessions": total_sessions,
        "age_gate_tracking_live": has_gate_rendered,
        "age_decline_tracking_live": has_age_declined,
        "age_gate_rendered_sessions": age_gate_rendered_sessions,
        "age_gate_render_rate": _safe_rate(
            age_gate_rendered_sessions,
            total_sessions,
        ),
        "age_declined_sessions": age_declined_sessions,
        "age_declined_rate": _safe_rate(
            age_declined_sessions,
            age_gate_rendered_sessions,
        ),
        "age_gate_abandoned_sessions": age_gate_abandoned_sessions,
        "age_gate_abandoned_rate": _safe_rate(
            age_gate_abandoned_sessions,
            age_gate_rendered_sessions,
        ),
        "age_confirmed_sessions": age_confirmed_sessions,
        "age_confirmation_rate": _safe_rate(age_confirmed_sessions, total_sessions),
        "age_acceptance_rate": _safe_rate(
            age_confirmed_sessions,
            age_gate_rendered_sessions,
        ),
        "active_sessions": active_sessions,
        "age_confirmed_active_sessions": age_confirmed_active_sessions,
        "active_age_confirmation_rate": _safe_rate(
            age_confirmed_active_sessions,
            active_sessions,
        ),
        "valid_age_order_sessions": valid_age_order_sessions,
        "allowed_chat_rate": _safe_rate(
            valid_age_order_sessions,
            active_sessions,
        ),
        "age_gate_rendered_events": _row_int(event, "age_gate_rendered_events"),
        "age_declined_events": _row_int(event, "age_declined_events"),
        "age_gate_bypass_events": _row_int(event, "age_gate_bypass_events"),
        "age_gate_bypass_messages": _row_int(event, "age_gate_bypass_messages"),
        "age_gate_bypass_sessions": _row_int(event, "age_gate_bypass_sessions"),
        "strict_refusal_events": _row_int(event, "strict_refusal_events"),
        "strict_refusal_messages": _row_int(event, "strict_refusal_messages"),
        "strict_refusal_sessions": _row_int(event, "strict_refusal_sessions"),
        "disclaimers_attached": _row_int(event, "disclaimers_attached"),
        "near_misses": _row_int(event, "near_misses"),
        "near_misses_high_signal": _row_int(
            near_miss_high_signal, "near_misses_high_signal"
        ),
        "near_miss_high_signal_messages": _row_int(
            near_miss_high_signal, "near_miss_high_signal_messages"
        ),
        "output_drift": _row_int(event, "output_drift"),
        "slang_sanitized_events": _row_int(event, "slang_sanitized_events"),
        "slang_replacements": _row_int(event, "slang_replacements"),
        "product_recommendation_messages": product_recommendation_messages,
        "warning_rendered_messages": warning_rendered_messages,
        "warning_render_rate": _safe_rate(
            warning_rendered_messages,
            product_recommendation_messages,
        ),
        "product_recommendation_sessions": product_recommendation_sessions,
        "warning_rendered_sessions": warning_rendered_sessions,
        "warning_session_rate": _safe_rate(
            warning_rendered_sessions,
            product_recommendation_sessions,
        ),
    }


async def _compliance_daily(
    client: D1ReadClient,
    *,
    started_after: str | None = None,
    started_before: str | None = None,
    session_columns: set[str] | None = None,
) -> list[dict]:
    q = D1ReadClient.sql_quote
    session_columns = session_columns or await _table_columns(client, "chat_sessions")
    has_gate_rendered = "age_gate_rendered_at" in session_columns
    has_age_declined = "age_declined_at" in session_columns
    gate_rendered_expr = "s.age_gate_rendered_at" if has_gate_rendered else "NULL"
    age_declined_expr = "s.age_declined_at" if has_age_declined else "NULL"
    after = _date_after(started_after) or _days_ago_iso(30)
    before = _date_before(started_before)
    session_clauses = [f"s.started_at >= {q(after)}"]
    event_clauses = [f"e.event_type IN {_event_type_in_sql()}", f"e.occurred_at >= {q(after)}"]
    product_clauses = ["p.message_id IS NOT NULL", f"p.shown_at >= {q(after)}"]
    if before:
        session_clauses.append(f"s.started_at <= {q(before)}")
        event_clauses.append(f"e.occurred_at <= {q(before)}")
        product_clauses.append(f"p.shown_at <= {q(before)}")

    by_day: dict[str, dict] = {}

    def day_row(day: str) -> dict:
        if day not in by_day:
            by_day[day] = {
                "day": day,
                "total_sessions": 0,
                "age_gate_rendered_sessions": 0,
                "age_confirmed_sessions": 0,
                "age_declined_sessions": 0,
                "age_gate_abandoned_sessions": 0,
                "active_sessions": 0,
                "age_confirmed_active_sessions": 0,
                "valid_age_order_sessions": 0,
                "age_gate_bypass_events": 0,
                "strict_refusal_events": 0,
                "disclaimers_attached": 0,
                "near_misses": 0,
                "output_drift": 0,
                "slang_sanitized_events": 0,
                "warning_rendered_messages": 0,
                "product_recommendation_messages": 0,
            }
        return by_day[day]

    age_rows = await client.exec_sql(
        "SELECT"
        "  substr(s.started_at, 1, 10) AS day,"
        "  COUNT(*) AS total_sessions,"
        f"  SUM(CASE WHEN {gate_rendered_expr} IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_gate_rendered_sessions,"
        "  SUM(CASE WHEN s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_confirmed_sessions,"
        f"  SUM(CASE WHEN {age_declined_expr} IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_declined_sessions,"
        "  SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 THEN 1 ELSE 0 END)"
        "    AS active_sessions,"
        "  SUM(CASE WHEN COALESCE(s.message_count, 0) > 0"
        "    AND s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END)"
        "    AS age_confirmed_active_sessions,"
        "  SUM(CASE WHEN COALESCE(s.message_count, 0) > 0"
        f"    AND {gate_rendered_expr} IS NOT NULL"
        "    AND s.age_confirmed_at IS NOT NULL"
        "    AND fm.first_message_at IS NOT NULL"
        f"    AND {gate_rendered_expr} <= s.age_confirmed_at"
        "    AND s.age_confirmed_at <= fm.first_message_at"
        "    THEN 1 ELSE 0 END) AS valid_age_order_sessions,"
        f"  SUM(CASE WHEN {gate_rendered_expr} IS NOT NULL"
        "    AND s.age_confirmed_at IS NULL"
        f"    AND {age_declined_expr} IS NULL"
        "    AND COALESCE(s.message_count, 0) = 0"
        "    THEN 1 ELSE 0 END) AS age_gate_abandoned_sessions"
        " FROM chat_sessions s"
        " LEFT JOIN ("
        "   SELECT session_id, MIN(created_at) AS first_message_at"
        "   FROM chat_messages GROUP BY session_id"
        " ) fm ON fm.session_id = s.session_id"
        f"{_where(session_clauses)}"
        " GROUP BY day ORDER BY day ASC LIMIT 370"
    )
    for row in age_rows:
        target = day_row(row.get("day") or "")
        target["total_sessions"] = _row_int(row, "total_sessions")
        target["age_gate_rendered_sessions"] = _row_int(
            row, "age_gate_rendered_sessions"
        )
        target["age_confirmed_sessions"] = _row_int(row, "age_confirmed_sessions")
        target["age_declined_sessions"] = _row_int(row, "age_declined_sessions")
        target["active_sessions"] = _row_int(row, "active_sessions")
        target["age_confirmed_active_sessions"] = _row_int(
            row, "age_confirmed_active_sessions"
        )
        target["valid_age_order_sessions"] = _row_int(
            row, "valid_age_order_sessions"
        )
        target["age_gate_abandoned_sessions"] = _row_int(
            row, "age_gate_abandoned_sessions"
        )

    event_rows = await client.exec_sql(
        "SELECT"
        "  substr(e.occurred_at, 1, 10) AS day,"
        "  COUNT(CASE WHEN e.event_type = 'age_gate_bypass_detected' THEN 1 END)"
        "    AS age_gate_bypass_events,"
        "  COUNT(CASE WHEN e.event_type = 'compliance_refusal_strict' THEN 1 END)"
        "    AS strict_refusal_events,"
        "  COUNT(CASE WHEN e.event_type = 'compliance_disclaimer_attached' THEN 1 END)"
        "    AS disclaimers_attached,"
        "  COUNT(CASE WHEN e.event_type = 'compliance_near_miss' THEN 1 END)"
        "    AS near_misses,"
        "  COUNT(CASE WHEN e.event_type = 'bot_output_therapeutic_drift' THEN 1 END)"
        "    AS output_drift,"
        "  COUNT(CASE WHEN e.event_type = 'bot_output_slang_sanitized' THEN 1 END)"
        "    AS slang_sanitized_events"
        f" FROM chat_events e{_where(event_clauses)}"
        " GROUP BY day ORDER BY day ASC LIMIT 370"
    )
    for row in event_rows:
        target = day_row(row.get("day") or "")
        target["age_gate_bypass_events"] = _row_int(row, "age_gate_bypass_events")
        target["strict_refusal_events"] = _row_int(row, "strict_refusal_events")
        target["disclaimers_attached"] = _row_int(row, "disclaimers_attached")
        target["near_misses"] = _row_int(row, "near_misses")
        target["output_drift"] = _row_int(row, "output_drift")
        target["slang_sanitized_events"] = _row_int(row, "slang_sanitized_events")

    warning_rows = await client.exec_sql(
        "WITH recommendation_messages AS ("
        "  SELECT substr(MIN(p.shown_at), 1, 10) AS day, p.message_id"
        f"  FROM chat_message_products p{_where(product_clauses)}"
        "  GROUP BY p.message_id"
        ")"
        " SELECT"
        "  day,"
        "  COUNT(*) AS product_recommendation_messages,"
        "  SUM(CASE WHEN EXISTS ("
        "    SELECT 1 FROM chat_events e"
        "    WHERE e.event_type = 'warning_rendered'"
        "      AND e.message_id = recommendation_messages.message_id"
        "  ) THEN 1 ELSE 0 END) AS warning_rendered_messages"
        " FROM recommendation_messages"
        " GROUP BY day ORDER BY day ASC LIMIT 370"
    )
    for row in warning_rows:
        target = day_row(row.get("day") or "")
        target["product_recommendation_messages"] = _row_int(
            row, "product_recommendation_messages"
        )
        target["warning_rendered_messages"] = _row_int(row, "warning_rendered_messages")

    return [by_day[day] for day in sorted(day for day in by_day if day)]


@router.get("/compliance/summary")
async def compliance_summary(
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    client = _client(lane)
    session_columns = await _table_columns(client, "chat_sessions")
    return {
        "selected": await _compliance_summary_metrics(
            client,
            started_after=started_after,
            started_before=started_before,
            session_columns=session_columns,
        ),
        "last_7_days": await _compliance_summary_metrics(
            client,
            started_after=_days_ago_iso(7),
            session_columns=session_columns,
        ),
        "last_30_days": await _compliance_summary_metrics(
            client,
            started_after=_days_ago_iso(30),
            session_columns=session_columns,
        ),
        "total": await _compliance_summary_metrics(
            client,
            session_columns=session_columns,
        ),
        "daily": await _compliance_daily(
            client,
            started_after=started_after,
            started_before=started_before,
            session_columns=session_columns,
        ),
    }


@router.get("/compliance/events")
async def compliance_events(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    event_type: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    matched_stem: Optional[str] = Query(default=None),
    tier: Optional[str] = Query(default=None),
    layer: Optional[str] = Query(default=None),
    session_id: Optional[str] = Query(default=None),
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    client = _client(lane)
    where = _compliance_event_where(
        event_type=event_type,
        category=category,
        matched_stem=matched_stem,
        tier=tier,
        layer=layer,
        session_id=session_id,
        started_after=started_after,
        started_before=started_before,
    )

    count_rows = await client.exec_sql(
        f"SELECT COUNT(*) AS total FROM chat_events e{where}"
    )
    total = _row_int(count_rows[0], "total") if count_rows else 0

    rows = await client.exec_sql(
        "SELECT"
        "  e.event_id,"
        "  e.session_id,"
        "  e.message_id,"
        "  e.event_type,"
        "  e.occurred_at,"
        f"  {_json_value('e.payload_json', '$.category')} AS category,"
        f"  {_json_value('e.payload_json', '$.matched_stem')} AS matched_stem,"
        f"  {_json_value('e.payload_json', '$.nearest_stem')} AS nearest_stem,"
        f"  {_json_value('e.payload_json', '$.token_stem')} AS token_stem,"
        f"  {_json_value('e.payload_json', '$.tier')} AS tier,"
        f"  {_json_value('e.payload_json', '$.layer')} AS layer,"
        f"  {_json_value('e.payload_json', '$.score')} AS score,"
        f"  {_json_value('e.payload_json', '$.violation')} AS violation,"
        f"  {_json_value('e.payload_json', '$.first_message_at')} AS first_message_at,"
        f"  {_json_value('e.payload_json', '$.age_gate_rendered_at')} AS age_gate_rendered_at,"
        f"  {_json_value('e.payload_json', '$.age_confirmed_at')} AS age_confirmed_at,"
        f"  {_json_value('e.payload_json', '$.age_declined_at')} AS age_declined_at,"
        f"  {_json_value('e.payload_json', '$.replacement_count')} AS replacement_count,"
        f"  {_json_value('e.payload_json', '$.terms')} AS terms_json"
        f" FROM chat_events e{where}"
        f" ORDER BY e.occurred_at DESC LIMIT {limit} OFFSET {offset}"
    )

    events = []
    for row in rows:
        events.append(
            {
                "event_id": row.get("event_id"),
                "session_id": row.get("session_id"),
                "message_id": row.get("message_id"),
                "event_type": row.get("event_type") or "",
                "occurred_at": row.get("occurred_at"),
                "category": row.get("category"),
                "matched_stem": row.get("matched_stem"),
                "nearest_stem": row.get("nearest_stem"),
                "token_stem": row.get("token_stem"),
                "tier": row.get("tier"),
                "layer": row.get("layer"),
                "violation": row.get("violation"),
                "first_message_at": row.get("first_message_at"),
                "age_gate_rendered_at": row.get("age_gate_rendered_at"),
                "age_confirmed_at": row.get("age_confirmed_at"),
                "age_declined_at": row.get("age_declined_at"),
                "score": (
                    _row_float(row, "score")
                    if row.get("score") is not None
                    else None
                ),
                "replacement_count": (
                    _row_int(row, "replacement_count")
                    if row.get("replacement_count") is not None
                    else None
                ),
                "terms": _parse_terms(row.get("terms_json")),
            }
        )

    return {"events": events, "total": total}


@router.get("/compliance/filters")
async def compliance_filters(
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    client = _client(lane)
    base_clauses = [f"e.event_type IN {_log_event_type_in_sql()}"]
    base_clauses.extend(
        _time_clauses(
            column="e.occurred_at",
            started_after=started_after,
            started_before=started_before,
        )
    )

    async def distinct_json(path: str) -> list[str]:
        expr = _json_text("e.payload_json", path)
        clauses = list(base_clauses)
        clauses.append(f"{expr} IS NOT NULL")
        clauses.append(f"{expr} != ''")
        rows = await client.exec_sql(
            f"SELECT DISTINCT {expr} AS value"
            f" FROM chat_events e{_where(clauses)}"
            " ORDER BY value ASC LIMIT 100"
        )
        return [str(r["value"]) for r in rows if r.get("value") is not None]

    matched_stems = list(
        dict.fromkeys(
            [
                *(await distinct_json("$.matched_stem")),
                *(await distinct_json("$.nearest_stem")),
            ]
        )
    )

    return {
        "event_types": list(_COMPLIANCE_LOG_EVENT_TYPES),
        "categories": list(
            dict.fromkeys([*_COMPLIANCE_CATEGORIES, *(await distinct_json("$.category"))])
        ),
        "matched_stems": matched_stems,
        "tiers": await distinct_json("$.tier"),
        "layers": await distinct_json("$.layer"),
    }


@router.get("/compliance/tuning")
async def compliance_tuning(
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    near_miss_score_max: float = Query(default=2.0, ge=0, le=3),
    lane: Optional[str] = None,
) -> dict:
    client = _client(lane)

    strict_where = _compliance_event_where(
        event_type="compliance_refusal_strict",
        started_after=started_after,
        started_before=started_before,
    )
    category_expr = f"COALESCE({_json_text('e.payload_json', '$.category')}, 'unknown')"
    matched_stem_expr = (
        f"COALESCE({_json_text('e.payload_json', '$.matched_stem')}, 'unknown')"
    )
    strict_rows = await client.exec_sql(
        "SELECT"
        f"  {category_expr} AS category,"
        f"  {matched_stem_expr} AS matched_stem,"
        "  COUNT(*) AS event_count,"
        "  COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS message_count,"
        "  COUNT(DISTINCT e.session_id) AS session_count"
        f" FROM chat_events e{strict_where}"
        " GROUP BY 1, 2 ORDER BY event_count DESC LIMIT 100"
    )

    near_where = _compliance_event_where(
        event_type="compliance_near_miss",
        started_after=started_after,
        started_before=started_before,
    )
    near_score_clause = (
        f"CAST(COALESCE({_json_value('e.payload_json', '$.score')}, 999) AS REAL)"
        f" <= {near_miss_score_max}"
    )
    near_where = f"{near_where} AND {near_score_clause}"
    nearest_stem_expr = (
        f"COALESCE({_json_text('e.payload_json', '$.nearest_stem')}, 'unknown')"
    )
    near_rows = await client.exec_sql(
        "SELECT"
        f"  {nearest_stem_expr} AS nearest_stem,"
        "  COUNT(*) AS event_count,"
        "  COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS message_count,"
        f"  ROUND(AVG(CAST({_json_value('e.payload_json', '$.score')} AS REAL)), 1)"
        "    AS avg_score"
        f" FROM chat_events e{near_where}"
        " GROUP BY 1 ORDER BY event_count DESC LIMIT 100"
    )

    drift_where = _compliance_event_where(
        event_type="bot_output_therapeutic_drift",
        started_after=started_after,
        started_before=started_before,
    )
    drift_stem_expr = (
        f"COALESCE({_json_text('e.payload_json', '$.matched_stem')}, 'unknown')"
    )
    drift_rows = await client.exec_sql(
        "SELECT"
        f"  {drift_stem_expr} AS matched_stem,"
        "  COUNT(*) AS event_count"
        f" FROM chat_events e{drift_where}"
        " GROUP BY 1 ORDER BY event_count DESC LIMIT 100"
    )

    slang_where = _compliance_event_where(
        event_type="bot_output_slang_sanitized",
        started_after=started_after,
        started_before=started_before,
    )
    safe_payload = (
        "CASE WHEN e.payload_json IS NOT NULL AND json_valid(e.payload_json)"
        " THEN e.payload_json ELSE '{\"terms\":[]}' END"
    )
    term_expr = (
        "CASE WHEN json_valid(term.value)"
        " THEN json_extract(term.value, '$.term') ELSE NULL END"
    )
    term_count_expr = (
        "CASE WHEN json_valid(term.value)"
        " THEN json_extract(term.value, '$.count') ELSE NULL END"
    )
    slang_rows = await client.exec_sql(
        "SELECT"
        f"  {term_expr} AS term,"
        "  COUNT(DISTINCT e.event_id) AS event_count,"
        f"  SUM(CAST(COALESCE({term_count_expr}, 0) AS INTEGER))"
        "    AS replacement_count"
        f" FROM chat_events e, json_each({safe_payload}, '$.terms') term"
        f"{slang_where} AND {term_expr} IS NOT NULL"
        " GROUP BY 1 ORDER BY replacement_count DESC LIMIT 100"
    )

    refused_session_rows = await client.exec_sql(
        "SELECT"
        "  e.session_id,"
        "  COUNT(*) AS event_count,"
        "  COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS message_count,"
        "  MIN(e.occurred_at) AS first_refusal_at,"
        "  MAX(e.occurred_at) AS last_refusal_at"
        f" FROM chat_events e{strict_where}"
        " GROUP BY e.session_id ORDER BY last_refusal_at DESC LIMIT 100"
    )

    bypass_where = _compliance_event_where(
        event_type="age_gate_bypass_detected",
        started_after=started_after,
        started_before=started_before,
    )
    bypass_violation_expr = (
        f"COALESCE({_json_text('e.payload_json', '$.violation')}, 'unknown')"
    )
    bypass_rows = await client.exec_sql(
        "SELECT"
        f"  {bypass_violation_expr} AS violation,"
        "  COUNT(*) AS event_count,"
        "  COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END)"
        "    AS message_count,"
        "  COUNT(DISTINCT CASE WHEN e.session_id IS NOT NULL THEN e.session_id END)"
        "    AS session_count,"
        "  MAX(e.occurred_at) AS last_seen_at"
        f" FROM chat_events e{bypass_where}"
        " GROUP BY 1 ORDER BY event_count DESC LIMIT 100"
    )

    return {
        "near_miss_score_max": near_miss_score_max,
        "strict_by_category_stem": [
            {
                "category": r.get("category") or "unknown",
                "matched_stem": r.get("matched_stem") or "unknown",
                "event_count": _row_int(r, "event_count"),
                "message_count": _row_int(r, "message_count"),
                "session_count": _row_int(r, "session_count"),
            }
            for r in strict_rows
        ],
        "near_misses_by_nearest_stem": [
            {
                "nearest_stem": r.get("nearest_stem") or "unknown",
                "event_count": _row_int(r, "event_count"),
                "message_count": _row_int(r, "message_count"),
                "avg_score": _row_float(r, "avg_score") if r.get("avg_score") is not None else None,
            }
            for r in near_rows
        ],
        "output_drift_by_matched_stem": [
            {
                "matched_stem": r.get("matched_stem") or "unknown",
                "event_count": _row_int(r, "event_count"),
            }
            for r in drift_rows
        ],
        "slang_sanitized_by_term": [
            {
                "term": r.get("term") or "unknown",
                "event_count": _row_int(r, "event_count"),
                "replacement_count": _row_int(r, "replacement_count"),
            }
            for r in slang_rows
        ],
        "refused_sessions": [
            {
                "session_id": r.get("session_id") or "",
                "event_count": _row_int(r, "event_count"),
                "message_count": _row_int(r, "message_count"),
                "first_refusal_at": r.get("first_refusal_at"),
                "last_refusal_at": r.get("last_refusal_at"),
            }
            for r in refused_session_rows
        ],
        "age_gate_bypass_by_violation": [
            {
                "violation": r.get("violation") or "unknown",
                "event_count": _row_int(r, "event_count"),
                "message_count": _row_int(r, "message_count"),
                "session_count": _row_int(r, "session_count"),
                "last_seen_at": r.get("last_seen_at"),
            }
            for r in bypass_rows
        ],
    }


# ─── Products ────────────────────────────────────────────────────────────────


@router.get("/products")
async def list_products(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
    started_after: Optional[str] = Query(default=None),
    started_before: Optional[str] = Query(default=None),
    sort_by: Optional[str] = Query(default=None),
    sort_dir: Optional[str] = Query(default=None),
    lane: Optional[str] = None,
) -> dict:
    client = _client(lane)
    where = _product_where(
        search=search,
        started_after=started_after,
        started_before=started_before,
    )

    count_where = where if where else " WHERE shown_at IS NOT NULL"
    if where and "shown_at" not in where:
        count_where = where + " AND shown_at IS NOT NULL"

    count_rows = await client.exec_sql(
        f"SELECT COUNT(DISTINCT product_name) AS total FROM chat_message_products{count_where}"
    )
    total = _row_int(count_rows[0], "total") if count_rows else 0

    rows = await client.exec_sql(
        "SELECT"
        "  product_name AS product,"
        "  COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS mentions,"
        "  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicks,"
        "  COUNT(CASE WHEN external_clicked_at IS NOT NULL THEN 1 END) AS external_clicks,"
        "  CASE WHEN COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) > 0"
        "    THEN ROUND("
        "      COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0"
        "      / COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END), 1)"
        "    ELSE 0 END AS ctr,"
        "  MAX(COALESCE(shown_at, clicked_at)) AS last_seen"
        f" FROM chat_message_products{where}"
        " GROUP BY product_name"
        " HAVING COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) > 0"
        f" ORDER BY {_product_sort(sort_by, sort_dir)} LIMIT {limit} OFFSET {offset}"
    )

    products = [
        {
            "product": r.get("product") or "",
            "mentions": _row_int(r, "mentions"),
            "clicks": _row_int(r, "clicks"),
            "external_clicks": _row_int(r, "external_clicks"),
            "ctr": float(r.get("ctr") or 0),
            "last_seen": r.get("last_seen"),
        }
        for r in rows
    ]

    return {"products": products, "total": total}
