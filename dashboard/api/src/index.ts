import { Hono } from 'hono';

type Bindings = {
  ANALYTICS_DB?: D1Database;
  ANALYTICS_DB_QA?: D1Database;
  ANALYTICS_DB_PROD?: D1Database;
  VEHICLES_DB?: D1Database;
  VEHICLES_DB_QA?: D1Database;
  VEHICLES_DB_PROD?: D1Database;
  WINE_DB?: D1Database;
  WINE_DB_QA?: D1Database;
  WINE_DB_PROD?: D1Database;
};

type Row = Record<string, unknown>;

type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>();

const CONFIRMATION_WORDS = ['ok', 'okay', 'sure', 'that one', 'this one', 'yeah', 'yep', 'yes'];
const COMPLIANCE_EVENT_TYPES = [
  'age_confirmed',
  'age_gate_rendered',
  'age_declined',
  'age_gate_bypass_detected',
  'compliance_refusal_strict',
  'compliance_disclaimer_attached',
  'compliance_near_miss',
  'bot_output_therapeutic_drift',
  'bot_output_slang_sanitized',
  'warning_rendered'
] as const;
const COMPLIANCE_LOG_EVENT_TYPES = COMPLIANCE_EVENT_TYPES.filter((event) => event !== 'age_confirmed');
const COMPLIANCE_CATEGORIES = [
  'medical_condition',
  'therapeutic_verb',
  'dosing',
  'pregnancy',
  'underage',
  'crisis',
  'abuse'
];

function dbFor(c: { env: Bindings; req: { query(name: string): string | undefined } }): D1Database | null {
  const lane = (c.req.query('lane') || 'qa').toLowerCase();
  if (lane === 'prod') {
    return c.env.ANALYTICS_DB_PROD ?? c.env.ANALYTICS_DB ?? c.env.VEHICLES_DB_PROD ?? c.env.VEHICLES_DB ?? c.env.WINE_DB_PROD ?? c.env.WINE_DB ?? null;
  }
  return c.env.ANALYTICS_DB_QA ?? c.env.ANALYTICS_DB ?? c.env.VEHICLES_DB_QA ?? c.env.VEHICLES_DB ?? c.env.WINE_DB_QA ?? c.env.WINE_DB ?? null;
}

