import Anthropic from '@anthropic-ai/sdk';
import { Storage } from './storage.js';
import { NotionSync } from './notion.js';

const storage = new Storage();

const TOOLS = [
  {
    name: 'log_exercise',
    description: 'Registra un ejercicio de fuerza con sus series. Soporta series regulares y dropsets.',
    input_schema: {
      type: 'object',
      properties: {
        ejercicio: { type: 'string', description: 'Nombre del ejercicio' },
        muscle_group: {
          type: 'string',
          enum: ['Pecho-Tricep', 'Espalda-Bicep', 'Piernas', 'Hombros', 'Full Body', 'Cardio'],
          description: 'Grupo muscular principal'
        },
        musculo_principal: { type: 'string', description: 'Músculo principal trabajado' },
        musculos_secundarios: {
          type: 'array',
          items: { type: 'string' },
          description: 'Músculos secundarios'
        },
        equipo: { type: 'string', description: 'Equipo utilizado (mancuerna, barra, máquina, cable, etc.)' },
        tipo: { type: 'string', description: 'Tipo de ejercicio (maquina_cable, mancuerna_libre, dropset_barra_recta, etc.)' },
        sets: {
          type: 'array',
          description: 'Lista de series. Cada serie puede ser regular o dropset.',
          items: {
            type: 'object',
            properties: {
              set: { type: 'number' },
              reps: { type: 'number', description: 'Para series regulares' },
              peso_kg: { type: 'number', description: 'Para series regulares' },
              tipo: { type: 'string', description: '"dropset" si es dropset' },
              drops: {
                type: 'array',
                description: 'Para dropsets: lista de drops con reps y peso',
                items: {
                  type: 'object',
                  properties: {
                    drop: { type: 'number' },
                    reps: { type: 'number' },
                    peso_kg: { type: 'number' }
                  }
                }
              }
            },
            required: ['set']
          }
        },
        notas: { type: 'string', description: 'Observaciones del ejercicio' }
      },
      required: ['ejercicio', 'muscle_group', 'sets']
    }
  },
  {
    name: 'log_cardio',
    description: 'Registra una actividad de cardio (natación, cinta, bici, remo, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        ejercicio: { type: 'string', description: 'Tipo de cardio (Natación, Cinta, Bici, Remo, etc.)' },
        equipo: { type: 'string', description: 'Equipo o instalación utilizada' },
        duracion_min: { type: 'number', description: 'Duración en minutos' },
        distancia_km: { type: 'number', description: 'Distancia en kilómetros (si aplica)' },
        distancia_m: { type: 'number', description: 'Distancia en metros (para natación)' },
        largos: { type: 'number', description: 'Cantidad de largos (para natación)' },
        pasos: { type: 'number', description: 'Pasos (para cinta)' },
        kcal: { type: 'number', description: 'Calorías quemadas' },
        velocidad_kmh: { type: 'number', description: 'Velocidad en km/h' },
        inclinacion: { type: 'number', description: 'Inclinación (para cinta)' },
        intensidad: {
          type: 'string',
          enum: ['baja', 'moderada', 'alta', 'maxima'],
          description: 'Intensidad percibida'
        },
        hora_inicio: { type: 'string', description: 'Hora de inicio (HH:MM)' },
        hora_fin: { type: 'string', description: 'Hora de fin (HH:MM)' },
        notas: { type: 'string', description: 'Observaciones' }
      },
      required: ['ejercicio', 'duracion_min']
    }
  },
  {
    name: 'log_nutrition',
    description: 'Registra una comida con detalle de alimentos y macros. También permite actualizar protocolo de alimentación.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['rompe_ayuno', 'desayuno', 'almuerzo', 'merienda', 'cena', 'post-entreno', 'snack'],
          description: 'Tipo de comida'
        },
        hora: { type: 'string', description: 'Hora de la comida (HH:MM)' },
        descripcion: { type: 'string', description: 'Descripción libre de la comida' },
        alimentos: {
          type: 'array',
          description: 'Lista de alimentos con sus macros',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              cantidad_g: { type: 'number' },
              unidades: { type: 'number', description: 'Cantidad de unidades (opcional)' },
              kcal: { type: 'number' },
              proteina_g: { type: 'number' },
              grasa_g: { type: 'number' },
              carbos_g: { type: 'number' }
            },
            required: ['nombre']
          }
        },
        totales: {
          type: 'object',
          description: 'Totales de la comida (se calculan si no se proveen)',
          properties: {
            kcal: { type: 'number' },
            proteina_g: { type: 'number' },
            grasa_g: { type: 'number' },
            carbos_g: { type: 'number' }
          }
        },
        protocolo: { type: 'string', description: 'Protocolo de alimentación (ej: "Ayuno intermitente")' },
        ayuno_horas: { type: 'number', description: 'Horas de ayuno si aplica' }
      },
      required: ['tipo', 'descripcion']
    }
  },
  {
    name: 'update_session_meta',
    description: 'Actualiza metadatos de la sesión: peso corporal, energía, gimnasio, ciudad, notas generales',
    input_schema: {
      type: 'object',
      properties: {
        weight_kg: { type: 'number', description: 'Peso corporal en kg' },
        energy: {
          type: 'string',
          enum: ['Alta', 'Normal', 'Baja'],
          description: 'Nivel de energía'
        },
        gimnasio: { type: 'string', description: 'Nombre del gimnasio' },
        ciudad: { type: 'string', description: 'Ciudad' },
        notes: { type: 'string', description: 'Notas generales de la sesión' }
      }
    }
  },
  {
    name: 'get_today',
    description: 'Muestra el resumen de todo lo registrado hoy',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_history',
    description: 'Muestra historial de días recientes',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Cantidad de días hacia atrás (default 7)' }
      }
    }
  }
];

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  return `Sos un asistente personal de gym y salud. Registras entrenamientos, comida y estado físico.

Perfil: 1.91m, ~125kg, objetivo bajar grasa manteniendo músculo, 4+ días de pesas/semana, ayuno 16:8, 2400-2600 kcal/día.

Notación de series regulares:
- "3x80" = 3 reps con 80kg (una serie)
- "3x80, 3x80, 3x80" = 3 series iguales
- "3x80, 4x85, 2x90" = series distintas

Notación de dropsets:
- "dropset 25kg x10 → 20kg x10" = un dropset con 2 drops

Hoy es: ${today}

Cuando el usuario registra algo, usa la herramienta correspondiente y confirma brevemente.
Si el usuario pide un resumen, usa get_today o get_history.
Sé conciso en las respuestas.`;
}

