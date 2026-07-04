export interface VehicleFilters {
  condition?: string;
  body_type?: string;
  make?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  drive_type?: string;
  fuel_type?: string;
  price_min?: number;
  price_max?: number;
  mileage_max?: number;
  seats_min?: number;
  use_case_tags?: string[];
  priority_tags?: string[];
}

export interface VehicleResult {
  id: string;
  vin?: string;
  condition: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  body_type: string;
  drive_type?: string;
  fuel_type?: string;
  transmission?: string;
  engine?: string;
  horsepower?: number;
  mpg_city?: number;
  mpg_highway?: number;
  seats?: number;
  mileage?: number;
  price: number;
  msrp?: number;
  exterior_color?: string;
  interior_color?: string;
  description?: string;
  key_features?: string[];
  use_case_tags?: string[];
  priority_tags?: string[];
  image_url?: string;
  dealer_name?: string;
  dealer_zip?: string;
  source_name?: string;
  source_url?: string;
  in_stock: number;
  featured: number;
}

function parseJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

function mapRow(row: any): VehicleResult {
  return {
    ...row,
    key_features: parseJsonArray(row.key_features),
    use_case_tags: parseJsonArray(row.use_case_tags),
    priority_tags: parseJsonArray(row.priority_tags),
  };
}

const LOOKUP_STOP_WORDS = new Set([
  'a', 'about', 'all', 'any', 'are', 'can', 'car', 'carfax', 'cars', 'could', 'details',
  'do', 'does', 'for', 'got', 'have', 'history', 'i', 'in', 'info', 'inventory', 'is',
  'it', 'its', 'let', 'like', 'listing', 'look', 'lookup', 'me', 'more', 'of', 'on',
  'please', 'pull', 'report', 'show', 'that', 'the', 'tell', 'this', 'up', 'vehicle',
  'vehicles', 'what', 'with', 'you', 'your'
]);

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseLookupQuery(query: string): { tokens: string[]; years: number[] } {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rawTokens = normalized ? normalized.split(' ') : [];
  const years = uniqueStrings(rawTokens.filter((token) => /^(19|20)\d{2}$/.test(token)))
    .map((token) => Number(token))
    .filter((year) => Number.isFinite(year));
  const tokens = uniqueStrings(
    rawTokens.filter((token) =>
      token.length > 1 &&
      !LOOKUP_STOP_WORDS.has(token) &&
      !/^(19|20)\d{2}$/.test(token)
    )
  ).slice(0, 10);

  return { tokens, years };
}

function fuelEconomyOrder(filters: VehicleFilters): string {
  const priorities = filters.priority_tags ?? [];
  const useCases = filters.use_case_tags ?? [];
  const wantsFuelEconomy =
    filters.fuel_type === 'hybrid' ||
    filters.fuel_type === 'plug-in-hybrid' ||
    filters.fuel_type === 'electric' ||
    priorities.includes('fuel-economy') ||
    useCases.includes('eco');

  return wantsFuelEconomy
    ? `CASE WHEN v.fuel_type IN ('hybrid', 'plug-in-hybrid', 'electric') THEN 1 ELSE 0 END DESC,
       COALESCE(v.mpg_city, 0) DESC,
       COALESCE(v.mpg_highway, 0) DESC,`
    : '';
}

