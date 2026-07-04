<script>
  import BodyMap from '$lib/bodymap/BodyMap.svelte';
  import { volumeBySlug, intensityFromVolume, muscleToSlug, regionForSlug, REGIONS, SLUG_LABEL, colorForSlug } from '$lib/bodymap/muscleMap.js';
  import { fmtDate } from '$lib/utils.js';

  let { data } = $props();
  let sessions = $derived(data.sessions ?? []);

  let period = $state(30);          // 7 | 30 | 'all'
  let selected = $state(null);      // slug seleccionado

  const periods = [
    { v: 7,     label: '7 días' },
    { v: 30,    label: '30 días' },
    { v: 'all', label: 'Todo' },
  ];

  let refDate = $derived(
    sessions.reduce((m, s) => (s.date > m ? s.date : m), '0000-00-00')
  );
  function daysAgo(date) {
    return (new Date(refDate + 'T12:00:00') - new Date(date + 'T12:00:00')) / 86400000;
  }
  let windowed = $derived(
    period === 'all' ? sessions : sessions.filter((s) => daysAgo(s.date) < period)
  );

  let vol = $derived(volumeBySlug(windowed));
  let intensity = $derived(intensityFromVolume(vol.bySlug, vol.max));

  // ── Stats de cabecera ──
  let nFuerza = $derived(windowed.filter((s) => s.fuerza?.length).length);
  let nCardio = $derived(windowed.filter((s) => s.cardio?.length).length);
  let totalSets = $derived(
    windowed.reduce((acc, s) => acc + (s.fuerza ?? []).reduce((a, e) => a + Math.max((e.sets ?? []).length, 1), 0), 0)
  );
  let topSlug = $derived.by(() => {
    let best = null, bestN = 0;
    for (const slug in vol.bySlug) if (vol.bySlug[slug] > bestN) { bestN = vol.bySlug[slug]; best = slug; }
    return best;
  });

  // ── Leyenda por región ──
  const REGION_ORDER = ['empuje', 'traccion', 'pierna', 'core'];
  let maxRegion = $derived(Math.max(1, ...REGION_ORDER.map((r) => vol.regionTotals[r] ?? 0)));

  // ── Regiones presentes en una sesión (para chips) ──
  function sessionRegions(s) {
    const set = new Set();
    for (const e of s.fuerza ?? []) {
      const r = regionForSlug(muscleToSlug(e.musculo_principal));
      if (r) set.add(r);
      for (const sec of e.musculos_secundarios ?? []) {
        const r2 = regionForSlug(muscleToSlug(sec));
        if (r2) set.add(r2);
      }
    }
    if (s.cardio?.length) set.add('cardio');
    return [...REGION_ORDER, 'cardio'].filter((r) => set.has(r));
  }

  // ── Ejercicios que trabajan el músculo seleccionado ──
  let drill = $derived.by(() => {
    if (!selected) return [];
    const out = [];
    for (const s of windowed) {
      for (const e of s.fuerza ?? []) {
        const isMain = muscleToSlug(e.musculo_principal) === selected;
        const isSec = (e.musculos_secundarios ?? []).some((m) => muscleToSlug(m) === selected);
        if (isMain || isSec) {
          out.push({ date: s.date, ejercicio: e.ejercicio, sets: (e.sets ?? []).length, role: isMain ? 'principal' : 'secundario' });
        }
      }
    }
    return out;
  });
</script>

