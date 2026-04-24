<script>
  import { fmtDate, localDateStr } from '$lib/utils.js';
  import { fade } from 'svelte/transition';
  import VentanaDetail from '$lib/VentanaDetail.svelte';

  let { data } = $props();
  let sessions     = $derived(data.sessions);
  let perfil       = $derived(data.perfil);
  let alimentosRef = $derived(data.alimentosRef ?? []);

  // Inyecta ventana virtual para hoy si no existe en el JSON
  let ventanas = $derived.by(() => {
    const raw      = data.ventanas;
    const todayStr = localDateStr();
    const hasToday = raw.some(v => v.ventana_id === todayStr);
    if (hasToday) return raw;
    const virtual = {
      ventana_id:      todayStr,
      protocolo:       'ayuno_intermitente',
      comidas:         [],
      totales_ventana: { kcal: 0, proteina_g: 0, grasa_g: 0, carbos_g: 0 },
      _virtual:        true,
    };
    return [virtual, ...raw];
  });

  let selectedIdx = $state(0);
  let filterText = $state('');

  let filtered = $derived.by(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return ventanas.map((v, i) => ({ v, i }));
    return ventanas
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => {
        const date = v.ventana_id;
        const descs = (v.comidas || []).map(c => (c.descripcion || '').toLowerCase()).join(' ');
        return date.includes(q) || descs.includes(q);
      });
  });
</script>

<div class="layout">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="filter-box">
      <input class="filter-input" type="text" placeholder="Buscar..." bind:value={filterText} />
    </div>
    {#if filtered.length === 0}
      <div style="padding:20px;color:var(--dim);font-size:12px">Sin resultados</div>
    {:else}
      {#each filtered as { v, i }}
        {@const t = v.totales_ventana || {}}
        {@const nComidas = v.comidas?.length || 0}
        <button
          class="sidebar-item t-ventana"
          class:active={selectedIdx === i}
          class:today={v._virtual}
          onclick={() => selectedIdx = i}
        >
          <div class="date">
            {fmtDate(v.ventana_id)}
            {#if v._virtual}<span class="hoy-badge">hoy</span>{/if}
          </div>
          <div class="si-tags">
            {#if v._virtual}
              <span class="tag sin-comidas">sin comidas</span>
            {:else}
              {#if t.kcal != null}
                <span class="tag ta">{t.kcal} kcal</span>
              {/if}
              <span class="tag">{nComidas} comida{nComidas !== 1 ? 's' : ''}</span>
            {/if}
            {#if v.protocolo}<span class="tag">IF</span>{/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Detail -->
  <div class="main">
    {#if ventanas.length === 0}
      <div class="empty-state">
        <div class="ei">🥗</div>
        <p>Sin registros de nutrición</p>
        <p class="es-hint">Agregá tu primera ventana en <code>data/nutricion.json</code></p>
      </div>
    {:else if ventanas[selectedIdx]}
      {#key selectedIdx}
        <div in:fade={{ duration: 150 }}>
          <VentanaDetail ventana={ventanas[selectedIdx]} {perfil} {sessions} {ventanas} {alimentosRef} />
        </div>
      {/key}
    {:else}
      <div class="empty-state">
        <div class="ei">🥗</div>
        <p>Seleccioná un día de la lista</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .layout {
    display: flex;
    width: 100%;
    min-height: 70vh;
    gap: 1rem;
  }

  .sidebar {
    width: 240px; flex-shrink: 0;
    border: 1px solid var(--b1);
    border-radius: 8px;
    background: var(--s1);
    align-self: flex-start;
    max-height: calc(100vh - 12rem);
    overflow-y: auto;
    position: sticky;
    top: 1rem;
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
  .sidebar-item.t-ventana::before { background: var(--amber); }
  .sidebar-item:hover  { background: var(--s2); }
  .sidebar-item.active { background: var(--s3); }

  .sidebar-item.today { background: rgba(74,222,128,.04); }
  .sidebar-item.today::before { background: #4ade80; }
  .date  { font-size: 12px; font-weight: 600; color: #bbb; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
  .hoy-badge {
    font-size: 8px; font-weight: 700; color: #4ade80;
    background: rgba(74,222,128,.12); border: 1px solid rgba(74,222,128,.25);
    border-radius: 3px; padding: 0 5px; text-transform: uppercase; letter-spacing: .05em;
  }
  .tag.sin-comidas { color: var(--dim); font-style: italic; }
  .si-tags { display: flex; flex-wrap: wrap; gap: 3px; }

  .tag {
    font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--s3); color: var(--dim); border: 1px solid var(--b2);
  }
  .tag.ta { background: rgba(245,158,11,.12); color: var(--amber); border-color: rgba(245,158,11,.25); }

  .main {
    flex: 1;
    min-width: 0;
    padding: 0 0.25rem;
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
    .layout { flex-direction: column; gap: 0.5rem; }
    .sidebar {
      position: static;
      width: 100%; flex-shrink: 0;
      height: 72px;
      border-radius: 6px;
      max-height: 72px;
      display: flex; overflow-x: auto; overflow-y: hidden;
    }
    .filter-box { display: none; }
    .sidebar-item {
      flex-shrink: 0; width: auto; min-width: 110px;
      padding: 8px 12px; border-bottom: none;
      border-right: 1px solid var(--b1);
    }
    .sidebar-item::before { left: 0; right: 0; top: auto; bottom: 0; width: auto; height: 3px; }
    .main { padding: 0; overflow-x: hidden; }
  }
</style>