export class Agent {
  constructor(config) {
    this.client = new Anthropic({ apiKey: config.anthropic_api_key });
    this.notion = new NotionSync(config);
    this.history = [];
  }

  async chat(userMessage) {
    this.history.push({ role: 'user', content: userMessage });

    let response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages: this.history
    });

    while (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUses) {
        const result = await this._executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      this.history.push({ role: 'assistant', content: response.content });
      this.history.push({ role: 'user', content: toolResults });

      response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        tools: TOOLS,
        messages: this.history
      });
    }

    const textBlock = response.content.find(b => b.type === 'text');
    const assistantMessage = textBlock?.text || '';
    this.history.push({ role: 'assistant', content: response.content });

    return assistantMessage;
  }

  async _executeTool(name, input) {
    switch (name) {
      case 'log_exercise': {
        const session = storage.getTodaySession();
        const orden = session.fuerza.length + 1;

        const ejercicio = {
          orden,
          ejercicio: input.ejercicio,
          equipo: input.equipo || null,
          musculo_principal: input.musculo_principal || null,
          musculos_secundarios: input.musculos_secundarios || [],
          tipo: input.tipo || null,
          sets: input.sets,
          notas: input.notas || null
        };

        session.fuerza.push(ejercicio);

        if (input.muscle_group && !session.groups.includes(input.muscle_group)) {
          session.groups.push(input.muscle_group);
        }

        storage.saveTodaySession(session);
        await this.notion.syncSession(session);

        // Calcular volumen total (ignorando drops de dropsets por ahora, suma todos los pesos)
        let totalReps = 0, totalVol = 0;
        for (const s of input.sets) {
          if (s.drops) {
            for (const d of s.drops) {
              totalReps += d.reps;
              totalVol += d.reps * d.peso_kg;
            }
          } else {
            totalReps += s.reps || 0;
            totalVol += (s.reps || 0) * (s.peso_kg || 0);
          }
        }

        return { ok: true, ejercicio: input.ejercicio, sets: input.sets.length, total_reps: totalReps, volumen_kg: totalVol };
      }

      case 'log_cardio': {
        const session = storage.getTodaySession();
        const orden = session.cardio.length + 1;

        session.cardio.push({
          orden,
          ejercicio: input.ejercicio,
          equipo: input.equipo || null,
          hora_inicio: input.hora_inicio || null,
          hora_fin: input.hora_fin || null,
          duracion_min: input.duracion_min,
          distancia_km: input.distancia_km || null,
          distancia_m: input.distancia_m || null,
          largos: input.largos || null,
          pasos: input.pasos || null,
          kcal: input.kcal || null,
          velocidad_kmh: input.velocidad_kmh || null,
          inclinacion: input.inclinacion ?? null,
          intensidad: input.intensidad || null,
          notas: input.notas || null
        });

        storage.saveTodaySession(session);
        return { ok: true, ejercicio: input.ejercicio, duracion_min: input.duracion_min };
      }

      case 'log_nutrition': {
        const session = storage.getTodaySession();

        if (input.protocolo) session.nutricion.protocolo = input.protocolo;
        if (input.ayuno_horas) session.nutricion.ayuno_horas = input.ayuno_horas;

        // Calcular totales si no vienen provistos
        let totales = input.totales || null;
        if (!totales && input.alimentos?.length) {
          totales = input.alimentos.reduce((acc, a) => ({
            kcal: acc.kcal + (a.kcal || 0),
            proteina_g: acc.proteina_g + (a.proteina_g || 0),
            grasa_g: acc.grasa_g + (a.grasa_g || 0),
            carbos_g: acc.carbos_g + (a.carbos_g || 0)
          }), { kcal: 0, proteina_g: 0, grasa_g: 0, carbos_g: 0 });
        }

        session.nutricion.comidas.push({
          tipo: input.tipo,
          hora: input.hora || null,
          descripcion: input.descripcion,
          alimentos: input.alimentos || [],
          totales: totales || null
        });

        storage.saveTodaySession(session);
        return { ok: true, tipo: input.tipo, totales };
      }

      case 'update_session_meta': {
        const session = storage.getTodaySession();
        if (input.weight_kg !== undefined) session.weight_kg = input.weight_kg;
        if (input.energy) session.energy = input.energy;
        if (input.gimnasio) session.gimnasio = input.gimnasio;
        if (input.ciudad) session.ciudad = input.ciudad;
        if (input.notes) session.notes = session.notes ? `${session.notes} | ${input.notes}` : input.notes;
        storage.saveTodaySession(session);
        await this.notion.syncSession(session);
        return { ok: true };
      }

      case 'get_today':
        return storage.getTodaySession();

      case 'get_history':
        return storage.getHistory(input.days || 7);

      default:
        return { error: 'Tool desconocida' };
    }
  }
}
