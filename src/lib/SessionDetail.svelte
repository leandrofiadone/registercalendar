<script>
  import { fmtDateLong } from '$lib/utils.js';
  import { gymKcalDetallado } from '$lib/activity.js';

  let { session, sessions = [], perfil = null, compact = false } = $props();

  function pesoEnFecha(fecha) {
    const hist = perfil?.historial_peso;
    if (!hist?.length) return null;
    const sorted = [...hist].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let closest = null;
    for (const h of sorted) {
      if (h.fecha <= fecha) closest = h;
    }
    return closest?.peso_kg ?? null;
  }

  let pesoKg  = $derived(pesoEnFecha(session?.date) ?? perfil?.historial_peso?.at(-1)?.peso_kg ?? 80);
  let detalle = $derived(session ? gymKcalDetallado(session, pesoKg) : null);

  let cardioKcalMap = $derived(
    detalle ? Object.fromEntries(detalle.cardio.map((c, i) => [i, c])) : {}
  );

  // Multi-gym: agrupar ejercicios/cardio por gimnasio si tienen campo `gimnasio`
  let gymSections = $derived.by(() => {
    if (!session) return null;
    const gyms = [...new Set([
      ...(session.fuerza||[]).map(e => e.gimnasio),
      ...(session.cardio||[]).map(c => c.gimnasio),
    ].filter(Boolean))];
    if (gyms.length <= 1) return null; // render normal
    return gyms.map(gym => {
      const fuerza = (session.fuerza||[]).filter(e => e.gimnasio === gym);
      const cardio  = (session.cardio||[]).filter(c => c.gimnasio === gym);
      const subSess = { ...session, fuerza, cardio };
      const det     = gymKcalDetallado(subSess, pesoKg);
      const cMap    = Object.fromEntries(det.cardio.map((c, i) => [i, c]));
      return { gym, fuerza, cardio, det, cMap };
    });
  });
</script>

