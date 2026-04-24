<script>
  import { tick, onMount } from 'svelte';

  let { onClose } = $props();

  let tipo     = $state('nutricion');
  let modo     = $state('nuevo');
  let input    = $state('');
  let imagenes = $state([]);
  let enviando = $state(false);
  let mensajes = $state([]);

  const SESSION_KEY = '_ingresar_state';

  onMount(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.mensajes?.length) mensajes = s.mensajes;
        if (s.input) input = s.input;
        if (s.tipo) tipo = s.tipo;
        if (s.modo) modo = s.modo;
      }
    } catch (_) {}

    try {
      const savedImgs = sessionStorage.getItem('_imgs_pending');
      if (savedImgs) {
        const arr = JSON.parse(savedImgs);
        imagenes = arr.map(i => ({ ...i, preview: `data:${i.media_type};base64,${i.data}` }));
        sessionStorage.removeItem('_imgs_pending');
      }
    } catch (_) {}
  });

  $effect(() => {
    try {
      const mensajesSlim = mensajes.map(m => m.imgs ? { ...m, imgs: [] } : m);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mensajes: mensajesSlim, input, tipo, modo }));
    } catch (_) {}
  });

  $effect(() => {
    try {
      if (imagenes.length > 0) {
        const toStore = imagenes.map(({ media_type, data, name }) => ({ media_type, data, name }));
        sessionStorage.setItem('_imgs_pending', JSON.stringify(toStore));
      } else {
        sessionStorage.removeItem('_imgs_pending');
      }
    } catch (_) {}
  });

  let ultimoJson = $derived(
    [...mensajes].reverse().find(m => m.isJson)?.parsed ?? null
  );

  let fechaEditar  = $state(new Date().toISOString().split('T')[0]);
  let cargando     = $state(false);
  let registroBase = $state(null);
  let cargadoError = $state('');

  async function cargarRegistro() {
    cargando = true;
    cargadoError = '';
    registroBase = null;
    mensajes = [];
    try {
      const res  = await fetch(`/api/registro?tipo=${tipo}&fecha=${fechaEditar}`);
      const body = await res.json();
      if (!body.ok) {
        cargadoError = `No hay registro de ${tipo === 'nutricion' ? 'nutrición' : 'entrenamiento'} para ${fechaEditar}`;
      } else {
        registroBase = body.data;
      }
    } catch (e) {
      cargadoError = e.message;
    }
    cargando = false;
  }

  let chatEl;

  async function scrollAbajo() {
    await tick();
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  }

  const MAX_DIM = 1600;
  const MAX_B64 = 3_900_000;

  function processFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w >= h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
          else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        let q = 0.88, result = c.toDataURL('image/jpeg', q);
        while (result.length > MAX_B64 && q > 0.35) { q -= 0.08; result = c.toDataURL('image/jpeg', q); }
        resolve(result);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen')); };
      img.src = url;
    });
  }

  async function onFileChange(e) {
    const files = [...e.target.files];
    e.target.value = '';
    for (const file of files) {
      try {
        const dataUrl = await processFile(file);
        imagenes = [...imagenes, {
          media_type: 'image/jpeg',
          data:    dataUrl.split(',')[1],
          preview: dataUrl,
          name:    file.name,
        }];
      } catch (err) {
        mensajes = [...mensajes, { role: 'assistant', content: `⚠ ${err.message}`, isError: true }];
      }
    }
  }

  function removeImg(i) {
    imagenes = imagenes.filter((_, idx) => idx !== i);
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto && imagenes.length === 0) return;
    if (enviando) return;

    const userMsg = { role: 'user', content: texto, imgs: imagenes.map(i => i.preview) };
    mensajes = [...mensajes, userMsg];
    const imgsCopy = [...imagenes];
    input = '';
    imagenes = [];
    enviando = true;
    await scrollAbajo();

    const historialApi = mensajes.map(m => {
      if (m.isJson) {
        const p = m.parsed;
        const resumen = tipo === 'nutricion'
          ? `[JSON registrado: ${p.descripcion} · ${p.totales?.kcal}kcal · ${p.totales?.proteina_g}g P]`
          : `[JSON registrado: sesión ${p.groups?.join('+')} · ${p.date}]`;
        return { role: 'assistant', content: resumen };
      }
      return { role: m.role, content: m.content || '' };
    });

    try {
      const res = await fetch('/api/ingresar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, modo,
          historial: historialApi,
          imagenes: imgsCopy.map(({ media_type, data }) => ({ media_type, data })),
          registroExistente: modo === 'editar' ? registroBase : null,
          fechaLocal: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
          horaLocal:  (() => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })(),
        }),
      });

      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'Error desconocido');

      if (body.tipo === 'json') {
        const hoy = new Date().toLocaleDateString('en-CA');
        const p = body.parsed;
        if (tipo === 'nutricion' && p.fecha > hoy) p.fecha = hoy;
        if (tipo === 'ejercicio' && p.date  > hoy) p.date  = hoy;
        mensajes = [...mensajes, { role: 'assistant', content: '', isJson: true, parsed: p }];
      } else {
        mensajes = [...mensajes, { role: 'assistant', content: body.texto, isJson: false }];
      }
    } catch (e) {
      mensajes = [...mensajes, { role: 'assistant', content: `⚠ ${e.message}`, isJson: false, isError: true }];
    }

    enviando = false;
    await scrollAbajo();
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
  }

  function autoResize(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  let guardando    = $state(false);
  let guardadoOk   = $state(false);
  let guardadoMsg  = $state('Guardado correctamente');
  let guardadoError = $state('');

  async function guardar() {
    if (!ultimoJson || guardando) return;
    guardando = true;
    guardadoError = '';
    try {
      const res = await fetch('/api/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, data: ultimoJson, sobrescribir: modo === 'editar' }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error);
      guardadoOk = true;
      if (body.merged) guardadoMsg = 'Agregado a la sesión del día';
      setTimeout(() => { reiniciar(); onClose?.(); }, 1800);
    } catch (e) {
      guardadoError = e.message;
    }
    guardando = false;
  }

  function reiniciar() {
    mensajes = [];
    input = '';
    imagenes = [];
    guardadoOk = false;
    guardadoMsg = 'Guardado correctamente';
    guardadoError = '';
    registroBase = null;
    cargadoError = '';
    try {
      sessionStorage.removeItem('_imgs_pending');
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function labelTipo(t) {
    return { rompe_ayuno:'Rompe ayuno', comida:'Comida', snack:'Snack',
             cena:'Cena', pre_entreno:'Pre-entreno', post_entreno:'Post-entreno',
             suplemento:'Suplemento' }[t] || t;
  }
</script>

<div class="drawer-inner">

  <!-- Header del drawer -->
  <div class="drawer-header">
    <div class="toggle-row">
      <button class="toggle-btn" class:active={tipo==='nutricion'}
        onclick={() => { tipo='nutricion'; reiniciar(); }}>🥗 Nutrición</button>
      <button class="toggle-btn" class:active={tipo==='ejercicio'}
        onclick={() => { tipo='ejercicio'; reiniciar(); }}>💪 Entrenamiento</button>
    </div>
    <button class="close-btn" onclick={onClose} aria-label="Cerrar">✕</button>
  </div>

  <!-- Modo -->
  <div class="modo-row">
    <button class="modo-btn" class:active={modo==='nuevo'}
      onclick={() => { modo='nuevo'; reiniciar(); }}>+ Nuevo</button>
    <button class="modo-btn" class:active={modo==='editar'}
      onclick={() => { modo='editar'; reiniciar(); }}>✏ Editar existente</button>
  </div>

  <!-- Panel editar -->
  {#if modo === 'editar' && !registroBase}
    <div class="editar-panel">
      <div class="editar-row">
        <input class="fecha-input" type="date" bind:value={fechaEditar} />
        <button class="cargar-btn" onclick={cargarRegistro} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Cargar'}
        </button>
      </div>
      {#if cargadoError}<div class="error-msg">{cargadoError}</div>{/if}
    </div>
  {/if}

  {#if modo === 'editar' && registroBase}
    <div class="registro-cargado">
      <span>
        {tipo === 'nutricion'
          ? `📋 Ventana ${registroBase.ventana_id} · ${registroBase.comidas?.length} comidas`
          : `📋 Sesión ${registroBase.date} · ${registroBase.groups?.join(', ')}`}
      </span>
      <button class="cambiar-btn" onclick={reiniciar}>cambiar</button>
    </div>
  {/if}

  <!-- Chat -->
  <div class="chat" bind:this={chatEl}>
    {#if mensajes.length === 0}
      <div class="empty-hint">
        {tipo === 'nutricion'
          ? 'Describí lo que comiste, o adjuntá una foto.'
          : 'Describí tu entrenamiento, o adjuntá una captura de la app.'}
      </div>
    {/if}

    {#each mensajes as msg}
      {#if msg.role === 'user'}
        <div class="bubble user">
          {#if msg.imgs?.length}
            <div class="bubble-imgs">
              {#each msg.imgs as src}<img class="bubble-img" {src} alt="" />{/each}
            </div>
          {/if}
          {#if msg.content}<span>{msg.content}</span>{/if}
        </div>

      {:else if msg.isJson}
        {#if tipo === 'nutricion'}
          <div class="result-card">
            <div class="result-header">
              <span class="result-badge">{labelTipo(msg.parsed.tipo)}</span>
              <span class="result-meta">{msg.parsed.hora} · {msg.parsed.fecha}</span>
            </div>
            <div class="result-desc">{msg.parsed.descripcion}</div>
            <div class="macros-row">
              <div class="macro"><span class="mv">{msg.parsed.totales?.kcal}</span><span class="ml">kcal</span></div>
              <div class="macro"><span class="mv">{msg.parsed.totales?.proteina_g}g</span><span class="ml">prot</span></div>
              <div class="macro"><span class="mv">{msg.parsed.totales?.grasa_g}g</span><span class="ml">grasa</span></div>
              <div class="macro"><span class="mv">{msg.parsed.totales?.carbos_g}g</span><span class="ml">carbos</span></div>
            </div>
            {#if msg.parsed.alimentos?.length}
              <div class="al-list">
                {#each msg.parsed.alimentos as al}
                  <div class="al-row">
                    <span class="al-n">{al.nombre}{al.marca ? ` · ${al.marca}` : ''}</span>
                    <span class="al-k">{al.kcal} kcal</span>
                  </div>
                {/each}
              </div>
            {/if}
            {#if msg.parsed.totales?.estimado}<div class="estimado">* valores estimados</div>{/if}
          </div>

        {:else}
          <div class="result-card">
            <div class="result-header">
              <span class="result-badge">{msg.parsed.groups?.join(' + ')}</span>
              <span class="result-meta">{msg.parsed.date}</span>
            </div>
            {#if msg.parsed.gimnasio}<div class="result-desc">🏛 {msg.parsed.gimnasio}</div>{/if}
            {#if msg.parsed.fuerza?.length}
              <div class="sec-lbl">💪 Fuerza</div>
              {#each msg.parsed.fuerza as e}
                <div class="al-row">
                  <span class="al-n">{e.ejercicio}</span>
                  <span class="al-k">{e.sets?.length} series</span>
                </div>
              {/each}
            {/if}
            {#if msg.parsed.cardio?.length}
              <div class="sec-lbl" style="margin-top:10px">🏃 Cardio</div>
              {#each msg.parsed.cardio as c}
                <div class="al-row">
                  <span class="al-n">{c.ejercicio}</span>
                  <span class="al-k">{c.duracion_min ? `${c.duracion_min}min` : ''}{c.distancia_km ? ` ${c.distancia_km}km` : ''}</span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

      {:else}
        <div class="bubble assistant" class:error={msg.isError}>{msg.content}</div>
      {/if}
    {/each}

    {#if enviando}
      <div class="bubble assistant typing">
        <span></span><span></span><span></span>
      </div>
    {/if}
  </div>

  <!-- Guardar -->
  {#if ultimoJson && !guardadoOk}
    <div class="guardar-row">
      {#if guardadoError}<div class="error-msg">⚠ {guardadoError}</div>{/if}
      <div class="guardar-btns">
        <button class="cancelar-btn" onclick={reiniciar} disabled={guardando}>✕ Cancelar</button>
        <button class="guardar-btn" onclick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : '✓ Guardar'}
        </button>
      </div>
    </div>
  {/if}

  {#if guardadoOk}
    <div class="ok-row">✓ {guardadoMsg}</div>
  {/if}

  <!-- Input -->
  {#if !guardadoOk && (modo === 'nuevo' || registroBase)}
    <div class="input-area">
      {#if imagenes.length > 0}
        <div class="img-row">
          {#each imagenes as img, i}
            <div class="img-thumb">
              <img src={img.preview} alt="" />
              <button onclick={() => removeImg(i)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}
      <div class="input-row">
        <label class="attach" title="Adjuntar imagen">
          📎
          <input type="file" accept="image/*" multiple onchange={onFileChange} style="display:none" />
        </label>
        <label class="attach" title="Tomar foto">
          📷
          <input type="file" accept="image/*" capture="environment" onchange={onFileChange} style="display:none" />
        </label>
        <textarea
          class="txt"
          placeholder="Escribí aquí…"
          bind:value={input}
          onkeydown={onKeydown}
          oninput={autoResize}
          rows="1"
        ></textarea>
        <button class="send" onclick={enviar} disabled={enviando || (!input.trim() && imagenes.length===0)}>↑</button>
      </div>
    </div>
  {/if}

</div>

<style>
  .drawer-inner {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 16px 16px 20px;
    overflow: hidden;
  }

  /* Header */
  .drawer-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .toggle-row {
    flex: 1;
    display: flex;
    background: var(--s2);
    border: 1px solid var(--b1);
    border-radius: 10px;
    overflow: hidden;
  }
  .toggle-btn {
    flex: 1; padding: 10px;
    background: none; border: none;
    color: var(--muted); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: background .15s, color .15s;
  }
  .toggle-btn.active { background: var(--accent); color: #fff; }

  .close-btn {
    width: 36px; height: 36px; flex-shrink: 0;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 8px; color: var(--muted);
    font-size: 14px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: color .15s, border-color .15s;
  }
  .close-btn:hover { color: var(--text); border-color: var(--b2); }

  /* Modo */
  .modo-row { display: flex; gap: 6px; flex-shrink: 0; }
  .modo-btn {
    flex: 1; padding: 8px;
    background: var(--s2); border: 1px solid var(--b1);
    border-radius: 8px; color: var(--muted);
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all .15s;
  }
  .modo-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(124,106,245,.08); }

  /* Editar */
  .editar-panel { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
  .editar-row { display: flex; gap: 8px; }
  .fecha-input {
    flex: 1; background: var(--s2); border: 1px solid var(--b1);
    border-radius: 8px; padding: 10px 12px; color: var(--text); font-size: 14px;
  }
  .fecha-input:focus { outline: none; border-color: var(--accent); }
  .cargar-btn {
    padding: 10px 18px; background: var(--accent);
    border: none; border-radius: 8px; color: #fff;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .cargar-btn:disabled { opacity: .4; cursor: default; }

  .registro-cargado {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(124,106,245,.08); border: 1px solid rgba(124,106,245,.25);
    border-radius: 8px; padding: 10px 14px;
    font-size: 12px; color: var(--muted); flex-shrink: 0;
  }
  .cambiar-btn { background: none; border: none; color: var(--accent); font-size: 11px; cursor: pointer; }

  /* Chat */
  .chat {
    flex: 1; overflow-y: auto;
    display: flex; flex-direction: column; gap: 10px;
    padding: 4px 2px;
    scrollbar-width: thin; scrollbar-color: var(--b2) transparent;
    min-height: 0;
  }
  .empty-hint { color: var(--dim); font-size: 13px; text-align: center; padding: 40px 0; }

  .bubble {
    max-width: 85%; padding: 10px 14px; border-radius: 14px;
    font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  }
  .bubble.user {
    align-self: flex-end;
    background: var(--accent); color: #fff;
    border-bottom-right-radius: 4px;
  }
  .bubble.assistant {
    align-self: flex-start;
    background: var(--s2); border: 1px solid var(--b1); color: var(--text);
    border-bottom-left-radius: 4px;
  }
  .bubble.error { border-color: rgba(239,68,68,.3); color: #f87171; background: rgba(239,68,68,.08); }

  .bubble-imgs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
  .bubble-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; }

  .typing { display: flex; align-items: center; gap: 4px; padding: 12px 16px; }
  .typing span {
    width: 6px; height: 6px; border-radius: 50%; background: var(--dim);
    animation: bounce .9s infinite;
  }
  .typing span:nth-child(2) { animation-delay: .15s; }
  .typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }

  /* Result card */
  .result-card {
    align-self: flex-start; width: 90%;
    background: var(--s2); border: 1px solid var(--b1);
    border-left: 3px solid var(--accent);
    border-radius: 10px; padding: 14px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .result-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .result-badge { background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
  .result-meta { font-size: 11px; color: var(--dim); }
  .result-desc { font-size: 14px; font-weight: 600; color: var(--text); }

  .macros-row { display: flex; border: 1px solid var(--b1); border-radius: 8px; overflow: hidden; }
  .macro { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 8px 0; border-right: 1px solid var(--b1); }
  .macro:last-child { border-right: none; }
  .mv { font-size: 17px; font-weight: 800; color: var(--accent-l); }
  .ml { font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: var(--dim); margin-top: 1px; }

  .al-list { display: flex; flex-direction: column; }
  .al-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--b1); }
  .al-row:last-child { border-bottom: none; }
  .al-n { color: var(--muted); flex: 1; }
  .al-k { color: var(--dim); font-variant-numeric: tabular-nums; }
  .estimado { font-size: 10px; color: var(--dim); font-style: italic; }
  .sec-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--dim); }

  /* Guardar */
  .guardar-row { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
  .guardar-btns { display: flex; gap: 8px; }
  .guardar-btn {
    flex: 1; padding: 14px; background: #22c55e;
    border: none; border-radius: 8px; color: #fff;
    font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity .15s;
  }
  .guardar-btn:disabled { opacity: .4; cursor: default; }
  .cancelar-btn {
    padding: 14px 18px; background: var(--s2); border: 1px solid var(--b2);
    border-radius: 8px; color: var(--muted); font-size: 14px;
    cursor: pointer; transition: opacity .15s; white-space: nowrap;
  }
  .cancelar-btn:disabled { opacity: .4; cursor: default; }
  .error-msg { font-size: 12px; color: #f87171; text-align: center; }
  .ok-row { text-align: center; font-size: 16px; font-weight: 700; color: #4ade80; padding: 12px; }

  /* Input */
  .input-area {
    flex-shrink: 0; background: var(--s2); border: 1px solid var(--b1);
    border-radius: 12px; padding: 8px 10px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .img-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .img-thumb { position: relative; width: 56px; height: 56px; border-radius: 6px; overflow: hidden; border: 1px solid var(--b2); }
  .img-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .img-thumb button { position: absolute; top: 1px; right: 1px; background: rgba(0,0,0,.75); border: none; border-radius: 50%; color: #fff; font-size: 9px; width: 16px; height: 16px; cursor: pointer; }

  .input-row { display: flex; align-items: flex-end; gap: 8px; }
  .attach { padding: 8px; color: var(--dim); font-size: 16px; cursor: pointer; flex-shrink: 0; }
  .txt {
    flex: 1; background: none; border: none; color: var(--text);
    font-size: 15px; line-height: 1.4; resize: none; max-height: 120px;
    font-family: inherit; padding: 4px 0;
  }
  .txt:focus { outline: none; }
  .txt::placeholder { color: var(--dim); }
  .send {
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--accent); border: none; color: #fff;
    font-size: 16px; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: opacity .15s;
  }
  .send:disabled { opacity: .35; cursor: default; }
</style>
