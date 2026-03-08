import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE    = join(__dirname, 'data', 'log.json');
const NUTRI_FILE  = join(__dirname, 'data', 'nutricion.json');
const PERFIL_FILE = join(__dirname, 'data', 'perfil.json');
const PORT = 3000;

function loadLog()    { return existsSync(LOG_FILE)    ? JSON.parse(readFileSync(LOG_FILE,    'utf-8')) : { sessions: [] }; }
function loadNutri()  { return existsSync(NUTRI_FILE)  ? JSON.parse(readFileSync(NUTRI_FILE,  'utf-8')) : { ventanas: [] }; }
function loadPerfil() { return existsSync(PERFIL_FILE) ? JSON.parse(readFileSync(PERFIL_FILE, 'utf-8')) : null; }

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gym Tracker</title>
<script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js'><\/script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0a0a0f;
  --s1: #111118;
  --s2: #17171f;
  --s3: #1e1e28;
  --b1: #22222e;
  --b2: #2d2d3e;
  --text: #dcdcec;
  --muted: #707088;
  --dim: #404055;
  --accent: #7c6af5;
  --accent-l: #a594f9;
  --blue: #3b82f6;
  --blue-l: #93c5fd;
  --green: #10b981;
  --green-l: #6ee7b7;
  --amber: #f59e0b;
  --red: #ef4444;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-size: 13px;
  line-height: 1.5;
}

/* ── Header ── */
.header {
  position: sticky; top: 0; z-index: 200;
  background: rgba(10, 10, 15, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--b1);
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 54px;
}

.logo {
  font-size: 14px; font-weight: 700; color: #fff;
  letter-spacing: -0.02em;
  display: flex; align-items: center; gap: 7px;
  flex-shrink: 0; white-space: nowrap;
}
.logo-icon { font-size: 17px; }

.stats-bar { display: flex; gap: 5px; flex: 1; overflow: hidden; }

.stat-chip {
  background: var(--s2); border: 1px solid var(--b1);
  border-radius: 6px; padding: 3px 9px;
  font-size: 11px; color: var(--muted);
  display: flex; align-items: center; gap: 5px;
  white-space: nowrap; flex-shrink: 0;
}
.stat-chip .v { color: var(--text); font-weight: 600; }

.tabs { display: flex; gap: 2px; flex-shrink: 0; }
.tab-btn {
  padding: 5px 14px;
  border: 1px solid transparent; border-radius: 6px;
  background: none; color: var(--muted);
  font-size: 12px; cursor: pointer;
  transition: all 0.12s; font-family: inherit;
  display: flex; align-items: center; gap: 5px;
}
.tab-btn:hover { background: var(--s2); color: var(--text); }
.tab-btn.active { background: var(--s3); border-color: var(--b2); color: #fff; }

/* ── Tab containers ── */
.tab-panel { display: none; }
.tab-panel.active { display: flex; height: calc(100vh - 54px); }

/* ── Sidebar ── */
.sidebar {
  width: 216px; flex-shrink: 0;
  border-right: 1px solid var(--b1);
  overflow-y: auto; background: var(--s1);
}

.sidebar-item {
  padding: 11px 15px; cursor: pointer;
  border-bottom: 1px solid var(--b1);
  transition: background 0.1s;
  position: relative; padding-left: 17px;
}
.sidebar-item::before {
  content: ''; position: absolute;
  left: 0; top: 0; bottom: 0; width: 3px;
  background: transparent; transition: background 0.1s;
}
.sidebar-item.t-fuerza::before  { background: var(--accent); }
.sidebar-item.t-cardio::before  { background: var(--blue); }
.sidebar-item.t-mixed::before   { background: var(--green); }
.sidebar-item.t-nutri::before   { background: var(--amber); }
.sidebar-item.t-ventana::before { background: var(--amber); }
.sidebar-item.t-other::before   { background: var(--dim); }
.sidebar-item:hover  { background: var(--s2); }
.sidebar-item.active { background: var(--s3); }
.sidebar-item .date  { font-size: 12px; font-weight: 600; color: #bbb; margin-bottom: 5px; }
.sidebar-item .si-tags { display: flex; flex-wrap: wrap; gap: 3px; }

.tag {
  font-size: 10px; padding: 1px 6px; border-radius: 3px;
  background: var(--s3); color: var(--dim); border: 1px solid var(--b2);
}
.tag.tf { background: rgba(124,106,245,.12); color: var(--accent-l); border-color: rgba(124,106,245,.25); }
.tag.tc { background: rgba(59,130,246,.12);  color: var(--blue-l);   border-color: rgba(59,130,246,.25); }
.tag.tn { background: rgba(16,185,129,.12);  color: var(--green-l);  border-color: rgba(16,185,129,.25); }
.tag.ta { background: rgba(245,158,11,.12);  color: var(--amber);    border-color: rgba(245,158,11,.25); }

/* ── Main detail ── */
.main { flex: 1; overflow-y: auto; padding: 26px 30px; }

.empty-state {
  height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; color: var(--dim);
}
.empty-state .ei { font-size: 36px; opacity: 0.35; }
.empty-state p { font-size: 13px; }

/* Session header */
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

/* Section */
.section { margin-bottom: 26px; }
.sec-label {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--dim); margin-bottom: 10px;
  display: flex; align-items: center; gap: 8px;
}
.sec-label::after { content: ''; flex: 1; height: 1px; background: var(--b1); }

/* Exercise card */
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

/* Cardio card */
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

/* Nutrition */
.meal-card {
  background: var(--s1); border: 1px solid var(--b1);
  border-radius: 8px; padding: 13px 15px; margin-bottom: 8px;
}
.meal-tipo {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--green);
}
.meal-hora { color: var(--dim); font-size: 11px; margin-left: 8px; }
.meal-fecha-badge {
  display: inline-block; font-size: 9px;
  color: var(--amber); background: rgba(245,158,11,.1);
  border: 1px solid rgba(245,158,11,.2);
  border-radius: 3px; padding: 0 5px; margin-left: 6px;
}
.meal-desc { font-size: 13px; color: #bbb; margin: 7px 0 10px; }

.macros-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 6px; background: var(--s2);
  border: 1px solid var(--b1); border-radius: 6px;
  padding: 10px; margin-bottom: 10px;
}
.mc { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.mc-val { font-size: 17px; font-weight: 700; line-height: 1; }
.mc-val.kcal { color: var(--amber); }
.mc-val.prot { color: var(--blue); }
.mc-val.gras { color: var(--red); }
.mc-val.carb { color: var(--green); }
.mc-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); }

