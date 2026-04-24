<script>
  let { targetBasePct, targetPct, fillBasePct, fillGymPct = 0, fillAmberPct = 0,
        extraGym = 0, targetBase = 0, targetGym = 0, maintGym = 0 } = $props();
</script>

<div class="cbb">
  <!-- Bar -->
  <div class="cbb-bar">
    <div class="cbb-zone-green" style="width:{targetBasePct}%"></div>
    {#if extraGym > 0}
      <div class="cbb-zone-gym" style="left:{targetBasePct}%; width:{targetPct - targetBasePct}%"></div>
    {/if}
    <div class="cbb-zone-amber" style="left:{targetPct}%"></div>
    <div class="cbb-fill-green" style="width:{fillBasePct}%"></div>
    {#if fillGymPct > 0}
      <div class="cbb-fill-gym" style="left:{targetBasePct}%; width:{fillGymPct}%"></div>
    {/if}
    {#if fillAmberPct > 0}
      <div class="cbb-fill-amber" style="left:{targetPct}%; width:{fillAmberPct}%"></div>
    {/if}
    {#if extraGym > 0}
      <div class="cbb-tick" style="left:{targetBasePct}%; background:rgba(148,163,184,.4)"></div>
    {/if}
    <div class="cbb-tick cbb-tick-obj" style="left:{targetPct}%"></div>
  </div>

  <!-- Legend: simple horizontal flex, no overlap possible -->
  <div class="cbb-legend">
    {#if extraGym > 0}
      <span class="cbb-leg dim">{targetBase} <small>sin gym</small></span>
      <span class="cbb-leg-sep">·</span>
    {/if}
    <span class="cbb-leg"><strong>{targetGym}</strong> <small>objetivo</small></span>
    <span class="cbb-leg-sep">·</span>
    <span class="cbb-leg amber">{maintGym} <small>superávit</small></span>
  </div>
</div>

<style>
  .cbb { margin: 4px 0 2px; }

  .cbb-bar {
    height: 12px; border-radius: 99px;
    position: relative; overflow: visible;
    border: 1px solid rgba(255,255,255,.07);
  }
  .cbb-zone-green {
    position: absolute; top: 0; bottom: 0; left: 0;
    background: repeating-linear-gradient(-45deg, rgba(74,222,128,.18) 0px, rgba(74,222,128,.18) 3px, rgba(74,222,128,.05) 3px, rgba(74,222,128,.05) 9px);
    border-radius: 99px 0 0 99px;
  }
  .cbb-zone-gym {
    position: absolute; top: 0; bottom: 0;
    background: repeating-linear-gradient(-45deg, rgba(22,163,74,.14) 0px, rgba(22,163,74,.14) 3px, rgba(22,163,74,.03) 3px, rgba(22,163,74,.03) 9px);
  }
  .cbb-zone-amber {
    position: absolute; top: 0; bottom: 0; right: 0;
    background: repeating-linear-gradient(-45deg, rgba(251,191,36,.18) 0px, rgba(251,191,36,.18) 3px, rgba(251,191,36,.05) 3px, rgba(251,191,36,.05) 9px);
    border-radius: 0 99px 99px 0;
  }
  .cbb-fill-green {
    position: absolute; top: 0; bottom: 0; left: 0; border-radius: 99px; z-index: 3;
    background: #4ade80; box-shadow: 0 0 8px rgba(74,222,128,.4);
    transition: width .7s cubic-bezier(.4,0,.2,1);
  }
  .cbb-fill-gym {
    position: absolute; top: 0; bottom: 0; z-index: 3;
    background: #16a34a; box-shadow: 0 0 6px rgba(22,163,74,.3);
    transition: left .7s, width .7s;
  }
  .cbb-fill-amber {
    position: absolute; top: 0; bottom: 0; border-radius: 0 99px 99px 0; z-index: 3;
    background: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,.4);
    transition: left .7s, width .7s;
  }
  .cbb-tick {
    position: absolute; top: -1px; bottom: -1px; width: 1px;
    z-index: 5; pointer-events: none; transform: translateX(-50%);
  }
  .cbb-tick-obj { background: rgba(255,255,255,.6); width: 2px; }

  /* Legend — simple inline flex, wraps if needed, never overlaps */
  .cbb-legend {
    display: flex; align-items: center; gap: 3px;
    margin-top: 2px; flex-wrap: wrap;
    font-size: 7px; color: #64748b;
    font-variant-numeric: tabular-nums;
  }
  .cbb-leg { white-space: nowrap; }
  .cbb-leg strong { color: #94a3b8; font-weight: 700; }
  .cbb-leg small { font-size: 6.5px; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
  .cbb-leg.dim { color: #475569; }
  .cbb-leg.amber { color: #d97706; }
  .cbb-leg.amber small { color: #92400e; }
  .cbb-leg-sep { color: #1e293b; font-size: 6px; }

  @media (max-width: 600px) {
    .cbb-legend { display: none; }
  }
</style>
