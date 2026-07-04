// Vehicle badge formatter.

export interface VehicleProduct {
  condition?: string;
  body_type?: string;
  drive_type?: string;
  fuel_type?: string;
  mileage?: number;
  engine?: string;
  year?: number;
  make?: string;
  model?: string;
  key_features?: string[];
  category?: string;
  brand?: string;
}

export interface BadgeResult {
  topLabel: string;
  value: string;
  sublabel?: string;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  used: 'Used',
  cpo: 'CPO',
};

const BODY_TYPE_LABELS: Record<string, string> = {
  suv: 'SUV',
  truck: 'Truck',
  sedan: 'Sedan',
  hatchback: 'Hatch',
  minivan: 'Minivan',
  coupe: 'Coupe',
  convertible: 'Conv.',
  wagon: 'Wagon',
  van: 'Van',
};

export function formatBodyBadge(product: VehicleProduct): BadgeResult | null {
  if (product.condition) {
    const label = CONDITION_LABELS[product.condition.toLowerCase()] ?? capitalizeFirst(product.condition);
    return { topLabel: 'Cond.', value: label };
  }
  return null;
}

export function formatTypeBadge(product: VehicleProduct): BadgeResult | null {
  if (product.body_type) {
    const label = BODY_TYPE_LABELS[product.body_type.toLowerCase()] ?? capitalizeFirst(product.body_type);
    return { topLabel: 'Type', value: label };
  }
  return null;
}

export function formatVehicleSubtitle(product: VehicleProduct): string | null {
  const parts: string[] = [];
  if (product.mileage != null && product.mileage > 0) {
    parts.push(`${product.mileage.toLocaleString()} mi`);
  } else if (product.mileage === 0) {
    parts.push('New');
  }
  if (product.engine) parts.push(product.engine);
  if (product.drive_type) parts.push(product.drive_type.toUpperCase());
  return parts.length > 0 ? parts.join(' · ') : null;
}

// Legacy no-op exports retained for older stories and demos.
export function formatTHCLabel(_product: any): null { return null; }
export function formatCBDLabel(_product: any): null { return null; }
export function formatWeightLabel(_product: any): null { return null; }
export function formatOzFraction(_oz: number): string { return ''; }
