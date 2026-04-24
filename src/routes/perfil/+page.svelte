<script>
  import { fmtDate, localDateStr } from '$lib/utils.js';
  import { gymKcalDetallado, actividadKcal } from '$lib/activity.js';

  let { data } = $props();
  let sessions     = $derived(data.sessions);
  let ventanas     = $derived(data.ventanas);
  let perfil       = $derived(data.perfil);
  let alimentosRef = $derived(data.alimentosRef ?? []);

  let thisMonth = $derived.by(() => {
    const now = new Date();
    const ym  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return sessions.filter(s => s.date.startsWith(ym)).length;
  });

  let streak = $derived.by(() => {
    const dateSet = new Set(sessions.map(s => s.date));
    let count = 0;
    const d = new Date();
    while (dateSet.has(localDateStr(d))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  });

  let favGroup = $derived.by(() => {
    const groupCount = {};
    sessions.forEach(s => (s.groups || []).forEach(g => { groupCount[g] = (groupCount[g] || 0) + 1; }));
    const favEntry = Object.entries(groupCount).sort((a, b) => b[1] - a[1])[0];
    return favEntry?.[0] ?? null;
  });

  let totalKcal = $derived(
    ventanas.reduce((sum, v) => sum + (v.totales_ventana?.kcal || 0), 0)
  );

  let pesoActual = $derived.by(() => {
    if (!perfil) return null;
    const sorted = [...(perfil.historial_peso || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
    return sorted[0] ?? null;
  });

  let pesoAnterior = $derived.by(() => {
    if (!perfil) return null;
    const sorted = [...(perfil.historial_peso || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
    return sorted[1] ?? null;
  });

  let pesoDelta = $derived(
    pesoActual && pesoAnterior
      ? (pesoActual.peso_kg - pesoAnterior.peso_kg).toFixed(1)
      : null
  );

  let histVentanas = $derived(
    [...ventanas].sort((a, b) => b.ventana_id.localeCompare(a.ventana_id)).slice(0, 10)
  );

  let maxKcal = $derived(
    perfil
      ? Math.max(...histVentanas.map(v => v.totales_ventana?.kcal || 0), perfil.objetivos_diarios.kcal_dia_gym, 1)
      : 1
  );

  // Rolling 7-day window for trend
  let rolling7 = $derived.by(() => {
    if (!perfil) return null;
    const me = perfil.metabolismo;
    const pesoKg = perfil.historial_peso?.at(-1)?.peso_kg ?? 80;
    const today = new Date();
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    let totalConsumed = 0;
    let totalSpent = 0;
    for (const date of dates) {
      const v = ventanas.find(vv => vv.ventana_id === date);
      totalConsumed += v?.totales_ventana?.kcal || 0;
      let actKcal = 0;
      const gymSess = sessions.find(s => s.date === date);
      if (gymSess) {
        const det = gymKcalDetallado(gymSess, pesoKg);
        actKcal += det.fuente === 'explicito' ? det.total : det.fuerza + det.cardio.reduce((sum, c) => sum + c.kcal, 0);
      }
      if (v?.actividades?.length) {
        for (const act of v.actividades) {
          actKcal += actividadKcal(act, pesoKg);
        }
      }
      totalSpent += me.gasto_total_descanso_kcal + actKcal;
    }
    const days = dates.length;
    return {
      days,
      avgConsumed: Math.round(totalConsumed / days),
      avgSpent: Math.round(totalSpent / days),
      avgDeficit: Math.round((totalSpent - totalConsumed) / days),
    };
  });

  let avgKcal = $derived(rolling7?.avgConsumed ?? 0);
  let avgDeficit = $derived(rolling7?.avgDeficit ?? 0);

  // Resumen semanal: agrupa datos por semana (lun-dom) y calcula promedios
  let weeklyRows = $derived.by(() => {
    if (!perfil) return [];
    const me = perfil.metabolismo;
    const ob = perfil.objetivos_diarios;
    const pesoKg = perfil.historial_peso?.at(-1)?.peso_kg ?? 80;

    // Monday (local) de una fecha YYYY-MM-DD
    const mondayOf = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00');
      const day = d.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const addDays = (dateStr, n) => {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    // Construye set de todas las fechas relevantes (ventanas + sessions) y peso fechas
    const allDates = new Set();
    ventanas.forEach(v => v.ventana_id && allDates.add(v.ventana_id));
    sessions.forEach(s => s.date && allDates.add(s.date));
    if (!allDates.size) return [];

    // Group by week (monday key)
    const weeks = new Map();
    for (const date of allDates) {
      const wk = mondayOf(date);
      if (!weeks.has(wk)) weeks.set(wk, []);
      weeks.get(wk).push(date);
    }

    const sortedPesos = [...(perfil.historial_peso || [])].sort((a,b) => a.fecha.localeCompare(b.fecha));
    const pesoBeforeOrOn = (dateStr) => {
      let found = null;
      for (const p of sortedPesos) {
        if (p.fecha <= dateStr) found = p;
        else break;
      }
      return found;
    };

    const todayStr = localDateStr(new Date());
    const rows = [];
    for (const [weekStart, dates] of weeks.entries()) {
      const weekEnd = addDays(weekStart, 6);
      let consumed = 0, spent = 0, daysLogged = 0;
      // Iterate all 7 days of the week, count days with data
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        if (d > todayStr) continue; // no futuros
        const v = ventanas.find(vv => vv.ventana_id === d);
        const gymSess = sessions.find(s => s.date === d);
        if (!v && !gymSess) continue;
        daysLogged++;
        consumed += v?.totales_ventana?.kcal || 0;
        let actKcal = 0;
        if (gymSess) {
          const det = gymKcalDetallado(gymSess, pesoKg);
          actKcal += det.fuente === 'explicito' ? det.total : det.fuerza + det.cardio.reduce((s,c) => s + c.kcal, 0);
        }
        if (v?.actividades?.length) {
          for (const act of v.actividades) actKcal += actividadKcal(act, pesoKg);
        }
        const tdee = gymSess ? me.gasto_total_gym_kcal : me.gasto_total_descanso_kcal;
        spent += tdee;
      }
      if (daysLogged === 0) continue;

      const avgC = Math.round(consumed / daysLogged);
      const avgS = Math.round(spent / daysLogged);
      const avgD = Math.round((spent - consumed) / daysLogged);
      const lossKg = +(avgD * daysLogged / 7700).toFixed(2);

      // Peso al principio y fin de la semana (el último registro <= cada fecha)
      const pesoStart = pesoBeforeOrOn(weekStart);
      const pesoEnd = pesoBeforeOrOn(weekEnd > todayStr ? todayStr : weekEnd);
      const pesoDelta = pesoStart && pesoEnd && pesoStart.fecha !== pesoEnd.fecha
        ? +(pesoEnd.peso_kg - pesoStart.peso_kg).toFixed(1)
        : null;

      // Color del déficit vs objetivo
      const targetDef = ob.deficit_target_kcal;
      let defCol = 'var(--dim)';
      if (avgD >= targetDef * 0.8) defCol = 'var(--green)';
      else if (avgD >= 0) defCol = 'var(--amber)';
      else defCol = 'var(--red)';

      // Label rango
      const fmt = (s) => {
        const [, m, d] = s.split('-');
        return `${parseInt(d,10)}/${parseInt(m,10)}`;
      };
      const label = `${fmt(weekStart)} - ${fmt(weekEnd)}`;
      const isCurrent = weekStart <= todayStr && todayStr <= weekEnd;

      rows.push({
        weekStart, weekEnd, label, daysLogged,
        avgConsumed: avgC, avgSpent: avgS, avgDeficit: avgD,
        lossKg, pesoDelta, defCol, isCurrent,
      });
    }
    rows.sort((a,b) => b.weekStart.localeCompare(a.weekStart));
    return rows.slice(0, 6);
  });

  let pesoMap = $derived.by(() => {
    const map = {};
    for (const p of (perfil?.historial_peso || [])) {
      map[p.fecha] = p.peso_kg;
    }
    return map;
  });

  let histRows = $derived.by(() => {
    if (!perfil) return [];
    const me = perfil.metabolismo;
    const ob = perfil.objetivos_diarios;
    return histVentanas.map(v => {
      const t       = v.totales_ventana || {};
      const kcal    = t.kcal || 0;
      const isGym   = sessions.some(s => s.date === v.ventana_id);
      const tdee    = isGym ? me.gasto_total_gym_kcal : me.gasto_total_descanso_kcal;
      const deficit = Math.round(tdee - kcal);
      const pct     = Math.round((kcal / maxKcal) * 100);
      const barCol  = kcal <= ob.kcal_objetivo_promedio ? 'var(--green)' : 'var(--amber)';
      const defSign = deficit >= 0 ? '-' : '+';
      const defCol  = deficit >= 0 ? 'var(--green)' : 'var(--red)';
      const peso    = pesoMap[v.ventana_id] ?? null;
      return { date: v.ventana_id, kcal, pct, barCol, deficit, defSign, defCol, isGym, peso };
    });
  });

  let pesoHistory = $derived.by(() => {
    if (!perfil?.historial_peso?.length) return [];
    const sorted = [...perfil.historial_peso].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted.map((p, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      const delta = prev ? +(p.peso_kg - prev.peso_kg).toFixed(1) : null;
      const dias  = prev ? Math.round((new Date(p.fecha) - new Date(prev.fecha)) / 86400000) : null;
      return { ...p, delta, dias };
    });
  });

  // SVG chart data for peso evolution
  let pesoChartPoints = $derived.by(() => {
    if (pesoHistory.length < 2) return null;
    const W = 400, H = 120, PX = 30, PY = 16;
    const vals = pesoHistory.map(p => p.peso_kg);
    const mn = Math.min(...vals) - 0.5, mx = Math.max(...vals) + 0.5;
    const range = mx - mn || 1;
    const pts = pesoHistory.map((p, i) => {
      const x = PX + (i / (pesoHistory.length - 1)) * (W - PX * 2);
      const y = PY + (1 - (p.peso_kg - mn) / range) * (H - PY * 2);
      return { x, y, label: p.peso_kg, date: p.fecha.slice(5) };
    });
    return { pts, W, H, mn, mx };
  });

  // ── Micronutrient analysis ────────────────────────────────────
  const MICRO_RDA = {
    fibra_g:      { rda: 38,   max: null, label: 'Fibra',      unit: 'g',   icon: '🌾' },
    sodio_mg:     { rda: null, max: 2300, label: 'Sodio',      unit: 'mg',  icon: '🧂' },
    potasio_mg:   { rda: 3400, max: null, label: 'Potasio',    unit: 'mg',  icon: '⚡' },
    hierro_mg:    { rda: 8,    max: null, label: 'Hierro',     unit: 'mg',  icon: '🩸' },
    calcio_mg:    { rda: 1000, max: null, label: 'Calcio',     unit: 'mg',  icon: '🦴' },
    magnesio_mg:  { rda: 420,  max: null, label: 'Magnesio',   unit: 'mg',  icon: '💜' },
    zinc_mg:      { rda: 11,   max: null, label: 'Zinc',       unit: 'mg',  icon: '🛡️' },
    vit_b12_mcg:  { rda: 2.4,  max: null, label: 'Vit B12',   unit: 'mcg', icon: '⚡' },
    vit_d_mcg:    { rda: 15,   max: null, label: 'Vit D',      unit: 'mcg', icon: '☀️' },
    vit_a_mcg:    { rda: 900,  max: null, label: 'Vit A',      unit: 'mcg', icon: '👁️' },
    vit_c_mg:     { rda: 90,   max: null, label: 'Vit C',      unit: 'mg',  icon: '🍊' },
    colesterol_mg:{ rda: null, max: 300,  label: 'Colesterol', unit: 'mg',  icon: '🫀' },
    omega3_g:     { rda: 1.6,  max: null, label: 'Omega-3',    unit: 'g',   icon: '🐟' },
    omega6_g:     { rda: 17,   max: null, label: 'Omega-6',    unit: 'g',   icon: '🌻' },
    vit_b6_mg:    { rda: 1.3,  max: null, label: 'Vit B6',     unit: 'mg',  icon: '🔬' },
    folato_mcg:   { rda: 400,  max: null, label: 'Folato',     unit: 'mcg', icon: '🧬' },
    vit_e_mg:     { rda: 15,   max: null, label: 'Vit E',      unit: 'mg',  icon: '🌿' },
    selenio_mcg:  { rda: 55,   max: null, label: 'Selenio',    unit: 'mcg', icon: '⚙️' },
    yodo_mcg:     { rda: 150,  max: null, label: 'Yodo',       unit: 'mcg', icon: '🫧' },
  };

  const MICRO_CATS_DEF = [
    { label: '🌾 Digestión',        keys: ['fibra_g'] },
    { label: '⚡ Electrolitos',      keys: ['potasio_mg', 'sodio_mg'] },
    { label: '🧲 Minerales',         keys: ['calcio_mg', 'magnesio_mg', 'hierro_mg', 'zinc_mg', 'selenio_mcg', 'yodo_mcg'] },
    { label: '💊 Vitaminas',         keys: ['vit_c_mg', 'vit_d_mcg', 'vit_e_mg', 'vit_a_mcg', 'vit_b12_mcg', 'vit_b6_mg', 'folato_mcg'] },
    { label: '🐟 Grasas especiales', keys: ['omega3_g', 'omega6_g', 'colesterol_mg'] },
  ];

  const MICRO_KEYS_ALL = Object.keys(MICRO_RDA);

  function normM(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function findRefM(a, refs) {
    if (!refs.length) return null;
    if (a.ref_id) return refs.find(r => r.id === a.ref_id) ?? null;
    const n = normM(a.nombre);
    return refs.find(r => r.nombres?.some(rn => {
      const rn2 = normM(rn);
      return n === rn2 || n.includes(rn2) || (rn2.length > n.length && rn2.includes(n));
    })) ?? null;
  }
  function microSt(key, avg) {
    const m = MICRO_RDA[key];
    if (m.rda) {
      const pct = avg / m.rda * 100;
      if (pct < 50)  return { pct, cls: 'deficit', barColor: '#f87171', bar: pct };
      if (pct < 80)  return { pct, cls: 'bajo',    barColor: '#fbbf24', bar: pct };
      if (pct < 150) return { pct, cls: 'ok',      barColor: '#4ade80', bar: Math.min(pct, 100) };
      return             { pct, cls: 'exceso',   barColor: '#60a5fa', bar: 100 };
    }
    if (m.max) {
      const pct = avg / m.max * 100;
      if (pct < 70)  return { pct, cls: 'ok',      barColor: '#4ade80', bar: pct };
      if (pct < 100) return { pct, cls: 'atención', barColor: '#fbbf24', bar: pct };
      return             { pct, cls: 'exceso',   barColor: '#f87171', bar: 100 };
    }
    return { pct: 0, cls: 'nd', barColor: '#475569', bar: 0 };
  }

  let microAnalysis = $derived.by(() => {
    if (!alimentosRef.length || !ventanas.length) return null;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;
    const relevant = ventanas.filter(v => v.ventana_id >= cutoffStr && v.ventana_id <= todayStr);
    if (!relevant.length) return null;

    const totals = {};
    MICRO_KEYS_ALL.forEach(k => totals[k] = 0);
    for (const v of relevant) {
      for (const c of (v.comidas || [])) {
        for (const a of (c.alimentos || [])) {
          const ref = findRefM(a, alimentosRef);
          if (!ref) continue;
          const grams = a.cantidad_g ?? a.cantidad_g_aprox ?? a.carne_neta_estimada_g
            ?? (a.unidades ? a.unidades * 100 : null)
            ?? a.cantidad_ml ?? a.cantidad_ml_aprox ?? 0;
          if (!grams) continue;
          const factor = grams / 100;
          for (const k of MICRO_KEYS_ALL) totals[k] += (ref.por_100g[k] ?? 0) * factor;
        }
      }
    }
    const days = relevant.length;
    const avgs = {}, statuses = {};
    for (const k of MICRO_KEYS_ALL) {
      avgs[k] = totals[k] / days;
      statuses[k] = microSt(k, avgs[k]);
    }
    // Nutrients with rda that are under 80%
    const alerts = MICRO_KEYS_ALL
      .filter(k => MICRO_RDA[k].rda && (statuses[k].cls === 'deficit' || statuses[k].cls === 'bajo'))
      .sort((a, b) => statuses[a].pct - statuses[b].pct);
    return { avgs, statuses, days, alerts };
  });

  // SVG chart data for deficit bars
  let deficitChart = $derived.by(() => {
    if (!histRows.length) return null;
    const rows = [...histRows].reverse();
    const W = 400, H = 100, PX = 10, PY = 10;
    const vals = rows.map(r => r.deficit);
    const absMax = Math.max(...vals.map(Math.abs), 100);
    const barW = Math.min(28, (W - PX * 2) / rows.length - 2);
    const mid = H / 2;
    const bars = rows.map((r, i) => {
      const x = PX + i * ((W - PX * 2) / rows.length) + ((W - PX * 2) / rows.length - barW) / 2;
      const h = Math.abs(r.deficit) / absMax * (H / 2 - PY);
      const y = r.deficit >= 0 ? mid - h : mid;
      return { x, y, w: barW, h, color: r.deficit >= 0 ? 'var(--green)' : 'var(--red)', val: r.deficit, date: r.date.slice(5) };
    });
    return { bars, W, H, mid };
  });
</script>

{#if !perfil}
  <div class="empty">
    <p>Sin perfil configurado</p>
    <p class="empty-hint">Configurá tu perfil en <code>data/perfil.json</code></p>
  </div>
{:else}
  {@const ob = perfil.objetivos_diarios}
  {@const me = perfil.metabolismo}

  <h1>Perfil</h1>
  <p class="page-sub">{perfil.nombre ?? 'Lean'} · {perfil.edad}{perfil.sexo ? perfil.sexo[0].toUpperCase() : ''} · {perfil.altura_cm}cm · Buenos Aires · {perfil.protocolo}</p>

  <!-- HERO STATS -->
  <div class="stat-grid four">
    <div class="stat-item">
      {#if pesoActual}
        <div class="num num-hero c-accent">{pesoActual.peso_kg}<span class="unit">kg</span></div>
        <div class="label">Peso actual</div>
        <div class="sub-label">
          {fmtDate(pesoActual.fecha)}
          {#if pesoDelta !== null}
            · <span class={+pesoDelta <= 0 ? 'c-good' : 'c-bad'}>{+pesoDelta > 0 ? '+' : '−'}{Math.abs(+pesoDelta)}kg</span>
          {/if}
        </div>
      {:else}
        <div class="num num-hero">—</div>
        <div class="label">Sin registros</div>
      {/if}
    </div>

    <div class="stat-item">
      <div class="num num-hero c-kcal">{avgKcal || '—'}<span class="unit">kcal</span></div>
      <div class="label">Consumo prom 7d</div>
      <div class="sub-label">Target {ob.kcal_objetivo_promedio}</div>
    </div>

    <div class="stat-item">
      <div class="num num-hero" class:c-good={avgDeficit >= ob.deficit_target_kcal * 0.8} class:c-warn={avgDeficit >= 0 && avgDeficit < ob.deficit_target_kcal * 0.8} class:c-bad={avgDeficit < 0}>
        {avgDeficit >= 0 ? '−' : '+'}{Math.abs(avgDeficit)}<span class="unit">kcal</span>
      </div>
      <div class="label">Déficit prom 7d</div>
      <div class="sub-label">Target −{ob.deficit_target_kcal} · {rolling7?.days ?? 0}/7 d</div>
    </div>

    <div class="stat-item">
      <div class="num num-hero c-accent">{thisMonth}</div>
      <div class="label">Sesiones este mes</div>
      <div class="sub-label">
        {#if streak > 0}Racha {streak}d{:else}Sin racha{/if}
        {#if favGroup} · Top {favGroup}{/if}
      </div>
    </div>
  </div>

  <!-- DATOS FÍSICOS + OBJETIVOS -->
  <h2 class="section">Datos y objetivos</h2>
  <div class="two-col">
    <div class="field-list">
      <div class="field-row"><span>Altura</span><span class="num">{perfil.altura_cm} cm</span></div>
      <div class="field-row"><span>Edad</span><span class="num">{perfil.edad} años</span></div>
      <div class="field-row"><span>Protocolo</span><span class="c-accent">{perfil.protocolo}</span></div>
      <div class="field-row"><span>Metabolismo basal</span><span class="num">{me.metabolismo_basal_kcal} <em>kcal</em></span></div>
      <div class="field-row"><span>Gasto día gym</span><span class="num">{me.gasto_total_gym_kcal} <em>kcal</em></span></div>
      <div class="field-row"><span>Gasto día sin gym</span><span class="num">{me.gasto_total_descanso_kcal} <em>kcal</em></span></div>
    </div>
    <div class="field-list">
      <div class="field-row"><span>Target promedio</span><span class="num c-kcal">{ob.kcal_objetivo_promedio} <em>kcal</em></span></div>
      <div class="field-row"><span>Día gym / descanso</span><span class="num">{ob.kcal_dia_gym} / {ob.kcal_dia_descanso}</span></div>
      <div class="field-row"><span>Déficit objetivo</span><span class="num c-good">−{ob.deficit_target_kcal} <em>kcal/día</em></span></div>
      <div class="field-row"><span>Proteína mín / ideal</span><span class="num c-prot">{ob.proteina_g_min} / {ob.proteina_g_ideal} <em>g</em></span></div>
      <div class="field-row"><span>Carbos tope</span><span class="num c-carb">{ob.carbos_g_max} <em>g</em></span></div>
      <div class="field-row"><span>Objetivo</span><span>bajar peso preservando músculo</span></div>
    </div>
  </div>

  <!-- RESUMEN SEMANAL -->
  {#if weeklyRows.length}
    <h2 class="section">Resumen semanal</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Semana</th>
            <th class="r">Días</th>
            <th class="r">Consumo</th>
            <th class="r">Gasto</th>
            <th class="r">Déficit</th>
            <th class="r">Kg (proy)</th>
            <th class="r">Kg (real)</th>
          </tr>
        </thead>
        <tbody>
          {#each weeklyRows as w}
            <tr class:current={w.isCurrent}>
              <td>
                {w.label}{#if w.isCurrent} <span class="chip">actual</span>{/if}
              </td>
              <td class="r num">{w.daysLogged}/7</td>
              <td class="r num c-kcal">{w.avgConsumed}</td>
              <td class="r num">{w.avgSpent}</td>
              <td class="r num" style="color:{w.defCol}">{w.avgDeficit >= 0 ? '−' : '+'}{Math.abs(w.avgDeficit)}</td>
              <td class="r num" style="color:{w.defCol}">{w.lossKg > 0 ? '−' : w.lossKg < 0 ? '+' : ''}{Math.abs(w.lossKg)}kg</td>
              <td class="r num">
                {#if w.pesoDelta !== null}
                  <span class={w.pesoDelta <= 0 ? 'c-good' : 'c-bad'}>{w.pesoDelta > 0 ? '+' : '−'}{Math.abs(w.pesoDelta)}kg</span>
                {:else}
                  <span class="c-dim">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="caption">Promedios diarios por semana · kg proy = déficit / 7700 · kg real = delta entre último peso registrado de la semana vs el anterior</p>
  {/if}

  <!-- BALANCE DIARIO CHART -->
  {#if deficitChart}
    <h2 class="section">Balance calórico diario</h2>
    <div class="chart-box">
      <svg viewBox="0 0 {deficitChart.W} {deficitChart.H}" class="chart-svg">
        <line x1="0" y1={deficitChart.mid} x2={deficitChart.W} y2={deficitChart.mid} stroke="var(--b1)" stroke-width="1" stroke-dasharray="3,3" />
        {#each deficitChart.bars as bar}
          <rect x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 1)} fill={bar.color} opacity="0.85" />
          <text x={bar.x + bar.w / 2} y={deficitChart.H - 1} text-anchor="middle" class="chart-label">{bar.date}</text>
        {/each}
        <text x="2" y={deficitChart.mid - 4} class="chart-axis">déficit</text>
        <text x="2" y={deficitChart.mid + 11} class="chart-axis">exceso</text>
      </svg>
    </div>
  {/if}

  <!-- HISTORIAL VENTANAS -->
  <h2 class="section">Historial día a día</h2>
  {#if histRows.length === 0}
    <p class="empty-inline">Sin datos</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th class="r">Peso</th>
            <th class="r">Kcal</th>
            <th style="width:38%">Barra vs target</th>
            <th class="r">Δ Kcal</th>
          </tr>
        </thead>
        <tbody>
          {#each histRows as row}
            <tr>
              <td>{fmtDate(row.date)}</td>
              <td>{#if row.isGym}<span class="chip carb">gym</span>{/if}</td>
              <td class="r num">{row.peso ? row.peso + 'kg' : '—'}</td>
              <td class="r num c-kcal">{row.kcal}</td>
              <td>
                <div class="bar-wrap">
                  <div class="bar-track"><div class="bar-fill" style="width:{row.pct}%;background:{row.barCol}"></div></div>
                  <span class="num bar-pct">{row.pct}%</span>
                </div>
              </td>
              <td class="r num" style="color:{row.defCol}">{row.defSign}{Math.abs(row.deficit)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="caption">Verde = dentro de target {ob.kcal_objetivo_promedio} kcal · Ámbar = por encima · Δ Kcal = cuánto menos (−) o más (+) comiste vs gastaste</p>
  {/if}

  <!-- EVOLUCIÓN DE PESO -->
  {#if pesoChartPoints}
    <h2 class="section">Evolución de peso</h2>
    <div class="chart-box">
      <div class="chart-hdr">
        <span class="chart-title">Últimos registros</span>
        <span class="num c-dim">min {pesoChartPoints.mn.toFixed(1)} · max {pesoChartPoints.mx.toFixed(1)}</span>
      </div>
      <svg viewBox="0 0 {pesoChartPoints.W} {pesoChartPoints.H}" class="chart-svg">
        <polyline
          points={pesoChartPoints.pts.map(p => p.x + ',' + p.y).join(' ')}
          fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"
        />
        {#each pesoChartPoints.pts as p}
          <circle cx={p.x} cy={p.y} r="2.5" fill="var(--accent)" />
          <text x={p.x} y={p.y - 8} text-anchor="middle" class="chart-val">{p.label}</text>
          <text x={p.x} y={pesoChartPoints.H - 2} text-anchor="middle" class="chart-label">{p.date}</text>
        {/each}
      </svg>
    </div>
  {/if}

  <!-- REGISTRO DE PESOS -->
  <h2 class="section">Registro de pesos</h2>
  {#if pesoHistory.length === 0}
    <p class="empty-inline">Sin registros</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th class="r">Peso</th>
            <th class="r">Δ</th>
            <th class="r">Días</th>
          </tr>
        </thead>
        <tbody>
          {#each [...pesoHistory].reverse() as entry}
            <tr>
              <td>{fmtDate(entry.fecha)}</td>
              <td class="r num c-accent">{entry.peso_kg}</td>
              <td class="r num">
                {#if entry.delta !== null}
                  <span class={entry.delta <= 0 ? 'c-good' : 'c-bad'}>{entry.delta > 0 ? '+' : '−'}{Math.abs(entry.delta)}</span>
                {:else}
                  <span class="c-dim">inicio</span>
                {/if}
              </td>
              <td class="r num">{entry.dias !== null ? entry.dias + 'd' : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if pesoHistory.length >= 2}
      {@const first = pesoHistory[0]}
      {@const last = pesoHistory[pesoHistory.length - 1]}
      {@const totalDelta = +(last.peso_kg - first.peso_kg).toFixed(1)}
      {@const totalDias = Math.round((new Date(last.fecha) - new Date(first.fecha)) / 86400000)}
      <p class="caption">
        Total: <strong class={totalDelta <= 0 ? 'c-good' : 'c-bad'}>{totalDelta > 0 ? '+' : '−'}{Math.abs(totalDelta)} kg</strong> en {totalDias} días
      </p>
    {/if}
  {/if}

  <!-- MICRONUTRIENTES -->
  {#if microAnalysis}
    {@const needWork  = MICRO_KEYS_ALL.filter(k => ['deficit','bajo'].includes(microAnalysis.statuses[k].cls)).sort((a,b) => microAnalysis.statuses[a].pct - microAnalysis.statuses[b].pct)}
    {@const overLimit = MICRO_KEYS_ALL.filter(k => microAnalysis.statuses[k].cls === 'exceso' && MICRO_RDA[k].max)}
    {@const wellCov   = MICRO_KEYS_ALL.filter(k => microAnalysis.statuses[k].cls === 'exceso' && MICRO_RDA[k].rda)}
    {@const inRange   = MICRO_KEYS_ALL.filter(k => ['ok','atención'].includes(microAnalysis.statuses[k].cls))}

    <h2 class="section">Micronutrientes — prom {microAnalysis.days}d</h2>

    {#if needWork.length}
      <div class="micro-sublabel c-warn">Por mejorar</div>
      <div class="micro-grid">
        {#each needWork as k}
          {@const m = MICRO_RDA[k]}
          {@const avg = microAnalysis.avgs[k]}
          {@const st = microAnalysis.statuses[k]}
          {@const pct = Math.round(st.pct)}
          {@const fmtVal = avg < 10 ? avg.toFixed(1) : Math.round(avg)}
          <div class="micro-item">
            <div class="micro-top">
              <span class="micro-name">{m.label}</span>
              <span class="micro-pct num" style="color:{st.barColor}">{pct}%</span>
            </div>
            <div class="micro-val num">{fmtVal} / {m.rda} {m.unit}</div>
            <div class="bar-track"><div class="bar-fill" style="width:{pct}%;background:{st.barColor}"></div></div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="micro-ok">✓ Todos dentro de rango</p>
    {/if}

    {#if overLimit.length}
      <div class="micro-sublabel c-bad">Sobre límite</div>
      <div class="micro-grid">
        {#each overLimit as k}
          {@const m = MICRO_RDA[k]}
          {@const avg = microAnalysis.avgs[k]}
          {@const st = microAnalysis.statuses[k]}
          {@const fmtVal = avg < 10 ? avg.toFixed(1) : Math.round(avg)}
          {@const excess = Math.round(st.pct - 100)}
          <div class="micro-item">
            <div class="micro-top">
              <span class="micro-name">{m.label}</span>
              <span class="micro-pct num c-bad">+{excess}%</span>
            </div>
            <div class="micro-val num">{fmtVal} · máx {m.max} {m.unit}</div>
            <div class="bar-track"><div class="bar-fill" style="width:100%;background:var(--bad)"></div></div>
          </div>
        {/each}
      </div>
    {/if}

    {#if inRange.length || wellCov.length}
      <div class="micro-sublabel c-good">En rango</div>
      <div class="micro-grid">
        {#each inRange as k}
          {@const m = MICRO_RDA[k]}
          {@const st = microAnalysis.statuses[k]}
          {@const pct = Math.round(st.pct)}
          <div class="micro-item compact">
            <div class="micro-top">
              <span class="micro-name">{m.label}</span>
              <span class="micro-pct num" style="color:{st.barColor}">{pct}%</span>
            </div>
          </div>
        {/each}
        {#each wellCov as k}
          {@const m = MICRO_RDA[k]}
          {@const st = microAnalysis.statuses[k]}
          {@const pct = Math.round(st.pct)}
          <div class="micro-item compact covered">
            <div class="micro-top">
              <span class="micro-name">{m.label}</span>
              <span class="micro-pct num c-carb">{pct}%</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <p class="caption">Ref: RDA hombre adulto · solo alimentos con datos disponibles</p>
  {/if}
{/if}

<style>
  h1 {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    margin-bottom: 0.15rem;
  }
  .page-sub {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--dim);
    margin-bottom: 2rem;
    letter-spacing: 0.02em;
  }

  /* Stat hero grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .stat-item {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 8px;
    padding: 1rem 0.9rem;
    text-align: center;
  }
  .num-hero {
    font-family: var(--font-display);
    font-size: 1.85rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .num-hero .unit {
    font-family: var(--font-mono);
    font-size: 0.55em;
    font-weight: 400;
    color: var(--muted);
    margin-left: 0.2em;
    letter-spacing: 0;
  }
  .stat-item .label {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 0.45rem;
  }
  .stat-item .sub-label {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--dim);
    margin-top: 0.25rem;
    letter-spacing: 0.02em;
  }

  /* Field rows en two-col */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem 3rem;
  }
  .field-list { display: flex; flex-direction: column; }
  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--b1);
    font-size: 0.88rem;
  }
  .field-row:last-child { border-bottom: none; }
  .field-row > span:first-child {
    color: var(--muted);
    font-family: var(--font-body);
  }
  .field-row > span:last-child {
    color: var(--text);
    font-weight: 500;
  }
  .field-row em {
    font-style: normal;
    color: var(--dim);
    font-size: 0.82em;
    margin-left: 0.15em;
  }

  /* Table */
  .table-wrap { overflow-x: auto; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
  }
  th {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 2px solid var(--b1);
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  th.r, td.r { text-align: right; }
  td {
    padding: 0.55rem 0.6rem;
    border-bottom: 1px solid var(--b1);
    vertical-align: middle;
  }
  tr:hover td { background: var(--s1); }
  tr.current td { background: rgba(188, 140, 255, 0.06); }

  /* Chip */
  .chip {
    display: inline-block;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    background: rgba(188, 140, 255, 0.14);
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .chip.carb { background: rgba(88, 166, 255, 0.14); color: var(--carb); }

  /* Bar inline (tabla) */
  .bar-wrap { display: flex; align-items: center; gap: 0.5rem; }
  .bar-track {
    flex: 1;
    height: 5px;
    background: var(--bg);
    border: 1px solid var(--b1);
    border-radius: 2px;
    overflow: hidden;
    min-width: 70px;
  }
  .bar-fill { height: 100%; transition: width 0.2s; }
  .bar-pct {
    font-size: 0.7rem;
    color: var(--muted);
    min-width: 36px;
    text-align: right;
  }

  /* Chart box */
  .chart-box {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 8px;
    padding: 1rem;
  }
  .chart-hdr {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .chart-title {
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .chart-svg { width: 100%; height: auto; display: block; }
  .chart-svg :global(.chart-label) {
    font-size: 8px;
    fill: var(--dim);
    font-family: var(--font-mono);
  }
  .chart-svg :global(.chart-val) {
    font-size: 9px;
    fill: var(--text);
    font-family: var(--font-mono);
    font-weight: 500;
  }
  .chart-svg :global(.chart-axis) {
    font-size: 7px;
    fill: var(--dim);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Color classes */
  .c-kcal   { color: var(--kcal); }
  .c-prot   { color: var(--prot); }
  .c-fat    { color: var(--fat); }
  .c-carb   { color: var(--carb); }
  .c-good   { color: var(--good); }
  .c-warn   { color: var(--warn); }
  .c-bad    { color: var(--bad); }
  .c-accent { color: var(--accent); }
  .c-dim    { color: var(--dim); }

  /* Caption / footnote */
  .caption {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--dim);
    margin-top: 0.5rem;
    line-height: 1.5;
    letter-spacing: 0.01em;
  }

  /* Micros */
  .micro-sublabel {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 1.5rem 0 0.6rem;
  }
  .micro-sublabel:first-of-type { margin-top: 0; }
  .micro-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.5rem;
  }
  .micro-item {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 6px;
    padding: 0.6rem 0.7rem;
  }
  .micro-item.compact { padding: 0.45rem 0.6rem; }
  .micro-item.covered { opacity: 0.65; }
  .micro-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.3rem;
  }
  .micro-item.compact .micro-top { margin-bottom: 0; }
  .micro-name {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text);
  }
  .micro-pct {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .micro-val {
    font-size: 0.7rem;
    color: var(--dim);
    margin-bottom: 0.35rem;
    letter-spacing: 0.01em;
  }
  .micro-ok {
    color: var(--good);
    font-size: 0.85rem;
    margin: 0.5rem 0;
  }

  /* Empty */
  .empty {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--dim);
  }
  .empty-hint { font-size: 0.82rem; margin-top: 0.4rem; }
  .empty-hint code {
    background: var(--s1);
    border: 1px solid var(--b1);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .empty-inline { color: var(--dim); font-size: 0.85rem; padding: 0.8rem 0; }

  @media (max-width: 768px) {
    h1 { font-size: 1.6rem; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
    .two-col { grid-template-columns: 1fr; gap: 1.5rem; }
    .num-hero { font-size: 1.5rem; }
    table { font-size: 0.78rem; }
    th, td { padding: 0.4rem 0.4rem; }
  }
</style>
