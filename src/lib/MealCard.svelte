<script>
  let { comida, ventanaId = '' } = $props();
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
        {@const cant = a.unidades != null       ? a.unidades       + 'u'
          : a.cantidad_g       != null ? a.cantidad_g       + 'g'
          : a.cantidad_ml      != null ? a.cantidad_ml      + 'ml'
          : ''}
        {@const ms = [
          a.kcal       != null ? a.kcal       + ' kcal' : '',
          a.proteina_g != null ? 'P '  + a.proteina_g + 'g' : '',
          a.grasa_g    != null ? 'G '  + a.grasa_g    + 'g' : '',
          a.carbos_g   != null ? 'C '  + a.carbos_g   + 'g' : '',
        ].filter(Boolean).join(' · ')}
        <li>
          <span class="al-name">{a.nombre}{#if cant} <span style="color:var(--dim)">({cant})</span>{/if}</span>
          <span class="al-macros">{ms}</span>
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
  .alimentos li {
    display: flex; justify-content: space-between;
    align-items: center; padding: 5px 0;
    border-bottom: 1px solid var(--b1); font-size: 11px;
  }
  .alimentos li:last-child { border-bottom: none; }
  .al-name  { color: #bbb; }
  .al-macros { color: var(--dim); font-size: 10px; }
</style>
