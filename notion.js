import { Client } from '@notionhq/client';

export class NotionSync {
  constructor(config) {
    if (!config.notion_api_key || !config.notion_diary_db_id) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.client = new Client({ auth: config.notion_api_key });
    this.dbId = config.notion_diary_db_id;
  }

  _formatFuerza(fuerza = []) {
    return fuerza.map(e => {
      const setsStr = e.sets.map(s => {
        if (s.tipo === 'dropset') {
          return `DS: ${s.drops.map(d => `${d.reps}x${d.peso_kg}kg`).join(' → ')}`;
        }
        return `${s.reps}x${s.peso_kg}kg`;
      }).join(' | ');
      return `${e.ejercicio}: ${setsStr}`;
    }).join('\n');
  }

  _formatCardio(cardio = []) {
    return cardio.map(c => {
      const parts = [`${c.ejercicio}`, `${c.duracion_min}min`];
      if (c.distancia_m) parts.push(`${c.distancia_m}m`);
      if (c.distancia_km) parts.push(`${c.distancia_km}km`);
      if (c.largos) parts.push(`${c.largos} largos`);
      if (c.kcal) parts.push(`${c.kcal}kcal`);
      if (c.intensidad) parts.push(`[${c.intensidad}]`);
      return parts.join(' · ');
    }).join('\n');
  }

  _formatNutricion(nutricion) {
    if (!nutricion?.comidas?.length) return '';
    const lines = [];
    if (nutricion.protocolo) lines.push(`Protocolo: ${nutricion.protocolo} (${nutricion.ayuno_horas}h)`);
    for (const comida of nutricion.comidas) {
      const hora = comida.hora ? ` [${comida.hora}]` : '';
      lines.push(`${comida.tipo}${hora}: ${comida.descripcion}`);
      if (comida.totales) {
        const t = comida.totales;
        lines.push(`  → ${t.kcal}kcal | P: ${t.proteina_g}g | G: ${t.grasa_g}g | C: ${t.carbos_g}g`);
      }
    }
    return lines.join('\n');
  }

  async syncSession(session) {
    if (!this.enabled) return;
    try {
      const existing = await this.client.databases.query({
        database_id: this.dbId,
        filter: { property: 'Fecha', date: { equals: session.date } }
      });

      const fuerzaText = this._formatFuerza(session.fuerza);
      const cardioText = this._formatCardio(session.cardio);
      const nutricionText = this._formatNutricion(session.nutricion);

      const properties = {
        'Dia': { title: [{ text: { content: session.date } }] },
        'Fecha': { date: { start: session.date } },
        'Grupo': { multi_select: (session.groups || []).map(g => ({ name: g })) },
        'Ejercicios': { rich_text: [{ text: { content: fuerzaText.slice(0, 2000) } }] },
        'Cardio': { rich_text: [{ text: { content: cardioText.slice(0, 2000) } }] },
        'Comida': { rich_text: [{ text: { content: nutricionText.slice(0, 2000) } }] },
        'Notas': { rich_text: [{ text: { content: (session.notes || '').slice(0, 2000) } }] }
      };

      if (session.weight_kg) properties['Peso kg'] = { number: session.weight_kg };
      if (session.energy) properties['Energia'] = { select: { name: session.energy } };
      if (session.gimnasio) properties['Gimnasio'] = { rich_text: [{ text: { content: session.gimnasio } }] };

      // Totales de nutrición del día
      const totalKcal = session.nutricion?.comidas?.reduce((acc, c) => acc + (c.totales?.kcal || 0), 0);
      const totalProteina = session.nutricion?.comidas?.reduce((acc, c) => acc + (c.totales?.proteina_g || 0), 0);
      if (totalKcal) properties['Kcal Total'] = { number: totalKcal };
      if (totalProteina) properties['Proteina g'] = { number: totalProteina };

      if (existing.results.length > 0) {
        await this.client.pages.update({ page_id: existing.results[0].id, properties });
      } else {
        await this.client.pages.create({ parent: { database_id: this.dbId }, properties });
      }
    } catch (err) {
      console.error('[Notion sync error]', err.message);
    }
  }
}
