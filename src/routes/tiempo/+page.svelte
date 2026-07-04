<script>
  import { invalidateAll } from '$app/navigation';
  import { fmtMin } from '$lib/tiempo/stats.js';

  let { data } = $props();

  let texto    = $state('');
  let enviando = $state(false);
  let msg      = $state(null); // { ok: boolean, txt: string }

  let cats   = $derived(data.config.categorias);
  let dist   = $derived(data.dist7);
  let maxMin = $derived(Math.max(1, ...dist.porCat.map((c) => c.minutos)));

  function ahoraLocal() {
    const d = new Date();
    const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { fecha, hora };
  }

  async function registrar() {
    const t = texto.trim();
    if (!t || enviando) return;
    enviando = true; msg = null;
    const { fecha, hora } = ahoraLocal();
    try {
      const res = await fetch('/api/tiempo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: t, fechaLocal: fecha, horaLocal: hora }),
      });
      const body = await res.json();
      if (body.pregunta) {
        msg = { ok: false, q: true, txt: body.pregunta };
      } else if (!body.ok) {
        msg = { ok: false, txt: body.error || body.errores?.map((e) => e.error).join(' · ') || 'no se pudo registrar' };
      } else {
        texto = '';
        msg = { ok: true, txt: `${body.agregadas} registrada${body.agregadas > 1 ? 's' : ''}` + (body.via === 'nl' ? ' · interpretado' : '') };
        await invalidateAll();
      }
    } catch (e) {
      msg = { ok: false, txt: e.message };
    }
    enviando = false;
  }

  async function limpiarEjemplos() {
    if (enviando) return;
    enviando = true;
    try {
      await fetch('/api/tiempo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'limpiarEjemplos' }),
      });
      await invalidateAll();
    } finally { enviando = false; }
  }

  function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); registrar(); } }

  function gapTxt(p) {
    if (p.gap === null) return 'sin registro';
    if (p.gap === 0) return 'hoy';
    if (p.gap === 1) return 'ayer';
    return `hace ${p.gap}d`;
  }

  function deltaTxt(d) {
    if (d === 0) return '—';
    return (d > 0 ? '+' : '−') + fmtMin(Math.abs(d));
  }

  const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  function dowDe(iso) {
    const dia = new Date(iso + 'T00:00:00').getDay(); // 0=domingo
    return DOW[(dia + 6) % 7];
  }
</script>

<svelte:head><title>Tiempo · Gym Tracker</title></svelte:head>

<h1>Tiempo</h1>
<p class="sub">registro por categorías · espejo, no puntaje</p>

<!-- Quick-add: una línea, sin formulario -->
<div class="add">
  <input
    class="add-in"
    placeholder="contá qué hiciste… ej: estuve 3h en uber y cociné un poco"
    bind:value={texto}
    onkeydown={onKey}
    disabled={enviando}
  />
  <button class="add-go" onclick={registrar} disabled={enviando || !texto.trim()}>{enviando ? 'interpretando…' : 'registrar'}</button>
