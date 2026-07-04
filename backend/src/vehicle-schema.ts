export const VALID_CONDITIONS = ['new', 'used', 'cpo'] as const;
export const VALID_BODY_TYPES = ['sedan', 'suv', 'truck', 'hatchback', 'minivan', 'coupe', 'convertible', 'wagon', 'van'] as const;
export const VALID_DRIVE_TYPES = ['fwd', 'awd', '4wd', 'rwd'] as const;
export const VALID_FUEL_TYPES = ['gasoline', 'hybrid', 'electric', 'diesel', 'plug-in-hybrid'] as const;
export const VALID_USE_CASE_TAGS = ['family', 'commuter', 'adventure', 'commercial', 'performance', 'eco'] as const;
export const VALID_PRIORITY_TAGS = ['safety', 'fuel-economy', 'cargo', 'towing', 'tech', 'reliability', 'performance', 'luxury', 'value', 'comfort'] as const;

export type Condition = typeof VALID_CONDITIONS[number];
export type BodyType = typeof VALID_BODY_TYPES[number];
export type DriveType = typeof VALID_DRIVE_TYPES[number];
export type FuelType = typeof VALID_FUEL_TYPES[number];
export type UseCaseTag = typeof VALID_USE_CASE_TAGS[number];
export type PriorityTag = typeof VALID_PRIORITY_TAGS[number];

export function isValidCondition(v: string): v is Condition {
  return (VALID_CONDITIONS as readonly string[]).includes(v);
}
export function isValidBodyType(v: string): v is BodyType {
  return (VALID_BODY_TYPES as readonly string[]).includes(v);
}
export function isValidDriveType(v: string): v is DriveType {
  return (VALID_DRIVE_TYPES as readonly string[]).includes(v);
}
export function isValidFuelType(v: string): v is FuelType {
  return (VALID_FUEL_TYPES as readonly string[]).includes(v);
}
export function isValidUseCaseTag(v: string): v is UseCaseTag {
  return (VALID_USE_CASE_TAGS as readonly string[]).includes(v);
}
export function isValidPriorityTag(v: string): v is PriorityTag {
  return (VALID_PRIORITY_TAGS as readonly string[]).includes(v);
}

const CONDITION_ALIASES: Record<string, Condition> = {
  'new': 'new', 'brand-new': 'new', 'brand new': 'new',
  'used': 'used', 'pre-owned': 'used', 'preowned': 'used', 'second-hand': 'used',
  'cpo': 'cpo', 'certified': 'cpo', 'certified pre-owned': 'cpo', 'certified preowned': 'cpo',
};
const BODY_TYPE_ALIASES: Record<string, BodyType> = {
  'sedan': 'sedan', 'car': 'sedan',
  'suv': 'suv', 'crossover': 'suv', 'cuv': 'suv', 'sport utility': 'suv',
  'truck': 'truck', 'pickup': 'truck', 'pickup truck': 'truck',
  'hatchback': 'hatchback', 'hatch': 'hatchback',
  'wagon': 'wagon', 'station wagon': 'wagon', 'estate': 'wagon',
  'minivan': 'minivan', 'people mover': 'minivan',
  'van': 'van', 'cargo van': 'van', 'passenger van': 'van', 'commercial van': 'van', 'work van': 'van',
  'coupe': 'coupe', 'sports car': 'coupe',
  'convertible': 'convertible', 'roadster': 'convertible',
};
const DRIVE_TYPE_ALIASES: Record<string, DriveType> = {
  'awd': 'awd', 'all-wheel': 'awd', 'all wheel drive': 'awd', 'all-wheel-drive': 'awd',
  '4wd': '4wd', '4x4': '4wd', 'four wheel drive': '4wd', 'four-wheel-drive': '4wd',
  'fwd': 'fwd', 'front-wheel': 'fwd', 'front wheel drive': 'fwd',
  'rwd': 'rwd', 'rear-wheel': 'rwd', 'rear wheel drive': 'rwd',
};
const FUEL_TYPE_ALIASES: Record<string, FuelType> = {
  'gasoline': 'gasoline', 'gas': 'gasoline', 'petrol': 'gasoline',
  'hybrid': 'hybrid', 'hev': 'hybrid',
  'electric': 'electric', 'ev': 'electric', 'bev': 'electric',
  'diesel': 'diesel',
  'plug-in-hybrid': 'plug-in-hybrid', 'phev': 'plug-in-hybrid', 'plug in hybrid': 'plug-in-hybrid', 'plugin hybrid': 'plug-in-hybrid',
};

export function normalizeCondition(v: string): Condition | null {
  return CONDITION_ALIASES[v.toLowerCase().trim()] ?? null;
}
export function normalizeBodyType(v: string): BodyType | null {
  return BODY_TYPE_ALIASES[v.toLowerCase().trim()] ?? null;
}
export function normalizeDriveType(v: string): DriveType | null {
  return DRIVE_TYPE_ALIASES[v.toLowerCase().trim()] ?? null;
}
export function normalizeFuelType(v: string): FuelType | null {
  return FUEL_TYPE_ALIASES[v.toLowerCase().trim()] ?? null;
}

export function getVehicleSchemaForPrompt(): string {
  return `
## VEHICLE SCHEMA (use ONLY these exact values)

Conditions: ${VALID_CONDITIONS.join(', ')}

Body Types: ${VALID_BODY_TYPES.join(', ')}

Drive Types: ${VALID_DRIVE_TYPES.join(', ')}

Fuel Types: ${VALID_FUEL_TYPES.join(', ')}

Use Case Tags: ${VALID_USE_CASE_TAGS.join(', ')}

Priority Tags: ${VALID_PRIORITY_TAGS.join(', ')}
`.trim();
}
