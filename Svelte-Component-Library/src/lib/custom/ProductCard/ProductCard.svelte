<script lang="ts">
  import Button from '../Button/Button.svelte';

  interface ProductCardProps {
    id?: string;
    image: string;
    title: string;
    price: number;
    originalPrice?: number;
    shopLink?: string;
    actionType?: 'add-to-cart' | 'link';
    condition?: string;
    body_type?: string;
    drive_type?: string;
    fuel_type?: string;
    mileage?: number;
    engine?: string;
    year?: number;
    key_features?: string[];
    description?: string;
    rankPosition?: number;
    onAddToCart?: () => void;
    onProductAction?: () => void;
  }

  let {
    id,
    image,
    title,
    price,
    originalPrice,
    shopLink,
    actionType = 'add-to-cart',
    condition,
    body_type,
    drive_type,
    fuel_type,
    mileage,
    engine,
    year,
    key_features,
    description,
    rankPosition,
    onAddToCart,
    onProductAction
  }: ProductCardProps = $props();

  function formatPrice(value: number | null | undefined): string {
    if (value == null || isNaN(value)) return '$0';
    return `$${value.toLocaleString()}`;
  }

  function capitalizeFirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const CONDITION_LABELS: Record<string, string> = {
    new: 'New', used: 'Used', cpo: 'CPO',
  };

  const BODY_TYPE_LABELS: Record<string, string> = {
    suv: 'SUV', truck: 'Truck', sedan: 'Sedan', hatchback: 'Hatchback',
    minivan: 'Minivan', coupe: 'Coupe', convertible: 'Convertible', wagon: 'Wagon',
  };

  const DRIVE_TYPE_LABELS: Record<string, string> = {
    awd: 'AWD', '4wd': '4WD', fwd: 'FWD', rwd: 'RWD',
  };

  const FUEL_TYPE_LABELS: Record<string, string> = {
    gasoline: 'Gas', hybrid: 'Hybrid', electric: 'Electric',
    'plug-in-hybrid': 'PHEV', diesel: 'Diesel',
  };

  let conditionLabel = $derived(condition ? (CONDITION_LABELS[condition.toLowerCase()] ?? capitalizeFirst(condition)) : null);
  let bodyLabel = $derived(body_type ? (BODY_TYPE_LABELS[body_type.toLowerCase()] ?? capitalizeFirst(body_type)) : null);
  let driveLabel = $derived(drive_type ? (DRIVE_TYPE_LABELS[drive_type.toLowerCase()] ?? drive_type.toUpperCase()) : null);
  let fuelLabel = $derived(fuel_type ? (FUEL_TYPE_LABELS[fuel_type.toLowerCase()] ?? capitalizeFirst(fuel_type)) : null);
  let mileageLabel = $derived(mileage != null ? (mileage === 0 ? 'New' : `${mileage.toLocaleString()} mi`) : null);
  let visibleFeatures = $derived(key_features ? key_features.slice(0, 3) : []);

  function handleProductAction() {
    onProductAction?.();
    if (actionType === 'link' && shopLink) {
      window.open(shopLink, '_blank', 'noopener,noreferrer');
    } else {
      onAddToCart?.();
    }
  }
</script>

<div class="product-card">
  {#if image}
    <div class="product-card__image-wrapper">
      <img src={image} alt={title} class="product-card__image" />
    </div>
  {/if}

  <div class="product-card__content">
    <h3 class="product-card__title">{title}</h3>

    <div class="product-card__badges">
      {#if conditionLabel}
        <span class="product-card__badge product-card__badge--condition">{conditionLabel}</span>
      {/if}
      {#if bodyLabel}
        <span class="product-card__badge product-card__badge--body">{bodyLabel}</span>
      {/if}
      {#if driveLabel}
        <span class="product-card__badge product-card__badge--drive">{driveLabel}</span>
      {/if}
      {#if fuelLabel && fuel_type !== 'gasoline'}
        <span class="product-card__badge product-card__badge--fuel">{fuelLabel}</span>
      {/if}
    </div>

    {#if mileageLabel || engine}
      <div class="product-card__specs">
        {#if mileageLabel}<span>{mileageLabel}</span>{/if}
        {#if mileageLabel && engine}<span class="product-card__specs-sep">·</span>{/if}
        {#if engine}<span>{engine}</span>{/if}
      </div>
    {/if}

    {#if description}
      <p class="product-card__description">{description}</p>
    {/if}

    {#if visibleFeatures.length > 0}
      <div class="product-card__features">
        {#each visibleFeatures as feature}
          <span class="product-card__feature-chip">{feature}</span>
        {/each}
      </div>
    {/if}

    <div class="product-card__pricing">
      <span class="product-card__price">{formatPrice(price)}</span>
      {#if originalPrice && originalPrice > price}
        <span class="product-card__original-price">{formatPrice(originalPrice)}</span>
      {/if}
    </div>

    <Button
      label="View Vehicle"
      variant="primary"
      size="sm"
      onclick={handleProductAction}
      fullWidth={true}
    />
  </div>
</div>

<style>
  .product-card {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease-out;
    cursor: pointer;
    max-width: 280px;
  }

  .product-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  .product-card__image-wrapper {
    position: relative;
    width: 100%;
    padding-top: 62%;
    background: #f3f4f6;
    overflow: hidden;
  }

  .product-card__image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease-out;
  }

  .product-card:hover .product-card__image {
    transform: scale(1.04);
  }

  .product-card__content {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .product-card__title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin: 0;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .product-card__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .product-card__badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .product-card__badge--condition {
    background: #dbeafe;
    color: #1e40af;
  }

  .product-card__badge--body {
    background: #f3f4f6;
    color: #374151;
  }

  .product-card__badge--drive {
    background: #dcfce7;
    color: #166534;
  }

  .product-card__badge--fuel {
    background: #fef3c7;
    color: #92400e;
  }

  .product-card__specs {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .product-card__specs-sep {
    color: #d1d5db;
  }

  .product-card__description {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .product-card__features {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .product-card__feature-chip {
    font-size: 10px;
    color: #374151;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 130px;
  }

  .product-card__pricing {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .product-card__price {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .product-card__original-price {
    font-size: 13px;
    color: #9ca3af;
    text-decoration: line-through;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  .product-card :global(.btn) {
    margin-top: 2px;
  }

  :global(.dark) .product-card,
  :global([data-theme="dark"]) .product-card {
    background: #252526;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  :global(.dark) .product-card:hover,
  :global([data-theme="dark"]) .product-card:hover {
    background: #2d2d30;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  :global(.dark) .product-card__title,
  :global([data-theme="dark"]) .product-card__title {
    color: #e5e7eb;
  }

  :global(.dark) .product-card__price,
  :global([data-theme="dark"]) .product-card__price {
    color: #e5e7eb;
  }

  :global(.dark) .product-card__image-wrapper,
  :global([data-theme="dark"]) .product-card__image-wrapper {
    background: #2d2d30;
  }

  @media (max-width: 640px) {
    .product-card {
      max-width: 100%;
      min-width: 100%;
    }

    .product-card__content {
      padding: 12px;
      gap: 6px;
    }

    .product-card__title {
      font-size: 14px;
    }

    .product-card__price {
      font-size: 18px;
    }
  }
</style>
