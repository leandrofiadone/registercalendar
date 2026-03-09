/** Referencia: luna nueva conocida */
const REF_NEW_MOON = new Date('2000-01-06T18:14:00Z');
const SYNODIC = 29.530588853; // días por ciclo lunar

/**
 * Devuelve la fase lunar para una fecha dada.
 * @returns {{ icon: string, name: string, age: number, key: boolean }}
 *   age: días dentro del ciclo actual (0–29.53)
 *   key: true si es una de las 4 fases principales
 */
export function getMoonPhase(date) {
  const daysSince = (date.getTime() - REF_NEW_MOON.getTime()) / 86_400_000;
  const age = ((daysSince % SYNODIC) + SYNODIC) % SYNODIC;

  if (age < 1.5)               return { icon: '🌑', name: 'Luna nueva',        age, key: true  };
  if (age < 6.38)              return { icon: '🌒', name: 'Creciente',          age, key: false };
  if (age < 8.38)              return { icon: '🌓', name: 'Cuarto creciente',   age, key: true  };
  if (age < 13.77)             return { icon: '🌔', name: 'Gibosa creciente',   age, key: false };
  if (age < 16.77)             return { icon: '🌕', name: 'Luna llena',         age, key: true  };
  if (age < 22.15)             return { icon: '🌖', name: 'Gibosa menguante',   age, key: false };
  if (age < 24.15)             return { icon: '🌗', name: 'Cuarto menguante',   age, key: true  };
  if (age < SYNODIC - 0.5)     return { icon: '🌘', name: 'Menguante',          age, key: false };
  return                              { icon: '🌑', name: 'Luna nueva',         age, key: true  };
}
