import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function GET() {
  const file = join('data', 'log.json');
  const log = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : { sessions: [] };
  const sessions = (log.sessions || []).sort((a, b) => b.date.localeCompare(a.date));
  return json(sessions);
}