export async function searchVehicles(
  db: D1Database,
  filters: VehicleFilters,
  limit = 8
): Promise<VehicleResult[]> {
  const conditions: string[] = ['v.in_stock = 1'];
  const params: any[] = [];

  if (filters.condition) {
    conditions.push('v.condition = ?');
    params.push(filters.condition);
  }
  if (filters.body_type) {
    conditions.push('v.body_type = ?');
    params.push(filters.body_type);
  }
  if (filters.make) {
    conditions.push('LOWER(v.make) = LOWER(?)');
    params.push(filters.make);
  }
  if (filters.model) {
    conditions.push('LOWER(v.model) LIKE LOWER(?)');
    params.push(`%${filters.model}%`);
  }
  if (filters.year_min != null) {
    conditions.push('v.year >= ?');
    params.push(filters.year_min);
  }
  if (filters.year_max != null) {
    conditions.push('v.year <= ?');
    params.push(filters.year_max);
  }
  if (filters.drive_type) {
    conditions.push('v.drive_type = ?');
    params.push(filters.drive_type);
  }
  if (filters.fuel_type) {
    conditions.push('v.fuel_type = ?');
    params.push(filters.fuel_type);
  }
  if (filters.price_min != null) {
    conditions.push('v.price >= ?');
    params.push(filters.price_min);
  }
  if (filters.price_max != null) {
    conditions.push('v.price <= ?');
    params.push(filters.price_max);
  }
  if (filters.mileage_max != null) {
    conditions.push('(v.mileage IS NULL OR v.mileage <= ?)');
    params.push(filters.mileage_max);
  }
  if (filters.seats_min != null) {
    conditions.push('(v.seats IS NULL OR v.seats >= ?)');
    params.push(filters.seats_min);
  }
  if (filters.use_case_tags && filters.use_case_tags.length > 0) {
    const tagConditions = filters.use_case_tags.map(() => `v.use_case_tags LIKE ?`);
    conditions.push(`(${tagConditions.join(' OR ')})`);
    filters.use_case_tags.forEach(tag => params.push(`%"${tag}"%`));
  }
  if (filters.priority_tags && filters.priority_tags.length > 0) {
    const tagConditions = filters.priority_tags.map(() => `v.priority_tags LIKE ?`);
    conditions.push(`(${tagConditions.join(' OR ')})`);
    filters.priority_tags.forEach(tag => params.push(`%"${tag}"%`));
  }

  const where = conditions.join(' AND ');
  const sql = `SELECT v.* FROM vehicles v WHERE ${where} ORDER BY ${fuelEconomyOrder(filters)} v.featured DESC, v.price ASC LIMIT ?`;
  params.push(limit);

  const result = await db.prepare(sql).bind(...params).all();
  return (result.results || []).map(mapRow);
}

export async function searchVehiclesWithFallback(
  db: D1Database,
  filters: VehicleFilters,
  limit = 8
): Promise<{ results: VehicleResult[]; appliedFilters: VehicleFilters; fallbackReason: string }> {
  // Tier 1: full match
  let results = await searchVehicles(db, filters, limit);
  if (results.length > 0) return { results, appliedFilters: filters, fallbackReason: 'exact_match' };

  // Tier 2: drop priority_tags
  if (filters.priority_tags?.length) {
    const f = { ...filters, priority_tags: undefined };
    results = await searchVehicles(db, f, limit);
    if (results.length > 0) return { results, appliedFilters: f, fallbackReason: 'dropped_priority_tags' };
  }

  // Tier 3: drop use_case_tags
  if (filters.use_case_tags?.length) {
    const f = { ...filters, priority_tags: undefined, use_case_tags: undefined };
    results = await searchVehicles(db, f, limit);
    if (results.length > 0) return { results, appliedFilters: f, fallbackReason: 'dropped_use_case_tags' };
  }

  // Tier 4: drop drive_type + fuel_type
  if (filters.drive_type || filters.fuel_type) {
    const f = { ...filters, priority_tags: undefined, use_case_tags: undefined, drive_type: undefined, fuel_type: undefined };
    results = await searchVehicles(db, f, limit);
    if (results.length > 0) return { results, appliedFilters: f, fallbackReason: 'dropped_drive_and_fuel' };
  }

  // Tier 5: condition + body_type + price only
  {
    const f: VehicleFilters = {
      condition: filters.condition,
      body_type: filters.body_type,
      price_min: filters.price_min,
      price_max: filters.price_max,
    };
    results = await searchVehicles(db, f, limit);
    if (results.length > 0) return { results, appliedFilters: f, fallbackReason: 'condition_body_price_only' };
  }

  // Tier 6: body_type + price only
  {
    const f: VehicleFilters = {
      body_type: filters.body_type,
      price_min: filters.price_min,
      price_max: filters.price_max,
    };
    results = await searchVehicles(db, f, limit);
    if (results.length > 0) return { results, appliedFilters: f, fallbackReason: 'body_price_only' };
  }

  // Tier 7: price only
  {
    const f: VehicleFilters = {
      price_min: filters.price_min,
      price_max: filters.price_max,
    };
    results = await searchVehicles(db, f, limit);
    return { results, appliedFilters: f, fallbackReason: results.length > 0 ? 'price_only' : 'no_valid_catalog_results' };
  }
}

