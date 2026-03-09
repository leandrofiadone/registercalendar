<script>
  import { fmtDate } from '$lib/utils.js';
  import VentanaDetail from '$lib/VentanaDetail.svelte';

  let { data } = $props();
  let ventanas = $derived(data.ventanas);
  let sessions = $derived(data.sessions);
  let perfil   = $derived(data.perfil);

  let selectedIdx = $state(0);
</script>

<div class="layout">
  <!-- Sidebar -->
  <div class="sidebar">
    {#if ventanas.length === 0}
      <div style="padding:20px;color:var(--dim);font-size:12px">Sin registros</div>
    {:else}
      {#each ventanas as v, i}
        {@const t = v.totales_ventana || {}}
        {@const nComidas = v.comidas?.length || 0}
        <button
          class="sidebar-item t-ventana"
          class:active={selectedIdx === i}
          onclick={() => selectedIdx = i}
        >
          <div class="date">{fmtDate(v.ventana_id)}</div>
          <div class="si-tags">
            {#if t.kcal != null}
              <span class="tag ta">{t.kcal} kcal</span>
            {/if}
            <span class="tag">{nComidas} comida{nComidas !== 1 ? 's' : ''}</span>
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
      </div>
    {:else if ventanas[selectedIdx]}
      <VentanaDetail ventana={ventanas[selectedIdx]} {perfil} {sessions} />
    {:else}
      <div class="empty-state">
        <div class="ei">🥗</div>
        <p>Seleccioná una ventana de alimentación</p>
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

  .date  { font-size: 12px; font-weight: 600; color: #bbb; margin-bottom: 5px; }
  .si-tags { display: flex; flex-wrap: wrap; gap: 3px; }

  .tag {
    font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--s3); color: var(--dim); border: 1px solid var(--b2);
  }
  .tag.ta { background: rgba(245,158,11,.12); color: var(--amber); border-color: rgba(245,158,11,.25); }

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
</style>
