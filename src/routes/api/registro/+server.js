import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function readJSON(file, fallback) {
  const path = join('data', file);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : fallback;
}

export function GET({ url }) {
  const tipo  = url.searchParams.get('tipo');
  const fecha = url.searchParams.get('fecha');

  if (!tipo || !fecha) return json({ error: 'faltan parámetros' }, { status: 400 });

  if (tipo === 'nutricion') {
    const nutri   = readJSON('nutricion.json', { ventanas: [] });
    const ventana = nutri.ventanas.find(v => v.ventana_id === fecha);
    return ventana
      ? json({ ok: true, data: ventana })
      : json({ ok: false, vacio: true });
  }

  if (tipo === 'ejercicio') {
    const log     = readJSON('log.json', { sessions: [] });
    const session = log.sessions.find(s => s.date === fecha);
    return session
      ? json({ ok: true, data: session })
      : json({ ok: false, vacio: true });
  }

  return json({ error: 'tipo inválido' }, { status: 400 });
}
