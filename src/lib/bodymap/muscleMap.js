// Taxonomía muscular: nombre en español (datos) → slug del body map → región + color.
// Calcula volumen entrenado por músculo a partir de las sesiones.

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Slug del body map → nombre legible (ES)
export const SLUG_LABEL = {
  chest: 'Pecho',
  obliques: 'Oblicuos',
  abs: 'Abdomen',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  trapezius: 'Trapecio',
  deltoids: 'Hombros',
  'upper-back': 'Espalda',
  'lower-back': 'Lumbares',
  forearm: 'Antebrazo',
  gluteal: 'Glúteos',
  hamstring: 'Isquios',
  quadriceps: 'Cuádriceps',
  adductors: 'Aductores',
  calves: 'Gemelos',
  knees: 'Rodillas',
  tibialis: 'Tibial',
  neck: 'Cuello',
  hands: 'Manos',
  feet: 'Pies',
  ankles: 'Tobillos',
};

// Región → etiqueta + color (los chips y el heatmap usan esto)
export const REGIONS = {
  empuje:   { label: 'Empuje',   color: '#f85149' },
  traccion: { label: 'Tracción', color: '#58a6ff' },
  pierna:   { label: 'Pierna',   color: '#3fb950' },
  core:     { label: 'Core',     color: '#d29922' },
  cardio:   { label: 'Cardio',   color: '#2dd4bf' },
};

// Slug → región
export const SLUG_REGION = {
  chest: 'empuje', deltoids: 'empuje', triceps: 'empuje',
  'upper-back': 'traccion', trapezius: 'traccion', biceps: 'traccion', forearm: 'traccion',
  quadriceps: 'pierna', hamstring: 'pierna', gluteal: 'pierna', adductors: 'pierna', calves: 'pierna', knees: 'pierna', tibialis: 'pierna',
  abs: 'core', obliques: 'core', 'lower-back': 'core',
  // neutral / estructural: neck, head, hair, hands, feet, ankles → sin región
};

// Nombre de músculo en datos (normalizado) → slug. Cubre variantes vistas en log.json.
const MUSCLE_TO_SLUG = {
  // Pecho
  'pecho': 'chest', 'pectoral': 'chest', 'pectoral mayor': 'chest', 'pectoral menor': 'chest',
  // Espalda / dorsales
  'dorsal ancho': 'upper-back', 'dorsales': 'upper-back', 'dorsal': 'upper-back',
  'espalda': 'upper-back', 'redondo mayor': 'upper-back', 'redondo menor': 'upper-back', 'espalda alta': 'upper-back',
  // Trapecio / romboides
  'trapecio': 'trapezius', 'trapecio medio': 'trapezius', 'trapecio inferior': 'trapezius', 'trapecio superior': 'trapezius', 'romboides': 'trapezius',
  'elevador de la escapula': 'trapezius',
  // Brazos
  'biceps': 'biceps', 'triceps': 'triceps',
  'braquial': 'forearm', 'braquiorradial': 'forearm', 'antebrazo': 'forearm',
  // Hombros
  'hombros': 'deltoids', 'hombro': 'deltoids', 'hombro anterior': 'deltoids', 'hombro posterior': 'deltoids',
  'deltoides': 'deltoids', 'deltoides anterior': 'deltoids', 'deltoides posterior': 'deltoids', 'deltoides lateral': 'deltoids',
  // Core
  'recto abdominal': 'abs', 'abdominales': 'abs', 'abdomen': 'abs', 'abs': 'abs', 'core': 'abs',
  'oblicuos': 'obliques', 'oblicuo': 'obliques', 'serrato anterior': 'obliques', 'serrato': 'obliques',
  'lumbar': 'lower-back', 'lumbares': 'lower-back', 'espalda baja': 'lower-back', 'erectores': 'lower-back',
  // Piernas
  'cuadriceps': 'quadriceps', 'cuadricep': 'quadriceps', 'piernas': 'quadriceps', 'pierna': 'quadriceps',
  'isquiotibiales': 'hamstring', 'isquios': 'hamstring', 'femoral': 'hamstring', 'femorales': 'hamstring',
  'gluteos': 'gluteal', 'gluteo': 'gluteal',
  'aductores': 'adductors', 'aductor': 'adductors',
  'pantorrilla': 'calves', 'pantorrillas': 'calves', 'gemelos': 'calves', 'gastrocnemio': 'calves', 'soleo': 'calves',
  'flexores de cadera': 'quadriceps',
  'posterior chain': 'gluteal', 'cadena posterior': 'gluteal',
};

