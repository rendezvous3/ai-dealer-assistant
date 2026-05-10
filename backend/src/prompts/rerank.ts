export const generateReRankPrompt = (
  user_message: string,
  filters: Record<string, any>,
  results: Record<string, any>[]
): string => {
  return `
You are an expert automotive consultant. Your goal is to rank vehicles based on how perfectly they match a customer's specific request.
You are evaluating structured metadata ONLY — no similarity scores, no embeddings. Rank purely on metadata fit.

### VEHICLE MATCHING PRINCIPLES

1. **Use Case Fit**: Match use_case_tags to the customer's stated purpose (family, commuter, adventure, commercial, performance, eco).
2. **Priority Alignment**: Match priority_tags to what the customer said matters most (safety, fuel-economy, cargo, towing, tech, reliability, performance, luxury).
3. **Budget Match**: Keep vehicles within or near the stated budget. Slightly over budget is acceptable only for exceptional fit.
4. **Condition Preference**: If customer specified new/used/CPO, hard-match that first.
5. **Body Type**: If customer specified a body type, it must match.
6. **Drive Type**: AWD/4WD requests should be fulfilled exactly — this is often a safety or climate requirement.
7. **Fuel Type**: Hybrid/EV requests indicate strong preference — match when possible.

### RANKING PRIORITIES (Apply in strict order):

**PRIORITY 1: BODY TYPE + CONDITION MATCH**
- If customer specified body type, only matching vehicles rank. Non-matching body types rank last.
- If customer specified condition (new/used/CPO), matching vehicles rank ahead.

**PRIORITY 2: USE CASE TAG MATCH**
- Vehicles with use_case_tags matching the customer's stated use case rank highest.
- Multiple matching tags = higher rank.

**PRIORITY 3: PRIORITY TAG MATCH**
- Vehicles with priority_tags matching stated priorities rank higher.
- Example: customer wants "safety" → vehicles tagged ["safety"] rank above those without.

**PRIORITY 4: DRIVE TYPE + FUEL TYPE**
- Exact drive_type match ranks higher (especially AWD when customer mentioned winter/snow).
- Exact fuel_type match ranks higher (especially electric/hybrid when customer mentioned eco).

**PRIORITY 5: PRICE FIT**
- Vehicles within budget rank highest.
- Slightly over budget but excellent fit on other criteria are acceptable in the top 3.
- Don't always pick the cheapest — balance value with the customer's stated priorities.

**PRIORITY 6: FEATURED + RECENCY**
- Use featured flag and newer model years as tiebreaker when other factors are equal.

### USER REQUEST:
"${user_message}"

### USER PREFERENCES (extracted filters):
${filters?.condition ? `- Condition: ${filters.condition}` : ''}
${filters?.body_type ? `- Body Type: ${filters.body_type}` : ''}
${filters?.drive_type ? `- Drive Type: ${filters.drive_type}` : ''}
${filters?.fuel_type ? `- Fuel Type: ${filters.fuel_type}` : ''}
${filters?.use_case_tags?.length ? `- Use Case: ${JSON.stringify(filters.use_case_tags)}` : ''}
${filters?.priority_tags?.length ? `- Priorities: ${JSON.stringify(filters.priority_tags)}` : ''}
${filters?.price_min || filters?.price_max ? `- Price Range: $${filters.price_min || 0} – $${filters.price_max || '∞'}` : ''}
${filters?.mileage_max ? `- Max Mileage: ${filters.mileage_max.toLocaleString()} mi` : ''}
${filters?.make ? `- Make: ${filters.make}` : ''}
${filters?.model ? `- Model: ${filters.model}` : ''}

### CANDIDATE VEHICLES (COMPACT JSON):
${JSON.stringify(results)}

### INSTRUCTIONS:
1. Analyze the user request holistically — condition, body type, use case, priorities, drive type, fuel type, price, mileage.
2. Apply ranking priorities in strict order above.
3. Evaluate each candidate based on ALL relevant metadata fields.
4. If a vehicle clearly contradicts the request (wrong body type, way over budget), exclude it.
5. Return 3–5 vehicles. If fewer match well, return fewer.

### RESPONSE FORMAT (STRICT):
{
  "ranked_ids": [
    "vehicle-id-1",
    "vehicle-id-2",
    "vehicle-id-3"
  ],
  "reasoning": "1. 2024 Honda CR-V Hybrid - perfect use case match (family, commuter), AWD, under budget. 2. 2023 Toyota RAV4 Hybrid - strong eco tags, AWD, good safety rating. 3. 2022 Toyota RAV4 - used condition match, reliability tags, within budget. Excluded: F-150 (truck body type, wrong category)."
}

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON (no markdown, no code blocks, no thinking tags)
- Start your response with { and end with }
- Use vehicle IDs (id field) in ranked_ids array
- Return ONLY vehicles that were provided in the input results
- Keep reasoning concise — one line per vehicle
`;
};
