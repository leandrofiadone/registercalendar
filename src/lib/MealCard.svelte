<script>
  let { comida, ventanaId = '', alimentosRef = [] } = $props();

  // Ordered by priority for display
  const MICRO_ORDER = [
    'fibra_g','hierro_mg','magnesio_mg','potasio_mg','calcio_mg','zinc_mg',
    'vit_b6_mg','vit_b12_mcg','folato_mcg','vit_c_mg','vit_d_mcg','vit_e_mg',
    'selenio_mcg','yodo_mcg','vit_a_mcg','omega3_g','omega6_g','sodio_mg','colesterol_mg'
  ];
  const MICRO_META = {
    fibra_g:      { label: 'Fibra',    unit: 'g',   icon: '🌾', color: '#4ade80' },
    hierro_mg:    { label: 'Hierro',   unit: 'mg',  icon: '🩸', color: '#f87171' },
    magnesio_mg:  { label: 'Mag',      unit: 'mg',  icon: '💜', color: '#c084fc' },
    potasio_mg:   { label: 'Pot',      unit: 'mg',  icon: '⚡', color: '#fbbf24' },
    calcio_mg:    { label: 'Calcio',   unit: 'mg',  icon: '🦴', color: '#e2e8f0' },
    zinc_mg:      { label: 'Zinc',     unit: 'mg',  icon: '🛡️', color: '#60a5fa' },
    vit_b6_mg:    { label: 'B6',       unit: 'mg',  icon: '🔬', color: '#f97316' },
    vit_b12_mcg:  { label: 'B12',      unit: 'mcg', icon: '⚡', color: '#fb923c' },
    folato_mcg:   { label: 'Folato',   unit: 'mcg', icon: '🧬', color: '#a3e635' },
    vit_c_mg:     { label: 'Vit C',    unit: 'mg',  icon: '🍊', color: '#fb923c' },
    vit_d_mcg:    { label: 'Vit D',    unit: 'mcg', icon: '☀️', color: '#facc15' },
    vit_e_mg:     { label: 'Vit E',    unit: 'mg',  icon: '🌿', color: '#4ade80' },
    selenio_mcg:  { label: 'Sel',      unit: 'mcg', icon: '⚙️', color: '#94a3b8' },
    yodo_mcg:     { label: 'Yodo',     unit: 'mcg', icon: '🫧', color: '#67e8f9' },
    vit_a_mcg:    { label: 'Vit A',    unit: 'mcg', icon: '👁️', color: '#f97316' },
    omega3_g:     { label: 'Ω3',       unit: 'g',   icon: '🐟', color: '#38bdf8' },
    omega6_g:     { label: 'Ω6',       unit: 'g',   icon: '🌻', color: '#a78bfa' },
    sodio_mg:     { label: 'Sodio',    unit: 'mg',  icon: '🧂', color: '#94a3b8' },
    colesterol_mg:{ label: 'Col',      unit: 'mg',  icon: '🫀', color: '#64748b' },
  };

  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function findRef(a) {
    if (!alimentosRef.length) return null;
    if (a.ref_id) return alimentosRef.find(r => r.id === a.ref_id) ?? null;
    const n = norm(a.nombre);
    return alimentosRef.find(r => r.nombres?.some(rn => {
      const rn2 = norm(rn);
      return n === rn2 || n.includes(rn2) || (rn2.length > n.length && rn2.includes(n));
    })) ?? null;
  }

  function calcAlimentoMicros(a) {
    const ref = findRef(a);
    if (!ref) return [];
    const grams = a.cantidad_g ?? a.cantidad_g_aprox ?? a.carne_neta_estimada_g
      ?? (a.unidades ? a.unidades * 100 : null)
      ?? a.cantidad_ml ?? a.cantidad_ml_aprox ?? 0;
    if (!grams) return [];
    const factor = grams / 100;
    return MICRO_ORDER
      .map(k => ({ k, v: (ref.por_100g?.[k] ?? 0) * factor }))
      .filter(({ v }) => v > 0)
      .slice(0, 4)
      .map(({ k, v }) => ({
        key: k,
        val: v < 10 ? +v.toFixed(1) : Math.round(v),
        ...MICRO_META[k],
      }));
  }
</script>

