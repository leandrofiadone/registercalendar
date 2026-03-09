<script>
  import { getMoonPhase } from '$lib/moon.js';
  import { sessionColor } from '$lib/utils.js';

  let { sessions = [], ventanas = [], onSessionClick = () => {}, onVentanaClick = () => {} } = $props();

  function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  const today    = new Date();
  const todayStr = localDateStr(today);

  function dayAt(base, offset) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  }

  // First day where icon transitions TO 🌑, searching back from d
  function findNewMoonDay(d) {
    for (let i = 0; i <= 35; i++) {
      const c  = dayAt(d, -i);
      const mp = getMoonPhase(c);
      if (mp.icon !== '🌑') continue;
      const prev = getMoonPhase(new Date(c.getTime() - 86_400_000));
      if (prev.icon !== '🌑') return c;
    }
    return dayAt(d, 0);
  }

  // Day whose age is closest to exact full moon peak (SYNODIC/2 ≈ 14.765 days)
  const HALF_SYNODIC = 29.530588853 / 2;

  function findFullMoonDay(newMoon) {
    let best = dayAt(newMoon, 14);
    let bestDiff = Infinity;
    for (let i = 10; i <= 20; i++) {
      const c    = dayAt(newMoon, i);
      const diff = Math.abs(getMoonPhase(c).age - HALF_SYNODIC);
      if (diff < bestDiff) { bestDiff = diff; best = c; }
    }
    return best;
  }

  // Last day before the next 🌑 transition, searching forward from d
  function findCycleEnd(fullMoon) {
    for (let i = 1; i <= 20; i++) {
      const c  = dayAt(fullMoon, i);
      const mp = getMoonPhase(c);
      if (mp.icon !== '🌑') continue;
      const prev = getMoonPhase(new Date(c.getTime() - 86_400_000));
      if (prev.icon !== '🌑') return dayAt(c, -1); // day before new moon
    }
    return dayAt(fullMoon, 15);
  }

  let cycleNewMoon = $state(findNewMoonDay(today));

  function prevCycle() { cycleNewMoon = findNewMoonDay(dayAt(cycleNewMoon, -1)); }
  function nextCycle() { cycleNewMoon = findNewMoonDay(dayAt(cycleNewMoon, 31)); }
  function goToday()   { cycleNewMoon = findNewMoonDay(today); }

  const PHASE_GLOW = {
    '🌑': 'rgba(148,163,184,.05)',
    '🌒': 'rgba(99,102,241,.07)',
    '🌓': 'rgba(16,185,129,.09)',
    '🌔': 'rgba(20,184,166,.08)',
    '🌕': 'rgba(245,158,11,.22)',
    '🌖': 'rgba(245,158,11,.07)',
    '🌗': 'rgba(239,68,68,.06)',
    '🌘': 'rgba(139,92,246,.05)',
  };

  function phaseLabel(date) {
    const mp   = getMoonPhase(date);
    const prev = getMoonPhase(new Date(date.getTime() - 86_400_000));
    return (mp.icon !== prev.icon && mp.key) ? mp.name : null;
  }

  function buildDay(date, i, gymMap, nutriMap) {
    const dateStr = localDateStr(date);
    const mp      = getMoonPhase(date);
    return {
      date, dateStr, dayNum: i + 1,
      phase: mp,
      label: phaseLabel(date),
      isFull: false,
      isToday: dateStr === todayStr,
      gym:   gymMap.get(dateStr)   ?? null,
      nutri: nutriMap.get(dateStr) ?? null,
      glow:  PHASE_GLOW[mp.icon]  ?? 'transparent',
    };
  }

  // No padding — let grid fill naturally, no empty null cells
  function toRows(days, perRow = 7) {
    const rows = [];
    for (let i = 0; i < days.length; i += perRow)
      rows.push(days.slice(i, i + perRow));
    return rows;
  }

  let cycle = $derived.by(() => {
    const gymMap   = new Map(sessions.map(s => [s.date, s]));
    const nutriMap = new Map(ventanas.map(v => [v.ventana_id, v]));

    const fullMoon = findFullMoonDay(cycleNewMoon);
    const cycleEnd = findCycleEnd(fullMoon);

    // Waxing: new moon → full moon (inclusive), as grid rows of 7
    const waxDays = [];
    for (let i = 0; ; i++) {
      const date = dayAt(cycleNewMoon, i);
      waxDays.push(buildDay(date, i, gymMap, nutriMap));
      if (localDateStr(date) === localDateStr(fullMoon)) break;
      if (i > 20) break;
    }
    // Always mark the last waxing cell as the full moon peak
    if (waxDays.length > 0) waxDays[waxDays.length - 1].isFull = true;

    // Waning: day after full moon → cycle end
    const wanDays = [];
    const wanStart = dayAt(fullMoon, 1);
    for (let i = 0; ; i++) {
      const date = dayAt(wanStart, i);
      wanDays.push(buildDay(date, waxDays.length + i, gymMap, nutriMap));
      if (localDateStr(date) === localDateStr(cycleEnd)) break;
      if (i > 20) break;
    }

    const allDays  = [...waxDays, ...wanDays];
    const todayDay = allDays.find(d => d.isToday)?.dayNum ?? null;
    const total    = allDays.length;
    const pct      = todayDay ? Math.round((todayDay / total) * 100) : null;

    const fmt = d => d.toLocaleDateString('es', { day:'numeric', month:'short' });

    const inWaxing = todayDay !== null && todayDay <= waxDays.length;

    return {
      waxRows: toRows(waxDays),
      wanRows: toRows(wanDays),
      allDays, total, todayDay, pct,
      fullDayNum: waxDays.length,
      inWaxing,
      label: `${fmt(cycleNewMoon)} → 🌕 ${fmt(fullMoon)} → ${fmt(cycleEnd)}`,
    };
  });

  let isCurrentCycle = $derived(
    localDateStr(cycleNewMoon) === localDateStr(findNewMoonDay(today))
  );
