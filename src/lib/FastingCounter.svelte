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
  {@const int = stage.intensity ?? 0}
  {@const sz = 11 + int * 4}
  {@const pad = 3 + int * 5}
  {@const borderW = 1 + Math.round(int * 2)}
  {@const glowSpread = Math.round(int * 12)}
  {@const animClass = int >= 0.5 ? 'fasting-pulse' : ''}
  <div
    class="fasting-chip {animClass}"
    class:milestone={stage.milestone}
    class:intense={int >= 0.65}
    class:extreme={int >= 0.9}
    style="
      color:{stage.color};
      background:{stage.glow};
      border-color:{stage.color}55;
      border-width:{borderW}px;
      padding:{pad}px {pad + 7}px;
      font-size:{sz}px;
      box-shadow: 0 0 {glowSpread}px {stage.glow};
    "
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
    white-space: nowrap; flex-shrink: 0;
    transition: all 0.8s ease;
    cursor: default;
  }
  .fh { font-weight: 700; font-variant-numeric: tabular-nums; }
  .fl { opacity: 0.85; }

  .milestone .fh { font-weight: 800; }
  .milestone .fl { opacity: 1; }
  .milestone .fi { font-size: 1.1em; }

  .intense {
    border-radius: 8px;
  }
  .intense .fh { font-size: 1.15em; letter-spacing: -0.02em; }
  .intense .fi { font-size: 1.25em; }

  .extreme {
    border-radius: 10px;
  }
  .extreme .fh { font-size: 1.3em; }
  .extreme .fi { font-size: 1.4em; }

  @keyframes fastingPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .fasting-pulse {
    animation: fastingPulse 3s ease-in-out infinite;
  }
  .extreme.fasting-pulse {
    animation-duration: 2s;
  }
</style>
