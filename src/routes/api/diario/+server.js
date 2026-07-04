import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const FILE = join('data', 'diario.json');

function read() {
  if (!existsSync(FILE)) return { entradas: [] };
  return JSON.parse(readFileSync(FILE, 'utf-8'));
}

function write(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function GET() {
  return json(read());
}

export async function POST({ request }) {
  const body = await request.json();
  const { fecha, peso_kg, entreno, linea } = body;
  if (!fecha) return json({ ok: false, error: 'fecha requerida' }, { status: 400 });

  const data = read();
  const idx = data.entradas.findIndex(e => e.fecha === fecha);
  const entry = {
    fecha,
    peso_kg: peso_kg ?? null,
    entreno: entreno ?? null,
    linea: linea ?? '',
    ts: new Date().toISOString()
  };
  if (idx >= 0) data.entradas[idx] = { ...data.entradas[idx], ...entry };
  else data.entradas.push(entry);
  data.entradas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  write(data);
  return json({ ok: true, entry });
}

export async function DELETE({ request }) {
  const { fecha } = await request.json();
  const data = read();
  data.entradas = data.entradas.filter(e => e.fecha !== fecha);
  write(data);
  return json({ ok: true });
}
