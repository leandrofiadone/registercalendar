<script>
  let { comidas = [], alimentosRef = [] } = $props();

  const MICRO_KEYS = ['fibra_g','sodio_mg','potasio_mg','hierro_mg','calcio_mg','magnesio_mg','zinc_mg','vit_b12_mcg','vit_d_mcg','vit_a_mcg','vit_c_mg','colesterol_mg','omega3_g','omega6_g'];
  const MICRO_LABELS = {
    fibra_g:'Fibra', sodio_mg:'Sodio', potasio_mg:'Potasio', hierro_mg:'Hierro',
    calcio_mg:'Calcio', magnesio_mg:'Magnesio', zinc_mg:'Zinc', vit_b12_mcg:'B12',
    vit_d_mcg:'Vit D', vit_a_mcg:'Vit A', vit_c_mg:'Vit C', colesterol_mg:'Colesterol',
    omega3_g:'Omega-3', omega6_g:'Omega-6'
  };
  const MICRO_UNITS = {
    fibra_g:'g', sodio_mg:'mg', potasio_mg:'mg', hierro_mg:'mg', calcio_mg:'mg',
    magnesio_mg:'mg', zinc_mg:'mg', vit_b12_mcg:'mcg', vit_d_mcg:'mcg', vit_a_mcg:'mcg',
    vit_c_mg:'mg', colesterol_mg:'mg', omega3_g:'g', omega6_g:'g'
  };

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function findRef(alimento) {
    if (!alimentosRef.length) return null;
    if (alimento.ref_id) {
      return alimentosRef.find(r => r.id === alimento.ref_id) ?? null;
    }
    const n = norm(alimento.nombre);
    return alimentosRef.find(r =>
      r.nombres.some(rn => {
        const rn2 = norm(rn);
        if (n === rn2 || n.includes(rn2)) return true;
        if (rn2.length > n.length && rn2.includes(n)) return true;
        return false;
      })
    ) ?? null;
  }

  let microTotals = $derived.by(() => {
    if (!comidas.length || !alimentosRef.length) return null;
    const totals = {};
    MICRO_KEYS.forEach(k => totals[k] = 0);
    let matched = 0;
    let total = 0;

    for (const comida of comidas) {
      for (const a of (comida.alimentos || [])) {
        total++;
        const ref = findRef(a);
        if (!ref) continue;
        matched++;
        const grams = a.cantidad_g ?? 0;
        if (!grams) continue;
        const factor = grams / 100;
        for (const k of MICRO_KEYS) {
          totals[k] += (ref.por_100g[k] ?? 0) * factor;
        }
      }
    }

    if (!matched) return null;
    const rounded = {};
    for (const k of MICRO_KEYS) {
      rounded[k] = totals[k] < 10 ? +totals[k].toFixed(1) : Math.round(totals[k]);
    }
    return { values: rounded, matched, total };
  });
</script>

{#if microTotals}
  <div class="section">
    <div class="sec-label">🧬 Micronutrientes</div>
    <div class="micro-grid">
      {#each MICRO_KEYS as k}
        <div class="micro-item">
          <span class="micro-val">{microTotals.values[k]}<span class="micro-unit">{MICRO_UNITS[k]}</span></span>
          <span class="micro-lbl">{MICRO_LABELS[k]}</span>
        </div>
      {/each}
    </div>
    {#if microTotals.matched < microTotals.total}
      <div class="micro-note">Datos de {microTotals.matched}/{microTotals.total} alimentos con referencia</div>
    {/if}
  </div>
{/if}

<style>
  .section { margin-bottom: 26px; }
  .sec-label {
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--dim); margin-bottom: 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .sec-label::after { content: ''; flex: 1; height: 1px; background: var(--b1); }
  .micro-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 6px;
  }
  .micro-item {
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 6px; padding: 8px 10px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .micro-val {
    font-size: 15px; font-weight: 700; color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .micro-unit { font-size: 10px; color: var(--dim); margin-left: 2px; font-weight: 400; }
  .micro-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .micro-note { margin-top: 8px; font-size: 10px; color: var(--dim); }
</style>