/** Convierte un nombre de músculo (es) en slug del body map, o null si no mapea. */
export function muscleToSlug(name) {
  const n = norm(name);
  if (!n) return null;
  if (MUSCLE_TO_SLUG[n]) return MUSCLE_TO_SLUG[n];
  // match parcial por palabra clave (cubre "Cuádriceps (vasto)", "Bíceps femoral", etc.)
  for (const key in MUSCLE_TO_SLUG) {
    if (n.includes(key)) return MUSCLE_TO_SLUG[key];
  }
  return null;
}

export function regionForSlug(slug) {
  return SLUG_REGION[slug] ?? null;
}

export function colorForSlug(slug) {
  const r = SLUG_REGION[slug];
  return r ? REGIONS[r].color : '#6e7681';
}

// ── Escala de calor por VOLUMEN ──────────────────────────────
// La tonalidad codifica cuánto se trabajó el músculo (no la categoría).
// Poco → tenue/frío · mucho → cálido/brillante. Misma escala para todos.
const HEAT_STOPS = [
  [0.00, [ 88,  92, 120]], // tenue azul-violáceo (apenas trabajado)
  [0.35, [124,  86, 168]], // violeta
  [0.60, [201,  74, 110]], // magenta-rojo
  [0.82, [240, 136,  62]], // naranja (kcal)
  [1.00, [255, 214,  92]], // amarillo cálido (máximo)
];
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

/** Color en la escala de calor para t∈[0,1]. */
export function heatColor(t) {
  const x = Math.max(0, Math.min(1, t || 0));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t0, c0] = HEAT_STOPS[i - 1];
    const [t1, c1] = HEAT_STOPS[i];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0 || 1);
      return `rgb(${lerp(c0[0], c1[0], f)},${lerp(c0[1], c1[1], f)},${lerp(c0[2], c1[2], f)})`;
    }
  }
  const last = HEAT_STOPS[HEAT_STOPS.length - 1][1];
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

/** CSS gradient para la leyenda (mismos stops). */
export const HEAT_GRADIENT =
  'linear-gradient(90deg,' + HEAT_STOPS.map(([, c]) => `rgb(${c[0]},${c[1]},${c[2]})`).join(',') + ')';

/**
 * Volumen entrenado por slug en un conjunto de sesiones.
 * Métrica: "unidades de set" ponderadas — músculo principal ×1.0, secundario ×0.5.
 * (sets son la señal más robusta; muchos registros no tienen peso/reps).
 * Retorna { bySlug: {slug: n}, max, regionTotals: {region: n}, cardioMin }.
 */
export function volumeBySlug(sessions) {
  const bySlug = {};
  const regionTotals = { empuje: 0, traccion: 0, pierna: 0, core: 0, cardio: 0 };
  let cardioMin = 0;

  const add = (slug, n) => {
    if (!slug || !n) return;
    bySlug[slug] = (bySlug[slug] ?? 0) + n;
    const r = SLUG_REGION[slug];
    if (r) regionTotals[r] += n;
  };

  for (const s of sessions) {
    for (const ej of s.fuerza ?? []) {
      const units = Math.max((ej.sets ?? []).length, 1); // el ejercicio ocurrió → mínimo 1
      add(muscleToSlug(ej.musculo_principal), units);
      for (const sec of ej.musculos_secundarios ?? []) {
        add(muscleToSlug(sec), units * 0.5);
      }
    }
    for (const c of s.cardio ?? []) {
      const min = c.duracion_min ?? 0;
      cardioMin += min;
      regionTotals.cardio += min;
    }
  }

  const max = Math.max(0, ...Object.values(bySlug));
  return { bySlug, max, regionTotals, cardioMin };
}

/** Normaliza bySlug a intensidad 0..1 (para opacidad del heatmap). */
export function intensityFromVolume(bySlug, max) {
  const out = {};
  if (!max) return out;
  for (const slug in bySlug) out[slug] = bySlug[slug] / max;
  return out;
}