<div class="meal-card">
  <div>
    <span class="meal-tipo">{comida.tipo}</span>
    {#if comida.hora}<span class="meal-hora">{comida.hora}</span>{/if}
    {#if comida.fecha && comida.fecha !== ventanaId}
      <span class="meal-fecha-badge">{comida.fecha}</span>
    {/if}
    {#if comida.totales?.estimado}
      <span class="estimado-badge">est.</span>
    {/if}
  </div>
  <div class="meal-desc">{comida.descripcion}</div>

  {#if comida.totales}
    {@const t = comida.totales}
    <div class="macros-grid">
      <div class="mc"><span class="mc-val kcal">{t.kcal}</span><span class="mc-lbl">kcal</span></div>
      <div class="mc"><span class="mc-val prot">{t.proteina_g != null ? t.proteina_g + 'g' : '—'}</span><span class="mc-lbl">proteína</span></div>
      <div class="mc"><span class="mc-val gras">{t.grasa_g    != null ? t.grasa_g    + 'g' : '—'}</span><span class="mc-lbl">grasa</span></div>
      <div class="mc"><span class="mc-val carb">{t.carbos_g   != null ? t.carbos_g   + 'g' : '—'}</span><span class="mc-lbl">carbos</span></div>
    </div>
  {/if}

  {#if comida.alimentos?.length}
    <ul class="alimentos">
      {#each comida.alimentos as a}
        {@const cant = a.unidades != null  ? a.unidades  + 'u'
          : a.cantidad_g  != null ? a.cantidad_g  + 'g'
          : a.cantidad_ml != null ? a.cantidad_ml + 'ml'
          : ''}
        {@const ms = [
          a.kcal       != null ? a.kcal       + ' kcal' : '',
          a.proteina_g != null ? 'P '  + a.proteina_g + 'g' : '',
          a.grasa_g    != null ? 'G '  + a.grasa_g    + 'g' : '',
          a.carbos_g   != null ? 'C '  + a.carbos_g   + 'g' : '',
        ].filter(Boolean).join(' · ')}
        {@const amicros = alimentosRef.length ? calcAlimentoMicros(a) : []}
        <li class="al-row">
          <div class="al-main">
            <span class="al-name">{a.nombre}{#if cant} <span class="al-cant">({cant})</span>{/if}</span>
            <span class="al-macros">{ms}</span>
          </div>
          {#if amicros.length}
            <div class="al-micros">
              {#each amicros as m}
                <span class="am-chip" style="--c:{m.color}">
                  <span class="am-icon">{m.icon}</span>
                  <span class="am-label">{m.label}</span>
                  <span class="am-val">{m.val}{m.unit}</span>
                </span>
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .meal-card {
    background: var(--s1); border: 1px solid var(--b1);
    border-radius: 8px; padding: 13px 15px; margin-bottom: 8px;
  }
  .meal-tipo {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--green);
  }
  .meal-hora { color: var(--dim); font-size: 11px; margin-left: 8px; }
  .meal-fecha-badge {
    display: inline-block; font-size: 9px;
    color: var(--amber); background: rgba(245,158,11,.1);
    border: 1px solid rgba(245,158,11,.2);
    border-radius: 3px; padding: 0 5px; margin-left: 6px;
  }
  .meal-desc { font-size: 13px; color: #bbb; margin: 7px 0 10px; }
  .estimado-badge {
    font-size: 9px; color: var(--amber);
    background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.2);
    border-radius: 3px; padding: 0 5px; margin-left: 6px;
  }
  .macros-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 6px; background: var(--s2);
    border: 1px solid var(--b1); border-radius: 6px;
    padding: 10px; margin-bottom: 10px;
  }
  .mc { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .mc-val { font-size: 17px; font-weight: 700; line-height: 1; }
  .mc-val.kcal { color: var(--amber); }
  .mc-val.prot { color: var(--blue); }
  .mc-val.gras { color: var(--red); }
  .mc-val.carb { color: var(--green); }
  .mc-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); }

  .alimentos { list-style: none; }
  .al-row {
    padding: 7px 0; border-bottom: 1px solid var(--b1);
    display: flex; flex-direction: column; gap: 5px;
  }
  .al-row:last-child { border-bottom: none; }
  .al-main {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 11px;
  }
  .al-name  { color: #bbb; }
  .al-cant  { color: var(--dim); }
  .al-macros { color: var(--dim); font-size: 10px; flex-shrink: 0; margin-left: 8px; }

  .al-micros {
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .am-chip {
    display: inline-flex; align-items: center; gap: 3px;
    background: color-mix(in srgb, var(--c) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 18%, transparent);
    border-radius: 4px; padding: 2px 6px;
  }
  .am-icon  { font-size: 10px; }
  .am-label { font-size: 9px; color: var(--muted); }
  .am-val   { font-size: 10px; font-weight: 700; color: var(--c); font-variant-numeric: tabular-nums; }
</style>
