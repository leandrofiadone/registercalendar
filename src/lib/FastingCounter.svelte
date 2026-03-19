<script>
  import { onMount } from 'svelte';
  import { getLastMeal, hoursSince, getFastingStage, fmtGap } from '$lib/fasting.js';

  let { ventanas = [] } = $props();

  let now   = $state(Date.now());
  let stage = $derived.by(() => {
    const last = getLastMeal(ventanas);
    if (!last) return null;
    const h = (now - last.dt.getTime()) / 3_600_000;
    return { ...getFastingStage(h), hours: h, lastHora: last.comida.hora, lastFecha: last.comida.fecha };
  });

  onMount(() => {
    const t = setInterval(() => { now = Date.now(); }, 30_000);
    return () => clearInterval(t);
  });
</script>

{#if stage}
  <div
    class="fasting-chip"
    style="color:{stage.color};background:{stage.glow};border-color:{stage.color}33"
    title="{stage.desc} · Última ingesta: {stage.lastHora} del {stage.lastFecha}"
  >
    <span class="fi">{stage.icon}</span>
    <span class="fh">{fmtGap(stage.hours)}</span>
    <span class="fl">{stage.label}</span>
  </div>
{/if}

<style>
  .fasting-chip {
    display: flex; align-items: center; gap: 5px;
    border: 1px solid; border-radius: 6px;
    padding: 3px 10px; font-size: 11px;
    white-space: nowrap; flex-shrink: 0;
    transition: color 0.5s, background 0.5s;
    cursor: default;
  }
  .fh { font-weight: 700; font-variant-numeric: tabular-nums; }
  .fl { opacity: 0.85; }
</style>
