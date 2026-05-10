<script lang="ts">
  export let pageTitle = "";
</script>

<div class="min-h-screen bg-[#0a0a0a] text-[#f5f5f5]">
  {#if pageTitle}
    <div class="border-b border-white/[0.07]">
      <div class="mx-auto max-w-7xl px-6 py-5">
        <h1 class="text-xl font-semibold text-white">{pageTitle}</h1>
      </div>
    </div>
  {/if}

  <div class="mx-auto max-w-7xl px-6 py-8">
    <slot />
  </div>
</div>
