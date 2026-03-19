<script>
  let { targetBasePct, targetPct, fillBasePct, fillGymPct = 0, fillAmberPct = 0,
        extraGym = 0, targetBase = 0, targetGym = 0, maintGym = 0 } = $props();
</script>

<div class="tb-bar-track">
  <div class="tb-bar-bg">
    <div class="tb-zone-green" style="width:{targetBasePct}%"></div>
    {#if extraGym > 0}
      <div class="tb-zone-gym" style="left:{targetBasePct}%; width:{targetPct - targetBasePct}%"></div>
    {/if}
    <div class="tb-zone-amber" style="left:{targetPct}%"></div>
    <div class="tb-fill-green" style="width:{fillBasePct}%"></div>
    {#if fillGymPct > 0}
      <div class="tb-fill-gym" style="left:{targetBasePct}%; width:{fillGymPct}%"></div>
    {/if}
    {#if fillAmberPct > 0}
      <div class="tb-fill-amber" style="left:{targetPct}%; width:{fillAmberPct}%"></div>
    {/if}
  </div>
  {#if extraGym > 0}
    <div class="tb-base-marker" style="left:{targetBasePct}%">
      <div class="tb-base-line"></div>
      <div class="tb-base-arrow"></div>
      <div class="tb-base-lbl">
        <span class="tb-base-name">sin gym</span>
        <span class="tb-base-val">{targetBase}</span>
      </div>
    </div>
  {/if}
  <div class="tb-marker" style="left:{targetPct}%">
    <div class="tb-marker-line"></div>
    <div class="tb-marker-arrow"></div>
    <div class="tb-marker-lbl">
      <span class="tb-marker-name">objetivo</span>
      <span class="tb-marker-val">{targetGym}</span>
    </div>
  </div>
  <div class="tb-end-marker">
    <div class="tb-end-line"></div>
    <div class="tb-end-lbl">
      <span class="tb-end-name">superávit</span>
      <span class="tb-end-val">{maintGym} kcal</span>
    </div>
  </div>
</div>

<style>
  .tb-bar-track { position: relative; padding-bottom: 48px; margin: 2px 0; }
  .tb-bar-bg {
    height: 22px; border-radius: 99px;
    position: relative; overflow: hidden;
    border: 1px solid rgba(255,255,255,.07);
  }
  .tb-zone-green {
    position: absolute; top: 0; bottom: 0; left: 0;
    background: repeating-linear-gradient(-45deg, rgba(74,222,128,.18) 0px, rgba(74,222,128,.18) 3px, rgba(74,222,128,.05) 3px, rgba(74,222,128,.05) 9px);
  }
  .tb-zone-gym {
    position: absolute; top: 0; bottom: 0;
    background: repeating-linear-gradient(-45deg, rgba(22,163,74,.14) 0px, rgba(22,163,74,.14) 3px, rgba(22,163,74,.03) 3px, rgba(22,163,74,.03) 9px);
    border-left: 1px dashed rgba(74,222,128,.2); border-right: 1px dashed rgba(74,222,128,.2);
  }
  .tb-zone-amber {
    position: absolute; top: 0; bottom: 0; right: 0;
    background: repeating-linear-gradient(-45deg, rgba(251,191,36,.18) 0px, rgba(251,191,36,.18) 3px, rgba(251,191,36,.05) 3px, rgba(251,191,36,.05) 9px);
  }
  .tb-fill-green {
    position: absolute; top: 0; bottom: 0; left: 0; border-radius: 99px; z-index: 3;
    background: #4ade80; box-shadow: 0 0 12px rgba(74,222,128,.45);
    transition: width .7s cubic-bezier(.4,0,.2,1);
  }
  .tb-fill-gym {
    position: absolute; top: 0; bottom: 0; z-index: 3;
    background: #16a34a; box-shadow: 0 0 8px rgba(22,163,74,.35);
    transition: left .7s cubic-bezier(.4,0,.2,1), width .7s cubic-bezier(.4,0,.2,1);
  }
  .tb-fill-amber {
    position: absolute; top: 0; bottom: 0; border-radius: 0 99px 99px 0; z-index: 3;
    background: #f59e0b; box-shadow: 0 0 12px rgba(245,158,11,.5);
    transition: left .7s cubic-bezier(.4,0,.2,1), width .7s cubic-bezier(.4,0,.2,1);
  }
  .tb-marker {
    position: absolute; top: 0; display: flex; flex-direction: column; align-items: center;
    pointer-events: none; z-index: 4; transform: translateX(-50%);
  }
  .tb-marker-line  { width: 2px; height: 22px; background: rgba(255,255,255,.8); flex-shrink: 0; }
  .tb-marker-arrow { width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid rgba(255,255,255,.8); }
  .tb-marker-lbl  { display: flex; flex-direction: column; align-items: center; margin-top: 5px; gap: 1px; }
  .tb-marker-name { font-size: 9px; text-transform: uppercase; letter-spacing: .09em; color: #94a3b8; font-weight: 700; }
  .tb-marker-val  { font-size: 20px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; line-height: 1; }
  .tb-base-marker {
    position: absolute; top: 0; display: flex; flex-direction: column; align-items: center;
    pointer-events: none; z-index: 3; transform: translateX(-50%);
  }
  .tb-base-line  { width: 1px; height: 22px; background: rgba(148,163,184,.45); flex-shrink: 0; }
  .tb-base-arrow { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid rgba(148,163,184,.45); }
  .tb-base-lbl  { display: flex; flex-direction: column; align-items: center; margin-top: 4px; gap: 1px; }
  .tb-base-name { font-size: 8px; text-transform: uppercase; letter-spacing: .09em; color: #64748b; font-weight: 700; }
  .tb-base-val  { font-size: 13px; font-weight: 700; color: #64748b; font-variant-numeric: tabular-nums; line-height: 1; }
  .tb-end-marker {
    position: absolute; top: 0; right: 0; display: flex; flex-direction: column; align-items: flex-end;
    pointer-events: none; z-index: 4;
  }
  .tb-end-line { width: 2px; height: 22px; background: rgba(251,191,36,.85); align-self: flex-end; }
  .tb-end-lbl  { display: flex; flex-direction: column; align-items: flex-end; margin-top: 5px; gap: 1px; }
  .tb-end-name { font-size: 9px; text-transform: uppercase; letter-spacing: .09em; color: #b45309; font-weight: 700; }
  .tb-end-val  { font-size: 20px; font-weight: 800; color: #fbbf24; font-variant-numeric: tabular-nums; line-height: 1; }
</style>
