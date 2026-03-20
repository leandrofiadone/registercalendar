<script>
  import { fmtDate, sessionType } from '$lib/utils.js';
  import { fade } from 'svelte/transition';
  import SessionDetail from '$lib/SessionDetail.svelte';

  let { data } = $props();
  let sessions = $derived(data.sessions);
  let perfil   = $derived(data.perfil);

  let selectedIdx = $state(0);
  let filterText = $state('');

  let filtered = $derived.by(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return sessions.map((s, i) => ({ s, i }));
    return sessions
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        const groups = (s.groups || []).join(' ').toLowerCase();
        const gym = (s.gimnasio || '').toLowerCase();
        const date = s.date;
        return groups.includes(q) || gym.includes(q) || date.includes(q);
      });
  });

  function gymCount(s) {
    return new Set([
      ...(s.fuerza||[]).map(e => e.gimnasio),
      ...(s.cardio||[]).map(c => c.gimnasio),
    ].filter(Boolean)).size;
  }
</script>

<div class="layout">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="filter-box">
      <input class="filter-input" type="text" placeholder="Buscar..." bind:value={filterText} />
    </div>
    {#each filtered as { s, i }}
      {@const type = sessionType(s)}
      {@const gyms = gymCount(s)}
      <button
        class="sidebar-item t-{type}"
        class:active={selectedIdx === i}
        onclick={() => selectedIdx = i}
      >
        <div class="date">
          {fmtDate(s.date)}
          {#if gyms > 1}<span class="multi-gym-badge">{gyms} sesiones</span>{/if}
        </div>
        <div class="si-tags">
          {#if s.fuerza?.length}
            {#each (s.groups || ['Fuerza']) as g}
              <span class="tag tf">{g}</span>
            {/each}
          {/if}
          {#if s.cardio?.length}<span class="tag tc">Cardio</span>{/if}
        </div>
      </button>
    {/each}
  </div>

  <!-- Detail -->
  <div class="main">
    {#if sessions.length === 0}
      <div class="empty-state">
        <div class="ei">📋</div>
        <p>Sin sesiones registradas</p>
        <p class="es-hint">Agregá tu primera sesión en <code>data/log.json</code></p>
      </div>
    {:else if sessions[selectedIdx]}
      {#key selectedIdx}
        <div in:fade={{ duration: 150 }}>
          <SessionDetail session={sessions[selectedIdx]} {sessions} {perfil} />
        </div>
      {/key}
    {:else}
      <div class="empty-state">
        <div class="ei">📋</div>
        <p>Seleccioná una sesión de la lista</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .layout {
    display: flex;
    flex: 1;
    height: 100%;
    overflow: hidden;
  }

  .sidebar {
    width: 216px; flex-shrink: 0;
    border-right: 1px solid var(--b1);
    overflow-y: auto; background: var(--s1);
  }

  .filter-box { padding: 8px 10px; border-bottom: 1px solid var(--b1); }
  .filter-input {
    width: 100%; padding: 5px 8px;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 4px; color: var(--text);
    font-size: 11px; font-family: inherit;
    outline: none;
  }
  .filter-input::placeholder { color: var(--dim); }
  .filter-input:focus { border-color: var(--accent); }

  .sidebar-item {
    width: 100%;
    text-align: left;
    padding: 11px 15px; cursor: pointer;
    border-bottom: 1px solid var(--b1);
    border-top: none; border-left: none; border-right: none;
    transition: background 0.1s;
    position: relative; padding-left: 17px;
    background: transparent; color: inherit;
    font-family: inherit; font-size: inherit;
  }
  .sidebar-item::before {
    content: ''; position: absolute;
    left: 0; top: 0; bottom: 0; width: 3px;
    background: transparent; transition: background 0.1s;
  }
  .sidebar-item.t-fuerza::before  { background: var(--accent); }
  .sidebar-item.t-cardio::before  { background: var(--blue); }
  .sidebar-item.t-mixed::before   { background: var(--green); }
  .sidebar-item.t-other::before   { background: var(--dim); }
  .sidebar-item:hover  { background: var(--s2); }
  .sidebar-item.active { background: var(--s3); }

  .date { font-size: 12px; font-weight: 600; color: #bbb; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
  .multi-gym-badge {
    font-size: 8px; font-weight: 600; color: var(--accent-l);
    background: rgba(124,106,245,.12); border: 1px solid rgba(124,106,245,.25);
    border-radius: 3px; padding: 0 5px; font-weight: 500;
  }
  .si-tags { display: flex; flex-wrap: wrap; gap: 3px; }

  .tag {
    font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--s3); color: var(--dim); border: 1px solid var(--b2);
  }
  .tag.tf { background: rgba(124,106,245,.12); color: var(--accent-l); border-color: rgba(124,106,245,.25); }
  .tag.tc { background: rgba(59,130,246,.12);  color: var(--blue-l);   border-color: rgba(59,130,246,.25); }
  .tag.ta { background: rgba(245,158,11,.12);  color: var(--amber);    border-color: rgba(245,158,11,.25); }

  .main {
    flex: 1; overflow-y: auto; padding: 26px 30px;
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

  @media (max-width: 768px) {
    .layout { flex-direction: column; }
    .sidebar {
      width: 100%; flex-shrink: 0;
      height: 72px; border-right: none;
      border-bottom: 1px solid var(--b1);
      display: flex; overflow-x: auto; overflow-y: hidden;
    }
    .filter-box { display: none; }
    .sidebar-item {
      flex-shrink: 0; width: auto; min-width: 110px;
      padding: 8px 12px; border-bottom: none;
      border-right: 1px solid var(--b1);
    }
    .sidebar-item::before { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 3px; }
    .main { padding: 16px; overflow-x: hidden; }
  }
</style>
