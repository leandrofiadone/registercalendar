<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();
  let entradas = $derived(data.diario?.entradas ?? []);
  let historialPeso = $derived(data.perfil?.historial_peso ?? []);

  function hoyStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function ultimoPeso() {
    if (historialPeso.length === 0) return null;
    return historialPeso[historialPeso.length - 1].peso_kg;
  }

  let fecha = $state(hoyStr());
  let entradaHoy = $derived(entradas.find(e => e.fecha === fecha));

  let pesoInput = $state('');
  let entreno = $state(null);
  let linea = $state('');
  let guardando = $state(false);
  let okFlash = $state(false);

  $effect(() => {
    if (entradaHoy) {
      pesoInput = entradaHoy.peso_kg != null ? String(entradaHoy.peso_kg) : '';
      entreno = entradaHoy.entreno;
      linea = entradaHoy.linea ?? '';
    } else {
      pesoInput = '';
      entreno = null;
      linea = '';
    }
  });

  async function guardar() {
    if (guardando) return;
    guardando = true;
    try {
      const peso_kg = pesoInput.trim() ? parseFloat(pesoInput.replace(',', '.')) : null;
      const res = await fetch('/api/diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, peso_kg, entreno, linea: linea.trim() })
      });
      if (!res.ok) throw new Error('fallo guardado');
      await invalidateAll();
      okFlash = true;
      setTimeout(() => okFlash = false, 1500);
    } catch (e) {
      console.error(e);
    }
    guardando = false;
  }

  function fmtFecha(f) {
    const [y, m, d] = f.split('-');
    return `${d}/${m}`;
  }

  let ultimasEntradas = $derived(entradas.slice(0, 14));

  let promedioSemana = $derived.by(() => {
    const ultSiete = entradas.slice(0, 7).filter(e => e.peso_kg != null);
    if (ultSiete.length === 0) return null;
    const sum = ultSiete.reduce((a, e) => a + e.peso_kg, 0);
    return (sum / ultSiete.length).toFixed(1);
  });

  let diasEntreno7 = $derived(
    entradas.slice(0, 7).filter(e => e.entreno === true).length
  );
</script>

