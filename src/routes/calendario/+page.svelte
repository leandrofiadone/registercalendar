<script>
  import { onMount } from 'svelte';
  import { sessionType, sessionColor } from '$lib/utils.js';
  import { getMoonPhase } from '$lib/moon.js';
  import { gymKcalDetallado } from '$lib/activity.js';
  import SessionDetail from '$lib/SessionDetail.svelte';
  import VentanaDetail from '$lib/VentanaDetail.svelte';
  import Luna13Cal from '$lib/Luna13Cal.svelte';

  let { data } = $props();
  let sessions = $derived(data.sessions);
  let ventanas = $derived(data.ventanas);
  let perfil   = $derived(data.perfil);

  let calView   = $state('gym');
  let calFormat = $state('gregoriano'); // 'gregoriano' | '13lunas'
  let selectedSession = $state(null);
  let selectedVentana = $state(null);

  let calEl;
  let fcCalendar = null;

  function gymCalEvents() {
    const pesoKg = perfil?.historial_peso?.at(-1)?.peso_kg ?? 80;
    return sessions.map((s, i) => {
      const det = gymKcalDetallado(s, pesoKg);
      const kcal = Math.round(det.fuerza + det.cardio.reduce((sum, c) => sum + c.kcal, 0));
      return {
        title: '',
        date: s.date,
        backgroundColor: sessionColor(s),
        borderColor: 'transparent',
        textColor: '#fff',
        extendedProps: {
          type: 'gym', idx: i,
          groups: s.groups || [],
          hasCardio: !!s.cardio?.length,
          color: sessionColor(s),
          kcal,
        },
      };
    });
  }

  function nutriCalEvents() {
    const pesoKg      = perfil?.historial_peso?.at(-1)?.peso_kg ?? 80;
    const tdeBase     = perfil?.metabolismo?.gasto_total_descanso_kcal ?? 2776;
    const kcalBase    = perfil?.objetivos_diarios?.kcal_dia_descanso ?? 2276;
    const deficitTarget = perfil?.objetivos_diarios?.deficit_target_kcal ?? 500;

    return ventanas.map((v, i) => {
      const t = v.totales_ventana || {};
      const gymSess = sessions.find(s => s.date === v.ventana_id);
      let kcalActividad = 0;
      if (gymSess) {
        const det = gymKcalDetallado(gymSess, pesoKg);
        kcalActividad = det.fuerza + det.cardio.reduce((sum, c) => sum + c.kcal, 0);
      }
      const kcalTarget = Math.round(kcalBase + kcalActividad);
      const maintTotal = Math.round(tdeBase + kcalActividad);
      const consumed   = t.kcal || 0;
      const zone = consumed <= kcalTarget ? 'ok' : consumed <= maintTotal ? 'warn' : 'over';
      const pct  = Math.min(100, Math.round((consumed / kcalTarget) * 100));
      return {
        title: '',
        date: v.ventana_id,
        backgroundColor: '#f59e0b',
        borderColor: 'transparent',
        textColor: '#000',
        extendedProps: {
          type: 'nutri', vIdx: i,
          kcal: consumed,
          prot: t.proteina_g || 0,
          gras: t.grasa_g    || 0,
          carb: t.carbos_g   || 0,
          kcalTarget, zone, pct,
          hasGym: !!gymSess,
        },
      };
    });
  }

  // Cuando vuelve a Gregoriano, recalcular tamaño del calendar (estaba oculto)
  $effect(() => {
    if (calFormat === 'gregoriano' && fcCalendar) {
      setTimeout(() => fcCalendar.updateSize(), 0);
    }
  });

  function switchCalView(view) {
    calView = view;
    selectedSession = null;
    selectedVentana = null;
    if (fcCalendar) {
      fcCalendar.removeAllEvents();
      fcCalendar.addEventSource(view === 'gym' ? gymCalEvents() : nutriCalEvents());
    }
  }

  onMount(() => {
    // FullCalendar loaded via CDN in <svelte:head>
    // Poll until FullCalendar is available
    const interval = setInterval(() => {
      if (typeof window.FullCalendar === 'undefined') return;
      clearInterval(interval);

      fcCalendar = new window.FullCalendar.Calendar(calEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: '100%',
        fixedWeekCount: false,
        headerToolbar: {
          left:   'prev,next today',
          center: 'title',
          right:  'dayGridMonth,listMonth',
        },
        buttonText: { today: 'Hoy', month: 'Mes', list: 'Lista' },
        events: gymCalEvents(),

        eventContent(arg) {
          const p = arg.event.extendedProps;
          if (p.type === 'nutri') {
            const zoneColor = { ok: '#166534', warn: '#92400e', over: '#991b1b' }[p.zone];
            const zoneDot   = { ok: '#4ade80', warn: '#fbbf24', over: '#f87171' }[p.zone];
            const gymBadge  = p.hasGym ? `<span class="ev-n-gym">💪</span>` : '';
            return { html: `<div class="ev-nutri">
              <div class="ev-n-top">
                <span class="ev-n-kcal">${p.kcal}</span>
                <span class="ev-n-unit">/ ${p.kcalTarget} kcal</span>
                ${gymBadge}
                <span class="ev-n-dot" style="background:${zoneDot}"></span>
              </div>
              <div class="ev-n-macros">
                <span class="ev-dot prot"></span>${p.prot}g
                <span class="ev-dot gras"></span>${p.gras}g
                <span class="ev-dot carb"></span>${p.carb}g
              </div>
              <div class="ev-n-bar"><div class="ev-n-bar-fill" style="width:${p.pct}%;background:${zoneColor}"></div></div>
            </div>` };
          }
          if (p.type === 'gym') {
            const tags = p.groups.map(g => `<span class="ev-g-tag">${g}</span>`).join('');
            const cardio = p.hasCardio ? '<span class="ev-g-cardio">Cardio</span>' : '';
            const kcal = p.kcal > 0 ? `<span class="ev-g-kcal">~${p.kcal} kcal</span>` : '';
            return { html: `<div class="ev-gym">${tags}${cardio}${kcal}</div>` };
          }
        },

        eventClick(info) {
          const p = info.event.extendedProps;
          if (p.type === 'gym') {
            selectedVentana = null;
            selectedSession = sessions[p.idx];
          }
          if (p.type === 'nutri') {
            selectedSession = null;
            selectedVentana = ventanas[p.vIdx];
          }
        },

        dayCellDidMount(info) {
          const d = info.date.toISOString().split('T')[0];
          const gymDates   = new Set(sessions.map(s => s.date));
          const nutriDates = new Set(ventanas.map(v => v.ventana_id));
          const pesoByDate = {};
          for (const p of (perfil?.historial_peso || [])) pesoByDate[p.fecha] = p.peso_kg;
          const frame = info.el.querySelector('.fc-daygrid-day-frame');
          if (frame) {
            if (calView === 'gym'       && gymDates.has(d))   frame.style.background = 'rgba(124,106,245,0.06)';
            if (calView === 'nutricion' && nutriDates.has(d)) frame.style.background = 'rgba(245,158,11,0.06)';


            // Línea de tiempo en días pasados + hoy
            const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
            const isPast  = info.date < todayMidnight;
            const isToday = info.date.getTime() === todayMidnight.getTime();
            if (isPast || isToday) {
              const line = document.createElement('div');
              line.style.cssText = [
                'position:absolute',
                'bottom:23.6%',
                'left:0',
                'right:0',
                'height:1px',
                isPast
                  ? 'background:rgba(120,110,200,0.14)'
                  : 'background:linear-gradient(90deg,rgba(165,148,249,0.56) 0%,transparent 100%)',
                'pointer-events:none',
                'z-index:0',
              ].join(';');
              frame.appendChild(line);
            }

            // Weight badge
            if (pesoByDate[d] && frame) {
              const wb = document.createElement('div');
              wb.className = 'peso-cal-badge';
              wb.textContent = pesoByDate[d] + ' kg';
              frame.appendChild(wb);
            }

            // Moon phase badge — only label for Luna llena / Luna nueva
            const moon = getMoonPhase(info.date);
            const showLabel = moon.name === 'Luna llena' || moon.name === 'Luna nueva';
            const badge = document.createElement('div');
            badge.className = 'moon-badge' + (showLabel ? ' moon-key' : '');
            badge.title = `${moon.name} (día ${Math.round(moon.age)} del ciclo)`;
            if (showLabel) {
              const label = document.createElement('span');
              label.className = 'moon-label';
              label.textContent = moon.name;
              badge.appendChild(label);
            }
            const iconSpan = document.createElement('span');
            iconSpan.textContent = moon.icon;
            badge.appendChild(iconSpan);
            frame.appendChild(badge);
          }
        },
      });

      fcCalendar.render();
    }, 50);

    return () => {
      clearInterval(interval);
      fcCalendar?.destroy();
    };
  });
