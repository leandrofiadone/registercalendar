<script>
  let { totales = null, vdr = null, comidas = [], alimentosRef = [] } = $props();

  const nf1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  const fmt = v => v == null ? '—' : (Math.abs(v) < 10 ? nf1 : nf0).format(v);

  const ST_COLOR = {
    good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)',
    high: 'var(--carb)', na: 'var(--dim)',
  };

  // Micros: <50% VDR = bad, 50-80 = warn, 80-150 = good, >150 = high (azul, atípico no malo).
  // Nutrientes con `limit` (sodio): la VDR es techo — pasarse es lo malo.
  function status(pct, limit) {
    if (pct == null) return 'na';
    if (limit) return pct <= 100 ? 'good' : pct <= 130 ? 'warn' : 'bad';
    if (pct < 50) return 'bad';
    if (pct < 80) return 'warn';
    if (pct <= 150) return 'good';
    return 'high';
  }

  let hasNew = $derived(!!(totales?.micro && totales?.macro_ext));

  let sections = $derived.by(() => {
    if (!hasNew) return null;
    const t = totales;
    const vm = vdr?.micro ?? {};
    const defs = [
      {
        title: 'Macros extendidos',
        src: { proteina_g: t.proteina_g, ...t.macro_ext },
        ref: {
          proteina_g: vdr?.macros?.proteina_g,
          fibra_total_g: vdr?.macros?.fibra_total_g,
          omega3_g: vdr?.macros?.omega3_g,
        },
        rows: [
          ['proteina_g', 'Proteína', 'g'],
          ['fibra_total_g', 'Fibra', 'g'],
          ['azucares_g', 'Azúcares', 'g'],
          ['almidon_g', 'Almidón', 'g'],
          ['grasas_saturadas_g', 'Grasa saturada', 'g'],
          ['grasas_monoinsaturadas_g', 'Grasa monoinsat.', 'g'],
          ['grasas_poliinsaturadas_g', 'Grasa poliinsat.', 'g'],
          ['grasas_trans_g', 'Grasa trans', 'g'],
          ['omega3_g', 'Omega-3', 'g'],
          ['omega6_g', 'Omega-6', 'g'],
          ['colesterol_mg', 'Colesterol', 'mg'],
        ],
      },
      {
        title: 'Electrolitos',
        src: t.micro.electrolitos, ref: vm.electrolitos ?? {},
        rows: [
          ['sodio_mg', 'Sodio', 'mg', true],
          ['potasio_mg', 'Potasio', 'mg'],
          ['cloro_mg', 'Cloro', 'mg'],
        ],
      },
      {
        title: 'Minerales',
        src: t.micro.minerales, ref: vm.minerales ?? {},
        rows: [
          ['calcio_mg', 'Calcio', 'mg'],
          ['fosforo_mg', 'Fósforo', 'mg'],
          ['magnesio_mg', 'Magnesio', 'mg'],
          ['hierro_mg', 'Hierro', 'mg'],
          ['zinc_mg', 'Zinc', 'mg'],
          ['selenio_mcg', 'Selenio', 'mcg'],
          ['cobre_mg', 'Cobre', 'mg'],
          ['manganeso_mg', 'Manganeso', 'mg'],
          ['cromo_mcg', 'Cromo', 'mcg'],
          ['yodo_mcg', 'Yodo', 'mcg'],
        ],
      },
      {
        title: 'Vitaminas liposolubles',
        src: t.micro.vitaminas_liposolubles, ref: vm.vitaminas_liposolubles ?? {},
        rows: [
          ['vit_a_mcg_rae', 'Vit A', 'mcg'],
          ['vit_d_mcg', 'Vit D', 'mcg'],
          ['vit_e_mg', 'Vit E', 'mg'],
          ['vit_k_mcg', 'Vit K', 'mcg'],
        ],
      },
      {
        title: 'Vitaminas hidrosolubles',
        src: t.micro.vitaminas_hidrosolubles, ref: vm.vitaminas_hidrosolubles ?? {},
        rows: [
          ['vit_c_mg', 'Vit C', 'mg'],
          ['vit_b1_tiamina_mg', 'B1 Tiamina', 'mg'],
          ['vit_b2_riboflavina_mg', 'B2 Riboflavina', 'mg'],
          ['vit_b3_niacina_mg', 'B3 Niacina', 'mg'],
          ['vit_b5_ac_pantotenico_mg', 'B5 Pantoténico', 'mg'],
          ['vit_b6_mg', 'B6', 'mg'],
          ['vit_b7_biotina_mcg', 'B7 Biotina', 'mcg'],
          ['vit_b9_folato_mcg', 'B9 Folato', 'mcg'],
          ['vit_b12_mcg', 'B12', 'mcg'],
        ],
      },
    ];
    return defs.map(d => ({
      title: d.title,
      rows: d.rows.map(([k, label, unit, limit]) => {
        const val = d.src?.[k] ?? null;
        const ref = d.ref?.[k] ?? null;
        const pct = (val != null && ref) ? Math.round((val / ref) * 100) : null;
        return { label, unit, val, ref, pct, limit: !!limit, st: status(pct, limit) };
      }).filter(r => r.val != null || r.ref != null),
    })).filter(s => s.rows.length);
  });

  let especiales = $derived.by(() => {
    if (!hasNew) return [];
    const e = totales.micro.compuestos_especiales ?? {};
    return [
      ['colageno_g', 'Colágeno', 'g'],
      ['creatina_g', 'Creatina', 'g'],
      ['cafeina_mg', 'Cafeína', 'mg'],
      ['alcohol_g', 'Alcohol', 'g'],
      ['taurina_mg', 'Taurina', 'mg'],
    ].map(([k, label, unit]) => ({ label, unit, val: e[k] })).filter(r => r.val != null);
  });

  let aminos = $derived.by(() => {
    if (!hasNew || !totales.aminoacidos_esenciales_totales_mg) return null;
    const a = totales.aminoacidos_esenciales_totales_mg;
    const rows = [
      ['histidina', 'Histidina'], ['isoleucina', 'Isoleucina'], ['leucina', 'Leucina'],
      ['lisina', 'Lisina'], ['metionina', 'Metionina'], ['fenilalanina', 'Fenilalanina'],
      ['treonina', 'Treonina'], ['triptofano', 'Triptófano'], ['valina', 'Valina'],
    ].map(([k, label]) => ({ label, val: a[k] }));
    return rows.some(r => r.val != null) ? rows : null;
  });

  /* ── Fallback legacy: ventanas viejas sin schema, estimación por alimentos_ref ── */
  const LEGACY_KEYS = [
    'fibra_g','hierro_mg','magnesio_mg','potasio_mg','calcio_mg','zinc_mg',
    'vit_b6_mg','vit_b12_mcg','folato_mcg','vit_c_mg','vit_d_mcg','vit_e_mg',
    'selenio_mcg','yodo_mcg','vit_a_mcg','omega3_g','omega6_g','sodio_mg','colesterol_mg'
  ];
  const LEGACY_META = {
    fibra_g: ['Fibra','g'], hierro_mg: ['Hierro','mg'], magnesio_mg: ['Magnesio','mg'],
    potasio_mg: ['Potasio','mg'], calcio_mg: ['Calcio','mg'], zinc_mg: ['Zinc','mg'],
    vit_b6_mg: ['Vit B6','mg'], vit_b12_mcg: ['Vit B12','mcg'], folato_mcg: ['Folato','mcg'],
    vit_c_mg: ['Vit C','mg'], vit_d_mcg: ['Vit D','mcg'], vit_e_mg: ['Vit E','mg'],
    selenio_mcg: ['Selenio','mcg'], yodo_mcg: ['Yodo','mcg'], vit_a_mcg: ['Vit A','mcg'],
    omega3_g: ['Omega-3','g'], omega6_g: ['Omega-6','g'], sodio_mg: ['Sodio','mg'],
    colesterol_mg: ['Colesterol','mg'],
  };

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  }
  function findRef(alimento) {
    if (!alimentosRef.length) return null;
    if (alimento.ref_id) return alimentosRef.find(r => r.id === alimento.ref_id) ?? null;
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

  let legacyTotals = $derived.by(() => {
    if (hasNew || !comidas.length || !alimentosRef.length) return null;
    const totals = {};
    LEGACY_KEYS.forEach(k => totals[k] = 0);
    let matched = 0, total = 0;
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
        for (const k of LEGACY_KEYS) totals[k] += (ref.por_100g[k] ?? 0) * factor;
      }
    }
    if (!matched) return null;
    const rounded = {};
    for (const k of LEGACY_KEYS) rounded[k] = totals[k] < 10 ? +totals[k].toFixed(1) : Math.round(totals[k]);
    return { values: rounded, matched, total };
  });
