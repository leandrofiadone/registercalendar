<script>
  import { fmtDateLong, localDateStr } from '$lib/utils.js';
  import { mealToDate, gapHours, getFastingStage, fmtGap, getAllMealsSorted } from '$lib/fasting.js';
  import { actividadKcal, gymKcalDetallado, actividadLabel } from '$lib/activity.js';

  let { ventana, perfil = null, sessions = [], ventanas = [], bodyOnly = false, alimentosRef = [] } = $props();

  // Gap de ayuno desde la última comida de la ventana anterior
  let prevFastGap = $derived.by(() => {
    if (!ventana?.comidas?.length || !ventanas.length) return null;
    const firstMeal = ventana.comidas.find(c => mealToDate(c));
    if (!firstMeal) return null;
    const dt1 = mealToDate(firstMeal);
    if (!dt1) return null;
    // Buscar la última comida de cualquier ventana anterior a esta
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

    // Actividad del día — desglose completo
    const gymSess   = sessions.find(s => s.date === ventana.ventana_id);
    const actsExtra = ventana.actividades || [];
    const actItems  = [];

    if (gymSess) {
      const det = gymKcalDetallado(gymSess, pesoKg);
      if (det.fuerza > 0) actItems.push({
        icon: '💪',
        label: (gymSess.groups||[]).join(' + ') || 'Fuerza',
        kcal: det.fuerza,
        estimado: true,
      });
      for (const c of det.cardio) actItems.push({
        icon: c.tipo === 'sauna' ? '🧖' : c.tipo === 'natacion' ? '🏊' : '🏃',
        label: `${c.ejercicio}${c.duracion_min ? ` ${c.duracion_min}min` : ''}`,
        kcal: c.kcal,
        estimado: c.fuente === 'estimado',
        dim: c.tipo === 'sauna' || c.tipo === 'ducha_fria',
      });
    }
    for (const a of actsExtra) actItems.push({
      icon: '🏃',
      label: `${actividadLabel(a.tipo)}${a.duracion_min ? ` ${a.duracion_min}min` : ''}`,
      kcal: actividadKcal(a, pesoKg),
      estimado: a.kcal_extra == null,
    });

    const kcalActividad       = actItems.reduce((s, a) => s + a.kcal, 0);
    const gastoSinActividad   = tdeBase;
    const gastoConActividad   = tdeBase + kcalActividad;
    const deficitSinActividad = Math.round(gastoSinActividad - t.kcal);
    const deficitConActividad = Math.round(gastoConActividad - t.kcal);
    const kcalObj             = kcalBase + kcalActividad;
    const margen              = Math.round(kcalObj - t.kcal);
    const dayLabel            = gymSess ? 'día de gym' : actsExtra.length ? 'día activo' : 'día de descanso';
    const todayStr            = localDateStr();
    const isToday             = ventana.ventana_id === todayStr;
    const targetCumplido      = deficitConActividad >= deficitTarget;

    function defCls(val) {
      return val >= deficitTarget ? 'st-ok' : val >= 0 ? 'st-warn' : 'st-over';
    }
    function mkBar(label, val, target, color) {
      const rawPct = Math.round((val / target) * 100);
      const pct    = Math.min(100, rawPct);
      const over   = val > target;
      return { label, val, target, pct, rawPct, over, fill: over ? 'var(--red)' : color };
    }

    return {
      bars: [
        mkBar('Proteína (g)', t.proteina_g, protObj, 'var(--blue)'),
        mkBar('Carbos (g)', t.carbos_g, carbsMax, 'var(--green)'),
      ],
      isToday, dayLabel,
      tdeBase, kcalActividad, gastoConActividad,
      deficitSinActividad, deficitConActividad,
      defClsSin: defCls(deficitSinActividad),
      defClsCon: defCls(deficitConActividad),
      kcalObj, margen, actItems, targetCumplido, deficitTarget,
      // compat
      deficit: deficitConActividad,
      gastoTotal: gastoConActividad,
      deficitCls: defCls(deficitConActividad),
    };
  });

  // Micronutrientes acumulados del día
  const MICRO_KEYS = ['fibra_g','sodio_mg','potasio_mg','hierro_mg','calcio_mg','magnesio_mg','zinc_mg','vit_b12_mcg','vit_d_mcg','vit_a_mcg','vit_c_mg','colesterol_mg','omega3_g','omega6_g'];
  const MICRO_LABELS = {
    fibra_g:'Fibra', sodio_mg:'Sodio', potasio_mg:'Potasio', hierro_mg:'Hierro',
    calcio_mg:'Calcio', magnesio_mg:'Magnesio', zinc_mg:'Zinc', vit_b12_mcg:'B12',
    vit_d_mcg:'Vit D', vit_a_mcg:'Vit A', vit_c_mg:'Vit C', colesterol_mg:'Colesterol',
    omega3_g:'Omega-3', omega6_g:'Omega-6'
  };
  const MICRO_UNITS = {
    fibra_g:'g', sodio_mg:'mg', potasio_mg:'mg', hierro_mg:'mg', calcio_mg:'mg',
    magnesio_mg:'mg', zinc_mg:'mg', vit_b12_mcg:'mcg', vit_d_mcg:'mcg', vit_a_mcg:'mcg',
    vit_c_mg:'mg', colesterol_mg:'mg', omega3_g:'g', omega6_g:'g'
  };

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function findRef(nombre) {
    if (!alimentosRef.length) return null;
    const n = norm(nombre);
    return alimentosRef.find(r =>
      r.nombres.some(rn => {
        const rn2 = norm(rn);
        // match exacto o contenido completo del nombre de referencia
        if (n === rn2 || n.includes(rn2)) return true;
        // match inverso solo si la referencia es más larga (evita "pan" matcheando "manzana")
        if (rn2.length > n.length && rn2.includes(n)) return true;
        return false;
      })
    ) ?? null;
  }

  let microTotals = $derived.by(() => {
    if (!ventana?.comidas?.length || !alimentosRef.length) return null;
    const totals = {};
    MICRO_KEYS.forEach(k => totals[k] = 0);
    let matched = 0;
    let total = 0;

    for (const comida of ventana.comidas) {
      for (const a of (comida.alimentos || [])) {
        total++;
        const ref = findRef(a.nombre);
        if (!ref) continue;
        matched++;
        const grams = a.cantidad_g ?? 0;
        if (!grams) continue;
        const factor = grams / 100;
        for (const k of MICRO_KEYS) {
          totals[k] += (ref.por_100g[k] ?? 0) * factor;
        }
      }
    }

    if (!matched) return null;

    // Round values
    const rounded = {};
    for (const k of MICRO_KEYS) {
      rounded[k] = totals[k] < 10 ? +totals[k].toFixed(1) : Math.round(totals[k]);
    }
    return { values: rounded, matched, total };
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
      {@const overAmount     = consumed > maintGym ? Math.round(consumed - maintGym) : 0}
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

          <!-- Hero: calorías consumidas -->
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

          <!-- Barra: 100% = sin déficit -->
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

          <!-- Referencia sin gym -->
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

        <!-- Macros -->
        <div class="tb-macros">
          <span class="tb-mac prot"><span class="tb-mac-dot"></span>{t.proteina_g}g prot {vsObjetivo.bars[0].rawPct}%</span>
          <span class="tb-mac gras"><span class="tb-mac-dot"></span>{t.grasa_g}g gras</span>
          <span class="tb-mac carb"><span class="tb-mac-dot"></span>{t.carbos_g}g carb {vsObjetivo.bars[1].rawPct}%</span>
        </div>

      </div>

    {:else if vsObjetivo}
      <!-- ═══ PASADO ═══ -->
      {@const pb_targetGym  = Math.round(vsObjetivo.gastoConActividad - vsObjetivo.deficitTarget)}
      {@const pb_maintGym   = vsObjetivo.gastoConActividad}
      {@const pb_consumed   = t.kcal}
      {@const pb_targetPct  = Math.round((pb_targetGym / pb_maintGym) * 100)}
      {@const pb_pct        = Math.min(100, Math.round((pb_consumed / pb_maintGym) * 100))}
      {@const pb_zone       = pb_consumed <= pb_targetGym ? 'ok' : pb_consumed <= pb_maintGym ? 'warn' : 'over'}
      {@const pb_color      = { ok: '#4ade80', warn: '#fbbf24', over: '#f87171' }}
      {@const pb_deficit    = Math.round(pb_maintGym - pb_consumed)}
      {@const pb_over       = pb_consumed > pb_maintGym ? Math.round(pb_consumed - pb_maintGym) : 0}
      {@const pb_restante    = Math.round(pb_targetGym - pb_consumed)}
      {@const pb_targetBase    = Math.round(vsObjetivo.tdeBase - vsObjetivo.deficitTarget)}
      {@const pb_targetBasePct = Math.round((pb_targetBase / pb_maintGym) * 100)}
      {@const pb_extraGym      = pb_targetGym - pb_targetBase}
      {@const pb_fillBasePct   = Math.min(pb_pct, pb_targetBasePct)}
      {@const pb_fillGymPct    = Math.max(0, Math.min(pb_pct, pb_targetPct) - pb_targetBasePct)}
      {@const pb_fillAmberPct  = Math.max(0, pb_pct - pb_targetPct)}
      <div class="past-balance">

        <!-- Gasto inline -->
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

        <!-- Barra: 100% = sin déficit -->
        <div class="tb-bar-track">
          <div class="tb-bar-bg">
            <div class="tb-zone-green" style="width:{pb_targetBasePct}%"></div>
            {#if pb_extraGym > 0}
              <div class="tb-zone-gym" style="left:{pb_targetBasePct}%; width:{pb_targetPct - pb_targetBasePct}%"></div>
            {/if}
            <div class="tb-zone-amber" style="left:{pb_targetPct}%"></div>
            <div class="tb-fill-green" style="width:{pb_fillBasePct}%"></div>
            {#if pb_fillGymPct > 0}
              <div class="tb-fill-gym" style="left:{pb_targetBasePct}%; width:{pb_fillGymPct}%"></div>
            {/if}
            {#if pb_fillAmberPct > 0}
              <div class="tb-fill-amber" style="left:{pb_targetPct}%; width:{pb_fillAmberPct}%"></div>
            {/if}
          </div>
          {#if pb_extraGym > 0}
            <div class="tb-base-marker" style="left:{pb_targetBasePct}%">
              <div class="tb-base-line"></div>
              <div class="tb-base-arrow"></div>
              <div class="tb-base-lbl">
                <span class="tb-base-name">sin gym</span>
                <span class="tb-base-val">{pb_targetBase}</span>
              </div>
            </div>
          {/if}
          <div class="tb-marker" style="left:{pb_targetPct}%">
            <div class="tb-marker-line"></div>
            <div class="tb-marker-arrow"></div>
            <div class="tb-marker-lbl">
              <span class="tb-marker-name">objetivo</span>
              <span class="tb-marker-val">{pb_targetGym}</span>
            </div>
          </div>
          <div class="tb-end-marker">
            <div class="tb-end-line"></div>
            <div class="tb-end-lbl">
              <span class="tb-end-name">superávit</span>
              <span class="tb-end-val">{pb_maintGym} kcal</span>
            </div>
          </div>
        </div>

        <!-- Resultado -->
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

        <!-- Macros -->
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
      <div class="meal-card">
        <div>
          <span class="meal-tipo">{comida.tipo}</span>
          {#if comida.hora}<span class="meal-hora">{comida.hora}</span>{/if}
          {#if comida.fecha && comida.fecha !== ventana.ventana_id}
            <span class="meal-fecha-badge">{comida.fecha}</span>
          {/if}
          {#if comida.totales?.estimado}
            <span class="estimado-badge">est.</span>
          {/if}
        </div>
        <div class="meal-desc">{comida.descripcion}</div>

        {#if comida.totales}
          {@const t = comida.totales}
          <div class="macros-grid">
            <div class="mc"><span class="mc-val kcal">{t.kcal}</span><span class="mc-lbl">kcal</span></div>
            <div class="mc"><span class="mc-val prot">{t.proteina_g != null ? t.proteina_g + 'g' : '—'}</span><span class="mc-lbl">proteína</span></div>
            <div class="mc"><span class="mc-val gras">{t.grasa_g    != null ? t.grasa_g    + 'g' : '—'}</span><span class="mc-lbl">grasa</span></div>
            <div class="mc"><span class="mc-val carb">{t.carbos_g   != null ? t.carbos_g   + 'g' : '—'}</span><span class="mc-lbl">carbos</span></div>
          </div>
        {/if}

        {#if comida.alimentos?.length}
          <ul class="alimentos">
            {#each comida.alimentos as a}
              {@const cant = a.unidades != null       ? a.unidades       + 'u'
                : a.cantidad_g       != null ? a.cantidad_g       + 'g'
                : a.cantidad_ml      != null ? a.cantidad_ml      + 'ml'
                : ''}
              {@const ms = [
                a.kcal       != null ? a.kcal       + ' kcal' : '',
                a.proteina_g != null ? 'P '  + a.proteina_g + 'g' : '',
                a.grasa_g    != null ? 'G '  + a.grasa_g    + 'g' : '',
                a.carbos_g   != null ? 'C '  + a.carbos_g   + 'g' : '',
              ].filter(Boolean).join(' · ')}
              <li>
                <span class="al-name">{a.nombre}{#if cant} <span style="color:var(--dim)">({cant})</span>{/if}</span>
                <span class="al-macros">{ms}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Micronutrientes -->
  {#if microTotals}
    <div class="section">
      <div class="sec-label">🧬 Micronutrientes</div>
      <div class="micro-grid">
        {#each MICRO_KEYS as k}
          <div class="micro-item">
            <span class="micro-val">{microTotals.values[k]}<span class="micro-unit">{MICRO_UNITS[k]}</span></span>
            <span class="micro-lbl">{MICRO_LABELS[k]}</span>
          </div>
        {/each}
      </div>
      {#if microTotals.matched < microTotals.total}
        <div class="micro-note">Datos de {microTotals.matched}/{microTotals.total} alimentos con referencia</div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .sess-header {
    margin-bottom: 22px; padding-bottom: 18px;
    border-bottom: 1px solid var(--b1);
  }
  .sess-header h2 {
    font-size: 19px; font-weight: 700; color: #fff;
    text-transform: capitalize; margin-bottom: 10px;
  }
  .meta-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .meta-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 5px; padding: 3px 9px;
    font-size: 11px; color: var(--muted);
  }
  .meta-badge strong { color: #bbb; }

  /* ── Paleta extendida ── */
  /* consumed: naranja cálido  gasto: azul cielo  déficit: gradiente verde→rojo */

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

  /* Gasto del día */
  .tb-gasto-block {
    background: rgba(255,255,255,.02); border: 1px solid var(--b1);
    border-radius: 9px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .tb-gasto-title {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: #94a3b8; margin-bottom: 3px;
  }
  .tb-gl {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; font-variant-numeric: tabular-nums;
  }
  .tb-gl.base  { color: #64748b; }
  .tb-gl.act   { color: #94a3b8; }
  .tb-gl.dim   { color: #475569; }
  .tb-gl.total {
    color: #e2e8f0; font-weight: 700; font-size: 12px;
    border-top: 1px solid var(--b1); padding-top: 6px; margin-top: 2px;
  }
  .tb-gl span:last-child { font-weight: 600; }
  .tb-gl.total span:last-child { font-size: 14px; }

  /* Barras de presupuesto */
  .tb-budget {
    background: rgba(255,255,255,.02); border: 1px solid var(--b1);
    border-radius: 9px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .tb-budget-title {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: #94a3b8; margin-bottom: 2px;
  }
  .tb-budget-header {
    display: flex; justify-content: space-between; align-items: center;
  }
  .tb-budget-gym-badge {
    font-size: 9px; color: #4ade80; font-weight: 600;
    background: rgba(74,222,128,.1); border-radius: 4px; padding: 2px 7px;
  }
  /* ── Hero kcal ── */
  .tb-hero {
    display: flex; align-items: center; gap: 18px;
    padding: 4px 0; flex-wrap: wrap;
  }
  .tb-hero-left { display: flex; flex-direction: column; gap: 2px; }
  .tb-hero-num  { display: flex; align-items: baseline; gap: 5px; }
  .tb-hero-kcal {
    font-size: 48px; font-weight: 800; line-height: 1;
    font-variant-numeric: tabular-nums; transition: color .3s;
    letter-spacing: -1px;
  }
  .tb-hero-unit  { font-size: 15px; color: #475569; font-weight: 600; }
  .tb-hero-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: .07em; }
  .tb-hero-right { display: flex; flex-direction: column; gap: 5px; }
  .tb-delta { font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 500; }
  .tb-delta.ok   { color: #4ade80; }
  .tb-delta.warn { color: #fbbf24; }
  .tb-delta.over { color: #f87171; font-weight: 700; }
  .tb-delta.dim  { color: #475569; }

  /* ── Barra de progreso ── */
  .tb-bar-track { position: relative; padding-bottom: 48px; margin: 2px 0; }
  .tb-bar-bg {
    height: 22px; border-radius: 99px;
    position: relative; overflow: hidden;
    border: 1px solid rgba(255,255,255,.07);
  }
  /* Zonas de fondo (lo que QUEDA por consumir) */
  .tb-zone-green {
    position: absolute; top: 0; bottom: 0; left: 0;
    background: repeating-linear-gradient(
      -45deg,
      rgba(74,222,128,.18) 0px,
      rgba(74,222,128,.18) 3px,
      rgba(74,222,128,.05) 3px,
      rgba(74,222,128,.05) 9px
    );
  }
  .tb-zone-gym {
    position: absolute; top: 0; bottom: 0;
    background: repeating-linear-gradient(
      -45deg,
      rgba(22,163,74,.14) 0px,
      rgba(22,163,74,.14) 3px,
      rgba(22,163,74,.03) 3px,
      rgba(22,163,74,.03) 9px
    );
    border-left: 1px dashed rgba(74,222,128,.2);
    border-right: 1px dashed rgba(74,222,128,.2);
  }
  .tb-zone-amber {
    position: absolute; top: 0; bottom: 0; right: 0;
    background: repeating-linear-gradient(
      -45deg,
      rgba(251,191,36,.18) 0px,
      rgba(251,191,36,.18) 3px,
      rgba(251,191,36,.05) 3px,
      rgba(251,191,36,.05) 9px
    );
  }
  /* Fills sólidos (lo que YA se consumió) */
  .tb-fill-green {
    position: absolute; top: 0; bottom: 0; left: 0;
    border-radius: 99px; z-index: 3;
    background: #4ade80;
    box-shadow: 0 0 12px rgba(74,222,128,.45);
    transition: width .7s cubic-bezier(.4,0,.2,1);
  }
  .tb-fill-gym {
    position: absolute; top: 0; bottom: 0;
    z-index: 3;
    background: #16a34a;
    box-shadow: 0 0 8px rgba(22,163,74,.35);
    transition: left .7s cubic-bezier(.4,0,.2,1), width .7s cubic-bezier(.4,0,.2,1);
  }
  .tb-fill-amber {
    position: absolute; top: 0; bottom: 0;
    border-radius: 0 99px 99px 0; z-index: 3;
    background: #f59e0b;
    box-shadow: 0 0 12px rgba(245,158,11,.5);
    transition: left .7s cubic-bezier(.4,0,.2,1), width .7s cubic-bezier(.4,0,.2,1);
  }

  /* Marcador objetivo */
  .tb-marker {
    position: absolute; top: 0;
    display: flex; flex-direction: column; align-items: center;
    pointer-events: none; z-index: 4; transform: translateX(-50%);
  }
  .tb-marker-line  { width: 2px; height: 22px; background: rgba(255,255,255,.8); flex-shrink: 0; }
  .tb-marker-arrow {
    width: 0; height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 10px solid rgba(255,255,255,.8);
  }
  .tb-marker-lbl  { display: flex; flex-direction: column; align-items: center; margin-top: 5px; gap: 1px; }
  .tb-marker-name { font-size: 9px; text-transform: uppercase; letter-spacing: .09em; color: #94a3b8; font-weight: 700; }
  .tb-marker-val  {
    font-size: 20px; font-weight: 800; color: #fff;
    font-variant-numeric: tabular-nums; line-height: 1;
  }

  /* Marcador base (sin gym) */
  .tb-base-marker {
    position: absolute; top: 0;
    display: flex; flex-direction: column; align-items: center;
    pointer-events: none; z-index: 3; transform: translateX(-50%);
  }
  .tb-base-line  { width: 1px; height: 22px; background: rgba(148,163,184,.45); flex-shrink: 0; }
  .tb-base-arrow {
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid rgba(148,163,184,.45);
  }
  .tb-base-lbl  { display: flex; flex-direction: column; align-items: center; margin-top: 4px; gap: 1px; }
  .tb-base-name { font-size: 8px; text-transform: uppercase; letter-spacing: .09em; color: #64748b; font-weight: 700; }
  .tb-base-val  { font-size: 13px; font-weight: 700; color: #64748b; font-variant-numeric: tabular-nums; line-height: 1; }

  /* Marcador superávit (fin de barra) */
  .tb-end-marker {
    position: absolute; top: 0; right: 0;
    display: flex; flex-direction: column; align-items: flex-end;
    pointer-events: none; z-index: 4;
  }
  .tb-end-line { width: 2px; height: 22px; background: rgba(251,191,36,.85); align-self: flex-end; }
  .tb-end-lbl  { display: flex; flex-direction: column; align-items: flex-end; margin-top: 5px; gap: 1px; }
  .tb-end-name { font-size: 9px; text-transform: uppercase; letter-spacing: .09em; color: #b45309; font-weight: 700; }
  .tb-end-val  {
    font-size: 20px; font-weight: 800; color: #fbbf24;
    font-variant-numeric: tabular-nums; line-height: 1;
  }

  /* Referencia sin gym */
  .tb-nogym-ref {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; border-radius: 6px;
    background: rgba(255,255,255,.03); border: 1px solid var(--b1);
    font-size: 10px; color: var(--dim);
  }
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
  .past-balance {
    border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;
    background: var(--s2); border: 1px solid var(--b1);
    display: flex; flex-direction: column; gap: 10px;
  }

  .pb-gasto-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .pb-gasto-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: #94a3b8; flex-shrink: 0;
  }
  .pb-gasto-items { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pb-gi {
    font-size: 10px; font-variant-numeric: tabular-nums;
    padding: 1px 6px; border-radius: 3px;
  }
  .pb-gi.base  { color: #64748b; background: rgba(255,255,255,.04); }
  .pb-gi.act   { color: #94a3b8; background: rgba(255,255,255,.04); }
  .pb-gi.dim   { color: #475569; }
  .pb-gi.total { color: #e2e8f0; font-weight: 700; background: rgba(255,255,255,.06); }

  .pb-result {
    display: flex; align-items: center; gap: 16px;
    font-variant-numeric: tabular-nums; flex-wrap: wrap;
  }
  .pb-result-main { display: flex; align-items: baseline; gap: 4px; }
  .pb-consumed      { font-size: 32px; font-weight: 800; }
  .pb-consumed-unit { font-size: 12px; color: #475569; font-weight: 600; }
  .pb-result-subs { display: flex; flex-direction: column; gap: 3px; }
  .pb-status      { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .pb-status.ok   { color: #4ade80; }
  .pb-status.warn { color: #fbbf24; }
  .pb-status.over { color: #f87171; }
  .pb-status.dim  { color: #475569; font-weight: 400; }

  .section { margin-bottom: 26px; }
  .sec-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--dim); margin-bottom: 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .sec-label::after { content: ''; flex: 1; height: 1px; background: var(--b1); }

  .macros-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 6px; background: var(--s2);
    border: 1px solid var(--b1); border-radius: 6px;
    padding: 10px; margin-bottom: 10px;
  }
  .mc { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .mc-val { font-size: 17px; font-weight: 700; line-height: 1; }
  .mc-val.kcal { color: var(--amber); }
  .mc-val.prot { color: var(--blue); }
  .mc-val.gras { color: var(--red); }
  .mc-val.carb { color: var(--green); }
  .mc-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); }

  .macros-grid.summary {
    margin-bottom: 0;
    border-color: rgba(245,158,11,.2);
    background: rgba(245,158,11,.04);
  }
  .macros-grid.summary .mc-val { font-size: 22px; }

  .targets-section {
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;
  }
  .target-row { margin-bottom: 10px; }
  .target-row:last-of-type { margin-bottom: 0; }
  .target-meta {
    display: flex; justify-content: space-between;
    font-size: 10px; margin-bottom: 4px;
  }
  .target-meta-lbl { color: var(--muted); }
  .target-meta-val { color: var(--text); font-weight: 600; }
  .target-meta-val.over { color: var(--amber); }
  .target-bar-bg {
    height: 5px; background: var(--b2); border-radius: 3px; overflow: visible; position: relative;
  }
  .target-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; overflow: hidden; }
  .target-bar-over {
    position: absolute; right: 0; top: 50%; transform: translateY(-50%);
    font-size: 9px; font-weight: 800; padding: 1px 5px;
    border-radius: 3px; opacity: .85; white-space: nowrap;
    color: #fff; margin-right: -2px;
  }

  .status-chip {
    display: flex; align-items: center; gap: 8px;
    border-radius: 8px; padding: 10px 14px; margin-bottom: 10px;
    border: 1px solid;
  }
  .st-icon { font-size: 14px; font-weight: 800; flex-shrink: 0; }
  .st-label { font-size: 12px; font-weight: 700; flex: 1; }
  .st-target { font-size: 10px; opacity: .6; flex-shrink: 0; }
  .status-chip.st-ok   { background: rgba(16,185,129,.1);  border-color: rgba(16,185,129,.3);  color: var(--green); }
  .status-chip.st-warn { background: rgba(245,158,11,.1);  border-color: rgba(245,158,11,.3);  color: var(--amber); }
  .status-chip.st-over { background: rgba(239,68,68,.1);   border-color: rgba(239,68,68,.3);   color: var(--red); }

  .gap-divider {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 10px; margin-bottom: 6px;
    border: 1px dashed; border-radius: 5px;
    font-size: 11px; opacity: 0.8;
    background: transparent;
  }
  .gap-icon { font-size: 13px; }
  .gap-time { font-weight: 700; font-variant-numeric: tabular-nums; }
  .gap-label { opacity: 0.75; }

  .meal-card {
    background: var(--s1); border: 1px solid var(--b1);
    border-radius: 8px; padding: 13px 15px; margin-bottom: 8px;
  }
  .meal-tipo {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--green);
  }
  .meal-hora { color: var(--dim); font-size: 11px; margin-left: 8px; }
  .meal-fecha-badge {
    display: inline-block; font-size: 9px;
    color: var(--amber); background: rgba(245,158,11,.1);
    border: 1px solid rgba(245,158,11,.2);
    border-radius: 3px; padding: 0 5px; margin-left: 6px;
  }
  .meal-desc { font-size: 13px; color: #bbb; margin: 7px 0 10px; }

  .estimado-badge {
    font-size: 9px; color: var(--amber);
    background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.2);
    border-radius: 3px; padding: 0 5px; margin-left: 6px;
  }

  .alimentos { list-style: none; }
  .alimentos li {
    display: flex; justify-content: space-between;
    align-items: center; padding: 5px 0;
    border-bottom: 1px solid var(--b1);
    font-size: 11px;
  }
  .alimentos li:last-child { border-bottom: none; }
  .al-name  { color: #bbb; }
  .al-macros { color: var(--dim); font-size: 10px; }

  .micro-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 6px;
  }
  .micro-item {
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 6px; padding: 8px 10px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .micro-val {
    font-size: 15px; font-weight: 700; color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .micro-unit { font-size: 10px; color: var(--dim); margin-left: 2px; font-weight: 400; }
  .micro-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .micro-note {
    margin-top: 8px; font-size: 10px; color: var(--dim);
  }
</style>
