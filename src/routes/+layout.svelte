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
    { href: '/sesiones',   label: 'sesiones'    },
    { href: '/nutricion',  label: 'nutrición'   },
    { href: '/calendario', label: 'calendario'  },
    { href: '/perfil',     label: 'perfil'      },
  ];

  let currentPath = $derived($page.url.pathname);
  let drawerOpen = $state(false);
</script>

<svelte:head>
  <title>Gym Tracker</title>
</svelte:head>

<div class="shell">
  <header class="top">
    <a href="/" class="brand">GYM&nbsp;TRACKER</a>
    <nav class="nav" aria-label="Navegación principal">
      {#each tabs as tab, i}
        {#if i > 0}<span class="sep">·</span>{/if}
        <a
          href={tab.href}
          class="nav-link"
          class:active={currentPath.startsWith(tab.href)}
          aria-current={currentPath.startsWith(tab.href) ? 'page' : undefined}
        >{tab.label}</a>
      {/each}
    </nav>
    <button class="add-btn" onclick={() => drawerOpen = true} aria-label="Ingresar dato">
      + ingresar
    </button>
  </header>

  <div class="status-strip">
    <TrendChip {ventanas} {sessions} {perfil} />
    <FastingCounter {ventanas} />
  </div>

  <main class="page">
    {@render children()}
  </main>

  <footer class="bottom">
    <span class="foot-l">Gym Tracker · bitácora personal</span>
    <span class="foot-r">
      <a href="/sesiones" class:active={currentPath.startsWith('/sesiones')}>ses</a>
      <a href="/nutricion" class:active={currentPath.startsWith('/nutricion')}>nut</a>
      <a href="/calendario" class:active={currentPath.startsWith('/calendario')}>cal</a>
      <a href="/perfil" class:active={currentPath.startsWith('/perfil')}>per</a>
    </span>
  </footer>
</div>

{#if drawerOpen}
  <div class="drawer-backdrop" onclick={() => drawerOpen = false} role="presentation"></div>
  <aside class="drawer">
    <Ingresar onClose={() => drawerOpen = false} />
  </aside>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }

  :global(:root) {
    /* GitHub dark palette */
    --bg: #0d1117;
    --s1: #161b22;
    --s2: #1c2333;
    --s3: #1c2333;
    --b1: #30363d;
    --b2: #484f58;
    --text: #e6edf3;
    --muted: #8b949e;
    --dim: #6e7681;
    --accent: #bc8cff;
    --accent-l: #d2b8ff;
    --blue: #58a6ff;
    --blue-l: #a6c8ff;
    --green: #3fb950;
    --green-l: #56d364;
    --amber: #d29922;
    --red: #f85149;

    /* Semánticos */
    --kcal: #f0883e;
    --prot: var(--green);
    --fat:  var(--amber);
    --carb: var(--blue);
    --good: var(--green);
    --warn: var(--amber);
    --bad:  var(--red);
    --surface-1: var(--s1);
    --surface-2: var(--s2);
    --border-1:  var(--b1);
    --border-2:  var(--b2);

    /* Fuentes por rol */
    --font-display: 'Space Grotesk', 'SF Pro Display', ui-sans-serif, system-ui, sans-serif;
    --font-body:    'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
    --font-mono:    'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }

  :global(html, body) {
    background: var(--bg);
    color: var(--text);
  }

  :global(body) {
    font-family: var(--font-body);
    min-height: 100vh;
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  :global(h1, h2, h3) { font-family: var(--font-display); font-weight: 600; }

  :global(h2.section) {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--muted);
    border-bottom: 1px solid var(--b1);
    padding-bottom: 0.45rem;
    margin: 2.5rem 0 1rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  :global(.num) {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
  }

  :global(.mono) { font-family: var(--font-mono); }

  :global(a) { color: var(--text); text-decoration: none; }

  :global(::-webkit-scrollbar) { width: 6px; height: 6px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) { background: var(--b1); border-radius: 3px; }
  :global(::-webkit-scrollbar-thumb:hover) { background: var(--b2); }

  /* ── Shell ───────────────────────────────── */
  .shell {
    width: 100%;
    padding: 1.75rem 2.5rem 5rem;
    min-height: 100vh;
  }
  /* Pantallas muy anchas: dejamos crecer pero con un tope útil */
  @media (min-width: 1600px) {
    .shell { padding-left: 3.5rem; padding-right: 3.5rem; }
  }

  /* TOP bar: brand · nav · action */
  .top {
    display: flex; align-items: baseline; gap: 1.5rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--b1);
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }
  .brand {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    color: var(--text);
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .nav {
    display: flex; align-items: baseline; gap: 0.35rem;
    font-family: var(--font-body);
    font-size: 0.9rem;
    flex: 1;
  }
  .nav-link {
    color: var(--muted);
    padding: 0.1rem 0.15rem;
    border-bottom: 1px solid transparent;
    transition: color .12s, border-color .12s;
  }
  .nav-link:hover { color: var(--text); }
  .nav-link.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .sep { color: var(--dim); font-size: 0.9rem; user-select: none; }

  .add-btn {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--muted);
    background: transparent;
    border: 1px solid var(--b1);
    border-radius: 4px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: border-color .12s, color .12s, background .12s;
  }
  .add-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(188, 140, 255, 0.06);
  }

  /* Status strip (ex header chips, ahora primera fila de página) */
  .status-strip {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .page {
    min-height: 50vh;
  }

  .bottom {
    margin-top: 4rem;
    padding-top: 1rem;
    border-top: 1px solid var(--b1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .foot-r { display: flex; gap: 0.75rem; }
  .foot-r a { color: var(--dim); }
  .foot-r a:hover { color: var(--text); }
  .foot-r a.active { color: var(--accent); }

  /* Drawer */
  .drawer-backdrop {
    position: fixed; inset: 0;
    z-index: 400;
    background: rgba(0, 0, 0, 0.72);
  }
  .drawer {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    z-index: 500;
    width: 460px;
    background: var(--s1);
    border-left: 1px solid var(--b1);
    display: flex; flex-direction: column;
    animation: slideInRight .22s ease-out;
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }

  @media (max-width: 768px) {
    .shell { padding: 1.25rem 1rem 5rem; }
    .top {
      gap: 0.75rem 1rem;
      padding-bottom: 0.9rem;
      margin-bottom: 0.9rem;
    }
    .brand { font-size: 0.74rem; }
    .nav { font-size: 0.82rem; flex-basis: 100%; order: 2; flex-wrap: wrap; }
    .add-btn { font-size: 0.7rem; padding: 0.3rem 0.55rem; order: 1; margin-left: auto; }
    .status-strip { margin-bottom: 1.5rem; }
    .bottom { flex-direction: column; gap: 0.5rem; align-items: flex-start; }

    .drawer {
      top: auto; left: 0; right: 0; bottom: 0;
      width: 100%;
      height: 92dvh;
      border-left: none;
      border-top: 1px solid var(--b1);
      border-radius: 12px 12px 0 0;
      animation: slideInUp .25s ease-out;
    }
    @keyframes slideInUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
  }
</style>
