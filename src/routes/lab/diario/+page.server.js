import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function load() {
  const diarioFile = join('data', 'diario.json');
  const perfilFile = join('data', 'perfil.json');
  const diario = existsSync(diarioFile)
    ? JSON.parse(readFileSync(diarioFile, 'utf-8'))
    : { entradas: [] };
  const perfil = existsSync(perfilFile)
    ? JSON.parse(readFileSync(perfilFile, 'utf-8'))
    : null;
  return { diario, perfil };
}