</script>

<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
</svelte:head>

<div class="cal-layout">
  <!-- Calendar panel -->
  <div class="cal-panel">
    <div class="cal-subnav">
      {#if calFormat === 'gregoriano'}
        <button class="cal-sub-btn" class:active={calView === 'gym'} onclick={() => switchCalView('gym')}>
          🏋️ Gym
        </button>
        <button class="cal-sub-btn" class:active={calView === 'nutricion'} onclick={() => switchCalView('nutricion')}>
          🥗 Nutrición
        </button>
        <div class="subnav-sep"></div>
      {/if}
      <button class="cal-sub-btn fmt-btn" class:active={calFormat === 'gregoriano'} onclick={() => calFormat = 'gregoriano'}>
        📅 Gregoriano
      </button>
      <button class="cal-sub-btn fmt-btn" class:active={calFormat === '13lunas'} onclick={() => calFormat = '13lunas'}>
        🌕 Ciclo Lunar
      </button>
    </div>

    <!-- Gregoriano: siempre en el DOM, oculto con display -->
    <div style="display:{calFormat === 'gregoriano' ? 'contents' : 'none'}">
      <div class="legend">
        {#if calView === 'gym'}
          <div class="legend-item"><div class="legend-dot" style="background:#7c6af5"></div> Fuerza</div>
          <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div> Cardio</div>
          <div class="legend-item"><div class="legend-dot" style="background:#10b981"></div> Fuerza + Cardio</div>
        {:else}
          <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div> Ventana de alimentación</div>
        {/if}
      </div>
      <div bind:this={calEl} style="flex:1;min-height:0"></div>
    </div>

    <!-- 13 Lunas: solo se monta cuando está activo -->
    {#if calFormat === '13lunas'}
      <Luna13Cal
        {sessions} {ventanas}
        onSessionClick={(s) => { selectedVentana = null; selectedSession = s; }}
        onVentanaClick={(v) => { selectedSession = null; selectedVentana = v; }}
      />
    {/if}
  </div>

  <!-- Detail panel -->
  <div class="cal-detail">
    {#if selectedSession}
      <SessionDetail session={selectedSession} {ventanas} {perfil} />
    {:else if selectedVentana}
      <VentanaDetail ventana={selectedVentana} {perfil} {sessions} {ventanas} />
    {:else}
      <div class="empty-state">
        <div class="ei">📅</div>
        <p>Clickeá un evento</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .cal-layout {
    display: flex;
    flex: 1;
    height: 100%;
    overflow: hidden;
  }

  .cal-panel {
    flex: 1; padding: 18px 20px; overflow: hidden;
    background: var(--bg); border-right: 1px solid var(--b1);
    display: flex; flex-direction: column;
  }

  .cal-subnav {
    display: flex; gap: 4px; margin-bottom: 12px;
  }
  .cal-sub-btn {
    padding: 4px 12px;
    border: 1px solid var(--b1); border-radius: 5px;
    background: var(--s2); color: var(--muted);
    font-size: 11px; cursor: pointer; font-family: inherit;
    transition: all 0.12s;
  }
  .cal-sub-btn:hover  { background: var(--s3); color: var(--text); }
  .cal-sub-btn.active { background: var(--s3); border-color: var(--b2); color: #fff; }
  .subnav-sep { flex: 1; }
  .fmt-btn { margin-left: 2px; }

  .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--muted); }
  .legend-dot  { width: 8px; height: 8px; border-radius: 50%; }

  .cal-detail {
    width: 340px; flex-shrink: 0; overflow-y: auto;
    padding: 20px; background: var(--s1);
  }

  .empty-state {
    height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px; color: var(--dim);
  }
  .ei { font-size: 36px; opacity: 0.35; }
  .empty-state p { font-size: 13px; }

  /* FullCalendar dark theme overrides */
  :global(.fc) { flex: 1; min-height: 0; font-family: inherit; font-size: 12px; }
  :global(.fc .fc-toolbar) { margin-bottom: 12px; }
  :global(.fc .fc-toolbar-title) { color: var(--text); font-size: 14px; font-weight: 600; }
  :global(.fc-theme-standard .fc-scrollgrid) { border-color: #35354a; }
  :global(.fc-theme-standard td), :global(.fc-theme-standard th) { border-color: #35354a; }
  :global(.fc .fc-col-header-cell) { background: var(--s2); border-color: var(--b1); }
  :global(.fc .fc-col-header-cell-cushion) {
    color: var(--muted); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.07em;
    padding: 6px 4px; text-decoration: none;
  }
  :global(.fc .fc-daygrid-day) { background: var(--s1); }
  :global(.fc .fc-day-other)   { background: var(--bg); }
  :global(.fc .fc-day-today)   { background: rgba(124,106,245,.3) !important; }

  :global(.fc .fc-daygrid-day:hover .fc-daygrid-day-frame) { background: var(--s1); }
  :global(.fc .fc-daygrid-day-number)               { color: #c8c8de; font-size: 13px; font-weight: 600; text-decoration: none; padding: 6px 8px; }
  :global(.fc .fc-day-other .fc-daygrid-day-number) { color: #252530; font-weight: 400; }
  :global(.fc .fc-day-today) { background: rgba(124,106,245,.06) !important; }
  :global(.fc .fc-day-today .fc-daygrid-day-number) {
    background: var(--accent); color: #fff !important; font-weight: 700;
    border-radius: 50%; width: 26px; height: 26px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    margin: 4px 6px;
  }
  :global(.fc .fc-button) {
    background: var(--s2) !important; border-color: var(--b1) !important;
    color: var(--muted) !important; font-size: 11px !important;
    padding: 4px 10px !important; box-shadow: none !important;
    font-family: inherit !important;
  }
  :global(.fc .fc-button:hover)  { background: var(--s3) !important; color: var(--text) !important; }
  :global(.fc .fc-button-active),
  :global(.fc .fc-button:focus)  { background: var(--s3) !important; color: #fff !important; outline: none !important; }
  :global(.fc .fc-event) {
    border: none !important; font-size: 11px !important;
    padding: 2px 6px !important; cursor: pointer !important;
    border-radius: 4px !important;
  }
  :global(.fc .fc-event-title)  { font-weight: 500 !important; }
  :global(.fc .fc-more-link)    { color: var(--accent-l); font-size: 10px; }
  :global(.fc .fc-list-event)   { cursor: pointer; }
  :global(.fc .fc-list-event:hover td) { background: var(--s2); }
  :global(.fc .fc-list-empty)   { background: var(--bg); color: var(--dim); }
  :global(.fc .fc-list-table)   { background: var(--bg); }
  :global(.fc .fc-list-day-cushion) { background: var(--s2); }
  :global(.fc .fc-list-day-text),
  :global(.fc .fc-list-day-side-text) { color: var(--text); text-decoration: none; font-size: 12px; }

  /* Custom calendar event content */
  :global(.ev-nutri) { padding: 4px 8px; width: 100%; cursor: pointer; }
  :global(.ev-n-top)  { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
  :global(.ev-n-kcal) { font-size: 15px; font-weight: 800; color: #000; line-height: 1; }
  :global(.ev-n-unit) { font-size: 9px; color: rgba(0,0,0,0.5); flex: 1; }
  :global(.ev-n-gym)  { font-size: 10px; }
  :global(.ev-n-dot)  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  :global(.ev-n-macros) {
    display: flex; align-items: center; gap: 5px;
    font-size: 9px; color: rgba(0,0,0,0.6); margin-bottom: 4px;
  }
  :global(.ev-dot) { display: inline-block; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  :global(.ev-dot.prot) { background: #1e40af; }
  :global(.ev-dot.gras) { background: #991b1b; }
  :global(.ev-dot.carb) { background: #065f46; }
  :global(.ev-n-bar) { height: 3px; background: rgba(0,0,0,0.15); border-radius: 2px; overflow: hidden; }
  :global(.ev-n-bar-fill) { height: 100%; border-radius: 2px; }

  :global(.ev-gym) { padding: 5px 8px; width: 100%; cursor: pointer; display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
  :global(.ev-g-tag) {
    font-size: 10px; font-weight: 600;
    color: rgba(255,255,255,0.95);
    background: rgba(255,255,255,0.12);
    border-radius: 3px; padding: 1px 5px;
  }
  :global(.ev-g-cardio) {
    font-size: 10px; font-weight: 600;
    color: #93c5fd;
    background: rgba(59,130,246,0.2);
    border-radius: 3px; padding: 1px 5px;
  }
  :global(.ev-g-kcal) {
    font-size: 10px; font-weight: 600;
    color: rgba(255,255,255,0.6);
    margin-left: auto;
  }

  /* Moon phase */
  :global(.moon-badge) {
    position: absolute; bottom: 4px; right: 5px;
    font-size: 13px; opacity: 0.35;
    line-height: 1; pointer-events: none;
    display: flex; align-items: center; gap: 4px;
  }
  :global(.moon-badge.moon-key) {
    opacity: 0.85;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 4px; padding: 2px 6px;
    pointer-events: auto; cursor: default;
  }
  :global(.moon-label) {
    font-size: 10px; color: var(--muted);
    letter-spacing: 0.02em; white-space: nowrap;
  }

  /* Weight badge */
  :global(.peso-cal-badge) {
    position: absolute; bottom: 4px; left: 5px;
    font-size: 9px; font-weight: 700;
    color: #c084fc;
    background: rgba(192,132,252,0.1);
    border: 1px solid rgba(192,132,252,0.2);
    border-radius: 3px; padding: 1px 4px;
    pointer-events: none; line-height: 1.3;
  }
</style>
