/**
 * MET por tipo de cardio según intensidad.
 * Fuente: Compendium of Physical Activities (Ainsworth et al.)
 */
const MET_CARDIO = {
  natacion:     { baja: 4.5, moderada: 6.0, alta: 8.0 },
  cinta:        { baja: 3.5, moderada: 5.5, alta: 8.5 },
  trote:        { baja: 6.0, moderada: 8.0, alta: 10.0 },
  correr:       { baja: 8.0, moderada: 10.0, alta: 12.0 },
  bicicleta:    { baja: 4.0, moderada: 6.0, alta: 8.0 },
  spinning:     { baja: 5.0, moderada: 7.5, alta: 10.0 },
  eliptico:     { baja: 4.0, moderada: 5.5, alta: 7.0 },
  remo:         { baja: 4.5, moderada: 6.0, alta: 8.5 },
  hiit:         { baja: 6.0, moderada: 8.0, alta: 10.0 },
  funcional:    { baja: 4.0, moderada: 5.5, alta: 7.0 },
  yoga:         { baja: 2.5, moderada: 3.0, alta: 3.5 },
  pilates:      { baja: 3.0, moderada: 3.5, alta: 4.0 },
  caminata:     { baja: 2.5, moderada: 3.5, alta: 4.5 },
  estiramiento: { baja: 2.0, moderada: 2.0, alta: 2.5 },
  // Sauna: hipertermia pasiva — Compendium of Physical Activities 1.0-1.2
  sauna:        { baja: 1.0, moderada: 1.1, alta: 1.2 },
  // Ducha fría: vasoconstricción, gasto mínimo
  ducha_fria:   { baja: 1.2, moderada: 1.2, alta: 1.2 },
  // Sexo: MET según esfuerzo (Compendium 18210-18220)
  sexo:         { baja: 1.3, moderada: 1.8, alta: 2.8 },
};

/**
 * Normaliza el string del ejercicio a una key del MET_CARDIO.
 * Maneja acentos y variantes en español.
 */
function normalizarTipo(ejercicio) {
  const e = ejercicio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (e.includes('natac') || e.includes('pileta') || e.includes('swim'))      return 'natacion';
  if (e.includes('cinta') || e.includes('treadmill') || e.includes('caminador')) return 'cinta';
  if (e.includes('trote') || e.includes('jogging'))                             return 'trote';
  if (e.includes('corr')  || e.includes('running'))                             return 'correr';
  if (e.includes('spinning'))                                                    return 'spinning';
  if (e.includes('bici')  || e.includes('cicl'))                                return 'bicicleta';
  if (e.includes('eliptic'))                                                     return 'eliptico';
  if (e.includes('remo')  || e.includes('rowing'))                               return 'remo';
  if (e.includes('hiit')  || e.includes('interval'))                             return 'hiit';
  if (e.includes('soga')  || e.includes('jump rope') || e.includes('saltar'))   return 'hiit';
  if (e.includes('funcional') || e.includes('crossfit'))                         return 'funcional';
  if (e.includes('yoga'))                                                         return 'yoga';
  if (e.includes('pilates'))                                                      return 'pilates';
  if (e.includes('caminat') || e.includes('walk'))                               return 'caminata';
  if (e.includes('estira') || e.includes('stretch'))                             return 'estiramiento';
  if (e.includes('sauna') || e.includes('vapor') || e.includes('bano turco'))   return 'sauna';
  if (e.includes('ducha'))                                                        return 'ducha_fria';
  if (e.includes('sex'))                                                          return 'sexo';
  return null;
}

/**
 * Calcula kcal de un item de cardio usando MET real + duración + intensidad.
 * Si el item ya tiene kcal explícito, lo usa directo.
 * Retorna objeto con kcal, met usado y tipo normalizado.
 */
export function cardioItemKcal(item, pesoKg) {
  if (item.kcal != null) {
    return { kcal: item.kcal, met: null, tipo: normalizarTipo(item.ejercicio ?? ''), fuente: 'explicito' };
  }
  const tipo      = normalizarTipo(item.ejercicio ?? '');
  const intensidad = item.intensidad ?? 'moderada';
  const metMap    = MET_CARDIO[tipo];
  const met       = metMap
    ? (metMap[intensidad] ?? metMap.moderada)
    : 4.0; // fallback genérico si no se reconoce el ejercicio
  const kcal = Math.round(met * pesoKg * ((item.duracion_min ?? 0) / 60));
  return { kcal, met, tipo, fuente: 'estimado' };
}

/**
 * Estima kcal de la parte de fuerza de una sesión.
 *
 * Modelo híbrido MET × intensidad × volumen:
 *   Base: compound vs aislación (MET + min/set)
 *     Compound (sentadilla, press, remo, etc.): MET 5.0, ~4.5 min/set
 *     Aislación (curl, extensión, etc.):        MET 3.5, ~2.5 min/set
 *
 *   Intensidad: multiplicador por ratio peso_carga / bodyweight
 *     ≥40% BW → ×1.6 (muy pesado)
 *     ≥25% BW → ×1.35 (pesado)
 *     ≥15% BW → ×1.15 (moderado)
 *     <15% BW → ×1.0 (liviano)
 *
 *   Volumen: multiplicador por reps del set
 *     ≥15 reps → ×1.10
 *     ≥10 reps → ×1.05
 *
 *   Auto-detección compound: si peso del set ≥50% BW se considera compound
 *   aunque el regex no matchee (cubre "Ejercicio no especificado" a 100 kg).
 *
 * Sin monitor cardíaco el error real sigue siendo ±25-30%.
 */
