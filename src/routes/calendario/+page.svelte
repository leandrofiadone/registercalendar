<script>
  import { onMount } from 'svelte';
  import { Calendar } from '@fullcalendar/core';
  import dayGridPlugin from '@fullcalendar/daygrid';
  import listPlugin from '@fullcalendar/list';
  import esLocale from '@fullcalendar/core/locales/es';
  import { sessionType, sessionColor } from '$lib/utils.js';
  import { getMoonPhase } from '$lib/moon.js';
  import { gymKcalDetallado } from '$lib/activity.js';
  import { getFastingStage } from '$lib/fasting.js';
  import SessionDetail from '$lib/SessionDetail.svelte';
  import VentanaDetail from '$lib/VentanaDetail.svelte';
  import Luna13Cal from '$lib/Luna13Cal.svelte';

  let { data } = $props();
  let sessions = $derived(data.sessions);
  let ventanas = $derived(data.ventanas);
  let perfil       = $derived(data.perfil);
  let alimentosRef = $derived(data.alimentosRef ?? []);

  let calView   = $state('nutricion');
  let calFormat = $state('gregoriano'); // 'gregoriano' | '13lunas'
  let selectedSession = $state(null);
  let selectedVentana = $state(null);

  let calEl;
  let fcCalendar = null;
  let calLoading = $state(false);

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
    const protMin     = perfil?.objetivos_diarios?.proteina_g_min ?? 160;

    // Compute fasting gaps between consecutive ventanas
    const sortedVentanas = [...ventanas].sort((a, b) => a.ventana_id.localeCompare(b.ventana_id));
    const fastingGaps = {};
    for (let i = 1; i < sortedVentanas.length; i++) {
      const prev = sortedVentanas[i - 1];
      const curr = sortedVentanas[i];
      const prevMeals = (prev.comidas || []).filter(c => c.hora).sort((a, b) => b.hora.localeCompare(a.hora));
      const currMeals = (curr.comidas || []).filter(c => c.hora).sort((a, b) => a.hora.localeCompare(b.hora));
      if (prevMeals.length && currMeals.length) {
        const lastDt = new Date(`${prev.ventana_id}T${prevMeals[0].hora}:00`);
        const firstDt = new Date(`${curr.ventana_id}T${currMeals[0].hora}:00`);
        const gh = (firstDt - lastDt) / 3_600_000;
        if (gh > 1) fastingGaps[curr.ventana_id] = Math.round(gh);
      }
    }

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
      const protOk = (t.proteina_g || 0) >= protMin;
      const zoneBg = { ok: 'rgba(74,222,128,0.08)', warn: 'rgba(251,191,36,0.08)', over: 'rgba(248,113,113,0.08)' }[zone];
      return {
        title: '',
        date: v.ventana_id,
        backgroundColor: zoneBg,
        borderColor: 'transparent',
        textColor: '#e2e8f0',
        extendedProps: {
          type: 'nutri', vIdx: i,
          kcal: consumed,
          prot: Math.round(t.proteina_g || 0),
          gras: Math.round(t.grasa_g || 0),
          carb: Math.round(t.carbos_g || 0),
          kcalTarget, zone, pct,
          hasGym: !!gymSess,
          protOk,
          fastGap: fastingGaps[v.ventana_id] || null,
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
    calLoading = false;

    fcCalendar = new Calendar(calEl, {
      plugins: [dayGridPlugin, listPlugin],
      initialView: 'dayGridMonth',
      locale: esLocale,
      height: '100%',
      fixedWeekCount: false,
      headerToolbar: {
        left:   'prev,next today',
        center: 'title',
        right:  'dayGridMonth,listMonth',
      },
      buttonText: { today: 'Hoy', month: 'Mes', list: 'Lista' },
      events: nutriCalEvents(),

      eventContent(arg) {
        const p = arg.event.extendedProps;
        const mobile = window.innerWidth < 768;

        if (p.type === 'nutri') {
          const zoneAccent = { ok: '#4ade80', warn: '#fbbf24', over: '#f87171' }[p.zone];
          const zoneFill   = { ok: '#16a34a', warn: '#d97706', over: '#dc2626' }[p.zone];
          if (mobile) {
            return { html: `<div class="ev-nutri-m"><span class="ev-nm-kcal">${p.kcal}</span><span class="ev-nm-dot" style="background:${zoneAccent}"></span></div>` };
          }
          const gymBadge  = p.hasGym ? `<span class="ev-n-gym">💪</span>` : '';
          const protWarn  = !p.protOk ? `<span class="ev-n-protwarn">⚠</span>` : '';
          // Fasting badge with stage color
          let fastBadge = '';
          if (p.fastGap) {
            const fs = getFastingStage(p.fastGap);
            fastBadge = `<span class="ev-n-fast" style="color:${fs.color};background:${fs.glow}">${fs.icon} ${p.fastGap}h</span>`;
          }
          return { html: `<div class="ev-nutri" style="border-left-color:${zoneAccent}">
            <div class="ev-n-top">
              <span class="ev-n-kcal" style="color:${zoneAccent}">${p.kcal}</span>
              <span class="ev-n-sep">/</span>
              <span class="ev-n-target">${p.kcalTarget}</span>
              ${gymBadge}${protWarn}
              ${fastBadge}
            </div>
            <div class="ev-n-bar"><div class="ev-n-bar-fill" style="width:${p.pct}%;background:${zoneFill}"></div></div>
            <div class="ev-n-macros">
              <span class="ev-mac${!p.protOk ? ' prot-low' : ''}"><span class="ev-dot prot"></span>${p.prot}p</span>
              <span class="ev-mac"><span class="ev-dot gras"></span>${p.gras}g</span>
              <span class="ev-mac"><span class="ev-dot carb"></span>${p.carb}c</span>
            </div>
          </div>` };
        }
        if (p.type === 'gym') {
          if (mobile) {
            const label = (p.groups[0] || (p.hasCardio ? 'Cardio' : '')).split('-')[0];
            const extra = (p.groups.length - 1) + (p.hasCardio ? 1 : 0);
            const moreStr = extra > 0 ? `<span class="ev-gm-more">+${extra}</span>` : '';
            return { html: `<div class="ev-gym-m"><span class="ev-gm-lbl">${label}</span>${moreStr}</div>` };
          }
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
        if (!frame) return;

        if (calView === 'gym' && gymDates.has(d)) {
          frame.style.background = 'rgba(124,106,245,0.06)';
        }
        if (calView === 'nutricion' && nutriDates.has(d)) {
          // Tint by zone
          const v = ventanas.find(v => v.ventana_id === d);
          if (v) {
            const t = v.totales_ventana || {};
            const consumed = t.kcal || 0;
            const pesoKg = perfil?.historial_peso?.at(-1)?.peso_kg ?? 80;
            const tdeBase = perfil?.metabolismo?.gasto_total_descanso_kcal ?? 2776;
            const kcalBase = perfil?.objetivos_diarios?.kcal_dia_descanso ?? 2276;
            const gymSess = sessions.find(s => s.date === d);
            let kcalAct = 0;
            if (gymSess) { const det = gymKcalDetallado(gymSess, pesoKg); kcalAct = det.fuerza + det.cardio.reduce((s,c) => s+c.kcal, 0); }
            const target = Math.round(kcalBase + kcalAct);
            const maint = Math.round(tdeBase + kcalAct);
            const bg = consumed <= target ? 'rgba(74,222,128,0.05)' : consumed <= maint ? 'rgba(251,191,36,0.05)' : 'rgba(248,113,113,0.05)';
            frame.style.background = bg;
          }
        }

        if (frame.dataset.decorated) return;
        frame.dataset.decorated = '1';

        const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
        const isPast  = info.date < todayMidnight;
        const isToday = info.date.getTime() === todayMidnight.getTime();
        if (isPast || isToday) {
          const line = document.createElement('div');
          line.className = 'cal-timeline';
          line.style.background = isPast
            ? 'rgba(120,110,200,0.14)'
            : 'linear-gradient(90deg,rgba(165,148,249,0.56) 0%,transparent 100%)';
          frame.appendChild(line);
        }

        if (pesoByDate[d]) {
          const wb = document.createElement('div');
          wb.className = 'peso-cal-badge';
          wb.textContent = pesoByDate[d] + ' kg';
          frame.appendChild(wb);
        }

        const moon = getMoonPhase(info.date);
        const isKeyPhase = moon.name === 'Luna llena' || moon.name === 'Luna nueva';
        const hasData = gymDates.has(d) || nutriDates.has(d);
        // Only show moon on key phases or days with data
        if (isKeyPhase || hasData) {
          const badge = document.createElement('div');
          badge.className = 'moon-badge' + (isKeyPhase ? ' moon-key' : '');
          badge.title = `${moon.name} (día ${Math.round(moon.age)} del ciclo)`;
          if (isKeyPhase) {
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

    return () => fcCalendar?.destroy();
  });
</script>

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

  <!-- Detail panel (sidebar on desktop, overlay on mobile) -->
  {#if selectedSession || selectedVentana}
    <div class="cal-detail">
      <button class="cal-detail-close" onclick={() => { selectedSession = null; selectedVentana = null; }}>✕</button>
      {#if selectedSession}
        <SessionDetail session={selectedSession} {ventanas} {perfil} {alimentosRef} />
      {:else if selectedVentana}
        <VentanaDetail ventana={selectedVentana} {perfil} {sessions} {ventanas} {alimentosRef} />
      {/if}
    </div>
  {/if}

  <!-- Desktop empty state (hidden on mobile) -->
  {#if !selectedSession && !selectedVentana}
    <div class="cal-detail cal-detail-empty">
      <div class="empty-state">
        <div class="ei">📅</div>
        <p>Seleccioná un evento del calendario</p>
      </div>
    </div>
  {/if}
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
    position: relative;
  }
  .cal-detail-close {
    display: none;
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
    padding: 1px 3px !important; cursor: pointer !important;
    border-radius: 3px !important;
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

  /* Custom calendar event content — nutrición */
  :global(.ev-nutri) {
    padding: 2px 5px; width: 100%; cursor: pointer;
    border-left: 2px solid; border-radius: 2px;
    background: rgba(255,255,255,0.03);
  }
  :global(.ev-n-top)  {
    display: flex; align-items: baseline; gap: 2px; margin-bottom: 1px;
    line-height: 1;
  }
  :global(.ev-n-kcal) {
    font-size: 10px; font-weight: 800; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  :global(.ev-n-sep) { font-size: 8px; color: #475569; }
  :global(.ev-n-target) { font-size: 8px; color: #64748b; font-weight: 500; font-variant-numeric: tabular-nums; }
  :global(.ev-n-gym) { font-size: 8px; margin-left: auto; }
  :global(.ev-n-fast) {
    font-size: 7px; font-weight: 700;
    border-radius: 2px; padding: 0 2px;
    margin-left: auto; flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  :global(.ev-n-protwarn) {
    font-size: 7px; margin-left: 1px; opacity: 0.8;
  }
  :global(.ev-n-macros) {
    display: flex; align-items: center; gap: 3px;
    font-size: 8px; color: #94a3b8; margin-top: 1px;
    font-variant-numeric: tabular-nums;
  }
  :global(.ev-mac) { display: flex; align-items: center; gap: 1px; }
  :global(.ev-mac.prot-ok) { color: #4ade80; }
  :global(.ev-mac.prot-low) { color: #f87171; }
  :global(.ev-dot) { display: inline-block; width: 3px; height: 3px; border-radius: 50%; flex-shrink: 0; }
  :global(.ev-dot.prot) { background: #60a5fa; }
  :global(.ev-dot.gras) { background: #f87171; }
  :global(.ev-dot.carb) { background: #34d399; }
  :global(.ev-n-bar) { height: 2px; background: rgba(255,255,255,0.08); border-radius: 1px; overflow: hidden; }
  :global(.ev-n-bar-fill) { height: 100%; border-radius: 1px; transition: width 0.3s; }

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

  /* Timeline line (replaces inline styles) */
  :global(.cal-timeline) {
    position: absolute; bottom: 24%; left: 0; right: 0;
    height: 1px; pointer-events: none; z-index: 0;
  }

  /* Mobile event styles */
  :global(.ev-gym-m) {
    display: flex; align-items: center; gap: 3px;
    padding: 2px 4px; width: 100%; overflow: hidden;
  }
  :global(.ev-gm-lbl) {
    font-size: 9px; font-weight: 700;
    color: rgba(255,255,255,.9);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex: 1; min-width: 0;
  }
  :global(.ev-gm-more) {
    font-size: 8px; color: rgba(255,255,255,.6);
    flex-shrink: 0; margin-left: 2px;
  }
  :global(.ev-nutri-m) {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 4px; width: 100%;
  }
  :global(.ev-nm-kcal) {
    font-size: 9px; font-weight: 800; color: #e2e8f0; flex: 1;
    font-variant-numeric: tabular-nums;
  }
  :global(.ev-nm-dot) {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .cal-layout { flex-direction: column; }
    .cal-panel { padding: 6px 8px; }
    .cal-subnav { gap: 3px; margin-bottom: 6px; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; }
    .cal-sub-btn { font-size: 10px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
    .subnav-sep { display: none; }
    .fmt-btn { margin-left: 0; }
    .legend { display: none; }

    /* Detail panel becomes a full-screen overlay on mobile */
    .cal-detail-empty { display: none; }
    .cal-detail {
      position: fixed; inset: 0; z-index: 300;
      width: 100%; max-height: 100%;
      background: var(--bg);
      padding: 16px;
      overflow-y: auto;
    }
    .cal-detail-close {
      display: flex; align-items: center; justify-content: center;
      position: sticky; top: 0; left: 0;
      margin-bottom: 12px;
      background: var(--s2); border: 1px solid var(--b1);
      border-radius: 6px; padding: 6px 14px;
      font-size: 12px; color: var(--muted);
      cursor: pointer; font-family: inherit;
      width: 100%;
    }
    .cal-detail-close:hover { color: var(--text); }

    :global(.fc .fc-toolbar-title) { font-size: 13px !important; }
    :global(.fc .fc-toolbar) { gap: 4px !important; flex-wrap: wrap !important; }
    :global(.fc .fc-button) { font-size: 10px !important; padding: 3px 7px !important; }
    :global(.fc .fc-daygrid-day-number) { font-size: 11px !important; padding: 3px 5px !important; }
    :global(.fc .fc-col-header-cell-cushion) { font-size: 9px !important; padding: 4px 2px !important; }
    :global(.fc .fc-event) { padding: 0 !important; margin: 1px 2px !important; }
  }
</style>