</div>
{#if msg}<div class="add-msg" class:err={!msg.ok && !msg.q} class:q={msg.q}>{msg.txt}</div>{/if}
<p class="add-hint">escribí natural, o terse: <span class="mono">b 3h …</span> · códigos: {cats.map((c) => c.codigo).join(' · ')} · la duración es opcional</p>

{#if data.hayEjemplos}
  <div class="ej-banner">
    <span>Estás viendo <strong>datos de ejemplo</strong> para que se vean los patrones. Borralos cuando registres lo tuyo.</span>
    <button onclick={limpiarEjemplos} disabled={enviando}>borrar ejemplos</button>
  </div>
{/if}

<!-- 1 · Distribución por categoría -->
<h2 class="section">distribución · últimos 7 días</h2>
<div class="dist">
  {#each dist.porCat as c}
    <div class="dist-row">
      <div class="dist-head">
        <span class="cod" style="color:{c.color}">{c.codigo}</span>
        <span class="etq">{c.etiqueta}</span>
        <span class="val num">{fmtMin(c.minutos)}</span>
      </div>
      <div class="track"><div class="fill" style="width:{(c.minutos / maxMin) * 100}%;background:{c.color}"></div></div>
    </div>
  {/each}
  {#if dist.totalMin === 0}<p class="vacio">Todavía no hay tiempo registrado en estos 7 días.</p>{/if}
</div>

<!-- 2 · Registrado vs sin registrar (Time Indifference) -->
<h2 class="section">registrado vs sin registrar · 7 días</h2>
<div class="split">
  {#each dist.porCat as c}
    {#if c.minutos > 0}
      <div class="seg" style="width:{(c.minutos / data.sin7.ventana) * 100}%;background:{c.color}" title="{c.codigo} · {fmtMin(c.minutos)}"></div>
    {/if}
  {/each}
  <div class="seg seg-sin" style="width:{(data.sin7.sinRegistrar / data.sin7.ventana) * 100}%" title="sin registrar"></div>
</div>
<div class="split-legend">
  <span class="num">{fmtMin(data.sin7.registrado)}</span> registradas ·
  <span class="num">{fmtMin(data.sin7.sinRegistrar)}</span> sin registrar ·
  ventana <span class="num">{fmtMin(data.sin7.ventana)}</span> (7 días × {data.config.ventana_label})
</div>
<p class="nota-sint">Lo «sin registrar» no es tiempo perdido — es tiempo que todavía no mirás. Hacerlo visible es el punto.</p>

<!-- 3 · Presencia / huecos -->
<h2 class="section">presencia · últimos 7 días</h2>
<div class="pres">
  <div class="pres-dow">
    <span class="cod"></span>
    <div class="dots">{#each data.dias7 as d}<span class="dow">{dowDe(d)}</span>{/each}</div>
    <span class="gap"></span>
  </div>
  {#each data.presencia7 as p}
    <div class="pres-row">
      <span class="cod" style="color:{p.color}">{p.codigo}</span>
      <div class="dots">
        {#each p.puntos as on, i}
          <span class="dot" class:on style={on ? `background:${p.color};border-color:${p.color}` : ''} title={data.dias7[i]}></span>
        {/each}
      </div>
      <span class="gap" class:frio={p.gap === null || p.gap >= 3}>{p.diasCon}/{p.total} · {gapTxt(p)}</span>
    </div>
  {/each}
</div>

<!-- 4 · Semana vs semana -->
<h2 class="section">semana vs semana</h2>
<table class="sem">
  <thead>
    <tr><th>categoría</th><th class="r">anterior</th><th class="r">esta</th><th class="r">Δ</th></tr>
  </thead>
  <tbody>
    {#each data.semanas.filas as f}
      <tr>
        <td><span class="cod" style="color:{f.color}">{f.codigo}</span> <span class="etq">{f.etiqueta}</span></td>
        <td class="r num">{fmtMin(f.prev)}</td>
        <td class="r num">{fmtMin(f.esta)}</td>
        <td class="r num delta">{deltaTxt(f.delta)}</td>
      </tr>
    {/each}
  </tbody>
</table>
<p class="nota-sint">La dirección del Δ no se juzga acá. Mostrar el cambio es la herramienta; interpretarlo es tuyo.</p>

<style>
  h1 { font-size: 2rem; letter-spacing: -0.02em; }
  .sub { color: var(--muted); font-size: 0.9rem; margin-top: 0.2rem; margin-bottom: 1.5rem; }

  /* Quick-add */
  .add { display: flex; gap: 0.5rem; }
  .add-in {
    flex: 1; background: var(--s1); border: 1px solid var(--b1); border-radius: 6px;
    padding: 0.6rem 0.75rem; color: var(--text); font-size: 0.9rem;
  }
  .add-in:focus { outline: none; border-color: var(--blue); }
  .add-in::placeholder { color: var(--dim); }
  .add-go {
    background: var(--s1); border: 1px solid var(--b1); border-radius: 6px;
    color: var(--muted); font-family: var(--font-mono); font-size: 0.8rem;
    padding: 0 0.9rem; cursor: pointer; transition: border-color .12s, color .12s;
  }
  .add-go:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .add-go:disabled { opacity: 0.4; cursor: default; }
  .add-msg { font-size: 0.78rem; color: var(--green); margin-top: 0.5rem; }
  .add-msg.err { color: var(--red); }
  .add-msg.q { color: var(--amber); }
  .add-hint { font-size: 0.72rem; color: var(--dim); margin-top: 0.5rem; }

  .ej-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    margin-top: 1.25rem; padding: 0.7rem 0.9rem;
    background: var(--s1); border: 1px solid var(--b1); border-left: 3px solid var(--amber); border-radius: 6px;
    font-size: 0.82rem; color: var(--muted);
  }
  .ej-banner button {
    background: transparent; border: 1px solid var(--b1); border-radius: 6px; color: var(--muted);
    font-family: var(--font-mono); font-size: 0.72rem; padding: 0.35rem 0.6rem; cursor: pointer; white-space: nowrap;
  }
  .ej-banner button:hover:not(:disabled) { border-color: var(--amber); color: var(--amber); }

  .cod { font-family: var(--font-mono); font-weight: 700; font-size: 0.82rem; width: 1.8rem; flex-shrink: 0; }
  .etq { color: var(--muted); font-size: 0.85rem; }

  /* Distribución */
  .dist-row { padding: 0.5rem 0; border-bottom: 1px solid var(--b1); }
  .dist-head { display: flex; align-items: baseline; gap: 0.5rem; }
  .dist-head .etq { flex: 1; }
  .dist-head .val { color: var(--text); font-size: 0.85rem; }
  .track {
    margin-top: 0.4rem; height: 6px; background: var(--bg);
    border: 1px solid var(--b1); border-radius: 2px; overflow: hidden;
  }
  .fill { height: 100%; transition: width .2s; }
  .vacio { color: var(--dim); font-size: 0.82rem; padding: 0.6rem 0; }

  /* Split registrado/sin registrar */
  .split {
    display: flex; height: 22px; border: 1px solid var(--b1); border-radius: 4px; overflow: hidden; background: var(--bg);
  }
  .seg { height: 100%; }
  .seg-sin { background: var(--b1); }
  .split-legend { margin-top: 0.5rem; font-size: 0.8rem; color: var(--muted); }
  .split-legend .num { color: var(--text); }
  .nota-sint { font-size: 0.74rem; color: var(--dim); margin-top: 0.5rem; font-style: italic; }

  /* Presencia */
  .pres { display: flex; flex-direction: column; gap: 0.15rem; }
  .pres-row, .pres-dow { display: flex; align-items: center; gap: 0.6rem; padding: 0.25rem 0; }
  .dots { display: flex; gap: 0.4rem; flex: 1; }
  .dow { width: 16px; text-align: center; font-family: var(--font-mono); font-size: 0.62rem; color: var(--dim); text-transform: uppercase; }
  .dot {
    width: 16px; height: 16px; border-radius: 3px;
    background: transparent; border: 1px solid var(--b1);
  }
  .gap { font-family: var(--font-mono); font-size: 0.7rem; color: var(--muted); white-space: nowrap; width: 8.5rem; text-align: right; }
  .gap.frio { color: var(--dim); }

  /* Semana vs semana */
  .sem { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .sem th {
    text-transform: uppercase; font-family: var(--font-mono); font-size: 0.66rem; color: var(--muted);
    border-bottom: 2px solid var(--b1); padding: 0.4rem 0.5rem; text-align: left; letter-spacing: 0.06em;
  }
  .sem th.r, .sem td.r { text-align: right; }
  .sem td { border-bottom: 1px solid var(--b1); padding: 0.45rem 0.5rem; }
  .sem .etq { font-size: 0.8rem; }
  .sem .delta { color: var(--muted); }  /* neutro a propósito — sin verde/rojo */

  @media (max-width: 768px) {
    .gap { width: auto; }
    .etq { font-size: 0.8rem; }
    .sem .etq { display: none; } /* en mobile solo el código */
  }
</style>
