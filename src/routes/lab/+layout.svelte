<script>
  import { page } from '$app/stores';
  let { children } = $props();
  let path = $derived($page.url.pathname);

  const experiments = [
    { href: '/lab/diario', label: 'diario', desc: '1 entrada por dia' },
    { href: '/lab/minimo', label: 'minimo', desc: 'solo peso semanal' },
    { href: '/lab/musculos', label: 'musculos', desc: 'mapa corporal' },
  ];
</script>

<div class="lab">
  <div class="lab-head">
    <span class="lab-tag">LAB</span>
    <span class="lab-sub">experimentos paralelos · datos en read-only</span>
  </div>

  <nav class="lab-nav">
    {#each experiments as e}
      <a href={e.href} class="exp" class:active={path.startsWith(e.href)}>
        <span class="exp-l">{e.label}</span>
        <span class="exp-d">{e.desc}</span>
      </a>
    {/each}
  </nav>

  <div class="lab-body">
    {@render children()}
  </div>
</div>

<style>
  .lab {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .lab-head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed var(--b1);
  }
  .lab-tag {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--amber);
    background: rgba(210, 153, 34, 0.1);
    border: 1px solid rgba(210, 153, 34, 0.3);
    border-radius: 3px;
    padding: 0.15rem 0.45rem;
  }
  .lab-sub {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .lab-nav {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .exp {
    flex: 1;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    padding: 0.7rem 0.9rem;
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 6px;
    transition: border-color .12s, background .12s;
  }
  .exp:hover { border-color: var(--accent); }
  .exp.active { border-color: var(--accent); background: rgba(188, 140, 255, 0.06); }
  .exp-l {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1rem;
    color: var(--text);
  }
  .exp-d {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 0.15rem;
  }

  .lab-body { min-height: 40vh; }
</style>
