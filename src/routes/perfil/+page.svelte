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

<div class="perfil-layout">
  {#if !perfil}
    <div class="empty-state">
      <div class="ei">👤</div>
      <p>Sin perfil configurado</p>
      <p class="es-hint">Configurá tu perfil en <code>data/perfil.json</code></p>
    </div>
  {:else}
    {@const ob = perfil.objetivos_diarios}
    {@const me = perfil.metabolismo}

    <!-- Resumen de actividad -->
    <div class="activity-summary">
      <div class="as-chip">Sesiones <span class="as-val">{sessions.length}</span></div>
      <div class="as-chip">Este mes <span class="as-val">{thisMonth}</span></div>
      {#if streak > 0}
        <div class="as-chip">Racha <span class="as-val">{streak}d</span></div>
      {/if}
      {#if favGroup}
        <div class="as-chip">Top <span class="as-val">{favGroup}</span></div>
      {/if}
      {#if totalKcal > 0}
        <div class="as-chip">kcal total <span class="as-val">{Math.round(totalKcal).toLocaleString()}</span></div>
      {/if}
    </div>

    <div class="perfil-grid">
      <!-- Peso -->
      <div class="pcard">
        <div class="pcard-title">Peso</div>
        {#if pesoActual}
          <div class="peso-big">{pesoActual.peso_kg}<span class="peso-unit">kg</span></div>
          <div class="peso-sub">Registrado el {fmtDate(pesoActual.fecha)}</div>
          {#if pesoDelta !== null}
            <div class="peso-sub" style="margin-top:4px;color:{+pesoDelta <= 0 ? 'var(--green)' : 'var(--red)'}">
              {+pesoDelta > 0 ? '+' : ''}{pesoDelta} kg desde el registro anterior
            </div>
          {/if}
          <div class="peso-goal">Objetivo: <strong>bajar peso</strong> preservando músculo</div>
        {:else}
          <p style="color:var(--dim);font-size:12px">Sin registros</p>
        {/if}
      </div>

      <!-- Datos físicos -->
      <div class="pcard">
        <div class="pcard-title">Datos físicos</div>
        <div class="pstat-row"><span class="pstat-lbl">Altura</span><span class="pstat-val">{perfil.altura_cm} cm</span></div>
        <div class="pstat-row"><span class="pstat-lbl">Edad</span><span class="pstat-val">{perfil.edad} años</span></div>
        <div class="pstat-row"><span class="pstat-lbl">Protocolo</span><span class="pstat-val hi">{perfil.protocolo}</span></div>
        <div class="pstat-row">
          <span class="pstat-lbl">Metabolismo en reposo</span>
          <span class="pstat-val">{me.metabolismo_basal_kcal} kcal</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Gasto real día de gym</span>
          <span class="pstat-val">{me.gasto_total_gym_kcal} kcal</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Gasto real día sin gym</span>
          <span class="pstat-val">{me.gasto_total_descanso_kcal} kcal</span>
        </div>
      </div>

      <!-- Qué comer por día -->
      <div class="pcard">
        <div class="pcard-title">Qué comer por día</div>
        <div class="pstat-row">
          <span class="pstat-lbl">Target promedio diario</span>
          <span class="pstat-val amber">{ob.kcal_objetivo_promedio} kcal</span>
        </div>
        <div class="pstat-row" style="font-size:10px;color:var(--dim);padding-bottom:8px">
          <span>(día de gym: {ob.kcal_dia_gym} · día sin gym: {ob.kcal_dia_descanso})</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Comer menos que el gasto</span>
          <span class="pstat-val green">−{ob.deficit_target_kcal} kcal/día</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Proteína mínima</span>
          <span class="pstat-val">{ob.proteina_g_min}g</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Proteína ideal</span>
          <span class="pstat-val hi">{ob.proteina_g_ideal}g</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Carbohidratos (tope orientativo)</span>
          <span class="pstat-val">{ob.carbos_g_max}g</span>
        </div>
      </div>

      <!-- Tendencia últimos 7 días -->
      <div class="pcard">
        <div class="pcard-title">Tendencia · últimos 7 días</div>
        {#if rolling7}
          <div class="pstat-row">
            <span class="pstat-lbl">Días con registro</span>
            <span class="pstat-val">{rolling7.days} de 7</span>
          </div>
          <div class="pstat-row">
            <span class="pstat-lbl">Consumo promedio</span>
            <span class="pstat-val" class:green={avgKcal <= ob.kcal_objetivo_promedio} class:amber={avgKcal > ob.kcal_objetivo_promedio}>
              {avgKcal} kcal/día
            </span>
          </div>
          <div class="pstat-row">
            <span class="pstat-lbl">Gasto promedio</span>
            <span class="pstat-val">{rolling7.avgSpent} kcal/día</span>
          </div>
          <div class="pstat-row">
            <span class="pstat-lbl">Déficit promedio</span>
            <span class="pstat-val" style="color:{avgDeficit >= 0 ? 'var(--green)' : 'var(--red)'}">
              {avgDeficit >= 0 ? '-' : '+'}{Math.abs(avgDeficit)} kcal/día
            </span>
          </div>
          <div class="pstat-row">
            <span class="pstat-lbl">Pérdida estimada semanal</span>
            <span class="pstat-val" style="color:{avgDeficit >= 0 ? 'var(--green)' : 'var(--red)'}">
              ~{(avgDeficit * 7 / 7700).toFixed(2)} kg
            </span>
          </div>
          <div class="pstat-row" style="font-size:10px;color:var(--dim);border:none;padding-top:8px">
            Target déficit: -{ob.deficit_target_kcal} kcal/día · El gasto incluye actividad real (gym + cardio)
          </div>
        {:else}
          <p style="color:var(--dim);font-size:12px">Sin datos en los últimos 7 días</p>
        {/if}
      </div>
    </div>

    <!-- Resumen semanal -->
    {#if weeklyRows.length}
      <div class="pcard">
        <div class="pcard-title">Resumen semanal · últimas {weeklyRows.length} semanas</div>
        <div class="weekly-head">
          <span class="wh-label">Semana</span>
          <span class="wh-val">días</span>
          <span class="wh-val">kcal</span>
          <span class="wh-val">gasto</span>
          <span class="wh-val">déficit</span>
          <span class="wh-val">pérdida est.</span>
          <span class="wh-val">Δ peso</span>
        </div>
        {#each weeklyRows as w}
          <div class="weekly-row" class:current={w.isCurrent}>
            <span class="wr-label">
              {w.label}{#if w.isCurrent} <span class="wr-tag">actual</span>{/if}
            </span>
            <span class="wr-val">{w.daysLogged}/7</span>
            <span class="wr-val">{w.avgConsumed}</span>
            <span class="wr-val">{w.avgSpent}</span>
            <span class="wr-val" style="color:{w.defCol}">
              {w.avgDeficit >= 0 ? '-' : '+'}{Math.abs(w.avgDeficit)}
            </span>
            <span class="wr-val" style="color:{w.defCol}">
              {w.lossKg > 0 ? '−' : w.lossKg < 0 ? '+' : ''}{Math.abs(w.lossKg)}kg
            </span>
            <span class="wr-val">
              {#if w.pesoDelta !== null}
                <span style="color:{w.pesoDelta <= 0 ? 'var(--green)' : 'var(--red)'}">
                  {w.pesoDelta > 0 ? '+' : ''}{w.pesoDelta}kg
                </span>
              {:else}
                <span style="color:var(--dim)">—</span>
              {/if}
            </span>
          </div>
        {/each}
        <div style="margin-top:10px;font-size:10px;color:var(--dim);line-height:1.6">
          Valores promedio diarios por semana · <strong>pérdida est.</strong> = déficit acumulado / 7700 kcal · <strong>Δ peso</strong> = diferencia entre el último peso registrado al cierre vs al inicio de la semana
        </div>
      </div>
    {/if}

    <!-- Chart: Balance calórico -->
    {#if deficitChart}
      <div class="pcard">
        <div class="pcard-title">Balance calórico diario</div>
        <svg viewBox="0 0 {deficitChart.W} {deficitChart.H}" class="chart-svg">
          <line x1="0" y1={deficitChart.mid} x2={deficitChart.W} y2={deficitChart.mid} stroke="var(--b2)" stroke-width="1" stroke-dasharray="4,3" />
          {#each deficitChart.bars as bar}
            <rect x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 1)} rx="2" fill={bar.color} opacity="0.75" />
            <text x={bar.x + bar.w / 2} y={deficitChart.H - 1} text-anchor="middle" class="chart-label">{bar.date}</text>
          {/each}
          <text x="2" y={deficitChart.mid - 4} class="chart-axis-label">deficit</text>
          <text x="2" y={deficitChart.mid + 11} class="chart-axis-label">exceso</text>
        </svg>
      </div>
    {/if}

    <!-- Historial calórico -->
    <div class="pcard">
      <div class="pcard-title">Historial calórico día a día</div>
      {#if histRows.length === 0}
        <p style="color:var(--dim);font-size:12px">Sin datos</p>
      {:else}
        {#each histRows as row}
          <div class="hist-row">
            <span class="hist-date">
              {fmtDate(row.date)}{#if row.isGym} <span style="font-size:9px;color:var(--accent-l)">gym</span>{/if}{#if row.peso} <span class="hist-peso-badge">{row.peso}kg</span>{/if}
            </span>
            <div class="hist-bar-wrap">
              <div class="hist-bar-fill" style="width:{row.pct}%;background:{row.barCol}"></div>
            </div>
            <span class="hist-kcal">{row.kcal} kcal</span>
            <span class="hist-deficit" style="color:{row.defCol}">{row.defSign}{Math.abs(row.deficit)}</span>
          </div>
        {/each}
      {/if}
      <div style="margin-top:12px;font-size:10px;color:var(--dim);line-height:1.6">
        Verde = dentro del target promedio ({ob.kcal_objetivo_promedio} kcal) · Ámbar = por encima<br>
        El número al final muestra cuánto menos (verde) o más (rojo) comiste vs lo que quemaste ese día
      </div>
    </div>

    <!-- Chart: Evolución de peso -->
    {#if pesoChartPoints}
      <div class="pcard">
        <div class="pcard-title">Evolución de peso</div>
        <svg viewBox="0 0 {pesoChartPoints.W} {pesoChartPoints.H}" class="chart-svg">
          <polyline
            points={pesoChartPoints.pts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"
          />
          {#each pesoChartPoints.pts as p}
            <circle cx={p.x} cy={p.y} r="4" fill="var(--accent)" stroke="var(--s1)" stroke-width="2" />
            <text x={p.x} y={p.y - 10} text-anchor="middle" class="chart-val">{p.label}</text>
            <text x={p.x} y={pesoChartPoints.H - 2} text-anchor="middle" class="chart-label">{p.date}</text>
          {/each}
        </svg>
      </div>
    {/if}

    <!-- Micronutrientes: análisis -->
    {#if microAnalysis}
      {@const needWork  = MICRO_KEYS_ALL.filter(k => ['deficit','bajo'].includes(microAnalysis.statuses[k].cls)).sort((a,b) => microAnalysis.statuses[a].pct - microAnalysis.statuses[b].pct)}
      {@const overLimit = MICRO_KEYS_ALL.filter(k => microAnalysis.statuses[k].cls === 'exceso' && MICRO_RDA[k].max)}
      {@const wellCov   = MICRO_KEYS_ALL.filter(k => microAnalysis.statuses[k].cls === 'exceso' && MICRO_RDA[k].rda)}
      {@const inRange   = MICRO_KEYS_ALL.filter(k => ['ok','atención'].includes(microAnalysis.statuses[k].cls))}
      <div class="pcard">
        <div class="pcard-title">🧬 Micronutrientes · promedio {microAnalysis.days} días</div>

        {#if needWork.length}
          <div class="msection-label warn">⚠ Por mejorar</div>
          <div class="micro-need-grid">
            {#each needWork as k}
              {@const m = MICRO_RDA[k]}
              {@const avg = microAnalysis.avgs[k]}
              {@const st = microAnalysis.statuses[k]}
              {@const pct = Math.round(st.pct)}
              {@const fmtVal = avg < 10 ? avg.toFixed(1) : Math.round(avg)}
              <div class="mneed-card">
                <div class="mneed-top">
                  <span class="mneed-icon">{m.icon}</span>
                  <span class="mneed-pct" style="color:{st.barColor}">{pct}%</span>
                </div>
                <div class="mneed-bar-wrap">
                  <div class="mneed-bar" style="width:{pct}%;background:{st.barColor}"></div>
                </div>
                <div class="mneed-name">{m.label}</div>
                <div class="mneed-val">{fmtVal} / {m.rda}{m.unit}</div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="mok-banner">✓ Todos los nutrientes están dentro del rango recomendado</div>
        {/if}

        {#if overLimit.length}
          <div class="msection-label overlimit">↑ Sobre el límite recomendado</div>
          <div class="micro-need-grid">
            {#each overLimit as k}
              {@const m = MICRO_RDA[k]}
              {@const avg = microAnalysis.avgs[k]}
              {@const st = microAnalysis.statuses[k]}
              {@const fmtVal = avg < 10 ? avg.toFixed(1) : Math.round(avg)}
              {@const excess = Math.round(st.pct - 100)}
              <div class="mneed-card overlimit">
                <div class="mneed-top">
                  <span class="mneed-icon">{m.icon}</span>
                  <span class="mneed-pct" style="color:#f87171">+{excess}%</span>
                </div>
                <div class="mneed-bar-wrap">
                  <div class="mneed-bar" style="width:100%;background:#f87171;opacity:.4"></div>
                  <div class="mneed-bar-over" style="width:{Math.min(excess,100)}%"></div>
                </div>
                <div class="mneed-name">{m.label}</div>
                <div class="mneed-val">{fmtVal} · límite {m.max}{m.unit}</div>
              </div>
            {/each}
          </div>
        {/if}

        {#if inRange.length || wellCov.length}
          <div class="msection-label ok">✓ En rango</div>
          <div class="mchips">
            {#each inRange as k}
              {@const m = MICRO_RDA[k]}
              {@const st = microAnalysis.statuses[k]}
              <div class="mchip">
                <span>{m.icon}</span>
                <span class="mchip-name">{m.label}</span>
                <span class="mchip-pct" style="color:{st.barColor}">{Math.round(st.pct)}%</span>
              </div>
            {/each}
            {#each wellCov as k}
              {@const m = MICRO_RDA[k]}
              <div class="mchip mchip-covered">
                <span>{m.icon}</span>
                <span class="mchip-name">{m.label}</span>
                <span class="mchip-check">✓</span>
              </div>
            {/each}
          </div>
        {/if}

        <div class="micro-disclaimer">Referencia: RDA hombre adulto. Solo alimentos con datos disponibles.</div>
      </div>
    {/if}

    <!-- Registro de pesos -->
    <div class="pcard">
      <div class="pcard-title">Registro de pesos</div>
      {#if pesoHistory.length === 0}
        <p style="color:var(--dim);font-size:12px">Sin registros</p>
      {:else}
        {#each [...pesoHistory].reverse() as entry}
          <div class="peso-row">
            <span class="peso-row-date">{fmtDate(entry.fecha)}</span>
            <span class="peso-row-val">{entry.peso_kg}<span class="peso-row-unit">kg</span></span>
            {#if entry.delta !== null}
              <span class="peso-row-delta" style="color:{entry.delta <= 0 ? 'var(--green)' : 'var(--red)'}">
                {entry.delta > 0 ? '+' : ''}{entry.delta} kg
              </span>
              <span class="peso-row-dias">{entry.dias}d</span>
            {:else}
              <span class="peso-row-delta" style="color:var(--dim)">inicio</span>
              <span class="peso-row-dias"></span>
            {/if}
          </div>
        {/each}
        {#if pesoHistory.length >= 2}
          {@const first = pesoHistory[0]}
          {@const last = pesoHistory[pesoHistory.length - 1]}
          {@const totalDelta = +(last.peso_kg - first.peso_kg).toFixed(1)}
          {@const totalDias = Math.round((new Date(last.fecha) - new Date(first.fecha)) / 86400000)}
          <div class="peso-total">
            Total: <strong style="color:{totalDelta <= 0 ? 'var(--green)' : 'var(--red)'}">{totalDelta > 0 ? '+' : ''}{totalDelta} kg</strong> en {totalDias} días
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .perfil-layout {
    flex: 1; overflow-y: auto; padding: 28px 32px;
    display: flex; flex-direction: column; gap: 22px;
  }

  .activity-summary {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .as-chip {
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 8px; padding: 8px 14px;
    font-size: 12px; color: var(--muted);
    display: flex; align-items: center; gap: 6px;
  }
  .as-val { color: var(--text); font-weight: 700; font-size: 16px; }

  .perfil-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;
  }

  .pcard {
    background: var(--s1); border: 1px solid var(--b1);
    border-radius: 10px; padding: 18px 20px;
  }
  .pcard-title {
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--dim); margin-bottom: 14px;
    display: flex; align-items: center; gap: 8px;
  }
  .pcard-title::after { content: ''; flex: 1; height: 1px; background: var(--b1); }

  .pstat-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 5px 0; border-bottom: 1px solid var(--b1);
    font-size: 12px;
  }
  .pstat-row:last-child { border-bottom: none; }
  .pstat-lbl { color: var(--muted); }
  .pstat-val { font-weight: 600; color: var(--text); }
  .pstat-val.hi    { color: var(--accent-l); }
  .pstat-val.green { color: var(--green); }
  .pstat-val.amber { color: var(--amber); }

  .peso-big {
    font-size: 52px; font-weight: 800; color: #fff;
    line-height: 1; letter-spacing: -0.03em;
  }
  .peso-unit { font-size: 18px; color: var(--muted); margin-left: 4px; }
  .peso-sub  { font-size: 11px; color: var(--dim); margin-top: 6px; }
  .peso-goal {
    margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--b1);
    font-size: 11px; color: var(--muted);
  }
  .peso-goal strong { color: var(--green); }

  .weekly-head, .weekly-row {
    display: grid;
    grid-template-columns: 1.5fr 0.6fr 0.8fr 0.8fr 0.9fr 1fr 0.9fr;
    gap: 6px; align-items: center;
    padding: 7px 0; border-bottom: 1px solid var(--b1);
    font-size: 11px;
  }
  .weekly-head { color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom-color: var(--b2); }
  .weekly-row:last-of-type { border-bottom: none; }
  .weekly-row.current { background: rgba(124,106,245,0.05); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 4px; }
  .wh-label, .wr-label { color: var(--muted); font-weight: 500; }
  .wr-label { color: var(--text); font-size: 11px; }
  .wh-val, .wr-val { text-align: right; font-variant-numeric: tabular-nums; }
  .wr-val { color: var(--text); font-weight: 600; }
  .wr-tag {
    font-size: 8px; color: var(--accent-l); background: rgba(124,106,245,0.12);
    border: 1px solid rgba(124,106,245,0.3); border-radius: 3px;
    padding: 1px 4px; font-weight: 600; margin-left: 4px; text-transform: uppercase;
  }
  @media (max-width: 560px) {
    .weekly-head, .weekly-row {
      grid-template-columns: 1.3fr 0.5fr 0.7fr 0.8fr 0.8fr;
      font-size: 10px;
    }
    .weekly-head :nth-child(4), .weekly-row :nth-child(4),
    .weekly-head :nth-child(6), .weekly-row :nth-child(6) { display: none; }
  }

  .hist-row {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 0; border-bottom: 1px solid var(--b1); font-size: 11px;
  }
  .hist-row:last-of-type { border-bottom: none; }
  .hist-date { color: var(--muted); width: 72px; flex-shrink: 0; }
  .hist-bar-wrap { flex: 1; height: 6px; background: var(--b2); border-radius: 3px; overflow: hidden; }
  .hist-bar-fill { height: 100%; border-radius: 3px; }
  .hist-kcal { width: 54px; text-align: right; color: var(--text); font-weight: 600; }
  .hist-deficit { width: 60px; text-align: right; font-size: 10px; }

  .hist-peso-badge {
    font-size: 8px; color: #c084fc; background: rgba(192,132,252,0.12);
    border: 1px solid rgba(192,132,252,0.2); border-radius: 3px;
    padding: 0 3px; font-weight: 600; margin-left: 2px;
  }

  .peso-row {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 0; border-bottom: 1px solid var(--b1); font-size: 12px;
  }
  .peso-row:last-of-type { border-bottom: none; }
  .peso-row-date { color: var(--muted); width: 80px; flex-shrink: 0; font-size: 11px; }
  .peso-row-val { font-weight: 700; color: var(--text); font-size: 16px; }
  .peso-row-unit { font-size: 11px; color: var(--muted); margin-left: 2px; }
  .peso-row-delta { font-size: 11px; font-weight: 600; margin-left: auto; }
  .peso-row-dias { font-size: 10px; color: var(--dim); width: 28px; text-align: right; }

  .peso-total {
    margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--b1);
    font-size: 11px; color: var(--muted);
  }

  .chart-svg { width: 100%; height: auto; display: block; margin: 4px 0; }
  .chart-svg :global(.chart-label) { font-size: 8px; fill: var(--dim); }
  .chart-svg :global(.chart-val) { font-size: 9px; fill: var(--text); font-weight: 600; }
  .chart-svg :global(.chart-axis-label) { font-size: 7px; fill: var(--dim); }

  /* ── Micronutrient analysis ── */
  /* ── Micronutrient analysis ── */
  .msection-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
    margin: 16px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--b1);
  }
  .msection-label:first-of-type { margin-top: 0; }
  .msection-label.warn     { color: #fbbf24; }
  .msection-label.ok       { color: #4ade80; }
  .msection-label.overlimit { color: #f87171; }

  .mok-banner {
    font-size: 13px; color: #4ade80; margin-bottom: 16px; padding: 10px 14px;
    background: rgba(74,222,128,.07); border: 1px solid rgba(74,222,128,.2); border-radius: 8px;
  }

  .micro-need-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px; margin-bottom: 4px;
  }
  .mneed-card {
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 9px; padding: 12px 12px 10px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .mneed-card.overlimit { border-color: rgba(248,113,113,.25); }
  .mneed-top { display: flex; align-items: center; justify-content: space-between; }
  .mneed-icon { font-size: 16px; }
  .mneed-pct  { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
  .mneed-bar-wrap {
    height: 5px; background: var(--b2); border-radius: 3px;
    overflow: hidden; position: relative;
  }
  .mneed-bar     { height: 100%; border-radius: 3px; }
  .mneed-bar-over {
    position: absolute; top: 0; right: 0; height: 100%;
    background: #f87171; border-radius: 3px;
    animation: pulse-bar 2s infinite;
  }
  @keyframes pulse-bar { 0%,100%{opacity:1} 50%{opacity:.4} }
  .mneed-name { font-size: 12px; color: var(--muted); font-weight: 500; }
  .mneed-val  { font-size: 10px; color: var(--dim); font-variant-numeric: tabular-nums; }

  .mchips {
    display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 4px;
  }
  .mchip {
    display: flex; align-items: center; gap: 6px;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 7px; padding: 6px 11px;
  }
  .mchip-covered { opacity: 0.6; }
  .mchip-name  { color: var(--muted); font-size: 12px; }
  .mchip-pct   { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .mchip-check { font-size: 12px; color: #4ade80; font-weight: 700; }

  .micro-disclaimer {
    margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--b1);
    font-size: 11px; color: var(--dim);
  }

  .empty-state {
    height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px; color: var(--dim);
  }
  .ei { font-size: 36px; opacity: 0.35; }
  .empty-state p { font-size: 13px; }
  .es-hint { font-size: 11px; color: var(--dim); }
  .es-hint code { background: var(--s2); padding: 1px 5px; border-radius: 3px; font-size: 10px; }
</style>
