<script>
  let { data } = $props();
  let perfil = $derived(data.perfil);
  let historial = $derived(perfil?.historial_peso ?? []);

  function diffDias(a, b) {
    const dA = new Date(a);
    const dB = new Date(b);
    return Math.round((dB - dA) / 86400000);
  }

  function hoyStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  let ultimo = $derived(historial[historial.length - 1] ?? null);
  let diasDesdeUltimo = $derived(ultimo ? diffDias(ultimo.fecha, hoyStr()) : null);

  let tendenciaTexto = $derived.by(() => {
    if (historial.length < 2) return null;
    const ult = historial[historial.length - 1];
    const ref = [...historial].reverse().find(p => diffDias(p.fecha, ult.fecha) >= 14);
    if (!ref) return null;
    const delta = ult.peso_kg - ref.peso_kg;
    const dias = diffDias(ref.fecha, ult.fecha);
    const semanas = dias / 7;
    const porSemana = delta / semanas;
    return {
      delta: delta.toFixed(1),
      dias,
      porSemana: porSemana.toFixed(2),
      direccion: delta < -0.1 ? 'down' : delta > 0.1 ? 'up' : 'flat'
    };
  });

  // SVG sparkline
  let sparklineData = $derived.by(() => {
    if (historial.length < 2) return null;
    const ultimos = historial.slice(-12);
    const pesos = ultimos.map(p => p.peso_kg);
    const min = Math.min(...pesos);
    const max = Math.max(...pesos);
    const range = max - min || 1;
    const W = 600;
    const H = 120;
    const pad = 12;
    const baseDate = new Date(ultimos[0].fecha).getTime();
    const lastDate = new Date(ultimos[ultimos.length - 1].fecha).getTime();
    const span = (lastDate - baseDate) || 1;
    const points = ultimos.map(p => {
      const t = (new Date(p.fecha).getTime() - baseDate) / span;
      const x = pad + t * (W - 2 * pad);
      const y = H - pad - ((p.peso_kg - min) / range) * (H - 2 * pad);
      return { x, y, peso: p.peso_kg, fecha: p.fecha };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return { points, path, min, max, W, H };
  });
</script>

<div class="minimo">
  <header class="head">
    <h1>minimo</h1>
    <p class="sub">solo peso · sin pedir nada mas</p>
  </header>

  {#if ultimo}
    <section class="bignum">
      <div class="kg num">{ultimo.peso_kg}<small>kg</small></div>
      <div class="meta">
        ultima medicion · {ultimo.fecha}
        {#if diasDesdeUltimo > 0}<span class="dim">· hace {diasDesdeUltimo}d</span>{/if}
      </div>
    </section>

    {#if tendenciaTexto}
      <section class="trend" class:down={tendenciaTexto.direccion === 'down'} class:up={tendenciaTexto.direccion === 'up'}>
        <div class="t-big num">
          {tendenciaTexto.direccion === 'down' ? '↓' : tendenciaTexto.direccion === 'up' ? '↑' : '→'}
          {Math.abs(tendenciaTexto.delta)}<small>kg</small>
        </div>
        <div class="t-meta">
          en los ultimos {tendenciaTexto.dias} dias ·
          <span class="num">{tendenciaTexto.porSemana}</span> kg/semana
        </div>
      </section>
    {/if}

    {#if sparklineData}
      <section class="chart">
        <svg viewBox="0 0 {sparklineData.W} {sparklineData.H}" preserveAspectRatio="none">
          <path d={sparklineData.path} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          {#each sparklineData.points as p}
            <circle cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
          {/each}
        </svg>
        <div class="chart-foot">
          <span class="num">{sparklineData.min}</span>
          <span class="dim">↑ rango ↓</span>
          <span class="num">{sparklineData.max}</span>
        </div>
      </section>
    {/if}
  {:else}
    <p class="empty">aun sin datos de peso</p>
  {/if}

  <section class="info">
    <h2 class="section">filosofia</h2>
    <p>
      la app no te pide entrar comida ni entrenamientos.
      solo el peso, una vez por semana es suficiente para ver la tendencia real.
      el resto vive afuera de la app.
    </p>
    <p class="hint">
      por ahora la entrada de peso sigue siendo via <code>data/perfil.json</code> (manual).
      si el modo te resulta util, agregamos un input directo aca.
    </p>
  </section>
</div>

<style>
  .minimo { display: flex; flex-direction: column; gap: 1.75rem; }
  .head h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
  }
  .sub { font-family: var(--font-mono); font-size: 0.7rem; color: var(--dim); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.15rem; }

  .bignum {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 8px;
    padding: 1.75rem 1.5rem;
    text-align: center;
  }
  .kg {
    font-family: var(--font-display);
    font-size: 4rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text);
  }
  .kg small {
    font-size: 1.2rem;
    color: var(--dim);
    font-weight: 400;
    margin-left: 0.25rem;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
    margin-top: 0.5rem;
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .dim { color: var(--dim); }

  .trend {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-left: 3px solid var(--b2);
    border-radius: 6px;
    padding: 1rem 1.25rem;
  }
  .trend.down { border-left-color: var(--green); }
  .trend.up { border-left-color: var(--red); }
  .t-big {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text);
  }
  .t-big small { font-size: 0.85rem; color: var(--dim); font-weight: 400; margin-left: 0.15rem; }
  .trend.down .t-big { color: var(--green-l); }
  .trend.up .t-big { color: var(--red); }
  .t-meta {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
    margin-top: 0.3rem;
  }

  .chart {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 6px;
    padding: 1rem;
  }
  svg {
    width: 100%;
    height: 120px;
    display: block;
  }
  .chart-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
  }
  .chart-foot .dim { color: var(--dim); }

  .info p {
    color: var(--muted);
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--dim);
  }
  code { background: var(--s2); padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.75rem; color: var(--accent-l); }

  .empty {
    color: var(--dim);
    text-align: center;
    padding: 2rem 0;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.8rem;
  }
</style>