{#if session}
  {#if !compact}
    <div class="sess-header">
      <h2>{fmtDateLong(session.date)}</h2>
      <div class="meta-row">
        {#if session.gimnasio}<div class="meta-badge">🏛 <strong>{session.gimnasio}</strong></div>{/if}
        {#if session.ciudad}<div class="meta-badge">📍 <strong>{session.ciudad}</strong></div>{/if}
        {#if pesoKg}<div class="meta-badge">⚖️ <strong>{pesoKg} kg</strong></div>{/if}
      </div>
    </div>
  {/if}

  <!-- Resumen gasto energético -->
  {#if detalle}
    <div class="gasto-card">
      <div class="gasto-title">🔥 Gasto estimado</div>
      <div class="gasto-items">
        {#if detalle.fuerza > 0}
          <div class="gasto-item">
            <span class="gasto-icon">💪</span>
            <span class="gasto-lbl">Fuerza ({(session.groups||[]).join(' + ')})</span>
            <span class="gasto-kcal">~{detalle.fuerza} kcal</span>
          </div>
        {/if}
        {#each detalle.cardio as c}
          <div class="gasto-item">
            <span class="gasto-icon">{c.tipo === 'sauna' ? '🧖' : c.tipo === 'natacion' ? '🏊' : '🏃'}</span>
            <span class="gasto-lbl">{c.ejercicio}{c.duracion_min ? ` · ${c.duracion_min}min` : ''}{c.intensidad ? ` · ${c.intensidad}` : ''}</span>
            <span class="gasto-kcal {c.tipo === 'sauna' ? 'dim' : ''}">{c.kcal} kcal{c.fuente === 'estimado' ? ' *' : ''}</span>
          </div>
        {/each}
      </div>
      <div class="gasto-total">
        <span>Total sesión</span>
        <span class="gasto-total-val">~{detalle.total} kcal</span>
      </div>
      {#if detalle.fuente === 'estimado'}
        <div class="gasto-nota">* estimado por MET · sin monitor cardíaco el error puede ser ±30%</div>
      {/if}
    </div>
  {/if}

  <!-- ── Snippets reutilizables ── -->
  {#snippet fuerzaSection(ejercicios)}
    {#if ejercicios.length}
      <div class="section">
        <div class="sec-label">💪 Fuerza</div>
        {#each ejercicios as e}
          <div class="ex-card">
            <div class="ex-name-row">
              <span class="ex-name">{e.ejercicio}</span>
              {#if e.equipo}<span class="ex-equipo">{e.equipo}</span>{/if}
            </div>
            {#if e.musculo_principal}
              <div class="ex-muscles">
                <span class="mp">{e.musculo_principal}</span>
                {#if e.musculos_secundarios?.length}
                  <span style="color:var(--dim)"> · {e.musculos_secundarios.join(', ')}</span>
                {/if}
              </div>
            {/if}
            <div class="sets-row">
              {#each e.sets as set}
                {#if set.tipo === 'dropset'}
                  <div class="set-pill ds">
                    <span class="sn">S{set.set}</span>
                    {#each set.drops as drop, di}
                      {#if di > 0}<span class="drop-sep">→</span>{/if}
                      <span class="sr">{drop.reps}</span><span style="color:var(--dim)">×</span><span class="sw">{drop.peso_kg}kg</span>
                    {/each}
                  </div>
                {:else}
                  <div class="set-pill">
                    <span class="sn">S{set.set}</span>
                    <span class="sr">{set.reps}</span><span style="color:var(--dim)">×</span><span class="sw">{set.peso_kg}kg</span>
                  </div>
                {/if}
              {/each}
            </div>
            {#if e.notas}<div class="ex-notas">{e.notas}</div>{/if}
          </div>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet cardioSection(cardioList, kcalMap)}
    {#if cardioList.length}
      <div class="section">
        <div class="sec-label">🏃 Cardio</div>
        {#each cardioList as c, ci}
          {@const ck = kcalMap[ci]}
          <div class="cardio-card">
            <div class="cardio-name-row">
              <span class="cardio-name">
                {c.ejercicio}{#if c.equipo}<span style="font-size:11px;color:var(--dim)"> · {c.equipo}</span>{/if}
              </span>
              {#if ck}
                <span class="cardio-kcal {ck.tipo === 'sauna' ? 'dim' : ''}">~{ck.kcal} kcal{ck.met ? ` · MET ${ck.met}` : ''}</span>
              {/if}
            </div>
            <div class="cardio-metrics">
              {#if c.duracion_min}<div class="cmetric"><span class="cmetric-val">{c.duracion_min}</span><span class="cmetric-lbl">min</span></div>{/if}
              {#if c.distancia_km}<div class="cmetric"><span class="cmetric-val">{c.distancia_km}</span><span class="cmetric-lbl">km</span></div>{/if}
              {#if c.distancia_m}<div class="cmetric"><span class="cmetric-val">{c.distancia_m}</span><span class="cmetric-lbl">m</span></div>{/if}
              {#if c.largos}<div class="cmetric"><span class="cmetric-val">{c.largos}</span><span class="cmetric-lbl">largos</span></div>{/if}
              {#if c.pasos}<div class="cmetric"><span class="cmetric-val">{c.pasos}</span><span class="cmetric-lbl">pasos</span></div>{/if}
              {#if c.kcal}<div class="cmetric"><span class="cmetric-val">{c.kcal}</span><span class="cmetric-lbl">kcal</span></div>{/if}
              {#if c.velocidad_kmh}<div class="cmetric"><span class="cmetric-val">{c.velocidad_kmh}</span><span class="cmetric-lbl">km/h</span></div>{/if}
              {#if c.intensidad}<div class="cmetric"><span class="cmetric-val">{c.intensidad}</span><span class="cmetric-lbl">intensidad</span></div>{/if}
            </div>
            {#if c.notas}<div class="ex-notas" style="margin-top:10px">{c.notas}</div>{/if}
          </div>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#if gymSections}
    <!-- ── Multi-gym: secciones por gimnasio ── -->
    {#each gymSections as gs, gsi}
      <div class="gym-section">
        <div class="gym-section-header">
          <span class="gym-section-num">{gsi + 1}</span>
          <span class="gym-section-name">🏛 {gs.gym}</span>
          <span class="gym-section-kcal">~{gs.det.total} kcal</span>
        </div>
        {@render fuerzaSection(gs.fuerza)}
        {@render cardioSection(gs.cardio, gs.cMap)}
      </div>
    {/each}

  {:else}
    <!-- ── Sesión simple ── -->
    {@render fuerzaSection(session.fuerza || [])}
    {@render cardioSection(session.cardio || [], cardioKcalMap)}
  {/if}


  <!-- Notas -->
  {#if session.notes}
    <div class="section">
      <div class="sec-label">📝 Notas</div>
      <p style="font-size:13px;color:#888;line-height:1.6">{session.notes}</p>
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

  /* ── Gasto energético ── */
  .gasto-card {
    background: var(--s2); border: 1px solid rgba(251,146,60,.2);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;
  }
  .gasto-title {
    font-size: 10px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #fb923c; margin-bottom: 10px;
  }
  .gasto-items { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .gasto-item {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: var(--muted);
  }
  .gasto-icon { font-size: 13px; flex-shrink: 0; }
  .gasto-lbl  { flex: 1; }
  .gasto-kcal { font-weight: 700; color: #fb923c; font-variant-numeric: tabular-nums; }
  .gasto-kcal.dim { color: #888; font-weight: 500; }

  .gasto-total {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 8px; border-top: 1px solid rgba(251,146,60,.15);
    font-size: 12px; color: var(--muted);
  }
  .gasto-total-val {
    font-size: 18px; font-weight: 800; color: #fb923c;
    font-variant-numeric: tabular-nums;
  }
  .gasto-nota {
    font-size: 9px; color: var(--dim); margin-top: 6px;
    font-style: italic; opacity: .7;
  }

  /* ── Multi-gym sections ── */
  .gym-section {
    border: 1px solid var(--b1); border-radius: 10px;
    padding: 14px 16px; margin-bottom: 20px;
    background: rgba(255,255,255,.015);
  }
  .gym-section-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 16px; padding-bottom: 12px;
    border-bottom: 1px solid var(--b1);
  }
  .gym-section-num {
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--accent); color: #fff;
    font-size: 10px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .gym-section-name { font-size: 13px; font-weight: 600; color: #ccc; flex: 1; }
  .gym-section-kcal {
    font-size: 11px; font-weight: 700; color: #fb923c;
    background: rgba(251,146,60,.08); border: 1px solid rgba(251,146,60,.2);
    border-radius: 4px; padding: 2px 8px;
    font-variant-numeric: tabular-nums;
  }
  .gym-section .section { margin-bottom: 16px; }
  .gym-section .section:last-child { margin-bottom: 0; }

  .section { margin-bottom: 26px; }
  .sec-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--dim); margin-bottom: 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .sec-label::after { content: ''; flex: 1; height: 1px; background: var(--b1); }

  .ex-card {
    background: var(--s1); border: 1px solid var(--b1);
    border-radius: 8px; padding: 13px 15px;
    margin-bottom: 8px; transition: border-color 0.12s;
  }
  .ex-card:hover { border-color: var(--b2); }
  .ex-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
  .ex-name { font-size: 14px; font-weight: 600; color: #ddd; }
  .ex-equipo {
    font-size: 10px; color: var(--dim);
    background: var(--s2); border: 1px solid var(--b1);
    padding: 1px 6px; border-radius: 3px;
  }
.ex-muscles { font-size: 11px; color: var(--dim); margin-bottom: 9px; }
  .ex-muscles .mp { color: #7778aa; }

  .sets-row { display: flex; flex-wrap: wrap; gap: 5px; }
  .set-pill {
    background: var(--s2); border: 1px solid var(--b2);
    border-radius: 4px; padding: 4px 9px;
    font-size: 11px; color: #888;
    font-variant-numeric: tabular-nums;
    display: inline-flex; align-items: center; gap: 2px;
  }
  .set-pill .sn { color: var(--dim); font-size: 9px; margin-right: 3px; }
  .set-pill .sr { color: #ccc; font-weight: 600; }
  .set-pill .sw { color: var(--accent-l); }
  .set-pill.ds { background: rgba(124,106,245,.08); border-color: rgba(124,106,245,.22); }
  .drop-sep { color: var(--accent); margin: 0 3px; font-size: 10px; }

  .ex-notas {
    font-size: 11px; color: var(--dim);
    margin-top: 9px; font-style: italic;
    padding-top: 8px; border-top: 1px solid var(--b1);
  }

  .cardio-card {
    background: var(--s1); border: 1px solid var(--b1);
    border-left: 3px solid var(--blue);
    border-radius: 8px; padding: 13px 15px; margin-bottom: 8px;
  }
  .cardio-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .cardio-name { font-size: 14px; font-weight: 600; color: #ddd; flex: 1; }
  .cardio-kcal {
    font-size: 10px; font-weight: 600; color: #fb923c;
    background: rgba(251,146,60,.08); border: 1px solid rgba(251,146,60,.15);
    padding: 2px 8px; border-radius: 4px;
    font-variant-numeric: tabular-nums;
  }
  .cardio-kcal.dim { color: #888; background: rgba(136,136,136,.08); border-color: rgba(136,136,136,.15); }

  .cardio-metrics { display: flex; gap: 20px; flex-wrap: wrap; }
  .cmetric { display: flex; flex-direction: column; gap: 1px; }
  .cmetric-val { font-size: 22px; font-weight: 700; color: var(--blue); line-height: 1; }
  .cmetric-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--dim); margin-top: 2px; }

  @media (max-width: 768px) {
    .cmetric-val { font-size: 18px; }
    .cardio-metrics { gap: 14px; }
    .gasto-lbl { font-size: 11px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
</style>
