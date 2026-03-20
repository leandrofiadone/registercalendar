<script>
  import { fmtDateLong, localDateStr } from '$lib/utils.js';
  import { mealToDate, gapHours, getFastingStage, fmtGap, getAllMealsSorted } from '$lib/fasting.js';
  import { actividadKcal, gymKcalDetallado, actividadLabel } from '$lib/activity.js';
  import CalorieBudgetBar from '$lib/CalorieBudgetBar.svelte';
  import MealCard from '$lib/MealCard.svelte';
  import MicronutrientPanel from '$lib/MicronutrientPanel.svelte';

  let { ventana, perfil = null, sessions = [], ventanas = [], bodyOnly = false, alimentosRef = [] } = $props();

  // Gap de ayuno desde la última comida de la ventana anterior
  let prevFastGap = $derived.by(() => {
    if (!ventana?.comidas?.length || !ventanas.length) return null;
    const firstMeal = ventana.comidas.find(c => mealToDate(c));
    if (!firstMeal) return null;
    const dt1 = mealToDate(firstMeal);
    if (!dt1) return null;
    const allMeals = getAllMealsSorted(ventanas);
    const prev = allMeals.filter(m => m.dt < dt1).at(-1);
    if (!prev) return null;
    const gh = gapHours(prev.dt, dt1);
    if (gh < 1) return null;
    return { gh, stage: getFastingStage(gh) };
  });

  let vsObjetivo = $derived.by(() => {
    if (!perfil?.metabolismo || !perfil?.objetivos_diarios || !ventana?.totales_ventana) return null;
    const t        = ventana.totales_ventana;
    const pesoKg   = perfil.historial_peso?.at(-1)?.peso_kg ?? 80;
    const protObj  = perfil.objetivos_diarios.proteina_g_ideal ?? 160;
    const carbsMax = perfil.objetivos_diarios.carbos_g_max ?? 300;
    const tdeBase  = perfil.metabolismo.gasto_total_descanso_kcal || 2776;
    const kcalBase = perfil.objetivos_diarios.kcal_dia_descanso || 2276;
    const deficitTarget = perfil.objetivos_diarios.deficit_target_kcal ?? 500;

    const gymSess   = sessions.find(s => s.date === ventana.ventana_id);
    const actsExtra = ventana.actividades || [];
    const actItems  = [];

    if (gymSess) {
      const det = gymKcalDetallado(gymSess, pesoKg);
      if (det.fuerza > 0) actItems.push({
        icon: '💪', label: (gymSess.groups||[]).join(' + ') || 'Fuerza',
        kcal: det.fuerza, estimado: true,
      });
      for (const c of det.cardio) actItems.push({
        icon: c.tipo === 'sauna' ? '🧖' : c.tipo === 'natacion' ? '🏊' : '🏃',
        label: `${c.ejercicio}${c.duracion_min ? ` ${c.duracion_min}min` : ''}`,
        kcal: c.kcal, estimado: c.fuente === 'estimado',
        dim: c.tipo === 'sauna' || c.tipo === 'ducha_fria',
      });
    }
    for (const a of actsExtra) actItems.push({
      icon: '🏃', label: `${actividadLabel(a.tipo)}${a.duracion_min ? ` ${a.duracion_min}min` : ''}`,
      kcal: actividadKcal(a, pesoKg), estimado: a.kcal_extra == null,
    });

    const kcalActividad       = actItems.reduce((s, a) => s + a.kcal, 0);
    const gastoConActividad   = tdeBase + kcalActividad;
    const deficitConActividad = Math.round(gastoConActividad - t.kcal);
    const dayLabel            = gymSess ? 'día de gym' : actsExtra.length ? 'día activo' : 'día de descanso';
    const isToday             = ventana.ventana_id === localDateStr();

    function defCls(val) {
      return val >= deficitTarget ? 'st-ok' : val >= 0 ? 'st-warn' : 'st-over';
    }
    function mkBar(label, val, target, color) {
      const rawPct = Math.round((val / target) * 100);
      return { label, val, target, pct: Math.min(100, rawPct), rawPct, over: val > target, fill: val > target ? 'var(--red)' : color };
    }

    return {
      bars: [ mkBar('Proteína (g)', t.proteina_g, protObj, 'var(--blue)'), mkBar('Carbos (g)', t.carbos_g, carbsMax, 'var(--green)') ],
      isToday, dayLabel, tdeBase, kcalActividad, gastoConActividad,
      deficitConActividad, defClsCon: defCls(deficitConActividad),
      actItems, deficitTarget,
    };
  });
