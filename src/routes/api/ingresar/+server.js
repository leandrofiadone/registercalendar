import { ANTHROPIC_API_KEY } from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';
import { SISTEMA_NUTRICION, SISTEMA_EJERCICIO, SISTEMA_EDITAR_NUTRICION, SISTEMA_EDITAR_EJERCICIO } from '$lib/prompts.js';
import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function appendTokenLog(entry) {
  const path = join('data', 'tokens_log.json');
  const log = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : { requests: [] };
  log.requests.push(entry);
  writeFileSync(path, JSON.stringify(log, null, 2), 'utf-8');
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Aprende gramos_por_unidad de los alimentos del JSON recibido y los guarda en alimentos_ref
function aprenderUnidades(parsed) {
  if (!parsed?.alimentos?.length) return;
  const refPath = join('data', 'alimentos_ref.json');
  try {
    const ref = JSON.parse(readFileSync(refPath, 'utf-8'));
    let modificado = false;
    for (const al of parsed.alimentos) {
      if (!al.gramos_por_unidad || !al.ref_id) continue;
      const entrada = ref.alimentos?.find(a => a.id === al.ref_id);
      if (!entrada) continue;
      if (entrada.por_unidad?.gramos === al.gramos_por_unidad) continue;
      entrada.por_unidad = { gramos: al.gramos_por_unidad };
      modificado = true;
    }
    if (modificado) writeFileSync(refPath, JSON.stringify(ref, null, 2), 'utf-8');
  } catch (_) { /* no interrumpir */ }
}

// Extrae el primer objeto JSON válido de un texto (ignora texto antes/después)
function extractJSON(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  // Buscar el cierre correcto contando llaves
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

export async function POST({ request }) {
  const body = await request.json();
  const { tipo, historial, imagenes = [], modo = 'nuevo', registroExistente = null, fechaLocal, horaLocal } = body;

  // Usar fecha/hora del cliente para respetar el timezone local
  const fecha = fechaLocal || new Date().toISOString().split('T')[0];
  const hora  = horaLocal  || new Date().toTimeString().slice(0, 5);

  let sistema;
  if (modo === 'editar') {
    sistema = tipo === 'nutricion' ? SISTEMA_EDITAR_NUTRICION : SISTEMA_EDITAR_EJERCICIO;
    if (registroExistente) {
      sistema += `\n\nRegistro actual:\n${JSON.stringify(registroExistente, null, 2)}`;
    }
  } else {
    sistema = (tipo === 'nutricion' ? SISTEMA_NUTRICION : SISTEMA_EJERCICIO)
      + `\n\nFecha y hora actual: ${fecha} ${hora}.`;

    // Inyectar referencia de alimentos conocidos (modo nutricion nuevo)
    if (tipo === 'nutricion') {
      try {
        const ref = JSON.parse(readFileSync(join('data', 'alimentos_ref.json'), 'utf-8'));
        if (ref.alimentos?.length) {
          const lineas = ref.alimentos.map(a => {
            const p = a.por_100g;
            const macros = `${p.kcal}kcal P${p.proteina_g}g G${p.grasa_g}g C${p.carbos_g}g`;
            const nombres = a.nombres.join(' / ');
            const unidad = a.por_unidad?.gramos ? ` (1u=${a.por_unidad.gramos}g)` : '';
            return `${nombres}: ${macros} /100g${unidad}`;
          });
          sistema += `\n\nALIMENTOS CONOCIDOS (reutilizá estos macros exactos si el usuario menciona el mismo alimento, ajustando solo la cantidad):\n${lineas.join('\n')}`;
        }
      } catch (_) { /* no interrumpir si falla */ }
    }
  }

  // Limitar historial a los últimos 6 mensajes para reducir tokens
  const historialReciente = historial.slice(-6);

  // Convertir historial al formato de Anthropic
  // Las imágenes van al último mensaje de usuario (el que acaba de enviar)
  const lastUserIdx = historialReciente.reduce((acc, msg, i) => msg.role === 'user' ? i : acc, -1);
  const messages = historialReciente.map((msg, i) => {
    if (msg.role === 'user' && i === lastUserIdx && imagenes.length > 0) {
      const content = [];
      for (const img of imagenes) {
        content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
      }
      if (msg.content?.trim()) content.push({ type: 'text', text: msg.content });
      return { role: 'user', content };
    }
    const content = msg.content?.trim() || '...';
    return { role: msg.role, content };
  });

  const model = imagenes.length > 0 ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

  let raw, usage;
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: sistema,
      messages,
    });
    raw   = response.content[0].text;
    usage = response.usage; // { input_tokens, output_tokens }
  } catch (e) {
    return json({ ok: false, error: `Error API: ${e.message}` }, { status: 502 });
  }

  // Extraer bloque JSON del texto (puede venir con markdown o texto extra)
  const parsed = extractJSON(raw);
  const respTipo = parsed ? 'json' : 'texto';

  // Log de tokens
  try {
    appendTokenLog({
      ts:            new Date().toISOString(),
      tipo,
      modo,
      modelo:        model,
      imagenes:      imagenes.length,
      msgs_hist:     historialReciente.length,
      sistema_chars: sistema.length,
      tok_in:        usage?.input_tokens  ?? null,
      tok_out:       usage?.output_tokens ?? null,
      respuesta:     respTipo,
    });
  } catch (_) { /* log failure doesn't break the request */ }

  if (parsed) {
    if (tipo === 'nutricion' && modo === 'nuevo') aprenderUnidades(parsed);
    return json({ ok: true, tipo: 'json', parsed });
  }
  return json({ ok: true, tipo: 'texto', texto: raw });
}
