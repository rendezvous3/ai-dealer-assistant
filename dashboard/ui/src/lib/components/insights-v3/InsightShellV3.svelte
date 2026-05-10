<script lang="ts">
  /** Section heading */
  export let title = "";
  /** Optional right-side caption (e.g. "12 sent today / 50 000 limit") */
  export let caption = "";
  /** Number of columns on sm+ screens (default 4) */
  export let cols: 4 | 5 = 4;
</script>

<div class="rounded-xl border border-white/[0.07] bg-[#111111] px-5 py-4">
  <div class="mb-4 flex items-center justify-between">
    <div class="text-xs uppercase tracking-widest text-[#8a8a8a]">{title}</div>
    {#if caption}
      <div class="text-xs text-[#8a8a8a]">{caption}</div>
    {/if}
  </div>

  <!-- Metrics grid — consumer controls columns via class on wrapper if needed -->
  <div class={`grid grid-cols-2 gap-4 ${cols === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
    <slot />
  </div>
</div>
