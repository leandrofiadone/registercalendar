import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Read-only: lee las sesiones existentes para el experimento del mapa muscular.
export function load() {
  const logFile = join('data', 'log.json');
  const log = existsSync(logFile)
    ? JSON.parse(readFileSync(logFile, 'utf-8'))
    : { sessions: [] };
  const sessions = (log.sessions ?? []).filter((s) => !s.sin_registro);
  return { sessions };
}