.macros-grid.summary {
  margin-bottom: 0;
  border-color: rgba(245,158,11,.2);
  background: rgba(245,158,11,.04);
}
.macros-grid.summary .mc-val { font-size: 22px; }

.alimentos { list-style: none; }
.alimentos li {
  display: flex; justify-content: space-between;
  align-items: center; padding: 5px 0;
  border-bottom: 1px solid var(--b1);
  font-size: 11px;
}
.alimentos li:last-child { border-bottom: none; }
.al-name  { color: #bbb; }
.al-macros { color: var(--dim); font-size: 10px; }

.estimado-badge {
  font-size: 9px; color: var(--amber);
  background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.2);
  border-radius: 3px; padding: 0 5px; margin-left: 6px;
}

.protocolo-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(124,106,245,.1); border: 1px solid rgba(124,106,245,.22);
  border-radius: 5px; padding: 4px 10px;
  font-size: 11px; color: var(--accent-l); margin-bottom: 12px;
}

/* ── CALENDAR TAB ── */
.cal-layout { display: flex; flex: 1; overflow: hidden; }

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

.cal-detail {
  width: 340px; flex-shrink: 0; overflow-y: auto;
  padding: 20px; background: var(--s1);
}
.cal-detail .empty-state { height: 100%; }

/* FullCalendar dark theme overrides */
.fc { flex: 1; min-height: 0; font-family: inherit; font-size: 12px; }
.fc .fc-toolbar { margin-bottom: 12px; }
.fc .fc-toolbar-title { color: var(--text); font-size: 14px; font-weight: 600; }
.fc-theme-standard .fc-scrollgrid { border-color: var(--b1); }
.fc-theme-standard td, .fc-theme-standard th { border-color: var(--b1); }
.fc .fc-col-header-cell { background: var(--s2); border-color: var(--b1); }
.fc .fc-col-header-cell-cushion {
  color: var(--muted); font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.07em;
  padding: 6px 4px; text-decoration: none;
}
.fc .fc-daygrid-day { background: var(--bg); }
.fc .fc-daygrid-day:hover .fc-daygrid-day-frame { background: var(--s1); }
.fc .fc-daygrid-day-number { color: var(--dim); font-size: 11px; text-decoration: none; }
.fc .fc-day-today { background: rgba(124,106,245,.05) !important; }
.fc .fc-day-today .fc-daygrid-day-number { color: var(--accent); font-weight: 700; }
.fc .fc-button {
  background: var(--s2) !important; border-color: var(--b1) !important;
  color: var(--muted) !important; font-size: 11px !important;
  padding: 4px 10px !important; box-shadow: none !important;
  font-family: inherit !important;
}
.fc .fc-button:hover   { background: var(--s3) !important; color: var(--text) !important; }
.fc .fc-button-active,
.fc .fc-button:focus   { background: var(--s3) !important; color: #fff !important; outline: none !important; }
.fc .fc-event {
  border: none !important; font-size: 11px !important;
  padding: 2px 6px !important; cursor: pointer !important;
  border-radius: 4px !important;
}
.fc .fc-event-title  { font-weight: 500 !important; }
.fc .fc-more-link    { color: var(--accent-l); font-size: 10px; }
.fc .fc-list-event   { cursor: pointer; }
.fc .fc-list-event:hover td { background: var(--s2); }
.fc .fc-list-empty   { background: var(--bg); color: var(--dim); }
.fc .fc-list-table   { background: var(--bg); }
.fc .fc-list-day-cushion { background: var(--s2); }
.fc .fc-list-day-text,
.fc .fc-list-day-side-text { color: var(--text); text-decoration: none; font-size: 12px; }

/* Legend */
.legend { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--muted); }
.legend-dot  { width: 8px; height: 8px; border-radius: 50%; }