<div class="diario">
  <header class="head">
    <h1>diario</h1>
    <p class="sub">1 entrada al dia · peso, entreno, una linea</p>
  </header>

  <!-- Tendencia mini -->
  {#if promedioSemana || diasEntreno7 > 0}
    <div class="trend">
      {#if promedioSemana}
        <div class="trend-item">
          <span class="t-l">peso 7d</span>
          <span class="t-v num">{promedioSemana} <small>kg</small></span>
        </div>
      {/if}
      <div class="trend-item">
        <span class="t-l">entrenos 7d</span>
        <span class="t-v num">{diasEntreno7}<small>/7</small></span>
      </div>
    </div>
  {/if}

  <!-- Form -->
  <section class="card">
    <div class="row">
      <label class="lbl">fecha</label>
      <input class="inp" type="date" bind:value={fecha} />
    </div>

    <div class="row">
      <label class="lbl">peso (kg)</label>
      <input class="inp" type="text" inputmode="decimal"
        bind:value={pesoInput}
        placeholder={ultimoPeso() ? `ultimo: ${ultimoPeso()}` : 'opcional'} />
    </div>

    <div class="row">
      <label class="lbl">entrenaste?</label>
      <div class="bool">
        <button class="b" class:on={entreno === true}
          onclick={() => entreno = entreno === true ? null : true}>si</button>
        <button class="b" class:on={entreno === false}
          onclick={() => entreno = entreno === false ? null : false}>no</button>
      </div>
    </div>

    <div class="row col">
      <label class="lbl">como te fue (una linea)</label>
      <textarea class="ta" rows="2" maxlength="200"
        bind:value={linea}
        placeholder="energia, animo, lo que sea..."></textarea>
      <span class="counter">{linea.length}/200</span>
    </div>

    <button class="save" onclick={guardar} disabled={guardando}>
      {#if okFlash}✓ guardado{:else if guardando}guardando…{:else if entradaHoy}actualizar{:else}guardar{/if}
    </button>
  </section>

  <!-- Historial -->
  {#if ultimasEntradas.length > 0}
    <section>
      <h2 class="section">ultimos dias</h2>
      <div class="list">
        {#each ultimasEntradas as e}
          <div class="entry">
            <div class="e-date num">{fmtFecha(e.fecha)}</div>
            <div class="e-data">
              <div class="e-stats">
                {#if e.peso_kg != null}
                  <span class="chip num">{e.peso_kg}kg</span>
                {/if}
                {#if e.entreno === true}
                  <span class="chip on">entreno</span>
                {:else if e.entreno === false}
                  <span class="chip off">descanso</span>
                {/if}
              </div>
              {#if e.linea}
                <div class="e-line">{e.linea}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .diario { display: flex; flex-direction: column; gap: 1.5rem; }
  .head h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
  }
  .sub { font-family: var(--font-mono); font-size: 0.7rem; color: var(--dim); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.15rem; }

  .trend {
    display: flex;
    gap: 0.75rem;
  }
  .trend-item {
    flex: 1;
    padding: 0.7rem 0.9rem;
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .t-l { font-family: var(--font-mono); font-size: 0.65rem; color: var(--dim); text-transform: uppercase; letter-spacing: 0.1em; }
  .t-v { font-size: 1.3rem; font-weight: 600; color: var(--accent-l); }
  .t-v small { font-size: 0.75rem; color: var(--dim); font-weight: 400; }

  .card {
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 8px;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .row.col { flex-direction: column; align-items: stretch; gap: 0.4rem; }
  .lbl {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    min-width: 110px;
  }
  .row.col .lbl { min-width: auto; }
  .inp, .ta {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--b1);
    border-radius: 5px;
    padding: 0.55rem 0.75rem;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
  .inp:focus, .ta:focus { outline: none; border-color: var(--accent); }
  .ta { font-family: var(--font-body); resize: vertical; min-height: 50px; }
  .counter { font-family: var(--font-mono); font-size: 0.65rem; color: var(--dim); align-self: flex-end; }

  .bool { display: flex; gap: 0.4rem; flex: 1; }
  .b {
    padding: 0.45rem 1rem;
    background: var(--bg);
    border: 1px solid var(--b1);
    border-radius: 5px;
    color: var(--muted);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: all .12s;
  }
  .b:hover { border-color: var(--b2); color: var(--text); }
  .b.on {
    border-color: var(--accent);
    background: rgba(188, 140, 255, 0.1);
    color: var(--accent-l);
  }

  .save {
    margin-top: 0.25rem;
    padding: 0.7rem;
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: opacity .12s;
  }
  .save:disabled { opacity: 0.5; cursor: default; }

  .list { display: flex; flex-direction: column; gap: 0.5rem; }
  .entry {
    display: flex;
    gap: 0.85rem;
    padding: 0.65rem 0.85rem;
    background: var(--s1);
    border: 1px solid var(--b1);
    border-radius: 6px;
  }
  .e-date {
    font-size: 0.85rem;
    color: var(--dim);
    min-width: 42px;
    padding-top: 0.1rem;
  }
  .e-data { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
  .e-stats { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .chip {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    background: var(--s2);
    border: 1px solid var(--b1);
    border-radius: 3px;
    color: var(--muted);
  }
  .chip.on { color: var(--green-l); border-color: rgba(63, 185, 80, 0.3); background: rgba(63, 185, 80, 0.08); }
  .chip.off { color: var(--dim); }
  .e-line {
    font-size: 0.88rem;
    color: var(--text);
    line-height: 1.45;
  }

  @media (max-width: 600px) {
    .row { flex-direction: column; align-items: stretch; gap: 0.35rem; }
    .lbl { min-width: auto; }
    .trend { flex-direction: row; }
  }
</style>