const COMPOUND_RE = /sentadilla|squat|peso muerto|deadlift|press\b|bench|militar|remo\b|row|dominad|pull.?up|hip thrust|clean|snatch|fondos|dips?\b|farmer/i;

function intensityMultiplier(ratio) {
  if (ratio >= 0.40) return 1.60;
  if (ratio >= 0.25) return 1.35;
  if (ratio >= 0.15) return 1.15;
  return 1.00;
}

function volumeMultiplier(reps) {
  if (reps >= 15) return 1.10;
  if (reps >= 10) return 1.05;
  return 1.00;
}

export function fuerzaKcal(session, pesoKg) {
  const ejercicios = session.fuerza ?? [];
  if (!ejercicios.length) return 0;
  let totalKcal = 0;

  for (const ej of ejercicios) {
    const sets          = ej.sets ?? [];
    if (!sets.length) continue;

    const nameCompound  = COMPOUND_RE.test(ej.ejercicio ?? '');
    // Auto-detect compound si algún set tiene peso ≥50% del bodyweight
    const maxWeight     = sets.reduce((m, s) => Math.max(m, s.peso_kg ?? 0), 0);
    const weightCompound = maxWeight >= pesoKg * 0.5;
    const isCompound    = nameCompound || weightCompound;

    const baseMet       = isCompound ? 5.0 : 3.5;
    const minPerSet     = isCompound ? 4.5 : 2.5;

    for (const set of sets) {
      const reps   = set.reps ?? 0;
      const weight = set.peso_kg ?? 0;

      let met = baseMet;
      if (weight > 0 && pesoKg > 0) {
        met *= intensityMultiplier(weight / pesoKg);
      }
      if (reps > 0) {
        met *= volumeMultiplier(reps);
      }

      totalKcal += met * pesoKg * (minPerSet / 60);
    }
  }

  return Math.round(totalKcal);
}

/**
 * Calcula el gasto total de una sesión con desglose completo.
 *
 * Retorna:
 * {
 *   total       — kcal totales
 *   fuerza      — kcal de ejercicios de fuerza
 *   cardioTotal — kcal suma de todos los items cardio
 *   cardio      — array con detalle por item: { ejercicio, tipo, duracion_min, intensidad, met, kcal, fuente }
 *   fuente      — 'explicito' si viene de session.kcal_quemadas, 'estimado' si se calculó
 * }
 */
export function gymKcalDetallado(session, pesoKg) {
  if (session.kcal_quemadas != null) {
    return {
      total: session.kcal_quemadas,
      fuerza: null,
      cardioTotal: null,
      cardio: [],
      fuente: 'explicito',
    };
  }

  const fuerza = fuerzaKcal(session, pesoKg);

  const cardio = (session.cardio ?? []).map(item => {
    const { kcal, met, tipo, fuente } = cardioItemKcal(item, pesoKg);
    return {
      ejercicio:    item.ejercicio,
      tipo,
      duracion_min: item.duracion_min ?? null,
      intensidad:   item.intensidad ?? null,
      met,
      kcal,
      fuente,
    };
  });

  const cardioTotal = cardio.reduce((acc, c) => acc + c.kcal, 0);
  const total       = fuerza + cardioTotal;

  return { total, fuerza, cardioTotal, cardio, fuente: 'estimado' };
}

/**
 * Versión simplificada — retorna solo el total (backward compat).
 */
export function gymKcal(session, pesoKg) {
  return gymKcalDetallado(session, pesoKg).total;
}

/**
 * Estima kcal de una actividad libre (no gym).
 * Si tiene kcal_extra explícito, lo usa directo.
 */
export function actividadKcal(act, pesoKg) {
  if (act.kcal_extra != null) return act.kcal_extra;
  const tipo      = normalizarTipo(act.tipo ?? '');
  const intensidad = act.intensidad ?? 'moderada';
  const metMap    = MET_CARDIO[tipo];
  const met       = metMap ? (metMap[intensidad] ?? metMap.moderada) : 4.0;
  return Math.round(met * pesoKg * ((act.duracion_min ?? 0) / 60));
}

/** Label legible para tipo de actividad */
export function actividadLabel(tipo) {
  const labels = {
    natacion:     'Natación',
    cinta:        'Cinta',
    trote:        'Trote',
    correr:       'Correr',
    bicicleta:    'Bicicleta',
    spinning:     'Spinning',
    eliptico:     'Elíptico',
    remo:         'Remo',
    hiit:         'HIIT',
    funcional:    'Funcional',
    yoga:         'Yoga',
    pilates:      'Pilates',
    caminata:     'Caminata',
    estiramiento: 'Estiramiento',
    sauna:        'Sauna',
    ducha_fria:   'Ducha fría',
    sexo:         'Sexo',
  };
  return labels[tipo] ?? tipo;
}
