import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function safeLoadJSON(filename, fallback) {
  const path = join('data', filename);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] ${filename} — JSON inválido: ${err.message}`);
    return fallback;
  }
}

export function load() {
  const alRef = safeLoadJSON('alimentos_ref.json', { alimentos: [] });
  return {
    alimentosRef: alRef.alimentos || []
  };
}
