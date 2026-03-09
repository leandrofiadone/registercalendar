<script>
  import { fmtDateLong } from '$lib/utils.js';
  import VentanaDetail from '$lib/VentanaDetail.svelte';

  let { session, ventanas = [], sessions = [], perfil = null, compact = false } = $props();

  function linkedVentana(s) {
    if (!s.nutricion_ref) return null;
    return ventanas.find(v => v.ventana_id === s.nutricion_ref) ?? null;
  }
</script>

{#if session}
  {#if !compact}
    <div class="sess-header">
      <h2>{fmtDateLong(session.date)}</h2>
      <div class="meta-row">
        {#if session.gimnasio}<div class="meta-badge">🏛 <strong>{session.gimnasio}</strong></div>{/if}
        {#if session.ciudad}<div class="meta-badge">📍 <strong>{session.ciudad}</strong></div>{/if}
        {#if session.weight_kg}<div class="meta-badge">⚖️ <strong>{session.weight_kg} kg</strong></div>{/if}
        {#if session.energy}<div class="meta-badge">⚡ <strong>{session.energy}</strong></div>{/if}
      </div>
    </div>
  {/if}

  <!-- Fuerza -->
  {#if session.fuerza?.length}
    <div class="section">
      <div class="sec-label">💪 Fuerza</div>
      {#each session.fuerza as e}
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

  <!-- Cardio -->
  {#if session.cardio?.length}
    <div class="section">
      <div class="sec-label">🏃 Cardio</div>
      {#each session.cardio as c}
        <div class="cardio-card">
          <div class="cardio-name">
            {c.ejercicio}{#if c.equipo}<span style="font-size:11px;color:var(--dim)"> · {c.equipo}</span>{/if}
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

  <!-- Nutrición vinculada -->
  {#if session.nutricion_ref}
    {@const v = linkedVentana(session)}
    {#if v}
      <div class="section">
        <div class="sec-label">🥗 Nutrición vinculada</div>
        <VentanaDetail ventana={v} {perfil} {sessions} bodyOnly />
      </div>
    {/if}
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
  .cardio-name { font-size: 14px; font-weight: 600; color: #ddd; margin-bottom: 12px; }
  .cardio-metrics { display: flex; gap: 20px; flex-wrap: wrap; }
  .cmetric { display: flex; flex-direction: column; gap: 1px; }
  .cmetric-val { font-size: 22px; font-weight: 700; color: var(--blue); line-height: 1; }
  .cmetric-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--dim); margin-top: 2px; }
</style>
