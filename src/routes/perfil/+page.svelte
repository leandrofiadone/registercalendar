<script>
  import { fmtDate, localDateStr } from '$lib/utils.js';
  import { gymKcalDetallado, actividadKcal } from '$lib/activity.js';

  let { data } = $props();
  let sessions = $derived(data.sessions);
  let ventanas = $derived(data.ventanas);
  let perfil   = $derived(data.perfil);

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
        actKcal += det.fuerza + det.cardio.reduce((sum, c) => sum + c.kcal, 0);
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
