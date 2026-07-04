<script>
  import { bodyFront, bodyBack, frontOutline, backOutline, FRONT_VIEWBOX, BACK_VIEWBOX } from './bodies.js';
  import { regionForSlug, heatColor, SLUG_LABEL } from './muscleMap.js';

  /**
   * @typedef {Object} Props
   * @property {Record<string,number>} intensity  slug → 0..1 (opacidad del heatmap)
   * @property {Record<string,number>} [counts]   slug → sets ponderados (tooltip)
   * @property {string|null} [selected]           slug seleccionado
   * @property {(slug:string|null)=>void} [onselect]
   */
  let { intensity = {}, counts = {}, selected = null, onselect = () => {}, bodyWidth = 220 } = $props();

  let hovered = $state(null);
  let tip = $state({ x: 0, y: 0 });

  const bodies = [
    { title: 'Frente',  data: bodyFront, outline: frontOutline, vb: FRONT_VIEWBOX },
    { title: 'Espalda', data: bodyBack,  outline: backOutline,  vb: BACK_VIEWBOX },
  ];

  function parts(path) {
    return [...(path.common ?? []), ...(path.left ?? []), ...(path.right ?? [])];
  }

  // Color = cuánto se trabajó (escala de calor). Sin trabajar → base tenue.
  function muscleColor(slug) {
    const v = intensity[slug] ?? 0;
    return v > 0 ? heatColor(v) : '#283039';
  }
  function muscleOpacity(slug) {
    const v = intensity[slug] ?? 0;
    return v > 0 ? 0.92 : 0.12;
  }

  function toggle(slug) {
    onselect(selected === slug ? null : slug);
  }

  let active = $derived(hovered ?? selected);
  let tipText = $derived.by(() => {
    if (!hovered) return null;
    const v = intensity[hovered] ?? 0;
    const n = counts[hovered] ?? 0;
    return {
      name: SLUG_LABEL[hovered] ?? hovered,
      color: v > 0 ? heatColor(v) : '#6e7681',
      sets: n ? `${Math.round(n * 10) / 10} sets` : 'sin entrenar',
    };
  });
</script>

<div class="wrap" onpointermove={(e) => { const r = e.currentTarget.getBoundingClientRect(); tip = { x: e.clientX - r.left, y: e.clientY - r.top }; }} role="presentation">
  <div class="bodies">
    {#each bodies as body}
      <div class="col">
        <svg viewBox={body.vb} class="body" style="max-width:{bodyWidth}px" role="img" aria-label="Mapa muscular {body.title}">
          <path class="outline" d={body.outline} vector-effect="non-scaling-stroke" />
          {#each body.data as m}
            {#if regionForSlug(m.slug)}
              {@const isActive = active === m.slug}
              <g
                class="muscle"
                class:active={isActive}
                role="button"
                tabindex="0"
                aria-label={SLUG_LABEL[m.slug] ?? m.slug}
                onpointerenter={() => (hovered = m.slug)}
                onpointerleave={() => (hovered = null)}
                onclick={() => toggle(m.slug)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(m.slug); } }}
              >
                {#each parts(m.path) as d}
                  <path
                    {d}
                    fill={muscleColor(m.slug)}
                    fill-opacity={isActive ? 1 : muscleOpacity(m.slug)}
                    stroke={isActive ? '#fff' : '#0d1117'}
                    stroke-opacity={isActive ? 0.95 : 0.5}
                    stroke-width="0.7"
                    vector-effect="non-scaling-stroke"
                  />
                {/each}
              </g>
            {/if}
          {/each}
        </svg>
        <div class="cap">{body.title}</div>
      </div>
    {/each}
  </div>

  {#if tipText}
    <div class="tip" style="left:{tip.x}px; top:{tip.y}px">
      <span class="dot" style="background:{tipText.color}"></span>
      <span class="tn">{tipText.name}</span>
      <span class="ts">{tipText.sets}</span>
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; }
  .bodies {
    display: flex; justify-content: center; gap: 14px;
    flex-wrap: wrap;
  }
  .col { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  .body {
    width: 100%;
    max-width: 220px;
    height: auto;
    max-height: 62vh;
    overflow: visible;
  }
  .outline {
    fill: #1b2430;
    stroke: #3a4654;
    stroke-width: 1.5;
  }
  .muscle { cursor: pointer; outline: none; transition: filter .12s; }
  .muscle path { transition: fill-opacity .12s, stroke-opacity .12s; }
  .muscle.active { filter: drop-shadow(0 0 4px rgba(255,255,255,.25)); }

  .cap {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--dim);
  }

  .tip {
    position: absolute;
    transform: translate(12px, -50%);
    pointer-events: none;
    display: flex; align-items: center; gap: 0.4rem;
    background: var(--s1);
    border: 1px solid var(--b2);
    border-radius: 6px;
    padding: 0.3rem 0.55rem;
    font-size: 0.72rem;
    white-space: nowrap;
    z-index: 10;
    box-shadow: 0 4px 14px rgba(0,0,0,.4);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .tn { color: var(--text); font-weight: 600; }
  .ts { color: var(--muted); font-variant-numeric: tabular-nums; }

  @media (max-width: 480px) {
    .body { max-width: 44vw; }
  }
</style>