function q(value: unknown): string {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function boolParam(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function intParam(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function floatParam(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(value || '');
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function rowInt(row: Row | undefined, key: string, fallback = 0): number {
  const value = row?.[key];
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function rowFloat(row: Row | undefined, key: string, fallback = 0): number {
  const value = row?.[key];
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseTerms(value: unknown): Array<Record<string, unknown>> {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item));
}

function where(clauses: string[]): string {
  const clean = clauses.filter(Boolean);
  return clean.length ? ` WHERE ${clean.join(' AND ')}` : '';
}

function dateAfter(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length === 10 ? `${value}T00:00:00Z` : value;
}

function dateBefore(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

function daysAgoIso(days: number): string {
  const dt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function timeClauses(column: string, startedAfter?: string, startedBefore?: string): string[] {
  const clauses: string[] = [];
  const after = dateAfter(startedAfter);
  const before = dateBefore(startedBefore);
  if (after) clauses.push(`${column} >= ${q(after)}`);
  if (before) clauses.push(`${column} <= ${q(before)}`);
  return clauses;
}

function jsonValue(column: string, path: string): string {
  return `CASE WHEN ${column} IS NOT NULL AND json_valid(${column}) THEN json_extract(${column}, '${path}') ELSE NULL END`;
}

function jsonText(column: string, path: string): string {
  return `CAST(${jsonValue(column, path)} AS TEXT)`;
}

function inSql(values: readonly string[]): string {
  return `(${values.map(q).join(', ')})`;
}

function confirmationExclusionSql(): string {
  return `m.user_text_normalized NOT IN (${CONFIRMATION_WORDS.map(q).join(', ')})`;
}

function reasonCodeExistsSql(column: string, code: string): string {
  const safeJson = `CASE WHEN ${column} IS NOT NULL AND json_valid(${column}) THEN ${column} ELSE '[]' END`;
  return `EXISTS (SELECT 1 FROM json_each(${safeJson}) AS rc WHERE rc.value = ${q(code)})`;
}

function msgWhere(params: {
  search?: string;
  startedAfter?: string;
  startedBefore?: string;
  unresolvedOnly?: boolean;
}): string {
  const clauses = ['m.user_text_normalized IS NOT NULL', confirmationExclusionSql()];
  if (params.search) clauses.push(`m.user_text_normalized LIKE ${q(`%${params.search}%`)}`);
  clauses.push(...timeClauses('m.created_at', params.startedAfter, params.startedBefore));
  if (params.unresolvedOnly) {
    clauses.push(
      "EXISTS (SELECT 1 FROM chat_search_sequences sq2 WHERE sq2.search_sequence_id = m.search_sequence_id AND sq2.status = 'unresolved')"
    );
  }
  return where(clauses);
}

function seqWhere(params: {
  search?: string;
  bucket?: string;
  startedAfter?: string;
  startedBefore?: string;
  unresolvedOnly?: boolean;
}): string {
  const clauses: string[] = [];
  if (params.search) {
    clauses.push(`(resolved_query_normalized LIKE ${q(`%${params.search}%`)} OR resolved_query_text LIKE ${q(`%${params.search}%`)})`);
  }
  if (params.bucket) clauses.push(`resolved_bucket_label = ${q(params.bucket)}`);
  clauses.push(...timeClauses('started_at', params.startedAfter, params.startedBefore));
  if (params.unresolvedOnly) clauses.push("status = 'unresolved'");
  return where(clauses);
}

function productWhere(params: { search?: string; startedAfter?: string; startedBefore?: string }): string {
  const clauses: string[] = [];
  if (params.search) clauses.push(`product_name LIKE ${q(`%${params.search}%`)}`);
  clauses.push(...timeClauses('shown_at', params.startedAfter, params.startedBefore));
  return where(clauses);
}

function productSort(sortBy?: string, sortDir?: string): string {
  const columns: Record<string, string> = {
    product: 'product',
    mentions: 'mentions',
    clicks: 'clicks',
    external_clicks: 'external_clicks',
    ctr: 'ctr',
    last_seen: 'last_seen'
  };
  const col = columns[sortBy || ''] || 'mentions';
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  return `${col} ${dir}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item)).filter(Boolean);
}

function reasonHas(value: unknown, code: string): boolean {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  return Array.isArray(parsed) && parsed.includes(code);
}

function addExample(bucket: Record<string, unknown>, value: unknown): void {
  const text = asText(value);
  if (!text) return;
  const examples = Array.isArray(bucket.example_queries) ? bucket.example_queries as string[] : [];
  if (!examples.includes(text) && examples.length < 3) examples.push(text);
  bucket.example_queries = examples;
}

function latestIso(current: unknown, next: unknown): unknown {
  const currentText = asText(current);
  const nextText = asText(next);
  if (!currentText) return next || null;
  if (!nextText) return current || null;
  return nextText > currentText ? next : current;
}

function matchesSearch(row: Record<string, unknown>, search?: string, keys: string[] = []): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  const haystack = keys
    .flatMap((key) => {
      const value = row[key];
      return Array.isArray(value) ? value : [value];
    })
    .map((value) => asText(value).toLowerCase())
    .join(' ');
  return haystack.includes(needle);
}

function sortDictRows(rows: Record<string, unknown>[], sortBy?: string, sortDir?: string, fallback = 'requests'): Record<string, unknown>[] {
  const key = sortBy || fallback;
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' || typeof bv === 'number') {
      return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
    }
    return asText(av).localeCompare(asText(bv)) * dir;
  });
}

function vehicleDemandLabel(filters: Record<string, unknown>, row: Row, isLookup: boolean): { label: string; make: string; model: string; body: string; fuel: string; priceBand: string } {
  const make = asText(filters.make);
  const model = asText(filters.model);
  const body = asText(filters.body_type);
  const fuel = asText(filters.fuel_type);
  const priceMax = Number(filters.price_max || 0);
  const priceBand = Number.isFinite(priceMax) && priceMax > 0 ? `under $${Math.round(priceMax).toLocaleString()}` : '';
  const useCases = asList(filters.use_case_tags);
  const priorities = asList(filters.priority_tags);
  const lookupName = asText(row.product_name) || asText(row.product_query);
  const labelParts = isLookup
    ? [lookupName || asText(row.user_text_normalized) || 'Specific vehicle lookup']
    : [make, model, body, fuel, ...useCases.slice(0, 2), ...priorities.slice(0, 2), priceBand];
  return {
    label: labelParts.filter(Boolean).join(' / ') || 'Vehicle recommendation',
    make,
    model,
    body: body || asText(row.category),
    fuel,
    priceBand
  };
}

function generalQuestionTopic(text: string, bucket: string): { topic: string; subtopic: string } {
  const qText = text.toLowerCase();
  if (/finance|payment|loan|apr|lease|monthly|credit/.test(qText)) return { topic: 'Financing', subtopic: 'Payments and credit' };
  if (/trade|sell my|trade-in|value my/.test(qText)) return { topic: 'Trade-In', subtopic: 'Vehicle value' };
  if (/carfax|accident|owner|history|damage|service record/.test(qText)) return { topic: 'Vehicle History', subtopic: 'CARFAX and condition' };
  if (/warranty|certified|cpo|inspection/.test(qText)) return { topic: 'Warranty / CPO', subtopic: 'Coverage and certification' };
  if (/hours|open|location|address|phone|appointment/.test(qText)) return { topic: 'Dealership Info', subtopic: 'Contact and hours' };
  if (/mpg|fuel|hybrid|electric|ev|gas/.test(qText)) return { topic: 'Fuel Economy', subtopic: 'Efficiency education' };
  if (/safe|safety|reliable|maintenance|repair/.test(qText)) return { topic: 'Ownership', subtopic: 'Safety and maintenance' };
  return { topic: bucket || 'General Shopping', subtopic: 'Buying guidance' };
}

function complianceEventWhere(params: {
  eventType?: string;
  category?: string;
  matchedStem?: string;
  tier?: string;
  layer?: string;
  sessionId?: string;
  startedAfter?: string;
  startedBefore?: string;
}): string {
  const clauses = [`e.event_type IN ${inSql(COMPLIANCE_LOG_EVENT_TYPES)}`];
  if (params.eventType) clauses.push(`e.event_type = ${q(params.eventType)}`);
  if (params.category) clauses.push(`${jsonText('e.payload_json', '$.category')} = ${q(params.category)}`);
  if (params.matchedStem) {
    clauses.push(
      `(${jsonText('e.payload_json', '$.matched_stem')} = ${q(params.matchedStem)} OR ${jsonText('e.payload_json', '$.nearest_stem')} = ${q(params.matchedStem)})`
    );
  }
  if (params.tier) clauses.push(`${jsonText('e.payload_json', '$.tier')} = ${q(params.tier)}`);
  if (params.layer) clauses.push(`${jsonText('e.payload_json', '$.layer')} = ${q(params.layer)}`);
  if (params.sessionId) clauses.push(`e.session_id LIKE ${q(`%${params.sessionId}%`)}`);
  clauses.push(...timeClauses('e.occurred_at', params.startedAfter, params.startedBefore));
  return where(clauses);
}

async function all(db: D1Database, sql: string): Promise<Row[]> {
  try {
    const result = await db.prepare(sql).all<Row>();
    return Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    console.error('analytics query failed', { sql, error });
    return [];
  }
}

async function first(db: D1Database, sql: string): Promise<Row> {
  return (await all(db, sql))[0] || {};
}

async function tableColumns(db: D1Database, table: string): Promise<Set<string>> {
  const rows = await all(db, `PRAGMA table_info(${table})`);
  return new Set(rows.map((row) => String(row.name || '')).filter(Boolean));
}

async function hasTable(db: D1Database, table: string): Promise<boolean> {
  return (await tableColumns(db, table)).size > 0;
}

function noDb(c: { json: (body: unknown, status?: number) => Response }) {
  return c.json({ error: 'No D1 binding configured. Bind ANALYTICS_DB_QA/ANALYTICS_DB_PROD or ANALYTICS_DB.' }, 500);
}

app.get('/health', (c) => c.json({ ok: true }));

app.get('/chat-analytics/buckets', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_search_sequences'))) return c.json({ buckets: [] });
  const rows = await all(
    db,
    "SELECT DISTINCT resolved_bucket_label AS bucket FROM chat_search_sequences WHERE resolved_bucket_label IS NOT NULL AND resolved_bucket_label != '' ORDER BY bucket ASC LIMIT 200"
  );
  return c.json({ buckets: rows.map((row) => String(row.bucket || '')).filter(Boolean) });
});

app.get('/chat-analytics/overview', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  const search = c.req.query('search') || undefined;
  const bucket = c.req.query('bucket') || undefined;
  const unresolvedOnly = boolParam(c.req.query('unresolved_only'));
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;

  const hasMessages = await hasTable(db, 'chat_messages');
  const hasSequences = await hasTable(db, 'chat_search_sequences');
  const hasProducts = await hasTable(db, 'chat_message_products');
  const hasSessions = await hasTable(db, 'chat_sessions');
  const hasEvents = await hasTable(db, 'chat_events');
  const sessionColumns = hasSessions ? await tableColumns(db, 'chat_sessions') : new Set<string>();
  const hasBrowserToken = sessionColumns.has('browser_token');

  const bucketJoin = bucket
    ? ` JOIN chat_search_sequences sq ON sq.search_sequence_id = m.search_sequence_id AND sq.resolved_bucket_label = ${q(bucket)}`
    : '';
  const totalQueries = hasMessages
    ? rowInt(
        await first(
          db,
          `SELECT COUNT(*) AS total_queries FROM chat_messages m${bucketJoin}${msgWhere({ search, startedAfter, startedBefore, unresolvedOnly })}`
        ),
        'total_queries'
      )
    : 0;

  const prodWhere = where(timeClauses('shown_at', startedAfter, startedBefore));
  const prodAgg = hasProducts
    ? await first(
        db,
        `SELECT COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS total_shown, COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS total_clicks FROM chat_message_products${prodWhere}`
      )
    : {};
  const totalShown = rowInt(prodAgg, 'total_shown');
  const totalClicks = rowInt(prodAgg, 'total_clicks');

  const seqFilter = seqWhere({ search, bucket, startedAfter, startedBefore, unresolvedOnly });
  const noResultsClause = reasonCodeExistsSql('sq.reason_codes_json', 'no_results');
  const seqAgg = hasSequences
    ? await first(
        db,
        `SELECT COUNT(*) AS total_sequences, SUM(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) AS ur_count, SUM(CASE WHEN ${noResultsClause} THEN 1 ELSE 0 END) AS no_results_count FROM chat_search_sequences sq${seqFilter}`
      )
    : {};
  const seqTotal = rowInt(seqAgg, 'total_sequences');
  const unresolvedCount = rowInt(seqAgg, 'ur_count');
  const noResultsCount = rowInt(seqAgg, 'no_results_count');

  const noResultWhere = `${seqFilter}${seqFilter ? ' AND' : ' WHERE'} ${noResultsClause}`;
  const noResultRows = hasSequences
    ? await all(
        db,
        `SELECT sq.search_sequence_id, sq.session_id, sq.first_message_id AS message_id, sq.resolved_query_text, sq.resolved_query_normalized, sq.reason_codes_json, sq.status, sq.recommendation_verdict, sq.started_at FROM chat_search_sequences sq${noResultWhere} ORDER BY sq.started_at DESC LIMIT 5`
      )
    : [];

  const sessionWhere = where(timeClauses('started_at', startedAfter, startedBefore));
  const totalSessions = hasSessions
    ? rowInt(await first(db, `SELECT COUNT(*) AS total_sessions FROM chat_sessions${sessionWhere}`), 'total_sessions')
    : 0;
  const uniqueUsers = hasSessions && hasBrowserToken
    ? rowInt(await first(db, `SELECT COUNT(DISTINCT CASE WHEN browser_token IS NOT NULL AND browser_token != '' THEN browser_token END) AS unique_users FROM chat_sessions${sessionWhere}`), 'unique_users')
    : 0;

  const bucketClauses = [...timeClauses('started_at', startedAfter, startedBefore), 'resolved_bucket_label IS NOT NULL'];
  if (search) bucketClauses.push(`(resolved_query_normalized LIKE ${q(`%${search}%`)} OR resolved_query_text LIKE ${q(`%${search}%`)})`);
  if (bucket) bucketClauses.push(`resolved_bucket_label = ${q(bucket)}`);
  const topBuckets = hasSequences
    ? (await all(
        db,
        `SELECT resolved_bucket_label AS bucket, COUNT(*) AS count FROM chat_search_sequences${where(bucketClauses)} GROUP BY resolved_bucket_label ORDER BY count DESC LIMIT 10`
      )).map((row) => ({ bucket: String(row.bucket || ''), count: rowInt(row, 'count') }))
    : [];

  const refusalWhere = where(["e.event_type = 'compliance_refusal_strict'", ...timeClauses('e.occurred_at', startedAfter, startedBefore)]);
  const refusalAgg = hasEvents
    ? await first(
        db,
        `SELECT COUNT(*) AS event_count, COUNT(DISTINCT e.message_id) AS message_count, COUNT(DISTINCT e.session_id) AS session_count FROM chat_events e${refusalWhere}`
      )
    : {};
  const strictRefusalSamples = hasEvents
    ? (await all(
        db,
        `SELECT e.session_id, e.message_id, e.occurred_at, ${jsonText('e.payload_json', '$.category')} AS category, ${jsonText('e.payload_json', '$.matched_stem')} AS matched_stem, ${jsonText('e.payload_json', '$.tier')} AS tier, ${jsonText('e.payload_json', '$.layer')} AS layer FROM chat_events e${refusalWhere} ORDER BY e.occurred_at DESC LIMIT 5`
      )).map((row) => ({
        session_id: String(row.session_id || ''),
        message_id: String(row.message_id || ''),
        occurred_at: row.occurred_at || null,
        category: String(row.category || ''),
        matched_stem: String(row.matched_stem || ''),
        tier: String(row.tier || ''),
        layer: String(row.layer || '')
      }))
    : [];

  return c.json({
    total_queries: totalQueries,
    total_sessions: totalSessions,
    unique_users: uniqueUsers,
    no_results_rate: safeRate(noResultsCount, seqTotal),
    no_results_count: noResultsCount,
    search_sequence_count: seqTotal,
    click_through_rate: safeRate(totalClicks, totalShown),
    unresolved_rate: safeRate(unresolvedCount, seqTotal),
    strict_refusal_events: rowInt(refusalAgg, 'event_count'),
    strict_refusal_messages: rowInt(refusalAgg, 'message_count'),
    strict_refusal_sessions: rowInt(refusalAgg, 'session_count'),
    top_buckets: topBuckets,
    no_result_sequences: noResultRows.map((row) => {
      const reasons = parseJson(row.reason_codes_json);
      return {
        search_sequence_id: String(row.search_sequence_id || ''),
        session_id: String(row.session_id || ''),
        message_id: String(row.message_id || ''),
        query: String(row.resolved_query_text || row.resolved_query_normalized || ''),
        reasons: Array.isArray(reasons) ? reasons : [],
        status: String(row.status || ''),
        recommendation_verdict: String(row.recommendation_verdict || ''),
        started_at: row.started_at || null
      };
    }),
    strict_refusal_samples: strictRefusalSamples,
    prev_total_queries: null,
    prev_total_sessions: null,
    prev_no_results_rate: null,
    prev_click_through_rate: null,
    prev_unresolved_rate: null
  });
});

app.get('/chat-analytics/queries', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_messages'))) return c.json({ queries: [], total: 0 });
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const search = c.req.query('search') || undefined;
  const bucket = c.req.query('bucket') || undefined;
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const unresolvedOnly = boolParam(c.req.query('unresolved_only'));
  const bucketJoin = bucket
    ? ` JOIN chat_search_sequences sq ON sq.search_sequence_id = m.search_sequence_id AND sq.resolved_bucket_label = ${q(bucket)}`
    : '';
  const filter = msgWhere({ search, startedAfter, startedBefore, unresolvedOnly });
  const total = rowInt(await first(db, `SELECT COUNT(DISTINCT m.user_text_normalized) AS total FROM chat_messages m${bucketJoin}${filter}`), 'total');
  const noResultsForMessage = `EXISTS (SELECT 1 FROM chat_search_sequences sq4 WHERE sq4.search_sequence_id = m.search_sequence_id AND ${reasonCodeExistsSql('sq4.reason_codes_json', 'no_results')})`;
  const rows = await all(
    db,
    `SELECT m.user_text_normalized AS query, COUNT(*) AS searches, SUM(COALESCE(m.result_count, 0)) AS results_shown, COALESCE(SUM(p.click_count), 0) AS clicks, CASE WHEN SUM(COALESCE(m.result_count, 0)) > 0 THEN ROUND(COALESCE(SUM(p.click_count), 0) * 100.0 / SUM(COALESCE(m.result_count, 0)), 1) ELSE 0 END AS ctr, COUNT(DISTINCT CASE WHEN ${noResultsForMessage} THEN m.search_sequence_id END) AS no_results_count, SUM(CASE WHEN EXISTS (SELECT 1 FROM chat_search_sequences sq3 WHERE sq3.search_sequence_id = m.search_sequence_id AND sq3.status = 'unresolved') THEN 1 ELSE 0 END) AS unresolved_count, MAX(m.created_at) AS last_seen FROM chat_messages m${bucketJoin} LEFT JOIN (SELECT message_id, COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS click_count FROM chat_message_products GROUP BY message_id) p ON p.message_id = m.message_id${filter} GROUP BY m.user_text_normalized ORDER BY searches DESC LIMIT ${limit} OFFSET ${offset}`
  );
  return c.json({
    queries: rows.map((row) => ({
      query: String(row.query || ''),
      searches: rowInt(row, 'searches'),
      results_shown: rowInt(row, 'results_shown'),
      clicks: rowInt(row, 'clicks'),
      ctr: rowFloat(row, 'ctr'),
      no_results_count: rowInt(row, 'no_results_count'),
      unresolved_count: rowInt(row, 'unresolved_count'),
      last_seen: row.last_seen || null
    })),
    total
  });
});

app.get('/chat-analytics/unresolved', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_search_sequences'))) return c.json({ sequences: [], total: 0 });
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const filter = seqWhere({
    search: c.req.query('search') || undefined,
    bucket: c.req.query('bucket') || undefined,
    startedAfter: c.req.query('started_after') || undefined,
    startedBefore: c.req.query('started_before') || undefined,
    unresolvedOnly: true
  });
  const total = rowInt(await first(db, `SELECT COUNT(*) AS total FROM chat_search_sequences${filter}`), 'total');
  const rows = await all(
    db,
    `SELECT resolved_query_text, resolved_query_normalized, reason_codes_json, message_count, cue_verdict, intent_verdict, recommendation_verdict, satisfaction_verdict, started_at, ended_at FROM chat_search_sequences${filter} ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`
  );
  return c.json({
    sequences: rows.map((row) => {
      const reasons = parseJson(row.reason_codes_json);
      return {
        query: String(row.resolved_query_text || row.resolved_query_normalized || ''),
        reasons: Array.isArray(reasons) ? reasons : [],
        message_count: rowInt(row, 'message_count'),
        cue_verdict: String(row.cue_verdict || ''),
        intent_verdict: String(row.intent_verdict || ''),
        recommendation_verdict: String(row.recommendation_verdict || ''),
        satisfaction_verdict: String(row.satisfaction_verdict || ''),
        started_at: row.started_at || null,
        ended_at: row.ended_at || null
      };
    }),
    total
  });
});

app.get('/chat-analytics/sessions', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  const sessionColumns = await tableColumns(db, 'chat_sessions');
  if (!sessionColumns.size) return c.json({ sessions: [], total: 0 });
  const hasBrowserToken = sessionColumns.has('browser_token');
  const hasPredecessorSessionId = sessionColumns.has('predecessor_session_id');
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const search = c.req.query('search') || undefined;
  const browserToken = c.req.query('browser_token') || undefined;
  const clauses = [...timeClauses('s.started_at', c.req.query('started_after') || undefined, c.req.query('started_before') || undefined)];
  if (search) {
    clauses.push(`(s.session_id LIKE ${q(`%${search}%`)} OR EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.session_id = s.session_id AND cm.user_text_normalized LIKE ${q(`%${search}%`)}))`);
  }
  if (browserToken && hasBrowserToken) {
    clauses.push(`s.browser_token = ${q(browserToken)}`);
  }
  const filter = where(clauses);
  const browserTokenSelect = hasBrowserToken ? 's.browser_token' : 'NULL AS browser_token';
  const predecessorSelect = hasPredecessorSessionId ? 's.predecessor_session_id' : 'NULL AS predecessor_session_id';
  const total = rowInt(await first(db, `SELECT COUNT(*) AS total FROM chat_sessions s${filter}`), 'total');
  const sessionRows = await all(
    db,
    `SELECT s.session_id, s.message_count, s.sequence_count, s.started_at, s.last_activity_at, ${browserTokenSelect}, ${predecessorSelect} FROM chat_sessions s${filter} ORDER BY s.started_at DESC LIMIT ${limit} OFFSET ${offset}`
  );
  if (!sessionRows.length) return c.json({ sessions: [], total });
  const ids = sessionRows.map((row) => String(row.session_id || '')).filter(Boolean);
  const inList = ids.map(q).join(', ');
  const productRows = inList
    ? await all(
        db,
        `SELECT session_id, COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS results_shown, COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicks FROM chat_message_products WHERE session_id IN (${inList}) GROUP BY session_id`
      )
    : [];
  const sequenceRows = inList
    ? await all(
        db,
        `SELECT session_id, MAX(CASE WHEN message_count > 1 THEN 1 ELSE 0 END) AS reformulated, MAX(CASE WHEN status = 'unresolved' THEN 1 ELSE 0 END) AS has_unresolved FROM chat_search_sequences WHERE session_id IN (${inList}) GROUP BY session_id`
      )
    : [];
  const productsBySession = new Map(productRows.map((row) => [String(row.session_id || ''), row]));
  const sequencesBySession = new Map(sequenceRows.map((row) => [String(row.session_id || ''), row]));
  return c.json({
    sessions: sessionRows.map((row) => {
      const sid = String(row.session_id || '');
      const prod = productsBySession.get(sid);
      const seq = sequencesBySession.get(sid);
      return {
        session_id: sid,
        message_count: rowInt(row, 'message_count'),
        sequence_count: rowInt(row, 'sequence_count'),
        results_shown: rowInt(prod, 'results_shown'),
        clicks: rowInt(prod, 'clicks'),
        reformulated: Boolean(rowInt(seq, 'reformulated')),
        exited: Boolean(rowInt(seq, 'has_unresolved')),
        started_at: row.started_at || null,
        last_activity_at: row.last_activity_at || null,
        browser_token: row.browser_token || null,
        predecessor_session_id: row.predecessor_session_id || null,
      };
    }),
    total
  });
});

app.get('/chat-analytics/sessions/:sessionId', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  const sessionId = c.req.param('sessionId');
  if (!(await hasTable(db, 'chat_sessions'))) return c.json({ session: null, messages: [], events: [] });
  const session = await first(db, `SELECT * FROM chat_sessions WHERE session_id = ${q(sessionId)}`);
  if (!session.session_id) return c.json({ session: null, messages: [], events: [] });

  const messages = await all(
    db,
    `SELECT message_id, message_index, user_text_raw, user_text_normalized, assistant_response_text, predicted_cue, predicted_intent, result_count, status, fallback_reason, latency_ms, created_at FROM chat_messages WHERE session_id = ${q(sessionId)} ORDER BY message_index ASC`
  );
  const messageIds = messages.map((row) => String(row.message_id || '')).filter(Boolean);
  const productsByMessage = new Map<string, Row[]>();
  if (messageIds.length && (await hasTable(db, 'chat_message_products'))) {
    const productRows = await all(
      db,
      `SELECT message_id, product_name, brand, category, rank_position, shown_at, clicked_at, external_clicked_at FROM chat_message_products WHERE message_id IN (${messageIds.map(q).join(', ')}) ORDER BY rank_position ASC`
    );
    for (const product of productRows) {
      const mid = String(product.message_id || '');
      if (!productsByMessage.has(mid)) productsByMessage.set(mid, []);
      productsByMessage.get(mid)?.push(product);
    }
  }
  const events = (await hasTable(db, 'chat_events'))
    ? (await all(
        db,
        `SELECT event_id, message_id, event_type, product_id, rank_position, payload_json, occurred_at FROM chat_events WHERE session_id = ${q(sessionId)} ORDER BY occurred_at ASC`
      )).map((event) => ({
        event_id: event.event_id || null,
        message_id: event.message_id || null,
        event_type: String(event.event_type || ''),
        product_id: event.product_id || null,
        rank_position: event.rank_position || null,
        payload: parseJson(event.payload_json),
        occurred_at: event.occurred_at || null
      }))
    : [];

  return c.json({
    session: {
      session_id: session.session_id || null,
      store_id: session.store_id || null,
      source_page: session.source_page || null,
      started_at: session.started_at || null,
      ended_at: session.ended_at || null,
      age_gate_rendered_at: session.age_gate_rendered_at || null,
      age_confirmed_at: session.age_confirmed_at || null,
      age_declined_at: session.age_declined_at || null,
      message_count: rowInt(session, 'message_count'),
      sequence_count: rowInt(session, 'sequence_count'),
      last_activity_at: session.last_activity_at || null,
      browser_token: session.browser_token || null,
      predecessor_session_id: session.predecessor_session_id || null
    },
    messages: messages.map((message) => {
      const mid = String(message.message_id || '');
      const products = (productsByMessage.get(mid) || []).map((product) => ({
        product_name: String(product.product_name || ''),
        brand: String(product.brand || ''),
        category: String(product.category || ''),
        rank_position: product.rank_position || null,
        shown: product.shown_at !== null && product.shown_at !== undefined,
        clicked: product.clicked_at !== null && product.clicked_at !== undefined,
        external_clicked: product.external_clicked_at !== null && product.external_clicked_at !== undefined
      }));
      return {
        message_id: mid,
        message_index: rowInt(message, 'message_index'),
        user_text_raw: String(message.user_text_raw || ''),
        assistant_response_text: String(message.assistant_response_text || ''),
        predicted_cue: String(message.predicted_cue || ''),
        predicted_intent: String(message.predicted_intent || ''),
        result_count: message.result_count ?? null,
        status: String(message.status || ''),
        fallback_reason: String(message.fallback_reason || ''),
        latency_ms: message.latency_ms ?? null,
        created_at: message.created_at || null,
        products
      };
    }),
    events
  });
});

async function complianceSummaryMetrics(db: D1Database, startedAfter?: string, startedBefore?: string, sessionColumns?: Set<string>) {
  const hasSessions = await hasTable(db, 'chat_sessions');
  const hasEvents = await hasTable(db, 'chat_events');
  const hasProducts = await hasTable(db, 'chat_message_products');
  const columns = sessionColumns || (hasSessions ? await tableColumns(db, 'chat_sessions') : new Set<string>());
  const hasGateRendered = columns.has('age_gate_rendered_at');
  const hasAgeDeclined = columns.has('age_declined_at');
  const gateRenderedExpr = hasGateRendered ? 's.age_gate_rendered_at' : 'NULL';
  const ageDeclinedExpr = hasAgeDeclined ? 's.age_declined_at' : 'NULL';

  const session = hasSessions
    ? await first(
        db,
        `SELECT COUNT(*) AS total_sessions, SUM(CASE WHEN s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS age_confirmed_sessions, SUM(CASE WHEN ${gateRenderedExpr} IS NOT NULL THEN 1 ELSE 0 END) AS age_gate_rendered_sessions, SUM(CASE WHEN ${ageDeclinedExpr} IS NOT NULL THEN 1 ELSE 0 END) AS age_declined_sessions, SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 THEN 1 ELSE 0 END) AS active_sessions, SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 AND s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS age_confirmed_active_sessions, SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 AND ${gateRenderedExpr} IS NOT NULL AND s.age_confirmed_at IS NOT NULL AND fm.first_message_at IS NOT NULL AND ${gateRenderedExpr} <= s.age_confirmed_at AND s.age_confirmed_at <= fm.first_message_at THEN 1 ELSE 0 END) AS valid_age_order_sessions, SUM(CASE WHEN ${gateRenderedExpr} IS NOT NULL AND s.age_confirmed_at IS NULL AND ${ageDeclinedExpr} IS NULL AND COALESCE(s.message_count, 0) = 0 THEN 1 ELSE 0 END) AS age_gate_abandoned_sessions FROM chat_sessions s LEFT JOIN (SELECT session_id, MIN(created_at) AS first_message_at FROM chat_messages GROUP BY session_id) fm ON fm.session_id = s.session_id${where(timeClauses('s.started_at', startedAfter, startedBefore))}`
      )
    : {};

  const totalSessions = rowInt(session, 'total_sessions');
  const ageConfirmedSessions = rowInt(session, 'age_confirmed_sessions');
  const ageGateRenderedSessions = rowInt(session, 'age_gate_rendered_sessions');
  const ageDeclinedSessions = rowInt(session, 'age_declined_sessions');
  const activeSessions = rowInt(session, 'active_sessions');
  const ageConfirmedActiveSessions = rowInt(session, 'age_confirmed_active_sessions');
  const validAgeOrderSessions = rowInt(session, 'valid_age_order_sessions');
  const ageGateAbandonedSessions = rowInt(session, 'age_gate_abandoned_sessions');

  const eventWhere = where([`e.event_type IN ${inSql(COMPLIANCE_EVENT_TYPES)}`, ...timeClauses('e.occurred_at', startedAfter, startedBefore)]);
  const replacementExpr = jsonValue('e.payload_json', '$.replacement_count');
  const event = hasEvents
    ? await first(
        db,
        `SELECT COUNT(CASE WHEN e.event_type = 'age_gate_rendered' THEN 1 END) AS age_gate_rendered_events, COUNT(CASE WHEN e.event_type = 'age_declined' THEN 1 END) AS age_declined_events, COUNT(CASE WHEN e.event_type = 'age_gate_bypass_detected' THEN 1 END) AS age_gate_bypass_events, COUNT(DISTINCT CASE WHEN e.event_type = 'age_gate_bypass_detected' AND e.message_id IS NOT NULL THEN e.message_id END) AS age_gate_bypass_messages, COUNT(DISTINCT CASE WHEN e.event_type = 'age_gate_bypass_detected' AND e.session_id IS NOT NULL THEN e.session_id END) AS age_gate_bypass_sessions, COUNT(CASE WHEN e.event_type = 'compliance_refusal_strict' THEN 1 END) AS strict_refusal_events, COUNT(DISTINCT CASE WHEN e.event_type = 'compliance_refusal_strict' AND e.message_id IS NOT NULL THEN e.message_id END) AS strict_refusal_messages, COUNT(DISTINCT CASE WHEN e.event_type = 'compliance_refusal_strict' AND e.session_id IS NOT NULL THEN e.session_id END) AS strict_refusal_sessions, COUNT(CASE WHEN e.event_type = 'compliance_disclaimer_attached' THEN 1 END) AS disclaimers_attached, COUNT(CASE WHEN e.event_type = 'compliance_near_miss' THEN 1 END) AS near_misses, COUNT(CASE WHEN e.event_type = 'bot_output_therapeutic_drift' THEN 1 END) AS output_drift, COUNT(CASE WHEN e.event_type = 'bot_output_slang_sanitized' THEN 1 END) AS slang_sanitized_events, SUM(CASE WHEN e.event_type = 'bot_output_slang_sanitized' THEN CAST(COALESCE(${replacementExpr}, 0) AS INTEGER) ELSE 0 END) AS slang_replacements FROM chat_events e${eventWhere}`
      )
    : {};

  const productWhere = where(['p.message_id IS NOT NULL', 'p.session_id IS NOT NULL', ...timeClauses('p.shown_at', startedAfter, startedBefore)]);
  const messageWarning = hasProducts
    ? await first(
        db,
        `WITH recommendation_messages AS (SELECT DISTINCT p.message_id FROM chat_message_products p${productWhere}) SELECT COUNT(*) AS product_recommendation_messages, SUM(CASE WHEN EXISTS (SELECT 1 FROM chat_events e WHERE e.event_type = 'warning_rendered' AND e.message_id = recommendation_messages.message_id) THEN 1 ELSE 0 END) AS warning_rendered_messages FROM recommendation_messages`
      )
    : {};
  const sessionWarning = hasProducts
    ? await first(
        db,
        `WITH recommendation_sessions AS (SELECT DISTINCT p.session_id FROM chat_message_products p${productWhere}) SELECT COUNT(*) AS product_recommendation_sessions, SUM(CASE WHEN EXISTS (SELECT 1 FROM chat_events e WHERE e.event_type = 'warning_rendered' AND e.session_id = recommendation_sessions.session_id) THEN 1 ELSE 0 END) AS warning_rendered_sessions FROM recommendation_sessions`
      )
    : {};
  const nearHigh = hasEvents
    ? await first(
        db,
        `SELECT COUNT(*) AS near_misses_high_signal, COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END) AS near_miss_high_signal_messages FROM chat_events e${where(["e.event_type = 'compliance_near_miss'", `CAST(COALESCE(${jsonValue('e.payload_json', '$.score')}, 999) AS REAL) <= 2`, ...timeClauses('e.occurred_at', startedAfter, startedBefore)])}`
      )
    : {};

  const productRecommendationMessages = rowInt(messageWarning, 'product_recommendation_messages');
  const warningRenderedMessages = rowInt(messageWarning, 'warning_rendered_messages');
  const productRecommendationSessions = rowInt(sessionWarning, 'product_recommendation_sessions');
  const warningRenderedSessions = rowInt(sessionWarning, 'warning_rendered_sessions');

  return {
    total_sessions: totalSessions,
    age_gate_tracking_live: hasGateRendered,
    age_decline_tracking_live: hasAgeDeclined,
    age_gate_rendered_sessions: ageGateRenderedSessions,
    age_gate_render_rate: safeRate(ageGateRenderedSessions, totalSessions),
    age_declined_sessions: ageDeclinedSessions,
    age_declined_rate: safeRate(ageDeclinedSessions, ageGateRenderedSessions),
    age_gate_abandoned_sessions: ageGateAbandonedSessions,
    age_gate_abandoned_rate: safeRate(ageGateAbandonedSessions, ageGateRenderedSessions),
    age_confirmed_sessions: ageConfirmedSessions,
    age_confirmation_rate: safeRate(ageConfirmedSessions, totalSessions),
    age_acceptance_rate: safeRate(ageConfirmedSessions, ageGateRenderedSessions),
    active_sessions: activeSessions,
    age_confirmed_active_sessions: ageConfirmedActiveSessions,
    active_age_confirmation_rate: safeRate(ageConfirmedActiveSessions, activeSessions),
    valid_age_order_sessions: validAgeOrderSessions,
    allowed_chat_rate: safeRate(validAgeOrderSessions, activeSessions),
    age_gate_rendered_events: rowInt(event, 'age_gate_rendered_events'),
    age_declined_events: rowInt(event, 'age_declined_events'),
    age_gate_bypass_events: rowInt(event, 'age_gate_bypass_events'),
    age_gate_bypass_messages: rowInt(event, 'age_gate_bypass_messages'),
    age_gate_bypass_sessions: rowInt(event, 'age_gate_bypass_sessions'),
    strict_refusal_events: rowInt(event, 'strict_refusal_events'),
    strict_refusal_messages: rowInt(event, 'strict_refusal_messages'),
    strict_refusal_sessions: rowInt(event, 'strict_refusal_sessions'),
    disclaimers_attached: rowInt(event, 'disclaimers_attached'),
    near_misses: rowInt(event, 'near_misses'),
    near_misses_high_signal: rowInt(nearHigh, 'near_misses_high_signal'),
    near_miss_high_signal_messages: rowInt(nearHigh, 'near_miss_high_signal_messages'),
    output_drift: rowInt(event, 'output_drift'),
    slang_sanitized_events: rowInt(event, 'slang_sanitized_events'),
    slang_replacements: rowInt(event, 'slang_replacements'),
    product_recommendation_messages: productRecommendationMessages,
    warning_rendered_messages: warningRenderedMessages,
    warning_render_rate: safeRate(warningRenderedMessages, productRecommendationMessages),
    product_recommendation_sessions: productRecommendationSessions,
    warning_rendered_sessions: warningRenderedSessions,
    warning_session_rate: safeRate(warningRenderedSessions, productRecommendationSessions)
  };
}

async function complianceDaily(db: D1Database, startedAfter?: string, startedBefore?: string, sessionColumns?: Set<string>) {
  const hasSessions = await hasTable(db, 'chat_sessions');
  const hasEvents = await hasTable(db, 'chat_events');
  const hasProducts = await hasTable(db, 'chat_message_products');
  const columns = sessionColumns || (hasSessions ? await tableColumns(db, 'chat_sessions') : new Set<string>());
  const hasGateRendered = columns.has('age_gate_rendered_at');
  const hasAgeDeclined = columns.has('age_declined_at');
  const gateRenderedExpr = hasGateRendered ? 's.age_gate_rendered_at' : 'NULL';
  const ageDeclinedExpr = hasAgeDeclined ? 's.age_declined_at' : 'NULL';
  const after = dateAfter(startedAfter) || daysAgoIso(30);
  const before = dateBefore(startedBefore);
  const byDay = new Map<string, Row>();
  const ensure = (day: string) => {
    if (!byDay.has(day)) {
      byDay.set(day, {
        day,
        total_sessions: 0,
        age_gate_rendered_sessions: 0,
        age_confirmed_sessions: 0,
        age_declined_sessions: 0,
        age_gate_abandoned_sessions: 0,
        active_sessions: 0,
        age_confirmed_active_sessions: 0,
        valid_age_order_sessions: 0,
        age_gate_bypass_events: 0,
        strict_refusal_events: 0,
        disclaimers_attached: 0,
        near_misses: 0,
        output_drift: 0,
        slang_sanitized_events: 0,
        warning_rendered_messages: 0,
        product_recommendation_messages: 0
      });
    }
    return byDay.get(day)!;
  };

  if (hasSessions) {
    const clauses = [`s.started_at >= ${q(after)}`];
    if (before) clauses.push(`s.started_at <= ${q(before)}`);
    const rows = await all(
      db,
      `SELECT substr(s.started_at, 1, 10) AS day, COUNT(*) AS total_sessions, SUM(CASE WHEN ${gateRenderedExpr} IS NOT NULL THEN 1 ELSE 0 END) AS age_gate_rendered_sessions, SUM(CASE WHEN s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS age_confirmed_sessions, SUM(CASE WHEN ${ageDeclinedExpr} IS NOT NULL THEN 1 ELSE 0 END) AS age_declined_sessions, SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 THEN 1 ELSE 0 END) AS active_sessions, SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 AND s.age_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS age_confirmed_active_sessions, SUM(CASE WHEN COALESCE(s.message_count, 0) > 0 AND ${gateRenderedExpr} IS NOT NULL AND s.age_confirmed_at IS NOT NULL AND fm.first_message_at IS NOT NULL AND ${gateRenderedExpr} <= s.age_confirmed_at AND s.age_confirmed_at <= fm.first_message_at THEN 1 ELSE 0 END) AS valid_age_order_sessions, SUM(CASE WHEN ${gateRenderedExpr} IS NOT NULL AND s.age_confirmed_at IS NULL AND ${ageDeclinedExpr} IS NULL AND COALESCE(s.message_count, 0) = 0 THEN 1 ELSE 0 END) AS age_gate_abandoned_sessions FROM chat_sessions s LEFT JOIN (SELECT session_id, MIN(created_at) AS first_message_at FROM chat_messages GROUP BY session_id) fm ON fm.session_id = s.session_id${where(clauses)} GROUP BY day ORDER BY day ASC LIMIT 370`
    );
    for (const row of rows) Object.assign(ensure(String(row.day || '')), row);
  }

  if (hasEvents) {
    const clauses = [`e.event_type IN ${inSql(COMPLIANCE_EVENT_TYPES)}`, `e.occurred_at >= ${q(after)}`];
    if (before) clauses.push(`e.occurred_at <= ${q(before)}`);
    const rows = await all(
      db,
      `SELECT substr(e.occurred_at, 1, 10) AS day, COUNT(CASE WHEN e.event_type = 'age_gate_bypass_detected' THEN 1 END) AS age_gate_bypass_events, COUNT(CASE WHEN e.event_type = 'compliance_refusal_strict' THEN 1 END) AS strict_refusal_events, COUNT(CASE WHEN e.event_type = 'compliance_disclaimer_attached' THEN 1 END) AS disclaimers_attached, COUNT(CASE WHEN e.event_type = 'compliance_near_miss' THEN 1 END) AS near_misses, COUNT(CASE WHEN e.event_type = 'bot_output_therapeutic_drift' THEN 1 END) AS output_drift, COUNT(CASE WHEN e.event_type = 'bot_output_slang_sanitized' THEN 1 END) AS slang_sanitized_events FROM chat_events e${where(clauses)} GROUP BY day ORDER BY day ASC LIMIT 370`
    );
    for (const row of rows) Object.assign(ensure(String(row.day || '')), row);
  }

  if (hasProducts) {
    const clauses = ['p.message_id IS NOT NULL', `p.shown_at >= ${q(after)}`];
    if (before) clauses.push(`p.shown_at <= ${q(before)}`);
    const rows = await all(
      db,
      `WITH recommendation_messages AS (SELECT substr(MIN(p.shown_at), 1, 10) AS day, p.message_id FROM chat_message_products p${where(clauses)} GROUP BY p.message_id) SELECT day, COUNT(*) AS product_recommendation_messages, SUM(CASE WHEN EXISTS (SELECT 1 FROM chat_events e WHERE e.event_type = 'warning_rendered' AND e.message_id = recommendation_messages.message_id) THEN 1 ELSE 0 END) AS warning_rendered_messages FROM recommendation_messages GROUP BY day ORDER BY day ASC LIMIT 370`
    );
    for (const row of rows) Object.assign(ensure(String(row.day || '')), row);
  }

  return [...byDay.entries()]
    .filter(([day]) => Boolean(day))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);
}

app.get('/chat-analytics/compliance/summary', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const sessionColumns = await tableColumns(db, 'chat_sessions');
  return c.json({
    selected: await complianceSummaryMetrics(db, startedAfter, startedBefore, sessionColumns),
    last_7_days: await complianceSummaryMetrics(db, daysAgoIso(7), undefined, sessionColumns),
    last_30_days: await complianceSummaryMetrics(db, daysAgoIso(30), undefined, sessionColumns),
    total: await complianceSummaryMetrics(db, undefined, undefined, sessionColumns),
    daily: await complianceDaily(db, startedAfter, startedBefore, sessionColumns)
  });
});

app.get('/chat-analytics/compliance/events', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_events'))) return c.json({ events: [], total: 0 });
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const filter = complianceEventWhere({
    eventType: c.req.query('event_type') || undefined,
    category: c.req.query('category') || undefined,
    matchedStem: c.req.query('matched_stem') || undefined,
    tier: c.req.query('tier') || undefined,
    layer: c.req.query('layer') || undefined,
    sessionId: c.req.query('session_id') || undefined,
    startedAfter: c.req.query('started_after') || undefined,
    startedBefore: c.req.query('started_before') || undefined
  });
  const total = rowInt(await first(db, `SELECT COUNT(*) AS total FROM chat_events e${filter}`), 'total');
  const rows = await all(
    db,
    `SELECT e.event_id, e.session_id, e.message_id, e.event_type, e.occurred_at, ${jsonValue('e.payload_json', '$.category')} AS category, ${jsonValue('e.payload_json', '$.matched_stem')} AS matched_stem, ${jsonValue('e.payload_json', '$.nearest_stem')} AS nearest_stem, ${jsonValue('e.payload_json', '$.token_stem')} AS token_stem, ${jsonValue('e.payload_json', '$.tier')} AS tier, ${jsonValue('e.payload_json', '$.layer')} AS layer, ${jsonValue('e.payload_json', '$.score')} AS score, ${jsonValue('e.payload_json', '$.violation')} AS violation, ${jsonValue('e.payload_json', '$.first_message_at')} AS first_message_at, ${jsonValue('e.payload_json', '$.age_gate_rendered_at')} AS age_gate_rendered_at, ${jsonValue('e.payload_json', '$.age_confirmed_at')} AS age_confirmed_at, ${jsonValue('e.payload_json', '$.age_declined_at')} AS age_declined_at, ${jsonValue('e.payload_json', '$.replacement_count')} AS replacement_count, ${jsonValue('e.payload_json', '$.terms')} AS terms_json FROM chat_events e${filter} ORDER BY e.occurred_at DESC LIMIT ${limit} OFFSET ${offset}`
  );
  return c.json({
    events: rows.map((row) => ({
      event_id: row.event_id || null,
      session_id: row.session_id || null,
      message_id: row.message_id || null,
      event_type: String(row.event_type || ''),
      occurred_at: row.occurred_at || null,
      category: row.category ?? null,
      matched_stem: row.matched_stem ?? null,
      nearest_stem: row.nearest_stem ?? null,
      token_stem: row.token_stem ?? null,
      tier: row.tier ?? null,
      layer: row.layer ?? null,
      violation: row.violation ?? null,
      first_message_at: row.first_message_at ?? null,
      age_gate_rendered_at: row.age_gate_rendered_at ?? null,
      age_confirmed_at: row.age_confirmed_at ?? null,
      age_declined_at: row.age_declined_at ?? null,
      score: row.score === null || row.score === undefined ? null : rowFloat(row, 'score'),
      replacement_count: row.replacement_count === null || row.replacement_count === undefined ? null : rowInt(row, 'replacement_count'),
      terms: parseTerms(row.terms_json)
    })),
    total
  });
});

app.get('/chat-analytics/compliance/filters', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  const database = db;
  if (!(await hasTable(database, 'chat_events'))) {
    return c.json({ event_types: COMPLIANCE_LOG_EVENT_TYPES, categories: COMPLIANCE_CATEGORIES, matched_stems: [], tiers: [], layers: [] });
  }
  const base = [`e.event_type IN ${inSql(COMPLIANCE_LOG_EVENT_TYPES)}`, ...timeClauses('e.occurred_at', c.req.query('started_after') || undefined, c.req.query('started_before') || undefined)];
  async function distinctJson(path: string): Promise<string[]> {
    const expr = jsonText('e.payload_json', path);
    const rows = await all(database, `SELECT DISTINCT ${expr} AS value FROM chat_events e${where([...base, `${expr} IS NOT NULL`, `${expr} != ''`])} ORDER BY value ASC LIMIT 100`);
    return rows.map((row) => String(row.value || '')).filter(Boolean);
  }
  const matched = [...(await distinctJson('$.matched_stem')), ...(await distinctJson('$.nearest_stem'))];
  const categories = [...COMPLIANCE_CATEGORIES, ...(await distinctJson('$.category'))];
  return c.json({
    event_types: COMPLIANCE_LOG_EVENT_TYPES,
    categories: [...new Set(categories)],
    matched_stems: [...new Set(matched)],
    tiers: await distinctJson('$.tier'),
    layers: await distinctJson('$.layer')
  });
});

app.get('/chat-analytics/compliance/tuning', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_events'))) {
    return c.json({
      near_miss_score_max: floatParam(c.req.query('near_miss_score_max'), 2, 0, 3),
      strict_by_category_stem: [],
      near_misses_by_nearest_stem: [],
      output_drift_by_matched_stem: [],
      slang_sanitized_by_term: [],
      refused_sessions: [],
      age_gate_bypass_by_violation: []
    });
  }
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const nearMax = floatParam(c.req.query('near_miss_score_max'), 2, 0, 3);
  const strictWhere = complianceEventWhere({ eventType: 'compliance_refusal_strict', startedAfter, startedBefore });
  const strictRows = await all(
    db,
    `SELECT COALESCE(${jsonText('e.payload_json', '$.category')}, 'unknown') AS category, COALESCE(${jsonText('e.payload_json', '$.matched_stem')}, 'unknown') AS matched_stem, COUNT(*) AS event_count, COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END) AS message_count, COUNT(DISTINCT e.session_id) AS session_count FROM chat_events e${strictWhere} GROUP BY 1, 2 ORDER BY event_count DESC LIMIT 100`
  );
  const nearWhere = `${complianceEventWhere({ eventType: 'compliance_near_miss', startedAfter, startedBefore })} AND CAST(COALESCE(${jsonValue('e.payload_json', '$.score')}, 999) AS REAL) <= ${nearMax}`;
  const nearRows = await all(
    db,
    `SELECT COALESCE(${jsonText('e.payload_json', '$.nearest_stem')}, 'unknown') AS nearest_stem, COUNT(*) AS event_count, COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END) AS message_count, ROUND(AVG(CAST(${jsonValue('e.payload_json', '$.score')} AS REAL)), 1) AS avg_score FROM chat_events e${nearWhere} GROUP BY 1 ORDER BY event_count DESC LIMIT 100`
  );
  const driftRows = await all(
    db,
    `SELECT COALESCE(${jsonText('e.payload_json', '$.matched_stem')}, 'unknown') AS matched_stem, COUNT(*) AS event_count FROM chat_events e${complianceEventWhere({ eventType: 'bot_output_therapeutic_drift', startedAfter, startedBefore })} GROUP BY 1 ORDER BY event_count DESC LIMIT 100`
  );
  const slangWhere = complianceEventWhere({ eventType: 'bot_output_slang_sanitized', startedAfter, startedBefore });
  const safePayload = "CASE WHEN e.payload_json IS NOT NULL AND json_valid(e.payload_json) THEN e.payload_json ELSE '{\"terms\":[]}' END";
  const termExpr = "CASE WHEN json_valid(term.value) THEN json_extract(term.value, '$.term') ELSE NULL END";
  const termCountExpr = "CASE WHEN json_valid(term.value) THEN json_extract(term.value, '$.count') ELSE NULL END";
  const slangRows = await all(
    db,
    `SELECT ${termExpr} AS term, COUNT(DISTINCT e.event_id) AS event_count, SUM(CAST(COALESCE(${termCountExpr}, 0) AS INTEGER)) AS replacement_count FROM chat_events e, json_each(${safePayload}, '$.terms') term${slangWhere} AND ${termExpr} IS NOT NULL GROUP BY 1 ORDER BY replacement_count DESC LIMIT 100`
  );
  const refusedRows = await all(
    db,
    `SELECT e.session_id, COUNT(*) AS event_count, COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END) AS message_count, MIN(e.occurred_at) AS first_refusal_at, MAX(e.occurred_at) AS last_refusal_at FROM chat_events e${strictWhere} GROUP BY e.session_id ORDER BY last_refusal_at DESC LIMIT 100`
  );
  const bypassRows = await all(
    db,
    `SELECT COALESCE(${jsonText('e.payload_json', '$.violation')}, 'unknown') AS violation, COUNT(*) AS event_count, COUNT(DISTINCT CASE WHEN e.message_id IS NOT NULL THEN e.message_id END) AS message_count, COUNT(DISTINCT CASE WHEN e.session_id IS NOT NULL THEN e.session_id END) AS session_count, MAX(e.occurred_at) AS last_seen_at FROM chat_events e${complianceEventWhere({ eventType: 'age_gate_bypass_detected', startedAfter, startedBefore })} GROUP BY 1 ORDER BY event_count DESC LIMIT 100`
  );
  return c.json({
    near_miss_score_max: nearMax,
    strict_by_category_stem: strictRows.map((row) => ({ category: String(row.category || 'unknown'), matched_stem: String(row.matched_stem || 'unknown'), event_count: rowInt(row, 'event_count'), message_count: rowInt(row, 'message_count'), session_count: rowInt(row, 'session_count') })),
    near_misses_by_nearest_stem: nearRows.map((row) => ({ nearest_stem: String(row.nearest_stem || 'unknown'), event_count: rowInt(row, 'event_count'), message_count: rowInt(row, 'message_count'), avg_score: row.avg_score === null || row.avg_score === undefined ? null : rowFloat(row, 'avg_score') })),
    output_drift_by_matched_stem: driftRows.map((row) => ({ matched_stem: String(row.matched_stem || 'unknown'), event_count: rowInt(row, 'event_count') })),
    slang_sanitized_by_term: slangRows.map((row) => ({ term: String(row.term || 'unknown'), event_count: rowInt(row, 'event_count'), replacement_count: rowInt(row, 'replacement_count') })),
    refused_sessions: refusedRows.map((row) => ({ session_id: String(row.session_id || ''), event_count: rowInt(row, 'event_count'), message_count: rowInt(row, 'message_count'), first_refusal_at: row.first_refusal_at || null, last_refusal_at: row.last_refusal_at || null })),
    age_gate_bypass_by_violation: bypassRows.map((row) => ({ violation: String(row.violation || 'unknown'), event_count: rowInt(row, 'event_count'), message_count: rowInt(row, 'message_count'), session_count: rowInt(row, 'session_count'), last_seen_at: row.last_seen_at || null }))
  });
});

app.get('/chat-analytics/product-demand', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_messages'))) return c.json({ demand: [], total: 0, rollups: { make: [], body_type: [], fuel_type: [], priority: [] } });

  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const search = c.req.query('search') || undefined;
  const source = c.req.query('source') || undefined;
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const hasSequences = await hasTable(db, 'chat_search_sequences');
  const hasProducts = await hasTable(db, 'chat_message_products');
  const sequenceJoin = hasSequences ? 'LEFT JOIN chat_search_sequences sq ON sq.search_sequence_id = m.search_sequence_id' : '';
  const productJoin = hasProducts
    ? `LEFT JOIN (
        SELECT message_id,
          MAX(product_id) AS product_id,
          MAX(product_name) AS product_name,
          MAX(brand) AS brand,
          MAX(category) AS category,
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicks,
          COUNT(CASE WHEN external_clicked_at IS NOT NULL THEN 1 END) AS external_clicks
        FROM chat_message_products
        GROUP BY message_id
      ) p ON p.message_id = m.message_id`
    : '';
  const clauses = [
    'm.user_text_normalized IS NOT NULL',
    confirmationExclusionSql(),
    `(m.predicted_cue IN ('RECOMMEND', 'PRODUCT_LOOKUP') OR m.predicted_intent IN ('recommendation', 'product-question', 'product-context-question') OR (m.product_query IS NOT NULL AND TRIM(m.product_query) != ''))`,
    ...timeClauses('m.created_at', startedAfter, startedBefore)
  ];
  if (search) clauses.push(`(m.user_text_normalized LIKE ${q(`%${search}%`)} OR m.product_query LIKE ${q(`%${search}%`)})`);
  const rows = await all(
    db,
    `SELECT m.message_id, m.session_id, m.user_text_raw, m.user_text_normalized, m.predicted_cue, m.predicted_intent, m.predicted_filters_json, m.semantic_search, m.product_query, m.result_count, m.fallback_reason, m.created_at AS last_seen, ${hasSequences ? 'sq.source' : "'chat' AS source"}, ${hasSequences ? 'sq.reason_codes_json' : 'NULL AS reason_codes_json'}, ${hasProducts ? 'p.product_id, p.product_name, p.brand, p.category, p.clicks, p.external_clicks' : 'NULL AS product_id, NULL AS product_name, NULL AS brand, NULL AS category, 0 AS clicks, 0 AS external_clicks'} FROM chat_messages m ${sequenceJoin} ${productJoin}${where(clauses)} ORDER BY m.created_at DESC LIMIT 5000`
  );

  const groups = new Map<string, Record<string, unknown>>();
  const rollups = {
    make: new Map<string, number>(),
    body_type: new Map<string, number>(),
    fuel_type: new Map<string, number>(),
    priority: new Map<string, number>()
  };
  for (const row of rows) {
    const rowSource = asText(row.source) || 'chat';
    if (source && rowSource !== source) continue;
    const filters = asRecord(parseJson(row.predicted_filters_json));
    const isLookup =
      row.predicted_cue === 'PRODUCT_LOOKUP' ||
      row.predicted_intent === 'product-question' ||
      row.predicted_intent === 'product-context-question' ||
      !!asText(row.product_query);
    const demand = vehicleDemandLabel(filters, row, isLookup);
    const item = {
      label: demand.label,
      make: demand.make || asText(row.brand),
      model: demand.model,
      body_type: demand.body,
      fuel_type: demand.fuel,
      price_band: demand.priceBand,
      demand_type: isLookup ? 'vehicle_lookup' : 'recommendation'
    };
    if (!matchesSearch({ ...item, example_queries: [row.user_text_raw, row.user_text_normalized, row.product_query] }, search, ['label', 'make', 'model', 'body_type', 'fuel_type', 'example_queries'])) continue;

    const key = [item.demand_type, item.label, item.make, item.body_type, item.fuel_type, rowSource].join('|');
    const bucket = groups.get(key) ?? {
      ...item,
      source: rowSource,
      requests: 0,
      sessions: new Set<string>(),
      results_shown: 0,
      no_match_count: 0,
      clicks: 0,
      external_clicks: 0,
      last_seen: null,
      example_queries: []
    };
    bucket.requests = Number(bucket.requests) + 1;
    (bucket.sessions as Set<string>).add(asText(row.session_id));
    bucket.results_shown = Number(bucket.results_shown) + rowInt(row, 'result_count');
    if (rowInt(row, 'result_count') === 0 || reasonHas(row.reason_codes_json, 'no_results') || ['no_match', 'missing_product_query'].includes(asText(row.fallback_reason))) {
      bucket.no_match_count = Number(bucket.no_match_count) + 1;
    }
    bucket.clicks = Number(bucket.clicks) + rowInt(row, 'clicks');
    bucket.external_clicks = Number(bucket.external_clicks) + rowInt(row, 'external_clicks');
    bucket.last_seen = latestIso(bucket.last_seen, row.last_seen);
    addExample(bucket, row.user_text_raw || row.product_query || row.user_text_normalized);
    groups.set(key, bucket);

    if (item.make) rollups.make.set(item.make, (rollups.make.get(item.make) ?? 0) + 1);
    if (item.body_type) rollups.body_type.set(item.body_type, (rollups.body_type.get(item.body_type) ?? 0) + 1);
    if (item.fuel_type) rollups.fuel_type.set(item.fuel_type, (rollups.fuel_type.get(item.fuel_type) ?? 0) + 1);
    for (const priority of asList(filters.priority_tags)) rollups.priority.set(priority, (rollups.priority.get(priority) ?? 0) + 1);
  }

  const normalized = [...groups.values()].map((row) => {
    const sessions = row.sessions as Set<string>;
    return {
      ...row,
      sessions: sessions.size,
      ctr: safeRate(Number(row.clicks), Number(row.results_shown))
    };
  });
  const sorted = sortDictRows(normalized, c.req.query('sort_by') || undefined, c.req.query('sort_dir') || undefined, 'requests');
  const rollup = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([label, count]) => ({ label, count }));
  return c.json({
    demand: sorted.slice(offset, offset + limit),
    total: sorted.length,
    rollups: {
      make: rollup(rollups.make),
      body_type: rollup(rollups.body_type),
      fuel_type: rollup(rollups.fuel_type),
      priority: rollup(rollups.priority)
    }
  });
});

app.get('/chat-analytics/product-lookups', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_messages'))) return c.json({ lookups: [], total: 0 });
  const hasSequences = await hasTable(db, 'chat_search_sequences');
  const hasProducts = await hasTable(db, 'chat_message_products');
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const search = c.req.query('search') || undefined;
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const productJoin = hasProducts
    ? `LEFT JOIN chat_message_products p ON p.message_id = m.message_id AND (p.source_kind = 'product_lookup' OR m.predicted_cue = 'PRODUCT_LOOKUP')`
    : '';
  const sequenceJoin = hasSequences ? 'LEFT JOIN chat_search_sequences sq ON sq.search_sequence_id = m.search_sequence_id' : '';
  const clauses = [
    `(m.predicted_cue = 'PRODUCT_LOOKUP' OR m.predicted_intent IN ('product-question', 'product-context-question') OR (m.product_query IS NOT NULL AND TRIM(m.product_query) != ''))`,
    ...timeClauses('m.created_at', startedAfter, startedBefore)
  ];
  if (search) clauses.push(`(m.user_text_normalized LIKE ${q(`%${search}%`)} OR m.product_query LIKE ${q(`%${search}%`)} ${hasProducts ? `OR p.product_name LIKE ${q(`%${search}%`)}` : ''})`);
  const rows = await all(
    db,
    `SELECT m.message_id, m.user_text_raw, m.user_text_normalized, m.predicted_intent, m.predicted_filters_json, m.product_query, m.result_count, m.fallback_reason, m.created_at AS last_seen, ${hasSequences ? 'sq.reason_codes_json' : 'NULL AS reason_codes_json'}, ${hasProducts ? 'p.product_id, p.product_name, p.brand, p.category, p.clicked_at, p.external_clicked_at' : 'NULL AS product_id, NULL AS product_name, NULL AS brand, NULL AS category, NULL AS clicked_at, NULL AS external_clicked_at'} FROM chat_messages m ${sequenceJoin} ${productJoin}${where(clauses)} ORDER BY m.created_at DESC LIMIT 5000`
  );
  const groups = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const filters = asRecord(parseJson(row.predicted_filters_json));
    const productName = asText(row.product_name) || asText(row.product_query) || asText(row.user_text_normalized) || 'Unknown vehicle';
    const productId = asText(row.product_id) || productName;
    const key = [productId, productName].join('|');
    const bucket = groups.get(key) ?? {
      product_id: productId,
      product: productName,
      make: asText(row.brand) || asText(filters.make),
      category: asText(row.category) || asText(filters.body_type),
      lookup_count: 0,
      follow_up_count: 0,
      no_match_count: 0,
      clarification_count: 0,
      clicks: 0,
      external_clicks: 0,
      last_seen: null,
      example_queries: []
    };
    bucket.lookup_count = Number(bucket.lookup_count) + 1;
    if (row.predicted_intent === 'product-context-question') bucket.follow_up_count = Number(bucket.follow_up_count) + 1;
    if (row.fallback_reason === 'clarification') bucket.clarification_count = Number(bucket.clarification_count) + 1;
    if (rowInt(row, 'result_count') === 0 || reasonHas(row.reason_codes_json, 'no_results') || ['no_match', 'missing_product_query'].includes(asText(row.fallback_reason))) {
      bucket.no_match_count = Number(bucket.no_match_count) + 1;
    }
    if (row.clicked_at) bucket.clicks = Number(bucket.clicks) + 1;
    if (row.external_clicked_at) bucket.external_clicks = Number(bucket.external_clicks) + 1;
    bucket.last_seen = latestIso(bucket.last_seen, row.last_seen);
    addExample(bucket, row.user_text_raw || row.product_query || row.user_text_normalized);
    groups.set(key, bucket);
  }
  const sorted = sortDictRows([...groups.values()], c.req.query('sort_by') || undefined, c.req.query('sort_dir') || undefined, 'lookup_count');
  return c.json({ lookups: sorted.slice(offset, offset + limit), total: sorted.length });
});

app.get('/chat-analytics/general-questions', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_messages'))) return c.json({ questions: [], total: 0, topics: [] });
  const hasSequences = await hasTable(db, 'chat_search_sequences');
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const search = c.req.query('search') || undefined;
  const topic = c.req.query('topic') || undefined;
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const sequenceJoin = hasSequences ? 'LEFT JOIN chat_search_sequences sq ON sq.search_sequence_id = m.search_sequence_id' : '';
  const clauses = [
    'm.user_text_normalized IS NOT NULL',
    confirmationExclusionSql(),
    `(m.predicted_intent = 'general' OR (m.predicted_cue IS NULL AND (m.predicted_intent IS NULL OR m.predicted_intent = 'general')))`,
    `(m.predicted_cue IS NULL OR m.predicted_cue NOT IN ('RECOMMEND', 'PRODUCT_LOOKUP'))`,
    ...timeClauses('m.created_at', startedAfter, startedBefore)
  ];
  if (search) clauses.push(`m.user_text_normalized LIKE ${q(`%${search}%`)}`);
  const rows = await all(
    db,
    `SELECT m.message_id, m.session_id, m.user_text_raw, m.user_text_normalized, m.assistant_response_text, m.predicted_filters_json, m.created_at AS last_seen, ${hasSequences ? 'sq.resolved_bucket_label' : "NULL AS resolved_bucket_label"} FROM chat_messages m ${sequenceJoin}${where(clauses)} ORDER BY m.created_at DESC LIMIT 5000`
  );
  const groups = new Map<string, Record<string, unknown>>();
  const topicCounts = new Map<string, number>();
  for (const row of rows) {
    const text = asText(row.user_text_raw) || asText(row.user_text_normalized);
    const taxonomy = generalQuestionTopic(text, asText(row.resolved_bucket_label));
    if (topic && taxonomy.topic !== topic) continue;
    const key = [taxonomy.topic, taxonomy.subtopic].join('|');
    const bucket = groups.get(key) ?? {
      topic: taxonomy.topic,
      subtopic: taxonomy.subtopic,
      question_count: 0,
      sessions: new Set<string>(),
      answered_count: 0,
      last_seen: null,
      example_queries: []
    };
    bucket.question_count = Number(bucket.question_count) + 1;
    (bucket.sessions as Set<string>).add(asText(row.session_id));
    if (asText(row.assistant_response_text)) bucket.answered_count = Number(bucket.answered_count) + 1;
    bucket.last_seen = latestIso(bucket.last_seen, row.last_seen);
    addExample(bucket, text);
    groups.set(key, bucket);
    topicCounts.set(taxonomy.topic, (topicCounts.get(taxonomy.topic) ?? 0) + 1);
  }
  const normalized = [...groups.values()].map((row) => ({ ...row, sessions: (row.sessions as Set<string>).size }));
  const sorted = sortDictRows(normalized, c.req.query('sort_by') || undefined, c.req.query('sort_dir') || undefined, 'question_count');
  const topics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  return c.json({ questions: sorted.slice(offset, offset + limit), total: sorted.length, topics });
});

app.get('/chat-analytics/unmet-demand/summary', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_search_sequences'))) return c.json({ total_requests: 0, total_sessions: 0, distinct_items: 0, top: null, buckets: [], categories: [] });
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const clauses = [
    `(status = 'unresolved' OR ${reasonCodeExistsSql('reason_codes_json', 'no_results')})`,
    ...timeClauses('started_at', startedAfter, startedBefore)
  ];
  const rows = await all(
    db,
    `SELECT resolved_query_text, resolved_query_normalized, reason_codes_json, session_id, started_at FROM chat_search_sequences${where(clauses)} ORDER BY started_at DESC LIMIT 1000`
  );
  const groups = new Map<string, Record<string, unknown>>();
  const categories = new Map<string, { count: number; items: Set<string>; last_seen: unknown }>();
  for (const row of rows) {
    const label = asText(row.resolved_query_text) || asText(row.resolved_query_normalized) || 'Unmet request';
    const reasons = Array.isArray(parseJson(row.reason_codes_json)) ? parseJson(row.reason_codes_json) as string[] : [];
    const category = reasons.includes('no_results') ? 'No Results' : 'Unresolved Conversation';
    const bucket = groups.get(label) ?? { label, category, count: 0, sessions: new Set<string>(), reasons, last_seen: null };
    bucket.count = Number(bucket.count) + 1;
    (bucket.sessions as Set<string>).add(asText(row.session_id));
    bucket.last_seen = latestIso(bucket.last_seen, row.started_at);
    groups.set(label, bucket);
    const cat = categories.get(category) ?? { count: 0, items: new Set<string>(), last_seen: null };
    cat.count += 1;
    cat.items.add(label);
    cat.last_seen = latestIso(cat.last_seen, row.started_at);
    categories.set(category, cat);
  }
  const buckets = sortDictRows([...groups.values()].map((row) => ({ ...row, sessions: (row.sessions as Set<string>).size })), 'count', 'desc', 'count');
  return c.json({
    total_requests: rows.length,
    total_sessions: new Set(rows.map((row) => asText(row.session_id)).filter(Boolean)).size,
    distinct_items: buckets.length,
    top: buckets[0] ?? null,
    buckets,
    categories: [...categories.entries()].map(([category, value]) => ({ category, count: value.count, items: value.items.size, last_seen: value.last_seen })).sort((a, b) => b.count - a.count)
  });
});

app.get('/chat-analytics/products', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  if (!(await hasTable(db, 'chat_message_products'))) return c.json({ products: [], total: 0 });
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const filter = productWhere({
    search: c.req.query('search') || undefined,
    startedAfter: c.req.query('started_after') || undefined,
    startedBefore: c.req.query('started_before') || undefined
  });
  const countWhere = filter ? `${filter} AND shown_at IS NOT NULL` : ' WHERE shown_at IS NOT NULL';
  const total = rowInt(await first(db, `SELECT COUNT(DISTINCT product_name) AS total FROM chat_message_products${countWhere}`), 'total');
  const rows = await all(
    db,
    `SELECT product_name AS product, COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) AS mentions, COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicks, COUNT(CASE WHEN external_clicked_at IS NOT NULL THEN 1 END) AS external_clicks, CASE WHEN COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) > 0 THEN ROUND(COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END), 1) ELSE 0 END AS ctr, MAX(COALESCE(shown_at, clicked_at)) AS last_seen FROM chat_message_products${filter} GROUP BY product_name HAVING COUNT(CASE WHEN shown_at IS NOT NULL THEN 1 END) > 0 ORDER BY ${productSort(c.req.query('sort_by') || undefined, c.req.query('sort_dir') || undefined)} LIMIT ${limit} OFFSET ${offset}`
  );
  return c.json({
    products: rows.map((row) => ({
      product: String(row.product || ''),
      mentions: rowInt(row, 'mentions'),
      clicks: rowInt(row, 'clicks'),
      external_clicks: rowInt(row, 'external_clicks'),
      ctr: rowFloat(row, 'ctr'),
      last_seen: row.last_seen || null
    })),
    total
  });
});

app.get('/chat-analytics/guided-flow', async (c) => {
  const db = dbFor(c);
  if (!db) return noDb(c);
  const hasSequences = await hasTable(db, 'chat_search_sequences');
  const hasEvents = await hasTable(db, 'chat_events');
  const limit = intParam(c.req.query('limit'), 50, 1, 200);
  const offset = intParam(c.req.query('offset'), 0, 0, 100000);
  const search = c.req.query('search') || undefined;
  const startedAfter = c.req.query('started_after') || undefined;
  const startedBefore = c.req.query('started_before') || undefined;
  const eventType = c.req.query('event_type') || undefined;
  const eventQueryExpr = `COALESCE(${jsonText('e.payload_json', '$.query')}, ${jsonText('e.payload_json', '$.guided_flow_query')})`;
  const submittedEventExpr = `e.event_type = 'guided_flow_submitted' AND ${eventQueryExpr} IS NOT NULL AND ${eventQueryExpr} != ''`;
  const completedEventExpr = `e.event_type = 'guided_flow_completed' AND CAST(COALESCE(${jsonValue('e.payload_json', '$.result_count')}, 0) AS INTEGER) > 0`;
  const eventClauses = ["e.event_type IN ('guided_flow_submitted', 'guided_flow_completed')", ...timeClauses('e.occurred_at', startedAfter, startedBefore)];
  if (search) eventClauses.push(`${eventQueryExpr} LIKE ${q(`%${search}%`)}`);
  const eventFilter = where(eventClauses);

  const summaryRow = hasEvents
    ? await first(
        db,
        `SELECT COUNT(CASE WHEN ${submittedEventExpr} THEN 1 END) AS submitted, COUNT(CASE WHEN ${completedEventExpr} THEN 1 END) AS completed, COUNT(DISTINCT CASE WHEN ${submittedEventExpr} THEN e.session_id END) AS unique_sessions FROM chat_events e${eventFilter}`
      )
    : {};
  const submitted = rowInt(summaryRow, 'submitted');
  const completed = rowInt(summaryRow, 'completed');

  const guidedEventClauses = ["e.event_type IN ('guided_flow_submitted', 'guided_flow_completed')", ...timeClauses('e.occurred_at', startedAfter, startedBefore)];
  if (eventType === 'guided_flow_submitted' || eventType === 'guided_flow_completed') {
    guidedEventClauses.push(`e.event_type = ${q(eventType)}`);
  }
  if (search) guidedEventClauses.push(`${eventQueryExpr} LIKE ${q(`%${search}%`)}`);
  const guidedEventWhere = where(guidedEventClauses);
  const eventsTotal = hasEvents
    ? rowInt(await first(db, `SELECT COUNT(*) AS total FROM chat_events e${guidedEventWhere}`), 'total')
    : 0;
  const events = hasEvents
    ? await all(
        db,
        `SELECT e.event_id, e.session_id, e.message_id, e.event_type, e.payload_json, e.occurred_at FROM chat_events e${guidedEventWhere} ORDER BY e.occurred_at DESC LIMIT ${limit} OFFSET ${offset}`
      )
    : [];

  const queryClauses = [
    "e.event_type = 'guided_flow_submitted'",
    `${eventQueryExpr} IS NOT NULL`,
    `${eventQueryExpr} != ''`,
    ...timeClauses('e.occurred_at', startedAfter, startedBefore),
  ];
  if (search) queryClauses.push(`${eventQueryExpr} LIKE ${q(`%${search}%`)}`);
  const querySummary = hasEvents
    ? await all(
        db,
        `SELECT ${eventQueryExpr} AS query, COUNT(DISTINCT COALESCE(e.message_id, e.event_id)) AS count, MAX(e.occurred_at) AS last_seen FROM chat_events e${where(queryClauses)} GROUP BY query ORDER BY count DESC LIMIT 20`
      )
    : [];

  const sequenceColumns = hasSequences ? await tableColumns(db, 'chat_search_sequences') : new Set<string>();
  const hasSource = sequenceColumns.has('source');
  const hasGuidedFlowFilters = sequenceColumns.has('guided_flow_filters');
  const clauses = hasSource ? ["source = 'guided_flow'"] : ["1 = 0"];
  if (search) clauses.push(`(resolved_query_normalized LIKE ${q(`%${search}%`)} OR resolved_query_text LIKE ${q(`%${search}%`)})`);
  clauses.push(...timeClauses('started_at', startedAfter, startedBefore));
  const filter = where(clauses);
  const total = hasSequences ? rowInt(await first(db, `SELECT COUNT(*) AS total FROM chat_search_sequences${filter}`), 'total') : 0;
  const guidedFiltersSelect = hasGuidedFlowFilters ? 'guided_flow_filters' : 'NULL AS guided_flow_filters';
  const sequences = hasSequences
    ? await all(
        db,
        `SELECT search_sequence_id, session_id, resolved_query_text, resolved_query_normalized, status, cue_verdict, intent_verdict, recommendation_verdict, ${guidedFiltersSelect}, started_at, ended_at FROM chat_search_sequences${filter} ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`
      )
    : [];

  return c.json({
    summary: {
      submitted,
      completed,
      completion_rate: safeRate(completed, submitted),
      unique_sessions: rowInt(summaryRow, 'unique_sessions'),
    },
    events: events.map((row) => ({
      event_id: row.event_id || null,
      session_id: row.session_id || null,
      message_id: row.message_id || null,
      event_type: String(row.event_type || ''),
      payload: parseJson(row.payload_json),
      occurred_at: row.occurred_at || null,
    })),
    events_total: eventsTotal,
    sequences: sequences.map((row) => ({
      search_sequence_id: String(row.search_sequence_id || ''),
      session_id: String(row.session_id || ''),
      query: String(row.resolved_query_text || row.resolved_query_normalized || ''),
      status: String(row.status || ''),
      cue_verdict: String(row.cue_verdict || ''),
      intent_verdict: String(row.intent_verdict || ''),
      recommendation_verdict: String(row.recommendation_verdict || ''),
      guided_flow_filters: parseJson(row.guided_flow_filters),
      started_at: row.started_at || null,
      ended_at: row.ended_at || null,
    })),
    total,
    query_summary: querySummary.map((row) => ({
      query: String(row.query || ''),
      count: rowInt(row, 'count'),
      last_seen: row.last_seen || null,
    })),
    queries_total: querySummary.length,
  });
});

export default app;
