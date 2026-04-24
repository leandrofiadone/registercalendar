/** Convierte una comida a Date usando fecha + hora */
export function mealToDate(comida) {
  if (!comida?.fecha || !comida?.hora) return null;
  return new Date(`${comida.fecha}T${comida.hora}:00`);
}

/** Todas las comidas de todas las ventanas, ordenadas cronológicamente */
export function getAllMealsSorted(ventanas) {
  const meals = [];
  for (const v of ventanas) {
    for (const c of (v.comidas || [])) {
      const dt = mealToDate(c);
      if (dt) meals.push({ comida: c, dt, ventana_id: v.ventana_id });
    }
  }
  return meals.sort((a, b) => a.dt - b.dt);
}

/** Última comida registrada que ya ocurrió (no comidas futuras) */
export function getLastMeal(ventanas) {
  const now = new Date();
  return getAllMealsSorted(ventanas)
    .filter(m => m.dt <= now)
    .at(-1) ?? null;
}

/** Horas entre dos fechas */
export function gapHours(dt1, dt2) {
  return (dt2.getTime() - dt1.getTime()) / 3_600_000;
}

/** Horas desde una fecha hasta ahora */
export function hoursSince(dt) {
  return (Date.now() - dt.getTime()) / 3_600_000;
}

/**
 * Etapa del ayuno según horas transcurridas.
 * `intensity` (0-1) escala la prominencia visual: más largo = más visible.
 */
export function getFastingStage(hours) {
  if (hours < 4)  return {
    label: 'Digestión activa',
    desc:  'El cuerpo procesa los nutrientes recientes.',
    color: 'var(--muted)',
    glow:  'rgba(112,112,136,.2)',
    icon:  '🍽️',
    milestone: false,
    intensity: 0,
  };
  if (hours < 12) return {
    label: 'Ayuno limpio',
    desc:  'Insulina baja, glucosa estabilizándose.',
    color: 'var(--blue-l)',
    glow:  'rgba(59,130,246,.15)',
    icon:  '💧',
    milestone: false,
    intensity: 0.15,
  };
  if (hours < 16) return {
    label: 'Cetosis iniciando',
    desc:  'El glucógeno hepático casi agotado. El cuerpo empieza a quemar grasa.',
    color: 'var(--green)',
    glow:  'rgba(16,185,129,.25)',
    icon:  '🔥',
    milestone: true,
    intensity: 0.35,
  };
  if (hours < 18) return {
    label: 'Zona IF · 16h',
    desc:  'Quema de grasa activa. Protocolo de ayuno intermitente alcanzado.',
    color: 'var(--accent-l)',
    glow:  'rgba(124,106,245,.3)',
    icon:  '⚡',
    milestone: true,
    intensity: 0.5,
  };
  if (hours < 24) return {
    label: 'Autofagia activa · 18h',
    desc:  'El cuerpo empieza a limpiar células dañadas (autofagia). Pico de hormona de crecimiento.',
    color: '#c084fc',
    glow:  'rgba(192,132,252,.35)',
    icon:  '🔬',
    milestone: true,
    intensity: 0.65,
  };
  if (hours < 36) return {
    label: 'Cetosis profunda · 24h',
    desc:  'Autofagia significativa. Máxima quema de grasa. Claridad mental elevada.',
    color: 'var(--amber)',
    glow:  'rgba(245,158,11,.35)',
    icon:  '🌊',
    milestone: true,
    intensity: 0.8,
  };
  if (hours < 72) return {
    label: 'Ayuno extendido · 36h',
    desc:  'Regeneración del sistema inmune iniciando. Reducción fuerte de inflamación.',
    color: 'var(--red)',
    glow:  'rgba(239,68,68,.4)',
    icon:  '⚠️',
    milestone: true,
    intensity: 0.92,
  };
  return {
    label: 'Regeneración celular · 72h',
    desc:  'Máxima autofagia. Regeneración de células madre. Reseteo inmune profundo.',
    color: '#fbbf24',
    glow:  'rgba(251,191,36,.45)',
    icon:  '✨',
    milestone: true,
    intensity: 1.0,
  };
}

/** Formatea horas como "16h 30m" o "45m" */
export function fmtGap(hours) {
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) { h++; m = 0; }
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