/* ── Custom calendar event content ── */
.ev-nutri { padding: 4px 8px; width: 100%; cursor: pointer; }
.ev-n-top  { display: flex; align-items: baseline; gap: 4px; margin-bottom: 3px; }
.ev-n-kcal { font-size: 15px; font-weight: 800; color: #000; line-height: 1; }
.ev-n-unit { font-size: 9px; color: rgba(0,0,0,0.5); }
.ev-n-macros {
  display: flex; align-items: center; gap: 5px;
  font-size: 9px; color: rgba(0,0,0,0.6); margin-bottom: 4px;
}
.ev-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.ev-dot.prot { background: #1e40af; }
.ev-dot.gras { background: #991b1b; }
.ev-dot.carb { background: #065f46; }
.ev-n-bar { height: 3px; background: rgba(0,0,0,0.15); border-radius: 2px; overflow: hidden; }
.ev-n-bar-fill { height: 100%; background: rgba(0,0,0,0.45); border-radius: 2px; }

.ev-gym { padding: 5px 8px; width: 100%; cursor: pointer; display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
.ev-g-tag {
  font-size: 10px; font-weight: 600;
  color: rgba(255,255,255,0.95);
  background: rgba(255,255,255,0.12);
  border-radius: 3px; padding: 1px 5px;
}
.ev-g-cardio {
  font-size: 10px; font-weight: 600;
  color: #93c5fd;
  background: rgba(59,130,246,0.2);
  border-radius: 3px; padding: 1px 5px;
}

/* ── Perfil tab ── */
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
.pstat-val.hi { color: var(--accent-l); }
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

/* ── Target progress bars (in ventana detail) ── */
.targets-section {
  background: var(--s2); border: 1px solid var(--b1);
  border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;
}
.targets-title {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--dim); margin-bottom: 12px;
}
.target-row { margin-bottom: 10px; }
.target-row:last-child { margin-bottom: 0; }
.target-meta {
  display: flex; justify-content: space-between;
  font-size: 10px; margin-bottom: 4px;
}
.target-meta-lbl { color: var(--muted); }
.target-meta-val { color: var(--text); font-weight: 600; }
.target-meta-val.over { color: var(--amber); }
.target-bar-bg {
  height: 5px; background: var(--b2); border-radius: 3px; overflow: hidden;
}
.target-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

.deficit-chip {
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 6px; padding: 6px 12px;
  font-size: 12px; font-weight: 700; margin-top: 12px;
}
.deficit-chip.positive {
  background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.25); color: var(--green);
}
.deficit-chip.negative {
  background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.25); color: var(--red);
}
.deficit-chip.neutral {
  background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.25); color: var(--amber);
}

/* ── Nutrición history bars ── */
.hist-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0; border-bottom: 1px solid var(--b1); font-size: 11px;
}
.hist-row:last-child { border-bottom: none; }
.hist-date { color: var(--muted); width: 72px; flex-shrink: 0; }
.hist-bar-wrap { flex: 1; height: 6px; background: var(--b2); border-radius: 3px; overflow: hidden; }
.hist-bar-fill { height: 100%; border-radius: 3px; }
.hist-kcal { width: 54px; text-align: right; color: var(--text); font-weight: 600; }
.hist-deficit { width: 60px; text-align: right; font-size: 10px; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 2px; }
</style>
</head>
<body>

<header class="header">
  <div class="logo"><span class="logo-icon">🏋️</span> Gym Tracker</div>
  <div class="stats-bar" id="stats-bar"></div>
  <div class="tabs">
    <button class="tab-btn active"  onclick="switchTab('sessions')">📋 Sesiones</button>
    <button class="tab-btn"         onclick="switchTab('nutricion')">🥗 Nutrición</button>
    <button class="tab-btn"         onclick="switchTab('calendar')">📅 Calendario</button>
    <button class="tab-btn"         onclick="switchTab('perfil')">👤 Perfil</button>
  </div>
</header>

<!-- ═══ SESSIONS TAB ═══ -->
<div class="tab-panel active" id="tab-sessions">
  <div class="sidebar" id="sidebar"></div>
  <div class="main" id="main">
    <div class="empty-state">
      <div class="ei">📋</div>
      <p>Seleccioná una sesión</p>
    </div>
  </div>
</div>

<!-- ═══ NUTRICIÓN TAB ═══ -->
<div class="tab-panel" id="tab-nutricion">
  <div class="sidebar" id="nutri-sidebar"></div>
  <div class="main" id="nutri-main">
    <div class="empty-state">
      <div class="ei">🥗</div>
      <p>Seleccioná una ventana de alimentación</p>
    </div>
  </div>
</div>

<!-- ═══ PERFIL TAB ═══ -->
<div class="tab-panel" id="tab-perfil">
  <div class="perfil-layout" id="perfil-main">
    <div class="empty-state"><div class="ei">👤</div><p>Cargando perfil…</p></div>
  </div>
</div>

<!-- ═══ CALENDAR TAB ═══ -->
<div class="tab-panel" id="tab-calendar">
  <div class="cal-layout">
    <div class="cal-panel">
      <div class="cal-subnav">
        <button class="cal-sub-btn active" onclick="switchCalView('gym')">🏋️ Gym</button>
        <button class="cal-sub-btn"        onclick="switchCalView('nutricion')">🥗 Nutrición</button>
      </div>
      <div class="legend" id="cal-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#7c6af5"></div> Fuerza</div>
        <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div> Cardio</div>
        <div class="legend-item"><div class="legend-dot" style="background:#10b981"></div> Fuerza + Cardio</div>
      </div>
      <div id="fc-calendar" style="flex:1;min-height:0"></div>
    </div>
    <div class="cal-detail" id="cal-detail">
      <div class="empty-state">
        <div class="ei">📅</div>
        <p>Clickeá un evento</p>
      </div>
    </div>
  </div>
</div>

<script>
let sessions = [];
let ventanas = [];
let perfil   = null;
let fcCalendar = null;
let calReady   = false;
let calView    = 'gym';