</script>

{#if ventana}
  {#if !bodyOnly}
    <div class="sess-header">
      <h2>{fmtDateLong(ventana.ventana_id)}</h2>
      <div class="meta-row">
        {#if ventana.protocolo}
          <div class="meta-badge">⏱ <strong>{ventana.protocolo.replace(/_/g,' ')}</strong></div>
        {/if}
        {#if ventana.ayuno_horas}
          <div class="meta-badge">🕐 <strong>{ventana.ayuno_horas}h ayuno</strong></div>
        {/if}
      </div>
    </div>
  {/if}

  {#if ventana.totales_ventana}
    {@const t = ventana.totales_ventana}

    {#if vsObjetivo?.isToday}
      <!-- ═══ HOY ═══ -->
      {@const targetBase    = Math.round(vsObjetivo.tdeBase - vsObjetivo.deficitTarget)}
      {@const targetGym     = Math.round(vsObjetivo.gastoConActividad - vsObjetivo.deficitTarget)}
      {@const maintGym      = vsObjetivo.gastoConActividad}
      {@const extraGym      = targetGym - targetBase}
      {@const consumed      = t.kcal}
      {@const targetPct     = Math.round((targetGym / maintGym) * 100)}
      {@const consumedPct   = Math.min(100, Math.round((consumed / maintGym) * 100))}
      {@const zoneGym       = consumed <= targetGym ? 'ok' : consumed <= maintGym ? 'warn' : 'over'}
      {@const zoneBase      = consumed <= targetBase ? 'ok' : 'over'}
      {@const colorZone     = { ok: '#4ade80', warn: '#fbbf24', over: '#f87171' }}
      {@const deficitActual = Math.round(maintGym - consumed)}
      {@const restante      = Math.round(targetGym - consumed)}
      {@const overAmount    = consumed > maintGym ? Math.round(consumed - maintGym) : 0}
      {@const targetBasePct = Math.round((targetBase / maintGym) * 100)}
      {@const fillBasePct   = Math.min(consumedPct, targetBasePct)}
      {@const fillGymPct    = Math.max(0, Math.min(consumedPct, targetPct) - targetBasePct)}
      {@const fillAmberPct  = Math.max(0, consumedPct - targetPct)}
      <div class="today-balance">

        <div class="tb-header">
          <span class="tb-live">en curso</span>
          <span class="tb-daylbl">{vsObjetivo.dayLabel}</span>
        </div>

        <!-- Gasto del día -->
        <div class="tb-gasto-block">
          <div class="tb-gasto-title">🔥 quemás hoy</div>
          <div class="tb-gl base">
            <span>Base (sin actividad)</span>
            <span>{vsObjetivo.tdeBase} kcal</span>
          </div>
          {#each vsObjetivo.actItems as a}
            <div class="tb-gl act {a.dim ? 'dim' : ''}">
              <span>{a.icon} {a.label}{a.estimado ? ' *' : ''}</span>
              <span>+{a.kcal}</span>
            </div>
          {/each}
          <div class="tb-gl total">
            <span>Total estimado{vsObjetivo.actItems.length ? ' *' : ''}</span>
            <span>{vsObjetivo.gastoConActividad} kcal</span>
          </div>
        </div>

        <!-- Barra de presupuesto -->
        <div class="tb-budget">
          <div class="tb-budget-header">
            <span class="tb-budget-title">🍽️ ¿cuánto podés comer hoy?</span>
            {#if extraGym > 0}
              <span class="tb-budget-gym-badge">con gym +{extraGym} kcal extra</span>
            {/if}
          </div>

          <div class="tb-hero">
            <div class="tb-hero-left">
              <div class="tb-hero-num">
                <span class="tb-hero-kcal" style="color:{colorZone[zoneGym]}">{consumed}</span>
                <span class="tb-hero-unit">kcal</span>
              </div>
              <div class="tb-hero-label">consumidas hoy</div>
            </div>
            <div class="tb-hero-right">
              {#if zoneGym === 'ok'}
                <div class="tb-delta ok">−{restante} kcal para objetivo</div>
                <div class="tb-delta dim">−{deficitActual} kcal para superávit</div>
              {:else if zoneGym === 'warn'}
                <div class="tb-delta warn">+{Math.abs(restante)} kcal sobre objetivo</div>
                <div class="tb-delta dim">−{deficitActual} kcal para superávit</div>
              {:else}
                <div class="tb-delta over">+{overAmount} kcal en superávit</div>
              {/if}
            </div>
          </div>

          <CalorieBudgetBar {targetBasePct} {targetPct} {fillBasePct} {fillGymPct} {fillAmberPct} {extraGym} {targetBase} {targetGym} {maintGym} />

          <div class="tb-nogym-ref">
            <span class="tb-nogym-icon">{zoneBase === 'ok' ? '✓' : '⚠'}</span>
            <span class="tb-nogym-txt">
              Sin gym: objetivo {targetBase} kcal ·
              {#if zoneBase === 'ok'}
                quedan {Math.round(targetBase - consumed)} kcal
              {:else}
                {Math.round(consumed - targetBase)} sobre objetivo sin actividad
              {/if}
            </span>
          </div>

          <div class="tb-budget-note">* gasto estimado — sin monitor cardíaco ±30%</div>
        </div>

        <div class="tb-macros">
          <span class="tb-mac prot"><span class="tb-mac-dot"></span>{t.proteina_g}g prot {vsObjetivo.bars[0].rawPct}%</span>
          <span class="tb-mac gras"><span class="tb-mac-dot"></span>{t.grasa_g}g gras</span>
          <span class="tb-mac carb"><span class="tb-mac-dot"></span>{t.carbos_g}g carb {vsObjetivo.bars[1].rawPct}%</span>
        </div>

      </div>

    {:else if vsObjetivo}
      <!-- ═══ PASADO ═══ -->
      {@const pb_targetGym    = Math.round(vsObjetivo.gastoConActividad - vsObjetivo.deficitTarget)}
      {@const pb_maintGym     = vsObjetivo.gastoConActividad}
      {@const pb_consumed     = t.kcal}
      {@const pb_targetPct    = Math.round((pb_targetGym / pb_maintGym) * 100)}
      {@const pb_pct          = Math.min(100, Math.round((pb_consumed / pb_maintGym) * 100))}
      {@const pb_zone         = pb_consumed <= pb_targetGym ? 'ok' : pb_consumed <= pb_maintGym ? 'warn' : 'over'}
      {@const pb_color        = { ok: '#4ade80', warn: '#fbbf24', over: '#f87171' }}
      {@const pb_deficit      = Math.round(pb_maintGym - pb_consumed)}
      {@const pb_over         = pb_consumed > pb_maintGym ? Math.round(pb_consumed - pb_maintGym) : 0}
      {@const pb_restante     = Math.round(pb_targetGym - pb_consumed)}
      {@const pb_targetBase   = Math.round(vsObjetivo.tdeBase - vsObjetivo.deficitTarget)}
      {@const pb_targetBasePct = Math.round((pb_targetBase / pb_maintGym) * 100)}
      {@const pb_extraGym     = pb_targetGym - pb_targetBase}
      {@const pb_fillBasePct  = Math.min(pb_pct, pb_targetBasePct)}
      {@const pb_fillGymPct   = Math.max(0, Math.min(pb_pct, pb_targetPct) - pb_targetBasePct)}
      {@const pb_fillAmberPct = Math.max(0, pb_pct - pb_targetPct)}
      <div class="past-balance">

        <div class="pb-gasto-row">
          <span class="pb-gasto-label">🔥 quemaste</span>
          <div class="pb-gasto-items">
            <span class="pb-gi base">{vsObjetivo.tdeBase} base</span>
            {#each vsObjetivo.actItems as a}
              <span class="pb-gi act {a.dim ? 'dim' : ''}">{a.icon} {a.label} +{a.kcal}{a.estimado ? '*' : ''}</span>
            {/each}
            <span class="pb-gi total">= {pb_maintGym} kcal</span>
          </div>
        </div>

        <CalorieBudgetBar targetBasePct={pb_targetBasePct} targetPct={pb_targetPct} fillBasePct={pb_fillBasePct} fillGymPct={pb_fillGymPct} fillAmberPct={pb_fillAmberPct} extraGym={pb_extraGym} targetBase={pb_targetBase} targetGym={pb_targetGym} maintGym={pb_maintGym} />

        <div class="pb-result">
          <div class="pb-result-main">
            <span class="pb-consumed" style="color:{pb_color[pb_zone]}">{pb_consumed}</span>
            <span class="pb-consumed-unit">kcal</span>
          </div>
          <div class="pb-result-subs">
            {#if pb_zone === 'ok'}
              <span class="pb-status ok">déficit −{pb_deficit} kcal ✓</span>
            {:else if pb_zone === 'warn'}
              <span class="pb-status warn">déficit parcial −{pb_deficit} kcal</span>
              <span class="pb-status dim">+{Math.abs(pb_restante)} sobre objetivo</span>
            {:else}
              <span class="pb-status over">superávit +{pb_over} kcal</span>
            {/if}
          </div>
        </div>

        <div class="tb-macros">
          <span class="tb-mac prot"><span class="tb-mac-dot"></span>{t.proteina_g}g prot {vsObjetivo.bars[0].rawPct}%</span>
          <span class="tb-mac gras"><span class="tb-mac-dot"></span>{t.grasa_g}g gras</span>
          <span class="tb-mac carb"><span class="tb-mac-dot"></span>{t.carbos_g}g carb {vsObjetivo.bars[1].rawPct}%</span>
        </div>

      </div>
    {/if}
  {/if}

  <!-- Comidas -->
  <div class="section">
    <div class="sec-label">🍽 Comidas</div>
    {#if prevFastGap}
      {@const gs = prevFastGap.stage}
      <div class="gap-divider" style="color:{gs.color};border-color:{gs.color}22">
        <span class="gap-icon">{gs.icon}</span>
        <span class="gap-time">{fmtGap(prevFastGap.gh)}</span>
        <span class="gap-label">ayuno previo{gs.milestone ? ` · ${gs.label}` : ''}</span>
      </div>
    {/if}
    {#each ventana.comidas || [] as comida, ci}
      {#if ci > 0}
        {@const prev = ventana.comidas[ci - 1]}
        {@const dt1 = mealToDate(prev)}
        {@const dt2 = mealToDate(comida)}
        {#if dt1 && dt2}
          {@const gh = gapHours(dt1, dt2)}
          {@const gs = getFastingStage(gh)}
          <div class="gap-divider" style="color:{gs.color};border-color:{gs.color}22">
            <span class="gap-icon">{gs.icon}</span>
            <span class="gap-time">{fmtGap(gh)}</span>
            {#if gs.milestone}
              <span class="gap-label">{gs.label}</span>
            {/if}
          </div>
        {/if}
      {/if}
      <MealCard {comida} ventanaId={ventana.ventana_id} {alimentosRef} />
    {/each}
  </div>

  <!-- Micronutrientes -->
  <MicronutrientPanel comidas={ventana.comidas || []} {alimentosRef} />
{/if}

<style>
  .sess-header { margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid var(--b1); }
  .sess-header h2 { font-size: 19px; font-weight: 700; color: #fff; text-transform: capitalize; margin-bottom: 10px; }
  .meta-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .meta-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 5px; padding: 3px 9px; font-size: 11px; color: var(--muted);
  }
  .meta-badge strong { color: #bbb; }

  /* ── HOY ── */
  .today-balance {
    border-radius: 12px; padding: 16px; margin-bottom: 20px;
    background: var(--s2); border: 1px solid var(--b2);
    display: flex; flex-direction: column; gap: 14px;
  }
  .tb-header { display: flex; align-items: center; gap: 8px; }
  .tb-live {
    font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: #4ade80; display: flex; align-items: center; gap: 5px;
  }
  .tb-live::before {
    content:''; width:6px; height:6px; border-radius:50%;
    background:#4ade80; animation: pulse 2s infinite; display:inline-block;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .tb-daylbl { font-size: 10px; color: var(--dim); margin-left: auto; text-transform: uppercase; letter-spacing: .06em; }

  .tb-gasto-block {
    background: rgba(255,255,255,.02); border: 1px solid var(--b1);
    border-radius: 9px; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px;
  }
  .tb-gasto-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-bottom: 3px; }
  .tb-gl { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-variant-numeric: tabular-nums; }
  .tb-gl.base  { color: #64748b; }
  .tb-gl.act   { color: #94a3b8; }
  .tb-gl.dim   { color: #475569; }
  .tb-gl.total { color: #e2e8f0; font-weight: 700; font-size: 12px; border-top: 1px solid var(--b1); padding-top: 6px; margin-top: 2px; }
  .tb-gl span:last-child { font-weight: 600; }
  .tb-gl.total span:last-child { font-size: 14px; }

  .tb-budget {
    background: rgba(255,255,255,.02); border: 1px solid var(--b1);
    border-radius: 9px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
  }
  .tb-budget-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-bottom: 2px; }
  .tb-budget-header { display: flex; justify-content: space-between; align-items: center; }
  .tb-budget-gym-badge { font-size: 9px; color: #4ade80; font-weight: 600; background: rgba(74,222,128,.1); border-radius: 4px; padding: 2px 7px; }

  .tb-hero { display: flex; align-items: center; gap: 18px; padding: 4px 0; flex-wrap: wrap; }
  .tb-hero-left { display: flex; flex-direction: column; gap: 2px; }
  .tb-hero-num  { display: flex; align-items: baseline; gap: 5px; }
  .tb-hero-kcal { font-size: 48px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; transition: color .3s; letter-spacing: -1px; }
  .tb-hero-unit  { font-size: 15px; color: #475569; font-weight: 600; }
  .tb-hero-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: .07em; }
  .tb-hero-right { display: flex; flex-direction: column; gap: 5px; }
  .tb-delta { font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 500; }
  .tb-delta.ok   { color: #4ade80; }
  .tb-delta.warn { color: #fbbf24; }
  .tb-delta.over { color: #f87171; font-weight: 700; }
  .tb-delta.dim  { color: #475569; }

  .tb-nogym-ref { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; background: rgba(255,255,255,.03); border: 1px solid var(--b1); font-size: 10px; color: var(--dim); }
  .tb-nogym-icon { font-size: 11px; flex-shrink: 0; }
  .tb-nogym-txt  { line-height: 1.4; }
  .tb-budget-note { font-size: 9px; color: var(--dim); opacity: .7; }

  .tb-macros { display: flex; gap: 10px; flex-wrap: wrap; padding-top: 2px; border-top: 1px solid var(--b1); }
  .tb-mac { font-size: 10px; display: flex; align-items: center; gap: 4px; color: var(--muted); }
  .tb-mac-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tb-mac.prot .tb-mac-dot { background: #60a5fa; }
  .tb-mac.gras .tb-mac-dot { background: #f87171; }
  .tb-mac.carb .tb-mac-dot { background: #34d399; }

  /* ── PASADO ── */
  .past-balance { border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; background: var(--s2); border: 1px solid var(--b1); display: flex; flex-direction: column; gap: 10px; }
  .pb-gasto-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .pb-gasto-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; flex-shrink: 0; }
  .pb-gasto-items { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pb-gi { font-size: 10px; font-variant-numeric: tabular-nums; padding: 1px 6px; border-radius: 3px; }
  .pb-gi.base  { color: #64748b; background: rgba(255,255,255,.04); }
  .pb-gi.act   { color: #94a3b8; background: rgba(255,255,255,.04); }
  .pb-gi.dim   { color: #475569; }
  .pb-gi.total { color: #e2e8f0; font-weight: 700; background: rgba(255,255,255,.06); }
  .pb-result { display: flex; align-items: center; gap: 16px; font-variant-numeric: tabular-nums; flex-wrap: wrap; }
  .pb-result-main { display: flex; align-items: baseline; gap: 4px; }
  .pb-consumed      { font-size: 32px; font-weight: 800; }
  .pb-consumed-unit { font-size: 12px; color: #475569; font-weight: 600; }
  .pb-result-subs { display: flex; flex-direction: column; gap: 3px; }
  .pb-status      { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .pb-status.ok   { color: #4ade80; }
  .pb-status.warn { color: #fbbf24; }
  .pb-status.over { color: #f87171; }
  .pb-status.dim  { color: #475569; font-weight: 400; }

  /* ── Secciones ── */
  .section { margin-bottom: 26px; }
  .sec-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--dim); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
  }
  .sec-label::after { content: ''; flex: 1; height: 1px; background: var(--b1); }

  .gap-divider {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 10px; margin-bottom: 6px;
    border: 1px dashed; border-radius: 5px;
    font-size: 11px; opacity: 0.8; background: transparent;
  }
  .gap-icon { font-size: 13px; }
  .gap-time { font-weight: 700; font-variant-numeric: tabular-nums; }
  .gap-label { opacity: 0.75; }
</style>