<div class="mus">
  <header class="head">
    <div>
      <h1>Mapa muscular</h1>
      <p class="sub">Heatmap de volumen entrenado · color = región, brillo = cuánto la pegaste</p>
    </div>
    <div class="periods">
      {#each periods as p}
        <button class="pbtn" class:active={period === p.v} onclick={() => (period = p.v)}>{p.label}</button>
      {/each}
    </div>
  </header>

  <!-- Stats -->
  <div class="stats">
    <div class="stat"><span class="sv">{nFuerza}</span><span class="sl">fuerza</span></div>
    <div class="stat"><span class="sv">{nCardio}</span><span class="sl">cardio</span></div>
    <div class="stat"><span class="sv">{totalSets}</span><span class="sl">sets</span></div>
    <div class="stat"><span class="sv">{Math.round(vol.cardioMin)}</span><span class="sl">min cardio</span></div>
    <div class="stat"><span class="sv accent">{topSlug ? (SLUG_LABEL[topSlug] ?? topSlug) : '—'}</span><span class="sl">más entrenado</span></div>
  </div>

  <div class="grid">
    <!-- Body map -->
    <section class="panel mapcard">
      <BodyMap {intensity} counts={vol.bySlug} {selected} onselect={(s) => (selected = s)} />
      {#if selected}
        <button class="clear" onclick={() => (selected = null)}>✕ quitar filtro: {SLUG_LABEL[selected] ?? selected}</button>
      {:else}
        <p class="hint">Pasá el mouse sobre un músculo · clic para filtrar</p>
      {/if}
    </section>

    <!-- Leyenda regiones -->
    <section class="panel">
      <div class="ptitle">Volumen por región</div>
      <div class="legend">
        {#each REGION_ORDER as r}
          {@const total = vol.regionTotals[r] ?? 0}
          <div class="lrow">
            <span class="lname" style="color:{REGIONS[r].color}">{REGIONS[r].label}</span>
            <div class="lbar"><div class="lfill" style="width:{(total / maxRegion) * 100}%; background:{REGIONS[r].color}"></div></div>
            <span class="lval">{Math.round(total)}</span>
          </div>
        {/each}
        <div class="lrow">
          <span class="lname" style="color:{REGIONS.cardio.color}">{REGIONS.cardio.label}</span>
          <div class="lbar"><div class="lfill" style="width:{vol.cardioMin ? 100 : 0}%; background:{REGIONS.cardio.color}; opacity:.5"></div></div>
          <span class="lval">{Math.round(vol.cardioMin)}′</span>
        </div>
      </div>
    </section>
  </div>

  <!-- Detalle / lista -->
  {#if selected}
    <section class="panel">
      <div class="ptitle">Ejercicios que trabajan <span style="color:{colorForSlug(selected)}">{SLUG_LABEL[selected] ?? selected}</span> ({drill.length})</div>
      {#if drill.length === 0}
        <p class="empty">Sin registros en este período.</p>
      {:else}
        <div class="drill">
          {#each drill as d}
            <div class="drow">
              <span class="ddate">{fmtDate(d.date)}</span>
              <span class="dname">{d.ejercicio}</span>
              <span class="drole {d.role}">{d.role}</span>
              {#if d.sets}<span class="dsets">{d.sets} sets</span>{/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {:else}
    <section class="panel">
      <div class="ptitle">Sesiones del período ({windowed.length})</div>
      <div class="slist">
        {#each windowed as s}
          <div class="srow">
            <span class="sdate">{fmtDate(s.date)}</span>
            <div class="schips">
              {#each sessionRegions(s) as r}
                <span class="chip" style="color:{REGIONS[r].color}; border-color:{REGIONS[r].color}40; background:{REGIONS[r].color}14">{REGIONS[r].label}</span>
              {/each}
              {#if sessionRegions(s).length === 0}<span class="chip muted">—</span>{/if}
            </div>
            <span class="sgym">{s.gimnasio ?? ''}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <p class="foot">Experimento read-only · datos de <code>data/log.json</code> · paths SVG via react-native-body-highlighter (MIT)</p>
</div>

<style>
  .mus { display: flex; flex-direction: column; gap: 1.25rem; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  h1 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; }
  .sub { color: var(--muted); font-size: 0.85rem; margin-top: 0.15rem; }

  .periods { display: flex; gap: 0.3rem; }
  .pbtn {
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--muted); background: var(--s1);
    border: 1px solid var(--b1); border-radius: 5px;
    padding: 0.3rem 0.6rem; cursor: pointer; transition: all .12s;
  }
  .pbtn:hover { border-color: var(--accent); color: var(--text); }
  .pbtn.active { border-color: var(--accent); color: var(--accent); background: rgba(188,140,255,.08); }

  .stats { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .stat {
    flex: 1; min-width: 88px;
    display: flex; flex-direction: column; gap: 0.1rem;
    background: var(--s1); border: 1px solid var(--b1);
    border-radius: 8px; padding: 0.6rem 0.8rem;
  }
  .sv { font-family: var(--font-mono); font-size: 1.15rem; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .sv.accent { color: var(--accent); font-size: 0.95rem; }
  .sl { font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }

  .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1rem; align-items: start; }
  .panel { background: var(--s1); border: 1px solid var(--b1); border-radius: 10px; padding: 1.1rem 1.2rem; }
  .mapcard { display: flex; flex-direction: column; gap: 0.8rem; }
  .ptitle {
    font-family: var(--font-mono); font-size: 0.7rem; font-weight: 500;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted);
    margin-bottom: 0.9rem;
  }

  .hint { font-size: 0.72rem; color: var(--dim); text-align: center; font-style: italic; }
  .clear {
    align-self: center;
    font-family: var(--font-mono); font-size: 0.7rem;
    color: var(--accent); background: rgba(188,140,255,.08);
    border: 1px solid rgba(188,140,255,.25); border-radius: 5px;
    padding: 0.3rem 0.7rem; cursor: pointer;
  }
  .clear:hover { background: rgba(188,140,255,.16); }

  .legend { display: flex; flex-direction: column; gap: 0.55rem; }
  .lrow { display: grid; grid-template-columns: 70px 1fr 32px; align-items: center; gap: 0.5rem; }
  .lname { font-size: 0.78rem; font-weight: 600; }
  .lbar { height: 8px; background: var(--s3); border-radius: 4px; overflow: hidden; }
  .lfill { height: 100%; border-radius: 4px; transition: width .2s; }
  .lval { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }

  .slist, .drill { display: flex; flex-direction: column; }
  .srow {
    display: grid; grid-template-columns: 90px 1fr auto; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0; border-bottom: 1px solid var(--b1);
  }
  .srow:last-child { border-bottom: none; }
  .sdate, .ddate { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); }
  .schips { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .chip {
    font-family: var(--font-mono); font-size: 0.62rem;
    border: 1px solid; border-radius: 3px; padding: 0.05rem 0.35rem;
  }
  .chip.muted { color: var(--dim); border-color: var(--b1); }
  .sgym { font-size: 0.7rem; color: var(--dim); text-align: right; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .drow {
    display: grid; grid-template-columns: 90px 1fr auto auto; align-items: center; gap: 0.6rem;
    padding: 0.5rem 0; border-bottom: 1px solid var(--b1);
  }
  .drow:last-child { border-bottom: none; }
  .dname { font-size: 0.82rem; color: var(--text); }
  .drole { font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.05rem 0.35rem; border-radius: 3px; }
  .drole.principal { color: var(--accent); background: rgba(188,140,255,.1); }
  .drole.secundario { color: var(--dim); background: var(--s3); }
  .dsets { font-family: var(--font-mono); font-size: 0.7rem; color: var(--muted); }

  .empty { color: var(--dim); font-size: 0.8rem; }
  .foot { font-family: var(--font-mono); font-size: 0.66rem; color: var(--dim); }
  .foot code { background: var(--s2); padding: 0.05rem 0.3rem; border-radius: 3px; color: var(--accent-l); }

  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
