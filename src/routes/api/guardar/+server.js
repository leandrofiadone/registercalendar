import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ── Micronutrientes ───────────────────────────────────────────
const MICRO_KEYS = ['fibra_g','sodio_mg','potasio_mg','hierro_mg','calcio_mg','magnesio_mg',
  'zinc_mg','vit_b12_mcg','vit_d_mcg','vit_a_mcg','vit_c_mg','colesterol_mg','omega3_g','omega6_g',
  'vit_b6_mg','folato_mcg','vit_e_mg','selenio_mcg','yodo_mcg'];

function normStr(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findRefMatch(nombre, refAlimentos) {
  const n = normStr(nombre);
  return refAlimentos.find(r =>
    r.nombres?.some(rn => {
      const rn2 = normStr(rn);
      return n === rn2 || n.includes(rn2) || (rn2.length > 4 && rn2.includes(n));
    })
  ) ?? null;
}

function gramosAlimento(a) {
  return a.cantidad_g ?? a.cantidad_g_aprox ?? a.carne_neta_estimada_g
    ?? (a.unidades ? a.unidades * 100 : null)
    ?? (a.cantidad_ml ?? a.cantidad_ml_aprox ?? null);
}

// Enriquecer alimentos: añadir ref_id si matchea, crear entrada nueva si no
function procesarAlimentos(comida, refData) {
  const nuevos = [];
  for (const a of (comida.alimentos || [])) {
    const match = findRefMatch(a.nombre, refData.alimentos);
    if (match) {
      a.ref_id = match.id;
    } else {
      // Crear nueva entrada en ref con macros+micros estimados por IA
      const g = gramosAlimento(a);
      if (g && a.kcal) {
        const factor = 100 / g;
        const por100 = {
          kcal:       Math.round(a.kcal       * factor),
          proteina_g: Math.round(a.proteina_g * factor * 10) / 10,
          grasa_g:    Math.round(a.grasa_g    * factor * 10) / 10,
          carbos_g:   Math.round(a.carbos_g   * factor * 10) / 10,
        };
        for (const k of MICRO_KEYS) {
          if (a[k] != null) por100[k] = Math.round(a[k] * factor * 10) / 10;
        }
        const id = normStr(a.nombre).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const entrada = {
          id,
          nombres: [a.nombre],
          categoria: 'sin_categoria',
          por_100g: por100,
          fuente: 'estimado_ia',
          estimado: true,
        };
        refData.alimentos.push(entrada);
        nuevos.push(a.nombre);
        a.ref_id = id;
      }
    }
  }
  return nuevos;
}

function readJSON(file, fallback) {
  const path = join('data', file);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : fallback;
}

function writeJSON(file, data) {
  writeFileSync(join('data', file), JSON.stringify(data, null, 2), 'utf-8');
}

function calcTotalesVentana(comidas) {
  return comidas.reduce(
    (acc, c) => ({
      kcal:       Math.round((acc.kcal       + (c.totales?.kcal       || 0)) * 10) / 10,
      proteina_g: Math.round((acc.proteina_g + (c.totales?.proteina_g || 0)) * 10) / 10,
      grasa_g:    Math.round((acc.grasa_g    + (c.totales?.grasa_g    || 0)) * 10) / 10,
      carbos_g:   Math.round((acc.carbos_g   + (c.totales?.carbos_g   || 0)) * 10) / 10,
    }),
    { kcal: 0, proteina_g: 0, grasa_g: 0, carbos_g: 0 }
  );
}

export async function POST({ request }) {
  const { tipo, data, sobrescribir = false } = await request.json();

  // ── Nutrición ────────────────────────────────────────────────
  if (tipo === 'nutricion') {
    const nutri = readJSON('nutricion.json', { ventanas: [] });

    if (sobrescribir) {
      const ventana = data;
      const fecha   = ventana.ventana_id;
      if (!fecha) return json({ ok: false, error: 'La ventana no tiene ventana_id' }, { status: 400 });
      const refData = readJSON('alimentos_ref.json', { alimentos: [] });
      const nuevos  = (ventana.comidas || []).flatMap(c => procesarAlimentos(c, refData));
      if (nuevos.length) writeJSON('alimentos_ref.json', refData);
      ventana.totales_ventana = calcTotalesVentana(ventana.comidas || []);
      const idx = nutri.ventanas.findIndex(v => v.ventana_id === fecha);
      if (idx >= 0) nutri.ventanas[idx] = ventana;
      else nutri.ventanas.push(ventana);
      nutri.ventanas.sort((a, b) => b.ventana_id.localeCompare(a.ventana_id));
      writeJSON('nutricion.json', nutri);
      return json({ ok: true, ventana_id: fecha, nuevos_alimentos: nuevos });
    }

    // Agregar comida nueva
    const comida = data;
    const fecha  = comida.fecha;
    if (!fecha) return json({ ok: false, error: 'El objeto comida no tiene fecha' }, { status: 400 });

    // Matchear alimentos contra referencia y agregar nuevos
    const refData  = readJSON('alimentos_ref.json', { alimentos: [] });
    const nuevos   = procesarAlimentos(comida, refData);
    if (nuevos.length) writeJSON('alimentos_ref.json', refData);

    let ventana = nutri.ventanas.find(v => v.ventana_id === fecha);
    if (ventana) {
      ventana.comidas.push(comida);
    } else {
      ventana = { ventana_id: fecha, protocolo: 'ayuno_intermitente', comidas: [comida] };
      nutri.ventanas.push(ventana);
    }
    ventana.totales_ventana = calcTotalesVentana(ventana.comidas);
    nutri.ventanas.sort((a, b) => b.ventana_id.localeCompare(a.ventana_id));
    writeJSON('nutricion.json', nutri);
    return json({ ok: true, ventana_id: fecha, comidas_hoy: ventana.comidas.length, nuevos_alimentos: nuevos });
  }

  // ── Ejercicio ─────────────────────────────────────────────────
  if (tipo === 'ejercicio') {
    const session = data;
    const fecha   = session.date;
    if (!fecha) return json({ ok: false, error: 'La sesión no tiene fecha' }, { status: 400 });

    const log = readJSON('log.json', { sessions: [] });
    const idx = log.sessions.findIndex(s => s.date === fecha);

    if (sobrescribir) {
      if (idx >= 0) log.sessions[idx] = session;
      else log.sessions.push(session);
      log.sessions.sort((a, b) => b.date.localeCompare(a.date));
      writeJSON('log.json', log);
      return json({ ok: true, date: fecha });
    }

    if (idx >= 0) {
      // Mergear con sesión existente
      const existing = log.sessions[idx];

      // Recalcular orden para fuerza y cardio nuevos
      const fuerzaOffset = (existing.fuerza || []).length;
      const cardioOffset = (existing.cardio || []).length;

      const fuerzaNueva = (session.fuerza || []).map((e, i) => ({ ...e, orden: fuerzaOffset + i + 1 }));
      const cardioNuevo = (session.cardio || []).map((c, i) => ({ ...c, orden: cardioOffset + i + 1 }));

      existing.fuerza = [...(existing.fuerza || []), ...fuerzaNueva];
      existing.cardio = [...(existing.cardio || []), ...cardioNuevo];

      // Mergear groups sin duplicados
      const allGroups = [...(existing.groups || []), ...(session.groups || [])];
      existing.groups = [...new Set(allGroups)];

      // Mergear notas
      if (session.notes) existing.notes = [existing.notes, session.notes].filter(Boolean).join(' · ');

      log.sessions[idx] = existing;
      log.sessions.sort((a, b) => b.date.localeCompare(a.date));
      writeJSON('log.json', log);
      return json({ ok: true, date: fecha, merged: true });
    }

    log.sessions.push(session);
    log.sessions.sort((a, b) => b.date.localeCompare(a.date));
    writeJSON('log.json', log);
    return json({ ok: true, date: fecha });
  }

  return json({ ok: false, error: 'tipo inválido' }, { status: 400 });
}
