import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function GET() {
  const file = join('data', 'nutricion.json');
  const nutri = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : { ventanas: [] };
  const ventanas = (nutri.ventanas || []).sort((a, b) => b.ventana_id.localeCompare(a.ventana_id));
  return json(ventanas);
}
