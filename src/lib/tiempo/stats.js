// src/lib/tiempo/stats.js
// Cálculo de patrones. Funciones PURAS sobre el registro.
// Todo es descriptivo: suma, cuenta, compara. Nunca puntúa ni juzga.

export function isoFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hoyISO() {
  return isoFecha(new Date());
}

export function diasEntre(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

// Array de fechas ISO [más viejo … hasta], longitud n.
export function ultimosNDias(n, hasta = hoyISO()) {
  const fin = new Date(hasta + 'T00:00:00');
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(fin);
    d.setDate(fin.getDate() - i);
    dias.push(isoFecha(d));
  }
  return dias;
}

function enRango(registro, dias) {
  const set = new Set(dias);
  return registro.filter((e) => set.has(e.fecha));
}

// Minutos por categoría en el rango. minutos null (presencia) suma 0 pero cuenta como entrada.
export function distribucion(registro, categorias, dias) {
  const reg = enRango(registro, dias);
  const porCat = categorias.map((c) => {
    const items = reg.filter((e) => e.categoria === c.codigo);
    return {
      ...c,
      minutos: items.reduce((s, e) => s + (e.minutos || 0), 0),
      entradas: items.length,
    };
  });
  return { porCat, totalMin: porCat.reduce((s, c) => s + c.minutos, 0) };
}

// Síntoma 1 (Time Indifference): reparto registrado vs sin registrar contra la ventana de vigilia.
// Descriptivo, NO un porcentaje-objetivo. "sin registrar" = no visto, nunca "desperdiciado".
export function sinRegistrar(registro, dias, ventanaMinPorDia) {
  const registrado = enRango(registro, dias).reduce((s, e) => s + (e.minutos || 0), 0);
  const ventana = ventanaMinPorDia * dias.length;
  return { registrado, ventana, sinRegistrar: Math.max(0, ventana - registrado) };
}

// Presencia/huecos: por categoría, qué días del rango hubo registro + hace cuánto fue la última vez.
// Hace visible si V/SC/R están siendo salteadas (Síntoma 5: Exertion/Exhaustion).
export function presencia(registro, categorias, dias) {
  const hoy = dias[dias.length - 1];
  return categorias.map((c) => {
    const fechasCat = new Set(registro.filter((e) => e.categoria === c.codigo).map((e) => e.fecha));
    const puntos = dias.map((d) => fechasCat.has(d));
    const todas = [...fechasCat].sort();
    const ultima = todas.length ? todas[todas.length - 1] : null;
    return {
      ...c,
      puntos,
      diasCon: puntos.filter(Boolean).length,
      total: dias.length,
      ultima,
      gap: ultima ? diasEntre(ultima, hoy) : null,
    };
  });
}

// Lunes (00=lunes) de la semana ISO que contiene la fecha.
export function lunesDe(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoFecha(d);
}

// Semana actual vs anterior, minutos por categoría + delta. Delta es número plano, sin color de valencia.
export function semanaVsSemana(registro, categorias, hasta = hoyISO()) {
  const lunesEsta = lunesDe(hasta);
  const lunesPrev = isoFecha(new Date(new Date(lunesEsta + 'T00:00:00').setDate(new Date(lunesEsta + 'T00:00:00').getDate() - 7)));
  const diasDeSemana = (lunes) => ultimosNDias(7, isoFecha(new Date(new Date(lunes + 'T00:00:00').setDate(new Date(lunes + 'T00:00:00').getDate() + 6))));
  const dEsta = distribucion(registro, categorias, diasDeSemana(lunesEsta)).porCat;
  const dPrev = distribucion(registro, categorias, diasDeSemana(lunesPrev)).porCat;
  return {
    lunesEsta,
    lunesPrev,
    filas: categorias.map((c, i) => ({
      ...c,
      esta: dEsta[i].minutos,
      prev: dPrev[i].minutos,
      delta: dEsta[i].minutos - dPrev[i].minutos,
    })),
  };
}

// "184" → "3h 04m" para mostrar. Minutos crudos para tabular.
export function fmtMin(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ' ' + String(m).padStart(2, '0') + 'm' : ''}` : `${m}m`;
}
