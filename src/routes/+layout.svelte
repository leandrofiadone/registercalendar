<script>
  import { page } from '$app/stores';
  import FastingCounter from '$lib/FastingCounter.svelte';
  import TrendChip from '$lib/TrendChip.svelte';
  import Ingresar from '$lib/Ingresar.svelte';

  let { data, children } = $props();

  let sessions = $derived(data.sessions);
  let ventanas = $derived(data.ventanas);
  let perfil   = $derived(data.perfil);

  let tabs = [
    { href: '/sesiones',   label: 'Sesiones',    icon: '📋' },
    { href: '/nutricion',  label: 'Nutrición',   icon: '🥗' },
    { href: '/calendario', label: 'Calendario',  icon: '📅' },
    { href: '/perfil',     label: 'Perfil',      icon: '👤' },
    { href: '/ingresar',   label: 'Ingresar',    icon: '✏️' },
  ];

  let currentPath = $derived($page.url.pathname);
  let drawerOpen = $state(false);
</script>

<svelte:head>
  <title>Gym Tracker</title>
</svelte:head>

<header class="header">
  <div class="logo"><span class="logo-icon">🏋️</span> Gym Tracker</div>
  <div class="stats-bar">
    <TrendChip {ventanas} {sessions} {perfil} />
    <FastingCounter {ventanas} />
  </div>
  <nav class="tabs" aria-label="Navegación principal">
    {#each tabs as tab}
      <a href={tab.href} class="tab-btn" class:active={currentPath.startsWith(tab.href)} aria-label={tab.label} aria-current={currentPath.startsWith(tab.href) ? 'page' : undefined}>
        {tab.icon} {tab.label}
      </a>
    {/each}
  </nav>
</header>

<main class="app-body">
  {@render children()}
</main>

<!-- FAB -->
<button class="fab" onclick={() => drawerOpen = true} aria-label="Ingresar dato">+</button>

<!-- Drawer -->
{#if drawerOpen}
  <div class="drawer-backdrop" onclick={() => drawerOpen = false} role="presentation"></div>
  <div class="drawer">
    <Ingresar onClose={() => drawerOpen = false} />
  </div>
{/if}

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

  .stats-bar { display: flex; gap: 8px; flex: 1; align-items: center; justify-content: flex-start; overflow: hidden; }


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

  /* FAB */
  .fab {
    position: fixed;
    bottom: 24px; right: 24px;
    z-index: 300;
    width: 44px; height: 44px;
    border-radius: 50%;
    background: var(--s2);
    border: 1px solid var(--b2);
    color: var(--muted);
    font-size: 22px; line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    display: flex; align-items: center; justify-content: center;
    transition: border-color .15s, color .15s, transform .15s;
  }
  .fab:hover { border-color: var(--accent); color: var(--accent-l); transform: scale(1.06); }
  .fab:active { transform: scale(0.95); }

  /* Drawer backdrop */
  .drawer-backdrop {
    position: fixed; inset: 0;
    z-index: 400;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
  }

  /* Drawer — desktop: panel derecho */
  .drawer {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    z-index: 500;
    width: 480px;
    background: var(--s1);
    border-left: 1px solid var(--b1);
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.5);
    display: flex; flex-direction: column;
    animation: slideInRight .22s ease-out;
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  @media (max-width: 768px) {
    .header {
      flex-wrap: wrap;
      height: auto;
      padding: 8px 12px 0;
      gap: 8px;
    }
    .logo { font-size: 13px; }
    .logo-icon { font-size: 15px; }
    .stats-bar { order: 1; flex-basis: 100%; justify-content: center; gap: 6px; }
    .tabs {
      position: fixed; bottom: 0; left: 0; right: 0;
      z-index: 200;
      background: rgba(10, 10, 15, 0.96);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--b1);
      justify-content: space-around;
      padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
      gap: 0;
    }
    .tab-btn { flex-direction: column; gap: 2px; font-size: 10px; padding: 4px 8px; }
    .app-body {
      height: calc(100vh - 80px - 52px);
    }

    /* FAB mobile — sube para no tapar la bottom nav */
    .fab {
      bottom: calc(60px + env(safe-area-inset-bottom) + 12px);
      right: 16px;
      width: 40px; height: 40px;
      font-size: 20px;
    }

    /* Drawer mobile — sube desde abajo, casi pantalla completa */
    .drawer {
      top: auto;
      left: 0; right: 0; bottom: 0;
      width: 100%;
      height: 92dvh;
      border-left: none;
      border-top: 1px solid var(--b1);
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
      animation: slideInUp .25s ease-out;
    }
    @keyframes slideInUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
  }
</style>
