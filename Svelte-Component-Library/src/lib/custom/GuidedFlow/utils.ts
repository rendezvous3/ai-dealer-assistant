import type { FlowStep } from './types.js';

export interface TransformedMetadata {
  metadata: Record<string, any>;
  guidedFlowQuery: string;
  filters: Record<string, any>;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function findSelectedOptions(step: FlowStep, value: any) {
  const selectedValues = Array.isArray(value) ? value : [value];
  return step.options.filter((option) =>
    selectedValues.some((selectedValue) => {
      if (typeof selectedValue === 'object' && typeof option.value === 'object') {
        return deepEqual(selectedValue, option.value);
      }
      return selectedValue === option.value;
    })
  );
}

function normalizeLabel(label: string): string {
  return label
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function formatPrice(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function applyPriceSelection(value: any, filters: Record<string, any>, metadata: Record<string, any>) {
  if (!value || typeof value !== 'object') return;

  if (value.mode === 'set-max' && typeof value.max === 'number') {
    filters.price_max = value.max;
    metadata.price = `under ${formatPrice(value.max)}`;
  } else if (value.mode === 'no-max') {
    metadata.price = 'flexible budget';
  }
}

export function transformSelectionsToMetadata(
  selections: Record<string, any>,
  steps: FlowStep[]
): TransformedMetadata {
  const metadata: Record<string, any> = {};
  const filters: Record<string, any> = {};
  const stepMap = new Map(steps.map((step) => [step.id, step]));

  for (const [stepId, value] of Object.entries(selections)) {
    const step = stepMap.get(stepId);
    if (!step) continue;

    if (step.type === 'price-selector' || stepId === 'price') {
      applyPriceSelection(value, filters, metadata);
      continue;
    }

    const selectedOptions = findSelectedOptions(step, value);
    if (selectedOptions.length === 0) continue;

    if (step.type === 'multi-select') {
      const values = selectedOptions.map((option) => option.value).filter((optionValue) => optionValue != null);
      const labels = selectedOptions.map((option) => normalizeLabel(option.label));
      if (values.length > 0) filters[stepId] = values;
      metadata[stepId] = labels;
      continue;
    }

    const option = selectedOptions[0];
    metadata[stepId] = normalizeLabel(option.label);
    if (option.value != null) {
      filters[stepId] = option.value;
    }
  }

  const queryParts: string[] = [];
  const condition = metadata.condition && filters.condition ? String(metadata.condition).toLowerCase() : '';
  const bodyType = metadata.body_type ? String(metadata.body_type).toLowerCase() : 'vehicle';
  queryParts.push(`Looking for ${condition ? `${condition} ` : ''}${bodyType}`);

  if (metadata.use_case) {
    queryParts.push(`for ${String(metadata.use_case).toLowerCase()}`);
  }

  if (Array.isArray(metadata.priority_tags) && metadata.priority_tags.length > 0) {
    queryParts.push(`prioritizing ${joinLabels(metadata.priority_tags.map((label: string) => label.toLowerCase()))}`);
  }

  if (metadata.price) {
    queryParts.push(String(metadata.price));
  }

  const guidedFlowQuery = `${queryParts.join(', ')}.`;

  return {
    metadata,
    guidedFlowQuery,
    filters
  };
}
