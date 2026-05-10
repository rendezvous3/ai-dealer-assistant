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

  interface ProductListProps {
    products: Product[];
    title?: string;
    showTitle?: boolean;
    actionType?: 'add-to-cart' | 'link';
    onAddToCart?: (product: Product) => void;
    onProductAction?: (product: Product) => void;
  }

  let {
    products,
    title = 'Products',
    showTitle = true,
    actionType = 'add-to-cart',
    onAddToCart,
    onProductAction
  }: ProductListProps = $props();

  function handleAddToCart(product: Product) {
    onAddToCart?.(product);
  }
</script>

<div class="product-list">
  {#if showTitle && title}
    <h2 class="product-list__title">{title}</h2>
  {/if}
  <div class="product-list__container">
    <div class="product-list__scroll">
      {#each products as product (product.title)}
        <div class="product-list__item">
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
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .product-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .product-list__title {
    font-size: 20px;
    font-weight: 600;
    color: #111827;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  }

  .product-list__container {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #d1d5db transparent;
  }

  .product-list__container::-webkit-scrollbar {
    height: 8px;
  }

  .product-list__container::-webkit-scrollbar-track {
    background: transparent;
  }

  .product-list__container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  .product-list__container::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  .product-list__scroll {
    display: flex;
    gap: 16px;
    padding: 8px 0;
    width: max-content;
  }

  .product-list__item {
    flex-shrink: 0;
  }

  /* Ensure ProductCard doesn't exceed container */
  .product-list__item :global(.product-card) {
    max-width: 280px;
    min-width: 280px;
  }

  /* Dark mode */
  :global(.dark) .product-list__title,
  :global([data-theme="dark"]) .product-list__title {
    color: #cccccc;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .product-list__item :global(.product-card) {
      max-width: 260px;
      min-width: 260px;
    }

    .product-list__title {
      font-size: 18px;
    }
  }
</style>
