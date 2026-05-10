<script lang="ts">
  import ProductCard from '../ProductCard/ProductCard.svelte';

  interface Product {
    id?: string;
    image: string;
    title: string;
    price: number;
    originalPrice?: number;
    shopLink?: string;
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
  }

  interface ProductGridProps {
    products: Product[];
    columns?: 2 | 3;
    title?: string;
    actionType?: 'add-to-cart' | 'link';
    onAddToCart?: (product: Product) => void;
    onProductAction?: (product: Product) => void;
  }

  let {
    products,
    columns = 3,
    title,
    actionType = 'add-to-cart',
    onAddToCart,
    onProductAction
  }: ProductGridProps = $props();

  let gridClasses = $derived(
    [
      'product-grid',
      `product-grid--${columns}-cols`
    ]
      .filter(Boolean)
      .join(' ')
  );

  function handleAddToCart(product: Product) {
    onAddToCart?.(product);
  }
</script>

<div class="product-grid-wrapper">
  {#if title}
    <h2 class="product-grid__title">{title}</h2>
  {/if}
  <div class={gridClasses}>
    {#each products as product (product.title)}
      <ProductCard
        image={product.image}
        title={product.title}
        price={product.price}
        originalPrice={product.originalPrice}
        shopLink={product.shopLink}
        condition={product.condition}
        body_type={product.body_type}
        drive_type={product.drive_type}
        fuel_type={product.fuel_type}
        mileage={product.mileage}
        engine={product.engine}
        year={product.year}
        key_features={product.key_features}
        description={product.description}
        rankPosition={product.rankPosition}
        actionType={actionType}
        onAddToCart={() => handleAddToCart(product)}
        onProductAction={() => onProductAction?.(product)}
      />
    {/each}
  </div>
</div>

<style>
  .product-grid-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .product-grid__title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .product-grid {
    display: grid;
    gap: 20px;
    width: 100%;
  }

  .product-grid--2-cols {
    grid-template-columns: repeat(2, 1fr);
  }

  .product-grid--3-cols {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Responsive: 3 cols -> 2 cols on medium screens */
  @media (max-width: 968px) {
    .product-grid--3-cols {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Responsive: 2 cols -> 1 col on small screens */
  @media (max-width: 640px) {
    .product-grid--2-cols,
    .product-grid--3-cols {
      grid-template-columns: 1fr;
    }
  }

  /* Ensure ProductCard fills grid cell */
  .product-grid :global(.product-card) {
    max-width: 100%;
    width: 100%;
  }

  /* Dark mode */
  :global(.dark) .product-grid__title,
  :global([data-theme="dark"]) .product-grid__title {
    color: #cccccc;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .product-grid__title {
      font-size: 18px;
    }
  }
</style>
