<script lang="ts">
  /** Primary metric value shown large */
  export let value: string | number = "—";
  /** Label above the value */
  export let label = "";
  /** Small helper text below the value */
  export let sub = "";
  /** Colour of the value: 'default' | 'green' | 'yellow' | 'red' */
  export let tone: "default" | "green" | "yellow" | "red" = "default";

  const toneClass: Record<string, string> = {
    default: "text-white",
    green:   "text-[#22c55e]",
    yellow:  "text-yellow-400",
    red:     "text-rose-400"
  };
</script>

<div class="flex flex-col">
  <div class="text-xs text-[#8a8a8a]">{label}</div>
  <div class="mt-1 text-xl font-semibold tabular-nums {toneClass[tone]}">
    {value}
  </div>
  {#if sub}
    <div class="mt-0.5 text-xs text-[#525252]">{sub}</div>
  {/if}
</div>
