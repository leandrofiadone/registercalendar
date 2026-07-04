// src/lib/tiempo/parse.js
// Parseo de línea libre → entrada de tiempo. Sin API, sin dependencias, instantáneo.
// Formato:  "<codigo> [duracion] <nota>"
//   ej:  "b 3h manejé uber"  ·  "sc 30m gym"  ·  "v leí del proyecto"  ·  "r 1h30 serie"
// La duración es OPCIONAL. Sin duración = entrada de PRESENCIA (minutos: null):
// igual cuenta que tocaste la categoría ese día, solo que no sabemos cuánto.

const DUR_RE = [
  // 1h30 / 2h15  → horas y minutos combinados (probar PRIMERO)
  { re: /\b(\d+)\s*h\s*(\d{1,2})\b/i, fn: (m) => Number(m[1]) * 60 + Number(m[2]) },
  // 3h / 1.5h / 2hs / 1 hr / 3 horas / 1 hora
  { re: /\b(\d+(?:[.,]\d+)?)\s*h(?:s|r|rs|ora|oras)?\b/i, fn: (m) => Math.round(parseFloat(m[1].replace(',', '.')) * 60) },
  // 90m / 45min / 30 minutos
  { re: /\b(\d+)\s*m(?:in|ins|inuto|inutos)?\b/i, fn: (m) => Number(m[1]) },
];

// Extrae la primera duración explícita (requiere unidad h/m). Bare numbers quedan en la nota.
export function extraerDuracion(texto) {
  for (const { re, fn } of DUR_RE) {
    const m = texto.match(re);
    if (m) {
      const resto = (texto.slice(0, m.index) + texto.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
      return { minutos: fn(m), resto };
    }
  }
  return { minutos: null, resto: texto.trim() };
}

export function parseLinea(linea, codigosValidos) {
  const txt = (linea || '').trim();
  if (!txt) return { error: 'vacío' };

  const partes = txt.split(/\s+/);
  const codigo = partes[0].toUpperCase().replace(/[.:,]+$/, '');
  const validos = (codigosValidos || []).map((c) => c.toUpperCase());
  if (!validos.includes(codigo)) {
    return { error: `código desconocido: "${partes[0]}" — válidos: ${validos.join(', ')}` };
  }

  const { minutos, resto } = extraerDuracion(partes.slice(1).join(' '));
  return { categoria: codigo, minutos, nota: resto };
}

// Varias entradas de una: separadas por salto de línea o por " · ".
export function parseTexto(texto, codigosValidos) {
  const lineas = (texto || '').split(/\n|·/).map((l) => l.trim()).filter(Boolean);
  const ok = [];
  const errores = [];
  for (const l of lineas) {
    const r = parseLinea(l, codigosValidos);
    if (r.error) errores.push({ linea: l, error: r.error });
    else ok.push(r);
  }
  return { ok, errores };
}