const GYM_LEGEND   = \`<div class="legend-item"><div class="legend-dot" style="background:#7c6af5"></div> Fuerza</div>
  <div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div> Cardio</div>
  <div class="legend-item"><div class="legend-dot" style="background:#10b981"></div> Fuerza + Cardio</div>\`;
const NUTRI_LEGEND = \`<div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div> Ventana de alimentación</div>\`;

// ─── Load ─────────────────────────────────────────────────────────────────────
async function load() {
  const [rSess, rNutri, rPerfil] = await Promise.all([
    fetch('/api/sessions'),
    fetch('/api/nutricion'),
    fetch('/api/perfil'),
  ]);
  sessions = await rSess.json();
  ventanas = await rNutri.json();
  perfil   = await rPerfil.json();
  renderStats();
  renderSidebar();
  renderNutriSidebar();
  renderPerfil();
  if (sessions.length > 0) renderSession(0, 'main');
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function renderStats() {
  const now = new Date();
  const ym  = \`\${now.getFullYear()}-\${String(now.getMonth()+1).padStart(2,'0')}\`;
  const thisMonth = sessions.filter(s => s.date.startsWith(ym)).length;

  const dateSet = new Set(sessions.map(s => s.date));
  let streak = 0;
  const d = new Date();
  while (dateSet.has(d.toISOString().split('T')[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const groupCount = {};
  sessions.forEach(s => (s.groups || []).forEach(g => { groupCount[g] = (groupCount[g]||0)+1; }));
  const fav = Object.entries(groupCount).sort((a,b) => b[1]-a[1])[0];

  const totalKcal = ventanas.reduce((sum, v) => sum + (v.totales_ventana?.kcal || 0), 0);

  const chips = [
    chip('Sesiones', sessions.length),
    chip('Mes',  thisMonth),
    streak > 0 ? chip('Racha', streak + 'd') : '',
    fav ? chip('Top', fav[0]) : '',
    totalKcal > 0 ? chip('kcal log', totalKcal) : '',
  ].filter(Boolean).join('');

  document.getElementById('stats-bar').innerHTML = chips;
}

function chip(label, val) {
  return \`<div class="stat-chip">\${label} <span class="v">\${val}</span></div>\`;
}

// ─── Gym Sidebar ──────────────────────────────────────────────────────────────
function sessionType(s) {
  const f = s.fuerza?.length > 0;
  const c = s.cardio?.length > 0;
  const n = !!s.nutricion_ref;
  if (f && c) return 'mixed';
  if (f) return 'fuerza';
  if (c) return 'cardio';
  if (n) return 'nutri';
  return 'other';
}

function sessionColor(s) {
  return { fuerza:'#7c6af5', cardio:'#3b82f6', mixed:'#10b981', nutri:'#f59e0b', other:'#555' }[sessionType(s)];
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = sessions.map((s, i) => {
    const type = sessionType(s);
    const tags = [];
    if (s.fuerza?.length) (s.groups || ['Fuerza']).forEach(g => tags.push(\`<span class="tag tf">\${g}</span>\`));
    if (s.cardio?.length) tags.push('<span class="tag tc">Cardio</span>');
    if (s.nutricion_ref)  tags.push('<span class="tag ta">Nutrición</span>');
    return \`<div class="sidebar-item t-\${type}" onclick="selectSession(\${i})" id="item-\${i}">
      <div class="date">\${fmtDate(s.date)}</div>
      <div class="si-tags">\${tags.join('')}</div>
    </div>\`;
  }).join('');
}

function selectSession(idx) {
  document.querySelectorAll('#sidebar .sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById('item-' + idx)?.classList.add('active');
  renderSession(idx, 'main');
}

// ─── Nutrición Sidebar ────────────────────────────────────────────────────────
function renderNutriSidebar() {
  const sb = document.getElementById('nutri-sidebar');
  if (!ventanas.length) {
    sb.innerHTML = '<div style="padding:20px;color:var(--dim);font-size:12px">Sin registros</div>';
    return;
  }
  sb.innerHTML = ventanas.map((v, i) => {
    const t = v.totales_ventana || {};
    const nComidas = v.comidas?.length || 0;
    return \`<div class="sidebar-item t-ventana" onclick="selectVentana(\${i})" id="vitem-\${i}">
      <div class="date">\${fmtDate(v.ventana_id)}</div>
      <div class="si-tags">
        \${t.kcal != null ? \`<span class="tag ta">\${t.kcal} kcal</span>\` : ''}
        <span class="tag">\${nComidas} comida\${nComidas !== 1 ? 's' : ''}</span>
        \${v.protocolo ? '<span class="tag">IF</span>' : ''}
      </div>
    </div>\`;
  }).join('');
}

function selectVentana(idx) {
  document.querySelectorAll('#nutri-sidebar .sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById('vitem-' + idx)?.classList.add('active');
  renderVentana(idx, 'nutri-main');
}

// ─── Session detail ───────────────────────────────────────────────────────────
function renderSession(idx, targetId) {
  const s = sessions[idx];
  if (!s) return;
  const target = document.getElementById(targetId);

  let html = \`<div class="sess-header">
    <h2>\${fmtDateLong(s.date)}</h2>
    <div class="meta-row">\`;
  if (s.gimnasio)  html += mbadge('🏛', s.gimnasio);
  if (s.ciudad)    html += mbadge('📍', s.ciudad);
  if (s.weight_kg) html += mbadge('⚖️', s.weight_kg + ' kg');
  if (s.energy)    html += mbadge('⚡', s.energy);
  html += \`</div></div>\`;

  // Fuerza
  if (s.fuerza?.length) {
    html += \`<div class="section"><div class="sec-label">💪 Fuerza</div>\`;
    for (const e of s.fuerza) {
      html += \`<div class="ex-card">
        <div class="ex-name-row">
          <span class="ex-name">\${e.ejercicio}</span>
          \${e.equipo ? \`<span class="ex-equipo">\${e.equipo}</span>\` : ''}
        </div>\`;
      if (e.musculo_principal) {
        const sec = e.musculos_secundarios?.length
          ? ' <span style="color:var(--dim)">· ' + e.musculos_secundarios.join(', ') + '</span>'
          : '';
        html += \`<div class="ex-muscles"><span class="mp">\${e.musculo_principal}</span>\${sec}</div>\`;
      }
      html += \`<div class="sets-row">\`;
      for (const set of e.sets) {
        if (set.tipo === 'dropset') {
          const drops = set.drops.map(d =>
            \`<span class="sr">\${d.reps}</span><span style="color:var(--dim)">×</span><span class="sw">\${d.peso_kg}kg</span>\`
          ).join('<span class="drop-sep">→</span>');
          html += \`<div class="set-pill ds"><span class="sn">S\${set.set}</span>\${drops}</div>\`;
        } else {
          html += \`<div class="set-pill"><span class="sn">S\${set.set}</span><span class="sr">\${set.reps}</span><span style="color:var(--dim)">×</span><span class="sw">\${set.peso_kg}kg</span></div>\`;
        }
      }
      html += \`</div>\`;
      if (e.notas) html += \`<div class="ex-notas">\${e.notas}</div>\`;
      html += \`</div>\`;
    }
    html += \`</div>\`;
  }

  // Cardio
  if (s.cardio?.length) {
    html += \`<div class="section"><div class="sec-label">🏃 Cardio</div>\`;
    for (const c of s.cardio) {
      html += \`<div class="cardio-card">
        <div class="cardio-name">\${c.ejercicio}\${c.equipo ? \` <span style="font-size:11px;color:var(--dim)">· \${c.equipo}</span>\` : ''}</div>
        <div class="cardio-metrics">\`;
      if (c.duracion_min)   html += cmetric(c.duracion_min, 'min');
      if (c.distancia_km)   html += cmetric(c.distancia_km, 'km');
      if (c.distancia_m)    html += cmetric(c.distancia_m, 'm');
      if (c.largos)         html += cmetric(c.largos, 'largos');
      if (c.pasos)          html += cmetric(c.pasos, 'pasos');
      if (c.kcal)           html += cmetric(c.kcal, 'kcal');
      if (c.velocidad_kmh)  html += cmetric(c.velocidad_kmh, 'km/h');
      if (c.intensidad)     html += cmetric(c.intensidad, 'intensidad');
      html += \`</div>\`;
      if (c.notas) html += \`<div class="ex-notas" style="margin-top:10px">\${c.notas}</div>\`;
      html += \`</div>\`;
    }
    html += \`</div>\`;
  }

  // Nutrición vinculada
  if (s.nutricion_ref) {
    const v = ventanas.find(vt => vt.ventana_id === s.nutricion_ref);
    if (v) {
      html += \`<div class="section"><div class="sec-label">🥗 Nutrición vinculada</div>\`;
      html += renderVentanaHTML(v);
      html += \`</div>\`;
    }
  }

  if (s.notes) {
    html += \`<div class="section"><div class="sec-label">📝 Notas</div>
      <p style="font-size:13px;color:#888;line-height:1.6">\${s.notes}</p></div>\`;
  }

  target.innerHTML = html;
}

// ─── Ventana detail ───────────────────────────────────────────────────────────
function renderVentana(idx, targetId) {
  const v = ventanas[idx];
  if (!v) return;
  document.getElementById(targetId).innerHTML =
    \`<div class="sess-header">
      <h2>\${fmtDateLong(v.ventana_id)}</h2>
      <div class="meta-row">
        \${v.protocolo  ? mbadge('⏱', v.protocolo.replace(/_/g,' ')) : ''}
        \${v.ayuno_horas ? mbadge('🕐', v.ayuno_horas + 'h ayuno') : ''}
      </div>
    </div>\` + renderVentanaHTML(v);
}

function targetBar(label, val, target, color) {
  const pct  = Math.min(100, Math.round((val / target) * 100));
  const over = val > target;
  const fill = over ? 'var(--amber)' : color;
  return \`<div class="target-row">
    <div class="target-meta">
      <span class="target-meta-lbl">\${label}</span>
      <span class="target-meta-val \${over ? 'over' : ''}">\${val} / \${target} &nbsp;\${pct}%</span>
    </div>
    <div class="target-bar-bg"><div class="target-bar-fill" style="width:\${pct}%;background:\${fill}"></div></div>
  </div>\`;
}

function renderVentanaHTML(v) {
  let html = '';

  // Totales del día
  if (v.totales_ventana) {
    const t = v.totales_ventana;
    html += \`<div class="section">
      <div class="sec-label">📊 Totales del día</div>
      <div class="macros-grid summary">
        <div class="mc"><span class="mc-val kcal">\${t.kcal}</span><span class="mc-lbl">kcal</span></div>
        <div class="mc"><span class="mc-val prot">\${t.proteina_g}g</span><span class="mc-lbl">proteína</span></div>
        <div class="mc"><span class="mc-val gras">\${t.grasa_g}g</span><span class="mc-lbl">grasa</span></div>
        <div class="mc"><span class="mc-val carb">\${t.carbos_g}g</span><span class="mc-lbl">carbos</span></div>
      </div>
      \${t.nota ? \`<p style="font-size:10px;color:var(--dim);margin-top:7px;font-style:italic">* \${t.nota}</p>\` : ''}
    </div>\`;

    // Progreso vs objetivos
    if (perfil) {
      const isGymDay  = sessions.some(s => s.date === v.ventana_id);
      const kcalObj   = isGymDay ? perfil.objetivos_diarios.kcal_dia_gym : perfil.objetivos_diarios.kcal_dia_descanso;
      const protObj   = perfil.objetivos_diarios.proteina_g_ideal;
      const tdee      = isGymDay ? perfil.metabolismo.gasto_total_gym_kcal : perfil.metabolismo.gasto_total_descanso_kcal;
      const deficit   = Math.round(tdee - t.kcal);
      const defClass  = deficit >= 400 ? 'positive' : deficit >= 0 ? 'neutral' : 'negative';
      const defLabel  = deficit >= 0 ? \`-\${deficit} kcal déficit\` : \`+\${Math.abs(deficit)} kcal superávit\`;
      const dayLabel  = isGymDay ? 'día de gym' : 'día de descanso';

      html += \`<div class="section">
        <div class="sec-label">🎯 vs Objetivo (\${dayLabel})</div>
        <div class="targets-section">
          \${targetBar('Calorías (kcal)', t.kcal, kcalObj, 'var(--amber)')}
          \${targetBar('Proteína (g)', t.proteina_g, protObj, 'var(--blue)')}
          \${targetBar('Carbos (g)', t.carbos_g, perfil.objetivos_diarios.carbos_g_max, 'var(--green)')}
          <div class="deficit-chip \${defClass}">\${defLabel} · TDEE \${tdee} kcal</div>
        </div>
      </div>\`;
    }
  }

  // Comidas
  html += \`<div class="section"><div class="sec-label">🍽 Comidas</div>\`;
  for (const comida of (v.comidas || [])) {
    const esBadge = comida.totales?.estimado
      ? '<span class="estimado-badge">est.</span>'
      : '';
    const fechaDif = comida.fecha && comida.fecha !== v.ventana_id
      ? \`<span class="meal-fecha-badge">\${comida.fecha}</span>\`
      : '';
    html += \`<div class="meal-card">
      <div>
        <span class="meal-tipo">\${comida.tipo}</span>
        \${comida.hora ? \`<span class="meal-hora">\${comida.hora}</span>\` : ''}
        \${fechaDif}
        \${esBadge}
      </div>
      <div class="meal-desc">\${comida.descripcion}</div>\`;

    if (comida.totales) {
      const t = comida.totales;
      html += \`<div class="macros-grid">
        <div class="mc"><span class="mc-val kcal">\${t.kcal}</span><span class="mc-lbl">kcal</span></div>
        <div class="mc"><span class="mc-val prot">\${t.proteina_g != null ? t.proteina_g + 'g' : '—'}</span><span class="mc-lbl">proteína</span></div>
        <div class="mc"><span class="mc-val gras">\${t.grasa_g    != null ? t.grasa_g    + 'g' : '—'}</span><span class="mc-lbl">grasa</span></div>
        <div class="mc"><span class="mc-val carb">\${t.carbos_g   != null ? t.carbos_g   + 'g' : '—'}</span><span class="mc-lbl">carbos</span></div>
      </div>\`;
    }

    if (comida.alimentos?.length) {
      html += \`<ul class="alimentos">\`;
      for (const a of comida.alimentos) {
        const ms = [
          a.kcal       != null ? a.kcal       + ' kcal' : '',
          a.proteina_g != null ? 'P '  + a.proteina_g + 'g' : '',
          a.grasa_g    != null ? 'G '  + a.grasa_g    + 'g' : '',
          a.carbos_g   != null ? 'C '  + a.carbos_g   + 'g' : '',
        ].filter(Boolean).join(' · ');
        const cant = a.unidades != null ? a.unidades + 'u'
          : a.cantidad_g    != null ? a.cantidad_g    + 'g'
          : a.cantidad_ml   != null ? a.cantidad_ml   + 'ml'
          : a.cantidad_g_aprox != null ? '~' + a.cantidad_g_aprox + 'g'
          : '';
        html += \`<li>
          <span class="al-name">\${a.nombre}\${cant ? \` <span style="color:var(--dim)">(\${cant})</span>\` : ''}</span>
          <span class="al-macros">\${ms}</span>
        </li>\`;
      }
      html += \`</ul>\`;
    }
    html += \`</div>\`;
  }
  html += \`</div>\`;
  return html;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mbadge(icon, text) {
  return \`<div class="meta-badge">\${icon} <strong>\${text}</strong></div>\`;
}
function cmetric(val, label) {
  return \`<div class="cmetric"><span class="cmetric-val">\${val}</span><span class="cmetric-lbl">\${label}</span></div>\`;
}
function fmtDate(d) {
  const [y, m, day] = d.split('-');
  const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return \`\${day} \${M[+m-1]} \${y}\`;
}
function fmtDateLong(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ─── Perfil ───────────────────────────────────────────────────────────────────
function renderPerfil() {
  if (!perfil) return;
  const p  = perfil;
  const ob = p.objetivos_diarios;
  const me = p.metabolismo;

  // Peso actual (último registro)
  const pesoHist    = (p.historial_peso || []).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const pesoActual  = pesoHist[0] || null;
  const pesoAnterior = pesoHist[1] || null;
  const pesoDelta   = pesoActual && pesoAnterior
    ? (pesoActual.peso_kg - pesoAnterior.peso_kg).toFixed(1)
    : null;

  // Historial de ventanas (hasta 10 últimas)
  const histVentanas = [...ventanas].sort((a,b) => b.ventana_id.localeCompare(a.ventana_id)).slice(0, 10);
  const maxKcal = Math.max(...histVentanas.map(v => v.totales_ventana?.kcal || 0), ob.kcal_dia_gym);

  // Resumen global del historial
  const totalKcalLog = histVentanas.reduce((s,v) => s + (v.totales_ventana?.kcal || 0), 0);
  const avgKcal      = histVentanas.length ? Math.round(totalKcalLog / histVentanas.length) : 0;
  const avgDeficit   = histVentanas.length
    ? Math.round(histVentanas.reduce((s,v) => {
        const isGym = sessions.some(ss => ss.date === v.ventana_id);
        const tdee  = isGym ? me.gasto_total_gym_kcal : me.gasto_total_descanso_kcal;
        return s + (tdee - (v.totales_ventana?.kcal || 0));
      }, 0) / histVentanas.length)
    : 0;

  const histRows = histVentanas.map(v => {
    const t       = v.totales_ventana || {};
    const kcal    = t.kcal || 0;
    const isGym   = sessions.some(s => s.date === v.ventana_id);
    const tdee    = isGym ? me.gasto_total_gym_kcal : me.gasto_total_descanso_kcal;
    const deficit = Math.round(tdee - kcal);
    const pct     = Math.round((kcal / maxKcal) * 100);
    const barCol  = kcal <= ob.kcal_objetivo_promedio ? 'var(--green)' : 'var(--amber)';
    const defSign = deficit >= 0 ? '-' : '+';
    const defCol  = deficit >= 0 ? 'var(--green)' : 'var(--red)';
    const gymTag  = isGym ? \` <span style="font-size:9px;color:var(--accent-l)">gym</span>\` : '';
    return \`<div class="hist-row">
      <span class="hist-date">\${fmtDate(v.ventana_id)}\${gymTag}</span>
      <div class="hist-bar-wrap"><div class="hist-bar-fill" style="width:\${pct}%;background:\${barCol}"></div></div>
      <span class="hist-kcal">\${kcal} kcal</span>
      <span class="hist-deficit" style="color:\${defCol}">\${defSign}\${Math.abs(deficit)}</span>
    </div>\`;
  }).join('');

  document.getElementById('perfil-main').innerHTML = \`
    <div class="perfil-grid">

      <!-- Peso con fecha -->
      <div class="pcard">
        <div class="pcard-title">Peso</div>
        \${pesoActual ? \`
          <div class="peso-big">\${pesoActual.peso_kg}<span class="peso-unit">kg</span></div>
          <div class="peso-sub">Registrado el \${fmtDate(pesoActual.fecha)}</div>
          \${pesoDelta !== null ? \`<div class="peso-sub" style="margin-top:4px;color:\${pesoDelta<=0?'var(--green)':'var(--red)'}">
            \${pesoDelta > 0 ? '+' : ''}\${pesoDelta} kg desde el registro anterior
          </div>\` : ''}
          <div class="peso-goal" style="margin-top:14px">Objetivo: <strong>bajar peso</strong> preservando músculo</div>
        \` : '<p style="color:var(--dim);font-size:12px">Sin registros</p>'}
      </div>

      <!-- Datos físicos en lenguaje simple -->
      <div class="pcard">
        <div class="pcard-title">Datos físicos</div>
        <div class="pstat-row"><span class="pstat-lbl">Altura</span><span class="pstat-val">\${p.altura_cm} cm</span></div>
        <div class="pstat-row"><span class="pstat-lbl">Edad</span><span class="pstat-val">\${p.edad} años</span></div>
        <div class="pstat-row"><span class="pstat-lbl">Protocolo</span><span class="pstat-val hi">\${p.protocolo}</span></div>
        <div class="pstat-row">
          <span class="pstat-lbl">Calorías en reposo total</span>
          <span class="pstat-val">\${me.metabolismo_basal_kcal} kcal</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Gasto real día de gym</span>
          <span class="pstat-val">\${me.gasto_total_gym_kcal} kcal</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Gasto real día sin gym</span>
          <span class="pstat-val">\${me.gasto_total_descanso_kcal} kcal</span>
        </div>
      </div>

      <!-- Objetivos en lenguaje simple -->
      <div class="pcard">
        <div class="pcard-title">Qué comer por día</div>
        <div class="pstat-row">
          <span class="pstat-lbl">Target promedio diario</span>
          <span class="pstat-val amber">\${ob.kcal_objetivo_promedio} kcal</span>
        </div>
        <div class="pstat-row" style="font-size:10px;color:var(--dim);padding-bottom:8px">
          <span>(día de gym: \${ob.kcal_dia_gym} · día sin gym: \${ob.kcal_dia_descanso})</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Comer menos que el gasto</span>
          <span class="pstat-val green">−\${ob.deficit_target_kcal} kcal/día</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Proteína mínima</span>
          <span class="pstat-val">\${ob.proteina_g_min}g</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Proteína ideal</span>
          <span class="pstat-val hi">\${ob.proteina_g_ideal}g</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Carbohidratos (tope orientativo)</span>
          <span class="pstat-val">\${ob.carbos_g_max}g</span>
        </div>
      </div>

      <!-- Resumen global -->
      <div class="pcard">
        <div class="pcard-title">Resumen del período registrado</div>
        <div class="pstat-row">
          <span class="pstat-lbl">Días con registro</span>
          <span class="pstat-val">\${histVentanas.length}</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Promedio diario consumido</span>
          <span class="pstat-val \${avgKcal <= ob.kcal_objetivo_promedio ? 'green' : 'amber'}">\${avgKcal} kcal</span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Déficit promedio real</span>
          <span class="pstat-val \${avgDeficit >= 0 ? 'green' : ''}" style="\${avgDeficit < 0 ? 'color:var(--red)' : ''}">
            \${avgDeficit >= 0 ? '-' : '+'}\${Math.abs(avgDeficit)} kcal/día
          </span>
        </div>
        <div class="pstat-row">
          <span class="pstat-lbl">Pérdida estimada del período</span>
          <span class="pstat-val green">~\${(avgDeficit * histVentanas.length / 7700).toFixed(2)} kg</span>
        </div>
      </div>

    </div>

    <!-- Historial calórico día a día -->
    <div class="pcard">
      <div class="pcard-title">Historial calórico día a día</div>
      \${histRows || '<p style="color:var(--dim);font-size:12px">Sin datos</p>'}
      <div style="margin-top:12px;font-size:10px;color:var(--dim);line-height:1.6">
        Verde = dentro del target promedio (\${ob.kcal_objetivo_promedio} kcal) · Ámbar = por encima<br>
        El número al final muestra cuánto menos (verde) o más (rojo) comiste vs lo que quemaste ese día
      </div>
    </div>
  \`;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TAB_NAMES = ['sessions', 'nutricion', 'calendar', 'perfil'];
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', TAB_NAMES[i] === tab);
  });
  TAB_NAMES.forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'calendar' && !calReady) {
    initCalendar();
    calReady = true;
  }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function gymCalEvents() {
  return sessions.map((s, i) => ({
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
    },
  }));
}

function nutriCalEvents() {
  return ventanas.map((v, i) => {
    const t = v.totales_ventana || {};
    return {
      title: '',
      date: v.ventana_id,
      backgroundColor: '#f59e0b',
      borderColor: 'transparent',
      textColor: '#000',
      extendedProps: {
        type: 'nutri', vIdx: i,
        kcal: t.kcal || 0,
        prot: t.proteina_g || 0,
        gras: t.grasa_g    || 0,
        carb: t.carbos_g   || 0,
        nComidas: v.comidas?.length || 0,
      },
    };
  });
}

function switchCalView(view) {
  calView = view;
  document.querySelectorAll('.cal-sub-btn').forEach((b, i) => {
    b.classList.toggle('active', ['gym','nutricion'][i] === view);
  });
  document.getElementById('cal-legend').innerHTML =
    view === 'gym' ? GYM_LEGEND : NUTRI_LEGEND;

  if (fcCalendar) {
    fcCalendar.removeAllEvents();
    fcCalendar.addEventSource(view === 'gym' ? gymCalEvents() : nutriCalEvents());
  }
  document.getElementById('cal-detail').innerHTML =
    \`<div class="empty-state"><div class="ei">📅</div><p>Clickeá un evento</p></div>\`;
}

function initCalendar() {
  const el = document.getElementById('fc-calendar');
  const gymDates   = new Set(sessions.map(s => s.date));
  const nutriDates = new Set(ventanas.map(v => v.ventana_id));

  fcCalendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    locale: 'es',
    height: '100%',
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
        const pct = Math.min(100, Math.round((p.kcal / 2500) * 100));
        return { html: \`<div class="ev-nutri">
          <div class="ev-n-top">
            <span class="ev-n-kcal">\${p.kcal}</span>
            <span class="ev-n-unit">kcal</span>
          </div>
          <div class="ev-n-macros">
            <span class="ev-dot prot"></span>\${p.prot}g
            <span class="ev-dot gras"></span>\${p.gras}g
            <span class="ev-dot carb"></span>\${p.carb}g
          </div>
          <div class="ev-n-bar"><div class="ev-n-bar-fill" style="width:\${pct}%"></div></div>
        </div>\` };
      }
      if (p.type === 'gym') {
        const tags = p.groups.map(g => \`<span class="ev-g-tag">\${g}</span>\`).join('');
        const cardio = p.hasCardio ? '<span class="ev-g-cardio">Cardio</span>' : '';
        return { html: \`<div class="ev-gym">\${tags}\${cardio}</div>\` };
      }
    },

    eventClick(info) {
      const p = info.event.extendedProps;
      if (p.type === 'gym')   renderSession(p.idx,  'cal-detail');
      if (p.type === 'nutri') renderVentana(p.vIdx, 'cal-detail');
    },

    dayCellDidMount(info) {
      const d = info.date.toISOString().split('T')[0];
      const hasGym   = gymDates.has(d);
      const hasNutri = nutriDates.has(d);
      info.el.style.background = 'var(--bg)';
      if (calView === 'gym'      && hasGym)   info.el.querySelector('.fc-daygrid-day-frame').style.background = 'rgba(124,106,245,0.06)';
      if (calView === 'nutricion' && hasNutri) info.el.querySelector('.fc-daygrid-day-frame').style.background = 'rgba(245,158,11,0.06)';
    },
  });

  fcCalendar.render();
}

load();
<\/script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/api/sessions') {
    const log = loadLog();
    const sessions = log.sessions.sort((a, b) => b.date.localeCompare(a.date));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }
  if (req.url === '/api/nutricion') {
    const nutri = loadNutri();
    const ventanas = (nutri.ventanas || []).sort((a, b) => b.ventana_id.localeCompare(a.ventana_id));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ventanas));
    return;
  }
  if (req.url === '/api/perfil') {
    const p = loadPerfil();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(p));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`\n  Gym Tracker → http://localhost:${PORT}\n`);
});
