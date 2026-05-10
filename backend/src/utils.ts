import {
  isValidCondition,
  isValidBodyType,
  isValidDriveType,
  isValidFuelType,
  isValidUseCaseTag,
  isValidPriorityTag,
  normalizeCondition,
  normalizeBodyType,
  normalizeDriveType,
  normalizeFuelType,
} from './vehicle-schema';
import type { VehicleFilters } from './vehicle-search';

const formatConversationHistory = (messageList: Array<any>) => {
    const formattedMessages = messageList.map(message => {
        const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
        return `${role}: ${message.content}`;
    });
    return formattedMessages.join('\n');
}

export function validateVehicleFilters(filters: Record<string, any>): VehicleFilters {
  const validated: VehicleFilters = {};
  const normalizeStringArray = (value: unknown): string[] => {
    const rawValues = Array.isArray(value) ? value : [value];
    return rawValues
      .map((entry) => String(entry).toLowerCase().trim())
      .filter((entry) => entry.length > 0);
  };

  if (filters.condition) {
    const normalized = normalizeCondition(String(filters.condition).toLowerCase());
    if (normalized && isValidCondition(normalized)) validated.condition = normalized;
  }
  if (filters.body_type) {
    const normalized = normalizeBodyType(String(filters.body_type).toLowerCase());
    if (normalized && isValidBodyType(normalized)) validated.body_type = normalized;
  }
  if (filters.make) validated.make = String(filters.make);
  if (filters.model) validated.model = String(filters.model);
  if (filters.year_min != null) validated.year_min = Number(filters.year_min);
  if (filters.year_max != null) validated.year_max = Number(filters.year_max);
  if (filters.drive_type) {
    const normalized = normalizeDriveType(String(filters.drive_type).toLowerCase());
    if (normalized && isValidDriveType(normalized)) validated.drive_type = normalized;
  }
  if (filters.fuel_type) {
    const normalized = normalizeFuelType(String(filters.fuel_type).toLowerCase());
    if (normalized && isValidFuelType(normalized)) validated.fuel_type = normalized;
  }
  if (filters.price_min != null) validated.price_min = Number(filters.price_min);
  if (filters.price_max != null) validated.price_max = Number(filters.price_max);
  if (filters.mileage_max != null) validated.mileage_max = Number(filters.mileage_max);
  if (filters.seats_min != null) validated.seats_min = Number(filters.seats_min);

  if (filters.use_case_tags && Array.isArray(filters.use_case_tags)) {
    const validTags = normalizeStringArray(filters.use_case_tags).filter(isValidUseCaseTag);
    if (validTags.length > 0) validated.use_case_tags = [...new Set(validTags)];
  }
  if (filters.priority_tags && Array.isArray(filters.priority_tags)) {
    const validTags = normalizeStringArray(filters.priority_tags).filter(isValidPriorityTag);
    if (validTags.length > 0) validated.priority_tags = [...new Set(validTags)];
  }

  return validated;
}

export function buildCompactRerankCandidates(
  vehicles: Array<Record<string, any>>
): Array<Record<string, any>> {
  return vehicles.map((v) => {
    const candidate: Record<string, any> = {
      id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim,
      condition: v.condition, body_type: v.body_type, price: v.price,
    };
    if (v.drive_type) candidate.drive_type = v.drive_type;
    if (v.fuel_type) candidate.fuel_type = v.fuel_type;
    if (v.mileage != null) candidate.mileage = v.mileage;
    if (v.engine) candidate.engine = v.engine;
    if (v.seats) candidate.seats = v.seats;
    if (v.mpg_city) candidate.mpg_city = v.mpg_city;
    if (v.mpg_highway) candidate.mpg_highway = v.mpg_highway;
    if (Array.isArray(v.use_case_tags) && v.use_case_tags.length > 0) candidate.use_case_tags = v.use_case_tags;
    if (Array.isArray(v.priority_tags) && v.priority_tags.length > 0) candidate.priority_tags = v.priority_tags;
    if (Array.isArray(v.key_features) && v.key_features.length > 0) candidate.key_features = v.key_features.slice(0, 5);
    if (v.description) {
      const desc = String(v.description).replace(/\s+/g, ' ').trim();
      candidate.description = desc.length > 200 ? desc.slice(0, 197) + '...' : desc;
    }
    return candidate;
  });
}

export function parseRobustJSON(rawText: string): { success: boolean; data?: any; error?: string } {
  if (!rawText || typeof rawText !== 'string') return { success: false, error: 'Empty or invalid input' };
  let text = rawText.trim();
  if (text.startsWith('```json')) text = text.replace(/^```json\s*/i, '').replace(/\s*```$/g, '');
  else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/\s*```$/g, '');
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<[^>]+>/g, '').trim();
  if (!text) return { success: false, error: 'Empty text after cleaning' };

  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return { success: false, error: 'No opening brace found' };

  let braceCount = 0, endBrace = -1;
  for (let i = firstBrace; i < text.length; i++) {
    if (text[i] === '{') braceCount++;
    if (text[i] === '}') braceCount--;
    if (braceCount === 0) { endBrace = i + 1; break; }
  }

  let jsonText: string;
  if (endBrace === -1 || braceCount > 0) {
    jsonText = text.substring(firstBrace);
    let openBraces = 0, openBrackets = 0, inString = false, escapeNext = false;
    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (char === '\\') { escapeNext = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
      }
    }
    jsonText = jsonText.replace(/,(\s*)$/, '$1');
    for (let i = 0; i < openBrackets; i++) jsonText += ']';
    for (let i = 0; i < openBraces; i++) jsonText += '}';
  } else {
    jsonText = text.substring(firstBrace, endBrace);
  }

  try {
    return { success: true, data: JSON.parse(jsonText) };
  } catch (parseError) {
    try {
      let cleaned = jsonText
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/}\s*"([^"]+)":/g, '}, "$1":')
        .replace(/]\s*"([^"]+)":/g, '], "$1":');
      let quoteCount = 0, lastQuoteIndex = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '"' && (i === 0 || cleaned[i - 1] !== '\\')) { quoteCount++; lastQuoteIndex = i; }
      }
      if (quoteCount % 2 !== 0 && lastQuoteIndex !== -1) {
        const afterQuote = cleaned.substring(lastQuoteIndex + 1);
        const nextSpecial = afterQuote.search(/[,}\]]/);
        if (nextSpecial !== -1) cleaned = cleaned.substring(0, lastQuoteIndex + 1 + nextSpecial) + '"' + cleaned.substring(lastQuoteIndex + 1 + nextSpecial);
        else cleaned += '"';
      }
      cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      return { success: true, data: JSON.parse(cleaned) };
    } catch {
      try {
        const idsMatch = jsonText.match(/"ranked_ids":\s*\[(.*?)\]/s);
        if (idsMatch) {
          const rankedIds = [...idsMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
          if (rankedIds.length > 0) return { success: true, data: { ranked_ids: rankedIds, reasoning: "Partial parse" } };
        }
      } catch { /* regex failed */ }
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      return { success: false, error: `JSON parse failed: ${errorMsg}` };
    }
  }
}

export { formatConversationHistory };
