<script>
  let { comidas = [], alimentosRef = [] } = $props();

  const MICRO_KEYS = [
    'fibra_g','hierro_mg','magnesio_mg','potasio_mg','calcio_mg','zinc_mg',
    'vit_b6_mg','vit_b12_mcg','folato_mcg','vit_c_mg','vit_d_mcg','vit_e_mg',
    'selenio_mcg','yodo_mcg','vit_a_mcg','omega3_g','omega6_g','sodio_mg','colesterol_mg'
  ];

  const MICRO_META = {
    fibra_g:      { label: 'Fibra',      unit: 'g',   icon: '🌾', color: '#4ade80' },
    hierro_mg:    { label: 'Hierro',     unit: 'mg',  icon: '🩸', color: '#f87171' },
    magnesio_mg:  { label: 'Magnesio',   unit: 'mg',  icon: '💜', color: '#c084fc' },
    potasio_mg:   { label: 'Potasio',    unit: 'mg',  icon: '⚡', color: '#fbbf24' },
    calcio_mg:    { label: 'Calcio',     unit: 'mg',  icon: '🦴', color: '#e2e8f0' },
    zinc_mg:      { label: 'Zinc',       unit: 'mg',  icon: '🛡️', color: '#60a5fa' },
    vit_b6_mg:    { label: 'Vit B6',     unit: 'mg',  icon: '🔬', color: '#f97316' },
    vit_b12_mcg:  { label: 'Vit B12',   unit: 'mcg', icon: '⚡', color: '#fb923c' },
    folato_mcg:   { label: 'Folato',     unit: 'mcg', icon: '🧬', color: '#a3e635' },
    vit_c_mg:     { label: 'Vit C',      unit: 'mg',  icon: '🍊', color: '#fb923c' },
    vit_d_mcg:    { label: 'Vit D',      unit: 'mcg', icon: '☀️', color: '#facc15' },
    vit_e_mg:     { label: 'Vit E',      unit: 'mg',  icon: '🌿', color: '#4ade80' },
    selenio_mcg:  { label: 'Selenio',    unit: 'mcg', icon: '⚙️', color: '#94a3b8' },
    yodo_mcg:     { label: 'Yodo',       unit: 'mcg', icon: '🫧', color: '#67e8f9' },
    vit_a_mcg:    { label: 'Vit A',      unit: 'mcg', icon: '👁️', color: '#f97316' },
    omega3_g:     { label: 'Omega-3',    unit: 'g',   icon: '🐟', color: '#38bdf8' },
    omega6_g:     { label: 'Omega-6',    unit: 'g',   icon: '🌻', color: '#a78bfa' },
    sodio_mg:     { label: 'Sodio',      unit: 'mg',  icon: '🧂', color: '#94a3b8' },
    colesterol_mg:{ label: 'Colesterol', unit: 'mg',  icon: '🫀', color: '#64748b' },
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
        const grams = a.cantidad_g ?? a.cantidad_g_aprox ?? a.carne_neta_estimada_g
          ?? (a.unidades ? a.unidades * 100 : null)
          ?? a.cantidad_ml ?? a.cantidad_ml_aprox ?? 0;
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
    <div class="sec-label">🧬 Total micronutrientes del día</div>
    <div class="micro-grid">
      {#each MICRO_KEYS.filter(k => microTotals.values[k] > 0) as k}
        {@const meta = MICRO_META[k]}
        {@const val = microTotals.values[k]}
        <div class="micro-item" style="--accent:{meta.color}">
          <div class="micro-top">
            <span class="micro-icon">{meta.icon}</span>
            <span class="micro-val">{val}<span class="micro-unit">{meta.unit}</span></span>
          </div>
          <span class="micro-lbl">{meta.label}</span>
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
    display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 6px;
  }

  .micro-item {
    background: var(--s2);
    border: 1px solid var(--b1);
    border-top: 2px solid var(--accent);
    border-radius: 6px; padding: 8px 10px;
    display: flex; flex-direction: column; gap: 4px;
    transition: border-color .2s;
  }
  .micro-top {
    display: flex; align-items: baseline; justify-content: space-between; gap: 4px;
  }

  .micro-icon {
    font-size: 13px; line-height: 1; flex-shrink: 0;
  }

  .micro-val {
    font-size: 14px; font-weight: 700;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .micro-item.zero .micro-val { color: var(--dim); }

  .micro-unit { font-size: 9px; color: var(--dim); margin-left: 1px; font-weight: 400; }
  .micro-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .micro-note { margin-top: 8px; font-size: 10px; color: var(--dim); }
</style>
