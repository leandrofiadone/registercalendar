import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const LOG_FILE = join(DATA_DIR, 'log.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadLog() {
  ensureDataDir();
  if (!existsSync(LOG_FILE)) return { sessions: [] };
  return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
}

function saveLog(data) {
  ensureDataDir();
  writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function emptySession(date) {
  return {
    date,
    gimnasio: null,
    ciudad: null,
    groups: [],
    // Fuerza: ejercicios con sets regulares o dropsets
    fuerza: [],
    // Cardio: actividades cardiovasculares con métricas específicas
    cardio: [],
    // Nutrición estructurada con macros por comida
    nutricion: {
      protocolo: null,
      ayuno_horas: null,
      comidas: []
    },
    weight_kg: null,
    energy: null,
    notes: ''
  };
}

export class Storage {
  getSession(date) {
    const log = loadLog();
    let session = log.sessions.find(s => s.date === date);
    if (!session) {
      session = emptySession(date);
      log.sessions.push(session);
      saveLog(log);
    }
    // Migrar sesiones viejas que no tienen los campos nuevos
    if (!session.fuerza) session.fuerza = [];
    if (!session.cardio) session.cardio = [];
    if (!session.nutricion) session.nutricion = { protocolo: null, ayuno_horas: null, comidas: [] };
    return session;
  }

  getTodaySession() {
    return this.getSession(todayKey());
  }

  saveSession(session) {
    const log = loadLog();
    const idx = log.sessions.findIndex(s => s.date === session.date);
    if (idx >= 0) log.sessions[idx] = session;
    else log.sessions.push(session);
    saveLog(log);
  }

  saveTodaySession(session) {
    this.saveSession(session);
  }

  getHistory(days = 7) {
    const log = loadLog();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return log.sessions
      .filter(s => new Date(s.date) >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  getAllSessions() {
    return loadLog().sessions.sort((a, b) => b.date.localeCompare(a.date));
  }
}
