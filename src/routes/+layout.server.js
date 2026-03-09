import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data';

export function load() {
  const log    = existsSync(join(DATA_DIR, 'log.json'))        ? JSON.parse(readFileSync(join(DATA_DIR, 'log.json'),        'utf-8')) : { sessions: [] };
  const nutri  = existsSync(join(DATA_DIR, 'nutricion.json'))  ? JSON.parse(readFileSync(join(DATA_DIR, 'nutricion.json'),  'utf-8')) : { ventanas: [] };
  const perfil = existsSync(join(DATA_DIR, 'perfil.json'))     ? JSON.parse(readFileSync(join(DATA_DIR, 'perfil.json'),     'utf-8')) : null;

  return {
    sessions: (log.sessions || []).sort((a, b) => b.date.localeCompare(a.date)),
    ventanas: (nutri.ventanas || []).sort((a, b) => b.ventana_id.localeCompare(a.ventana_id)),
    perfil
  };
}