export async function lookupVehicleByName(
  db: D1Database,
  query: string,
  limit = 3
): Promise<VehicleResult[]> {
  const { tokens, years } = parseLookupQuery(query);
  const fallbackTokens = tokens.length || years.length ? [] : query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const effectiveTokens = tokens.length ? tokens : fallbackTokens;
  const searchable = `LOWER(
    CAST(v.year AS TEXT) || ' ' ||
    COALESCE(v.make, '') || ' ' ||
    COALESCE(v.model, '') || ' ' ||
    COALESCE(v.trim, '') || ' ' ||
    COALESCE(v.vin, '') || ' ' ||
    COALESCE(v.description, '') || ' ' ||
    COALESCE(v.key_features, '') || ' ' ||
    COALESCE(v.source_name, '')
  )`;
  const whereClauses: string[] = [];
  const whereParams: any[] = [];

  effectiveTokens.forEach((token) => {
    whereClauses.push(`${searchable} LIKE ?`);
    whereParams.push(`%${token}%`);
  });
  years.forEach((year) => {
    whereClauses.push('v.year = ?');
    whereParams.push(year);
  });

  if (whereClauses.length === 0) return [];

  const scoreParts: string[] = [];
  const scoreParams: any[] = [];
  effectiveTokens.forEach((token) => {
    scoreParts.push(`CASE WHEN LOWER(v.make) = ? THEN 40 ELSE 0 END`);
    scoreParams.push(token);
    scoreParts.push(`CASE WHEN LOWER(v.model) = ? THEN 35 ELSE 0 END`);
    scoreParams.push(token);
    scoreParts.push(`CASE WHEN LOWER(COALESCE(v.trim, '')) = ? THEN 28 ELSE 0 END`);
    scoreParams.push(token);
    scoreParts.push(`CASE WHEN ${searchable} LIKE ? THEN 8 ELSE 0 END`);
    scoreParams.push(`%${token}%`);
  });
  years.forEach((year) => {
    scoreParts.push(`CASE WHEN v.year = ? THEN 50 ELSE 0 END`);
    scoreParams.push(year);
  });

  const params = [...scoreParams, ...whereParams];
  params.push(limit);

  const scoreSql = scoreParts.length ? scoreParts.join(' + ') : '0';
  const sql = `
    SELECT v.*, (${scoreSql}) AS lookup_score
    FROM vehicles v
    WHERE v.in_stock = 1 AND (${whereClauses.join(' OR ')})
    ORDER BY lookup_score DESC, v.featured DESC, v.price ASC
    LIMIT ?
  `;
  const result = await db.prepare(sql).bind(...params).all();
  return (result.results || []).map(mapRow);
}

export interface CatalogFacets {
  makes: string[];
  bodyTypes: string[];
  conditions: string[];
}

export async function getCatalogFacets(
  db: D1Database,
  filters: { make?: string } = {}
): Promise<CatalogFacets> {
  const clauses: string[] = ['in_stock = 1'];
  const params: any[] = [];

  if (filters.make) {
    clauses.push('make = ?');
    params.push(filters.make);
  }

  const sql = `SELECT make, body_type, condition FROM vehicles WHERE ${clauses.join(' AND ')}`;
  const result = await db.prepare(sql).bind(...params).all();
  const rows = result.results || [];

  const makes = new Set<string>();
  const bodyTypes = new Set<string>();
  const conditions = new Set<string>();

  for (const row of rows) {
    if (row.make) makes.add(String(row.make));
    if (row.body_type) bodyTypes.add(String(row.body_type));
    if (row.condition) conditions.add(String(row.condition));
  }

  return {
    makes: [...makes].sort(),
    bodyTypes: [...bodyTypes].sort(),
    conditions: [...conditions].sort(),
  };
}