</script>

<div class="sc-root">
  <!-- Header -->
  <div class="sc-header">
    <div class="sc-nav">
      <button class="nav-btn" onclick={prevCycle}>‹</button>
      <button class="nav-btn" onclick={nextCycle}>›</button>
      {#if !isCurrentCycle}
        <button class="today-btn" onclick={goToday}>Hoy</button>
      {/if}
    </div>
    <div class="sc-title">
      <span class="sc-label">Ciclo sinódico</span>
      <span class="sc-range">{cycle.label}</span>
      {#if cycle.todayDay}
        <span class="sc-today-badge">día {cycle.todayDay} / {cycle.total}</span>
      {/if}
    </div>
  </div>

  <!-- Progress arc: 🌑 ──── 🌕 ──── 🌑 -->
  <div class="arc-wrap">
    <span class="arc-end">🌑</span>
    <div class="arc-track">
      {#if cycle.pct !== null}
        <div class="arc-fill" style="width:{cycle.pct}%"></div>
        <div class="arc-dot"  style="left:{cycle.pct}%"></div>
      {/if}
      <div class="arc-full-mark" style="left:{Math.round((cycle.fullDayNum/cycle.total)*100)}%">🌕</div>
    </div>
    <span class="arc-end">🌑</span>
  </div>

  <div class="sc-body">

    {#snippet arcWaxing()}
      <div class="arc-section" class:current={cycle.inWaxing}>
        <div class="arc-section-label wax-lbl">🌑 → 🌕 Arco creciente {#if cycle.inWaxing}<span class="current-tag">ahora</span>{/if}</div>
        <div class="sc-grid">
          {#each cycle.waxRows as row}
            <div class="sc-row">{#each row as day}{@render dayCell(day)}{/each}</div>
          {/each}
        </div>
      </div>
    {/snippet}

    {#snippet arcWaning()}
      <div class="arc-section" class:current={!cycle.inWaxing}>
        <div class="arc-section-label wan-lbl">🌕 → 🌑 Arco menguante {#if !cycle.inWaxing}<span class="current-tag">ahora</span>{/if}</div>
        <div class="sc-grid">
          {#each cycle.wanRows as row}
            <div class="sc-row">{#each row as day}{@render dayCell(day)}{/each}</div>
          {/each}
        </div>
      </div>
    {/snippet}

    {#snippet dayCell(day)}
      <div class="sc-cell" class:today={day.isToday} class:full-moon={day.isFull} style="background:{day.isFull ? 'rgba(251,191,36,.12)' : day.glow}">
        <div class="cell-top">
          <span class="day-num" class:today-num={day.isToday} class:full-num={day.isFull}>{day.dayNum}</span>
          <span class="phase-ico" class:key={day.phase.key}>{day.phase.icon}</span>
        </div>
        {#if day.isFull}<div class="full-lbl">🌕 Plenilunio</div>{/if}
        {#if day.isToday}<div class="today-tag-cell">HOY</div>{/if}
        {#if day.label && !day.isFull}<div class="phase-lbl">{day.label}</div>{/if}
        {#if day.gym}
          {@const c = sessionColor(day.gym)}
          <button class="ev-pill ev-gym" style="background:{c}1a;border-color:{c}44;color:{c}" onclick={() => onSessionClick(day.gym)}>
            {#each (day.gym.groups||['Fuerza']) as g}<span class="ev-tag">{g}</span>{/each}
            {#if day.gym.cardio?.length}<span class="ev-tag ev-cardio">Cardio</span>{/if}
          </button>
        {/if}
        {#if day.nutri}
          {@const t = day.nutri.totales_ventana||{}}
          <button class="ev-pill ev-nutri" onclick={() => onVentanaClick(day.nutri)}>
            <div class="n-top"><span class="n-kcal">{t.kcal||'–'}</span><span class="n-unit">kcal</span></div>
            <div class="n-macros"><span class="nd prot"></span>{t.proteina_g||0}g <span class="nd fat"></span>{t.grasa_g||0}g <span class="nd carb"></span>{t.carbos_g||0}g</div>
            <div class="n-bar"><div class="n-fill" style="width:{Math.min(100,Math.round(((t.kcal||0)/2500)*100))}%"></div></div>
          </button>
        {/if}
      </div>
    {/snippet}

    {#if cycle.inWaxing}
      {@render arcWaxing()}
      {@render arcWaning()}
    {:else}
      {@render arcWaning()}
      {@render arcWaxing()}
    {/if}

  </div>
</div>

<style>
  .sc-root { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }

  /* Header */
  .sc-header { display:flex; align-items:center; gap:14px; padding:8px 0 8px; flex-shrink:0; }
  .sc-nav { display:flex; align-items:center; gap:4px; }
  .nav-btn {
    background:var(--s2); border:1px solid var(--b1); color:var(--text);
    border-radius:5px; padding:3px 10px; font-size:14px;
    cursor:pointer; font-family:inherit; line-height:1.2;
  }
  .nav-btn:hover { background:var(--s3); }
  .today-btn {
    background:var(--s2); border:1px solid var(--b1); color:var(--muted);
    border-radius:5px; padding:3px 9px; font-size:11px;
    cursor:pointer; font-family:inherit;
  }
  .today-btn:hover { color:var(--text); background:var(--s3); }
  .sc-title { display:flex; align-items:baseline; gap:9px; flex:1; }
  .sc-label { font-size:14px; font-weight:700; color:#fff; }
  .sc-range { font-size:11px; color:var(--dim); }
  .sc-today-badge {
    font-size:11px; color:var(--accent-l);
    background:rgba(165,148,249,.15); border:1px solid rgba(165,148,249,.3);
    border-radius:4px; padding:1px 8px;
  }

  /* Progress arc */
  .arc-wrap { display:flex; align-items:center; gap:8px; flex-shrink:0; padding-bottom:10px; }
  .arc-end  { font-size:14px; flex-shrink:0; }
  .arc-track {
    flex:1; position:relative; height:6px;
    background:var(--s2); border-radius:3px; border:1px solid var(--b1);
  }
  .arc-fill {
    position:absolute; left:0; top:0; bottom:0; border-radius:3px;
    background:linear-gradient(90deg,#334155,#a594f9 50%,#fbbf24);
  }
  .arc-dot {
    position:absolute; top:50%; transform:translate(-50%,-50%);
    width:10px; height:10px; border-radius:50%;
    background:var(--accent-l); border:2px solid var(--bg); z-index:2;
  }
  .arc-full-mark {
    position:absolute; top:50%; transform:translate(-50%,-60%);
    font-size:13px; line-height:1; z-index:1;
  }

  /* Body */
  .sc-body { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:0; }

  /* Arc sections */
  .arc-section { display:flex; flex-direction:column; opacity:.65; }
  .arc-section.current { opacity:1; }
  .arc-section-label {
    font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:var(--dim); padding:8px 4px 5px;
    display:flex; align-items:center; gap:6px;
  }
  .arc-section-label::after { content:''; flex:1; height:1px; background:var(--b1); }
  .wax-lbl { color: rgba(165,148,249,.7); }
  .wan-lbl { color: rgba(251,191,36,.6); }
  .current-tag {
    font-size:8px; background:rgba(165,148,249,.2);
    border:1px solid rgba(165,148,249,.4); border-radius:3px;
    padding:0 5px; color:var(--accent-l); letter-spacing:.05em;
  }

  /* Full moon cell */
  .sc-cell.full-moon {
    box-shadow:inset 0 3px 0 #fbbf24, inset 0 0 0 1px rgba(251,191,36,.4);
  }
  .full-num { color: #fbbf24 !important; }
  .full-lbl {
    font-size:10px; font-weight:700; color:#fbbf24;
    letter-spacing:.04em;
  }

  /* Grid */
  .sc-grid { display:flex; flex-direction:column; }
  .sc-row  { display:grid; grid-template-columns:repeat(7,1fr); border-top:1px solid var(--b1); }

  .sc-cell {
    border-right:1px solid var(--b1);
    padding:9px 11px;
    display:flex; flex-direction:column; gap:5px;
    min-height:110px; transition:filter .1s;
  }
  .sc-cell:last-child { border-right:none; }
  .sc-cell:not(.sc-pad):hover { filter:brightness(1.3); }
  .sc-cell.sc-pad { background:var(--s1) !important; }
  .sc-cell.today {
    background:rgba(165,148,249,.1) !important;
    box-shadow:inset 0 0 0 2px var(--accent-l);
  }

  .cell-top { display:flex; justify-content:space-between; align-items:center; }
  .day-num  {
    font-size:22px; font-weight:800; color:var(--dim);
    line-height:1; font-variant-numeric:tabular-nums;
  }
  .day-num.today-num {
    color:#fff;
    background: var(--accent);
    border-radius: 50%;
    width: 34px; height: 34px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .phase-ico      { font-size:18px; opacity:.5; line-height:1; }
  .phase-ico.key  { font-size:22px; opacity:1; }
  .phase-lbl { font-size:10px; color:var(--muted); }

  .today-tag-cell {
    font-size:8px; font-weight:700; letter-spacing:.1em;
    color:#fff; background: var(--accent);
    border-radius:3px;
    padding:1px 6px; align-self:flex-start;
  }

  /* Pills */
  .ev-pill {
    display:flex; flex-wrap:wrap; gap:3px; align-items:center;
    border:1px solid; border-radius:5px; padding:5px 7px;
    cursor:pointer; font-family:inherit; text-align:left;
    transition:filter .1s; width:100%;
  }
  .ev-pill:hover { filter:brightness(1.2); }
  .ev-tag { font-size:10px; font-weight:600; background:rgba(255,255,255,.1); border-radius:3px; padding:1px 5px; }
  .ev-cardio { color:var(--blue-l); }
  .ev-nutri { flex-direction:column; background:rgba(245,158,11,.1)!important; border-color:rgba(245,158,11,.28)!important; }
  .n-top   { display:flex; align-items:baseline; gap:3px; }
  .n-kcal  { font-size:15px; font-weight:800; color:var(--amber); line-height:1; }
  .n-unit  { font-size:9px; color:rgba(245,158,11,.6); }
  .n-macros{ display:flex; align-items:center; gap:4px; font-size:9px; color:var(--dim); }
  .nd { display:inline-block; width:5px; height:5px; border-radius:50%; flex-shrink:0; }
  .nd.prot { background:var(--blue); }
  .nd.fat  { background:var(--red); }
  .nd.carb { background:var(--green); }
  .n-bar  { height:3px; background:rgba(245,158,11,.15); border-radius:2px; overflow:hidden; }
  .n-fill { height:100%; background:var(--amber); border-radius:2px; }
</style>
