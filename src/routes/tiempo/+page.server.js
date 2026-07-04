import { cargar } from '$lib/tiempo/datos.js';
import { distribucion, sinRegistrar, presencia, semanaVsSemana, ultimosNDias, hoyISO } from '$lib/tiempo/stats.js';

export function load() {
  const data = cargar();
  const cats = data.config.categorias;
  const registro = data.registro || [];
  const dias7 = ultimosNDias(7);

  return {
    config: data.config,
    hoy: hoyISO(),
    dias7,
    totalEntradas: registro.length,
    hayEjemplos: registro.some((e) => e.ejemplo),
    dist7: distribucion(registro, cats, dias7),
    sin7: sinRegistrar(registro, dias7, data.config.ventana_min_dia),
    presencia7: presencia(registro, cats, dias7),
    semanas: semanaVsSemana(registro, cats),
  };
}
