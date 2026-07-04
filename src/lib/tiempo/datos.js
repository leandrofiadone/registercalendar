// src/lib/tiempo/datos.js
// Carga/guardado del registro de tiempo. SOLO SERVIDOR (usa fs) — nunca importar desde un .svelte.
// Aislado: un único archivo data/tiempo.json, sin tocar log/nutricion/perfil del gym tracker.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const FILE = join('data', 'tiempo.json');

// Categorías semilla (editables por el usuario). Colores = IDENTIDAD de categoría, no juicio.
// Deliberadamente NO se usan los tokens --good/--warn/--bad del gym tracker.
export const DEFAULT = {
  config: {
    ventana_min_dia: 960,                 // 16h de vigilia (editable). Solo es el denominador de "sin registrar".
    ventana_label: '06:00–22:00',
    categorias: [
      { codigo: 'B',  etiqueta: 'Business / B-job', color: '#58a6ff' },
      { codigo: 'V',  etiqueta: 'Visión',           color: '#bc8cff' },
      { codigo: 'R',  etiqueta: 'Recreación',       color: '#3fb950' },
      { codigo: 'S',  etiqueta: 'Servicio',         color: '#f0883e' },
      { codigo: 'SC', etiqueta: 'Self-Care',        color: '#db61a2' },
    ],
  },
  registro: [],
};

export function cargar() {
  if (!existsSync(FILE)) return structuredClone(DEFAULT);
  try {
    const d = JSON.parse(readFileSync(FILE, 'utf-8'));
    if (!d.config) d.config = structuredClone(DEFAULT.config);
    if (!Array.isArray(d.config.categorias)) d.config.categorias = structuredClone(DEFAULT.config.categorias);
    if (!Array.isArray(d.registro)) d.registro = [];
    return d;
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function guardar(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}
