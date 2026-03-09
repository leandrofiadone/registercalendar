import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function GET() {
  const file = join('data', 'perfil.json');
  const perfil = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : null;
  return json(perfil);
}
