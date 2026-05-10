<script lang="ts">
  export let value = "";
  export let options: string[] = [];
  export let placeholder = "";
  export let emptyLabel = "";
  export let formatOption: (value: string) => string = (v) => v;
  export let onSelect: (value: string) => void = () => {};

  let open = false;

  $: selectedLabel = value ? formatOption(value) : placeholder;

  function selectValue(nextValue: string) {
    open = false;
    onSelect(nextValue);
  }
</script>

<svelte:window on:click={() => { open = false; }} />

<div class="relative">
  <button
    type="button"
    on:click|stopPropagation={() => { open = !open; }}
    class="flex h-8 min-w-[120px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#141414] px-3 text-xs text-[#f5f5f5] transition hover:border-white/[0.15]"
  >
    <span class={value ? "text-[#f5f5f5]" : "text-[#737373]"}>{selectedLabel}</span>
    <svg class="h-3 w-3 shrink-0 text-[#737373]" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  </button>

  {#if open}
    <div class="absolute left-0 top-full z-30 mt-1 min-w-full rounded-lg border border-white/[0.07] bg-[#141414] py-1 shadow-lg shadow-black/40">
      {#if emptyLabel}
        <button
          type="button"
          on:click={() => selectValue("")}
          class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.04] {value === '' ? 'text-[#f5f5f5]' : 'text-[#737373]'}"
        >
          {#if value === ""}<span class="text-[#f5f5f5]">✓</span>{:else}<span class="w-3"></span>{/if}
          {emptyLabel}
        </button>
      {/if}
      {#each options as option}
        <button
          type="button"
          on:click={() => selectValue(option)}
          class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-xs transition hover:bg-white/[0.04] {value === option ? 'text-[#f5f5f5]' : 'text-[#737373]'}"
        >
          {#if value === option}<span class="text-[#f5f5f5]">✓</span>{:else}<span class="w-3"></span>{/if}
          {formatOption(option)}
        </button>
      {/each}
    </div>
  {/if}
</div>
