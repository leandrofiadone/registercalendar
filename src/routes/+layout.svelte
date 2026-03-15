<script>
  import { page } from '$app/stores';
  import FastingCounter from '$lib/FastingCounter.svelte';
  import { localDateStr } from '$lib/utils.js';

  let { data, children } = $props();

  let sessions = $derived(data.sessions);
  let ventanas = $derived(data.ventanas);
  let perfil   = $derived(data.perfil);

  let thisMonth = $derived.by(() => {
    const now = new Date();
    const ym  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return sessions.filter(s => s.date.startsWith(ym)).length;
  });

  let streak = $derived.by(() => {
    const dateSet = new Set(sessions.map(s => s.date));
    let count = 0;
    const d = new Date();
    while (dateSet.has(localDateStr(d))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  });

  let favGroup = $derived.by(() => {
    const groupCount = {};
    sessions.forEach(s => (s.groups || []).forEach(g => { groupCount[g] = (groupCount[g] || 0) + 1; }));
    const favEntry = Object.entries(groupCount).sort((a, b) => b[1] - a[1])[0];
    return favEntry?.[0] ?? null;
  });

  let totalKcal = $derived(
    ventanas.reduce((sum, v) => sum + (v.totales_ventana?.kcal || 0), 0)
  );

  let tabs = [
    { href: '/sesiones',   label: 'Sesiones',    icon: '📋' },
    { href: '/nutricion',  label: 'Nutrición',   icon: '🥗' },
    { href: '/calendario', label: 'Calendario',  icon: '📅' },
    { href: '/perfil',     label: 'Perfil',      icon: '👤' },
  ];

  let currentPath = $derived($page.url.pathname);
</script>

<svelte:head>
  <title>Gym Tracker</title>
</svelte:head>

<header class="header">
  <div class="logo"><span class="logo-icon">🏋️</span> Gym Tracker</div>
  <div class="stats-bar">
    <div class="stat-chip">Sesiones <span class="v">{sessions.length}</span></div>
    <div class="stat-chip">Mes <span class="v">{thisMonth}</span></div>
    {#if streak > 0}
      <div class="stat-chip">Racha <span class="v">{streak}d</span></div>
    {/if}
    {#if favGroup}
      <div class="stat-chip">Top <span class="v">{favGroup}</span></div>
    {/if}
    {#if totalKcal > 0}
      <div class="stat-chip">kcal log <span class="v">{Math.round(totalKcal)}</span></div>
    {/if}
    <FastingCounter {ventanas} />
  </div>
  <nav class="tabs">
    {#each tabs as tab}
      <a href={tab.href} class="tab-btn" class:active={currentPath.startsWith(tab.href)}>
        {tab.icon} {tab.label}
      </a>
    {/each}
  </nav>
</header>

<main class="app-body">
  {@render children()}
</main>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }

  :global(:root) {
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

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-size: 13px;
    line-height: 1.5;
  }

  :global(::-webkit-scrollbar) { width: 4px; height: 4px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) { background: var(--b2); border-radius: 2px; }

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
  .stat-chip :global(.v) { color: var(--text); font-weight: 600; }

  .tabs { display: flex; gap: 2px; flex-shrink: 0; }

  .tab-btn {
    padding: 5px 14px;
    border: 1px solid transparent; border-radius: 6px;
    background: none; color: var(--muted);
    font-size: 12px; cursor: pointer;
    transition: all 0.12s; font-family: inherit;
    display: flex; align-items: center; gap: 5px;
    text-decoration: none;
  }
  .tab-btn:hover { background: var(--s2); color: var(--text); }
  .tab-btn.active { background: var(--s3); border-color: var(--b2); color: #fff; }

  .app-body {
    height: calc(100vh - 54px);
    overflow: hidden;
    display: flex;
  }
</style>