</script>

{#if hasNew}
  <div class="section">
    <div class="sec-label">Micronutrientes · día vs VDR</div>

    {#each sections as sec}
      <div class="cat">
        <div class="cat-label">{sec.title}</div>
        <div class="cat-rows">
          {#each sec.rows as r}
            <div class="mrow">
              <span class="mlabel">{r.label}</span>
              <span class="mval num" class:isnull={r.val == null}>
                {fmt(r.val)}{#if r.val != null}<span class="munit">{r.unit}</span>{/if}
              </span>
              {#if r.pct != null}
                <div class="bar-track">
                  <div class="bar-fill" style="width:{Math.min(100, r.pct)}%; background:{ST_COLOR[r.st]}"></div>
                </div>
                <span class="mpct num" style="color:{ST_COLOR[r.st]}">{r.pct}%</span>
              {:else if r.val == null}
                <div class="bar-track empty"></div>
                <span class="mpct num isnull">s/d</span>
              {:else}
                <div class="bar-spacer"></div>
                <span class="mpct num isnull">·</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if especiales.length}
      <div class="cat">
        <div class="cat-label">Compuestos especiales</div>
        <div class="esp-row">
          {#each especiales as e}
            <span class="esp-chip">
              <span class="num">{fmt(e.val)}<span class="munit">{e.unit}</span></span>
              <span class="esp-lbl">{e.label}</span>
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if aminos}
      <div class="cat">
        <div class="cat-label">Aminoácidos esenciales · mg</div>
        <div class="aa-grid">
          {#each aminos as a}
            <div class="aa-item">
              <span class="mlabel">{a.label}</span>
              <span class="mval num" class:isnull={a.val == null}>{a.val == null ? 's/d' : fmt(a.val)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="micro-note">
      Micros estimados salvo etiqueta · VDR: DRI hombre 31-50 · s/d = sin dato ·
      sodio: la referencia es techo, no objetivo
    </div>
  </div>
{:else if legacyTotals}
  <div class="section">
    <div class="sec-label">Micronutrientes del día · estimado por referencia</div>
    <div class="micro-grid">
      {#each LEGACY_KEYS.filter(k => legacyTotals.values[k] > 0) as k}
        {@const [label, unit] = LEGACY_META[k]}
        <div class="micro-item">
          <span class="mval num">{fmt(legacyTotals.values[k])}<span class="munit">{unit}</span></span>
          <span class="micro-lbl">{label}</span>
        </div>
      {/each}
    </div>
    {#if legacyTotals.matched < legacyTotals.total}
      <div class="micro-note">Datos de {legacyTotals.matched}/{legacyTotals.total} alimentos con referencia</div>
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
    font-family: var(--font-mono);
  }
  .sec-label::after { content: ''; flex: 1; height: 1px; background: var(--b1); }

  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .cat { margin-bottom: 14px; }
  .cat-label {
    font-family: var(--font-mono);
    font-size: 0.66rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted);
    border-bottom: 1px solid var(--b1);
    padding-bottom: 3px; margin-bottom: 6px;
  }
  .cat-rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    column-gap: 22px; row-gap: 3px;
  }

  .mrow {
    display: grid;
    grid-template-columns: minmax(96px, auto) minmax(72px, auto) 1fr 44px;
    align-items: center; gap: 8px;
    font-size: 0.78rem; padding: 1px 0;
  }
  .mlabel { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mval { text-align: right; color: var(--text, #e6edf3); font-weight: 600; font-size: 0.78rem; white-space: nowrap; }
  .mval.isnull, .mpct.isnull { color: var(--dim); font-weight: 400; }
  .munit { font-size: 0.7em; color: var(--muted); margin-left: 2px; font-weight: 400; }
  .mpct { text-align: right; font-size: 0.72rem; font-weight: 600; }

  .bar-track {
    height: 6px; background: var(--bg, #0d1117);
    border: 1px solid var(--b1); border-radius: 2px;
    overflow: hidden; min-width: 50px;
  }
  .bar-track.empty { opacity: 0.4; }
  .bar-fill { height: 100%; transition: width 0.2s; }
  .bar-spacer { min-width: 50px; }

  .esp-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .esp-chip {
    display: inline-flex; align-items: baseline; gap: 6px;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 4px; padding: 3px 8px;
    font-size: 0.78rem;
  }
  .esp-chip .num { color: var(--accent); font-weight: 700; }
  .esp-lbl { font-size: 0.66rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

  .aa-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 3px 18px;
  }
  .aa-item { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.78rem; }

  .micro-note { margin-top: 8px; font-size: 10px; color: var(--dim); font-family: var(--font-mono); }

  /* legacy */
  .micro-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 6px;
  }
  .micro-item {
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 6px; padding: 7px 9px;
    display: flex; flex-direction: column; gap: 3px;
  }
  .micro-item .mval { text-align: left; font-size: 0.82rem; }
  .micro-lbl { font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
