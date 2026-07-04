import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';
import { cargar, guardar } from '$lib/tiempo/datos.js';
import { parseTexto } from '$lib/tiempo/parse.js';
import { hoyISO } from '$lib/tiempo/stats.js';
import { SISTEMA_TIEMPO } from '$lib/tiempo/prompt.js';

export function GET() {
  return json(cargar());
}

// Extrae el primer objeto JSON balanceado de un texto (ignora markdown/texto extra).
function extractJSON(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      if (--depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function guardarEntradas(data, entradas, fechaDefault, codigos) {
  const valido = new Set(codigos.map((c) => c.toUpperCase()));
  const ts = new Date().toISOString();
  let n = 0;
  for (const e of entradas) {
    if (!e || !e.categoria) continue;
    const cat = String(e.categoria).toUpperCase();
    if (!valido.has(cat)) continue;
    data.registro.push({
      fecha: e.fecha || fechaDefault,
      categoria: cat,
      minutos: Number.isFinite(e.minutos) ? e.minutos : null,
      nota: e.nota || '',
      ts,
    });
    n++;
  }
  guardar(data);
  return n;
}

// Lenguaje natural → entradas, vía Claude. Devuelve { entradas } o { pregunta }.
async function parseNL(texto, config, fechaLocal, horaLocal) {
  const cats = config.categorias.map((c) => `${c.codigo} = ${c.etiqueta}`).join('\n');
  // System estable = prompt + categorías → cacheable. La fecha/hora (volátil) va en el
  // mensaje de usuario, NO acá: un timestamp dentro del prefijo cacheado lo invalidaría
  // en cada request. (El cache recién engancha si el system supera ~2048 tokens en Sonnet 4.6.)
  const sistema = SISTEMA_TIEMPO.replace('{CATEGORIAS}', cats);
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    thinking: { type: 'disabled' },     // parsing puro: sin razonamiento extendido
    output_config: { effort: 'low' },   // bajo esfuerzo → menos tokens de salida
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Fecha y hora actual: ${fechaLocal} ${horaLocal}.\n\n${texto}` }],
  });
  const raw = resp.content?.[0]?.text || '';
  const parsed = extractJSON(raw);
  if (parsed?.entradas?.length) return { entradas: parsed.entradas };
  return { pregunta: raw.trim() || 'No entendí, ¿podés reformularlo?' };
}

export async function POST({ request }) {
  const body = await request.json();
  const data = cargar();

  // Acción: borrar las entradas de ejemplo sembradas.
  if (body.accion === 'limpiarEjemplos') {
    data.registro = data.registro.filter((e) => !e.ejemplo);
    guardar(data);
    return json({ ok: true, restantes: data.registro.length });
  }

  const texto = (body.texto || '').trim();
  if (!texto) return json({ ok: false, error: 'vacío' }, { status: 400 });

  const codigos = data.config.categorias.map((c) => c.codigo);
  const fechaDefault = body.fechaLocal || hoyISO();

  // 1) Camino terse: instantáneo, sin API. Solo si la primera palabra es un código válido.
  const terse = parseTexto(texto, codigos);
  if (terse.ok.length) {
    const n = guardarEntradas(data, terse.ok, fechaDefault, codigos);
    return json({ ok: true, agregadas: n, via: 'terse', errores: terse.errores });
  }

  // 2) Camino lenguaje natural: Claude interpreta la frase.
  try {
    const r = await parseNL(texto, data.config, fechaDefault, body.horaLocal || '');
    if (r.pregunta) return json({ ok: false, pregunta: r.pregunta });
    const n = guardarEntradas(data, r.entradas, fechaDefault, codigos);
    return json({ ok: true, agregadas: n, via: 'nl' });
  } catch (e) {
    return json({ ok: false, error: `No se pudo interpretar (${e.message})`, errores: terse.errores }, { status: 502 });
  }
}
