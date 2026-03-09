<script>
  import { fmtDateLong } from '$lib/utils.js';
  import { mealToDate, gapHours, getFastingStage, fmtGap } from '$lib/fasting.js';

  let { ventana, perfil = null, sessions = [], bodyOnly = false } = $props();

  let vsObjetivo = $derived.by(() => {
    if (!perfil || !ventana?.totales_ventana) return null;
    const t = ventana.totales_ventana;
    const isGymDay = sessions.some(s => s.date === ventana.ventana_id);
    const kcalObj  = isGymDay ? perfil.objetivos_diarios.kcal_dia_gym : perfil.objetivos_diarios.kcal_dia_descanso;
    const protObj  = perfil.objetivos_diarios.proteina_g_ideal;
    const carbsMax = perfil.objetivos_diarios.carbos_g_max;
    const tdee     = isGymDay ? perfil.metabolismo.gasto_total_gym_kcal : perfil.metabolismo.gasto_total_descanso_kcal;
    const deficit  = Math.round(tdee - t.kcal);
    const defClass = deficit >= 400 ? 'positive' : deficit >= 0 ? 'neutral' : 'negative';
    const defLabel = deficit >= 0 ? `-${deficit} kcal déficit` : `+${Math.abs(deficit)} kcal superávit`;
    const dayLabel = isGymDay ? 'día de gym' : 'día de descanso';

    function mkBar(label, val, target, color) {
      const pct  = Math.min(100, Math.round((val / target) * 100));
      const over = val > target;
      const fill = over ? 'var(--amber)' : color;
      return { label, val, target, pct, over, fill };
    }

    return {
      bars: [
        mkBar('Calorías (kcal)', t.kcal, kcalObj, 'var(--amber)'),
        mkBar('Proteína (g)', t.proteina_g, protObj, 'var(--blue)'),
        mkBar('Carbos (g)', t.carbos_g, carbsMax, 'var(--green)'),
      ],
      tdee, deficit, defClass, defLabel, dayLabel
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

  <!-- Totales -->
  {#if ventana.totales_ventana}
    {@const t = ventana.totales_ventana}
    <div class="section">
      <div class="sec-label">📊 Totales del día</div>
      <div class="macros-grid summary">
        <div class="mc"><span class="mc-val kcal">{t.kcal}</span><span class="mc-lbl">kcal</span></div>
        <div class="mc"><span class="mc-val prot">{t.proteina_g}g</span><span class="mc-lbl">proteína</span></div>
        <div class="mc"><span class="mc-val gras">{t.grasa_g}g</span><span class="mc-lbl">grasa</span></div>
        <div class="mc"><span class="mc-val carb">{t.carbos_g}g</span><span class="mc-lbl">carbos</span></div>
      </div>
      {#if t.nota}<p style="font-size:10px;color:var(--dim);margin-top:7px;font-style:italic">* {t.nota}</p>{/if}
    </div>

    <!-- vs Objetivo -->
    {#if vsObjetivo}
      <div class="section">
        <div class="sec-label">🎯 vs Objetivo ({vsObjetivo.dayLabel})</div>
        <div class="targets-section">
          {#each vsObjetivo.bars as bar}
            <div class="target-row">
              <div class="target-meta">
                <span class="target-meta-lbl">{bar.label}</span>
                <span class="target-meta-val" class:over={bar.over}>{bar.val} / {bar.target} &nbsp;{bar.pct}%</span>
              </div>
              <div class="target-bar-bg">
                <div class="target-bar-fill" style="width:{bar.pct}%;background:{bar.fill}"></div>
              </div>
            </div>
          {/each}
          <div class="deficit-chip {vsObjetivo.defClass}">{vsObjetivo.defLabel} · TDEE {vsObjetivo.tdee} kcal</div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Comidas -->
  <div class="section">
    <div class="sec-label">🍽 Comidas</div>
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
                : a.cantidad_g_aprox != null ? '~' + a.cantidad_g_aprox + 'g'
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
    height: 5px; background: var(--b2); border-radius: 3px; overflow: hidden;
  }
  .target-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

  .deficit-chip {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 6px; padding: 6px 12px;
    font-size: 12px; font-weight: 700; margin-top: 12px;
  }
  .deficit-chip.positive {
    background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.25); color: var(--green);
  }
  .deficit-chip.negative {
    background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.25); color: var(--red);
  }
  .deficit-chip.neutral {
    background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.25); color: var(--amber);
  }

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
</style>
