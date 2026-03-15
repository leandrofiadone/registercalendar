<script>
  import { fmtDate } from '$lib/utils.js';

  let { data } = $props();
  let sessions = $derived(data.sessions);
  let ventanas = $derived(data.ventanas);
  let perfil   = $derived(data.perfil);

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

  let avgKcal = $derived.by(() => {
    if (!histVentanas.length) return 0;
    const total = histVentanas.reduce((s, v) => s + (v.totales_ventana?.kcal || 0), 0);
    return Math.round(total / histVentanas.length);
  });

  let avgDeficit = $derived.by(() => {
    if (!perfil || !histVentanas.length) return 0;
    const me = perfil.metabolismo;
    const total = histVentanas.reduce((s, v) => {
      const isGym = sessions.some(ss => ss.date === v.ventana_id);
      const tdee  = isGym ? me.gasto_total_gym_kcal : me.gasto_total_descanso_kcal;
      return s + (tdee - (v.totales_ventana?.kcal || 0));
    }, 0);
    return Math.round(total / histVentanas.length);
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
</script>

<div class="perfil-layout">
  {#if !perfil}
    <div class="empty-state">
      <div class="ei">👤</div>
      <p>Sin perfil configurado</p>
    </div>
  {:else}
    {@const ob = perfil.objetivos_diarios}
    {@const me = perfil.metabolismo}

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

      <!-- Resumen del período -->
      <div class="pcard">
        <div class="pcard-title">Resumen del período registrado</div>
        <div class="pstat-row">
          <span class="pstat-lbl">Días con registro</span>
          <span class="pstat-val">{histVentanas.length}</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Promedio diario consumido</span>
          <span class="pstat-val" class:green={avgKcal <= ob.kcal_objetivo_promedio} class:amber={avgKcal > ob.kcal_objetivo_promedio}>
            {avgKcal} kcal
          </span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Déficit promedio real</span>
          <span class="pstat-val" style="color:{avgDeficit >= 0 ? 'var(--green)' : 'var(--red)'}">
            {avgDeficit >= 0 ? '-' : '+'}{Math.abs(avgDeficit)} kcal/día
          </span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Pérdida estimada del período</span>
          <span class="pstat-val green">~{(avgDeficit * histVentanas.length / 7700).toFixed(2)} kg</span>
        </div>
      </div>
    </div>

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

  .empty-state {
    height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px; color: var(--dim);
  }
  .ei { font-size: 36px; opacity: 0.35; }
  .empty-state p { font-size: 13px; }
</style>
