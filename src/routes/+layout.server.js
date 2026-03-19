import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data';

function safeLoadJSON(filename, fallback) {
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] ${filename} — JSON inválido: ${err.message}`);
    return fallback;
  }
}

function validateSession(s) {
  return s && typeof s.date === 'string' && Array.isArray(s.fuerza) && Array.isArray(s.cardio);
}

function validateVentana(v) {
  return v && typeof v.ventana_id === 'string' && Array.isArray(v.comidas);
}

export function load() {
  const log    = safeLoadJSON('log.json',           { sessions: [] });
  const nutri  = safeLoadJSON('nutricion.json',     { ventanas: [] });
  const perfil = safeLoadJSON('perfil.json',        null);
  const alRef  = safeLoadJSON('alimentos_ref.json', { alimentos: [] });
  const gymRef = safeLoadJSON('gimnasios_ref.json', []);

  const sessions = (log.sessions || []).filter(validateSession);
  const ventanas = (nutri.ventanas || []).filter(validateVentana);

  if (sessions.length !== (log.sessions || []).length) {
    console.warn(`[WARN] log.json: ${(log.sessions || []).length - sessions.length} sesiones con estructura inválida descartadas`);
  }
  if (ventanas.length !== (nutri.ventanas || []).length) {
    console.warn(`[WARN] nutricion.json: ${(nutri.ventanas || []).length - ventanas.length} ventanas con estructura inválida descartadas`);
  }

  // Validar horas en comidas
  for (const v of ventanas) {
    for (const c of v.comidas) {
      if (!c.hora) {
        console.warn(`[WARN] nutricion.json: ventana ${v.ventana_id} comida "${c.descripcion?.substring(0, 40)}" sin hora`);
      }
    }
  }

  return {
    sessions: sessions.sort((a, b) => b.date.localeCompare(a.date)),
    ventanas: ventanas.sort((a, b) => b.ventana_id.localeCompare(a.ventana_id)),
    perfil,
    alimentosRef: alRef.alimentos || [],
    gimnasiosRef: Array.isArray(gymRef) ? gymRef : []
  };
}
