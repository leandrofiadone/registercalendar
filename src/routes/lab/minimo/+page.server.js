import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function load() {
  const file = join('data', 'perfil.json');
  const perfil = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf-8'))
    : null;
  return { perfil };
}
