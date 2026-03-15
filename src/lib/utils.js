// Retorna YYYY-MM-DD en hora local (evita el offset UTC que desplaza el día)
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function fmtDate(d) {
  const [y, m, day] = d.split('-');
  const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${day} ${M[+m-1]} ${y}`;
}

export function fmtDateLong(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

export function sessionType(s) {
  const f = s.fuerza?.length > 0;
  const c = s.cardio?.length > 0;
  if (f && c) return 'mixed';
  if (f) return 'fuerza';
  if (c) return 'cardio';
  return 'other';
}

export function sessionColor(s) {
  return { fuerza: '#7c6af5', cardio: '#3b82f6', mixed: '#10b981', other: '#555' }[sessionType(s)];
}
