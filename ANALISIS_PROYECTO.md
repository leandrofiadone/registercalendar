# Gym Tracker — Análisis completo del proyecto

> Generado: 2026-03-19
> Cobertura de datos: 13 días (7–19 Mar 2026)
> Peso registrado: 130 → 126.5 kg (−3.5 kg)

---

## Mapa del proyecto

```
gym-tracker/
├── src/                              3,155 líneas en 21 archivos
│   ├── routes/
│   │   ├── +layout.svelte             171 ln   Header, stats bar, nav, CSS global
│   │   ├── +layout.server.js           47 ln   Carga los 4 JSON, valida, ordena
│   │   ├── +page.svelte                 1 ln   Redirect a /sesiones
│   │   ├── +page.server.js              5 ln   302 → /sesiones
│   │   ├── sesiones/+page.svelte      131 ln   Sidebar lista + detalle sesión
│   │   ├── nutricion/+page.svelte     145 ln   Sidebar lista + detalle ventana
│   │   ├── calendario/+page.svelte    500 ln   FullCalendar (CDN) + Ciclo Lunar
│   │   ├── perfil/+page.svelte        379 ln   Peso, targets, trend 7d, historial
│   │   └── api/
│   │       ├── sessions/+server.js     10 ln   GET /api/sessions
│   │       ├── nutricion/+server.js    10 ln   GET /api/nutricion
│   │       └── perfil/+server.js       10 ln   GET /api/perfil
│   └── lib/
│       ├── VentanaDetail.svelte       927 ln   MAYOR componente (detalle nutri)
│       ├── Luna13Cal.svelte           389 ln   Calendario lunar sinódico
│       ├── SessionDetail.svelte       341 ln   Detalle sesión gym
│       ├── activity.js                186 ln   Motor de gasto energético (MET)
│       ├── fasting.js                 111 ln   Estadíos de ayuno
│       ├── TrendChip.svelte            79 ln   Chip déficit/superávit 7d
│       ├── FastingCounter.svelte       45 ln   Timer ayuno en vivo
│       ├── utils.js                    29 ln   Fechas, tipos de sesión
│       └── moon.js                     25 ln   Fase lunar
│
├── data/                             ~160 KB total, 4 archivos JSON
│   ├── nutricion.json      64.6 KB   13 ventanas   (crece ~5 KB/día)
│   ├── alimentos_ref.json  47.8 KB   55 alimentos   (crece ~2 KB/semana)
│   ├── log.json            44.7 KB   13 sesiones    (crece ~3.5 KB/día)
│   └── perfil.json          1.0 KB   1 perfil       (crece ~0.1 KB/semana)
│
├── Scripts auxiliares (raíz, pre-web)
│   ├── agent.js             13.5 KB  Agente de procesamiento
│   ├── view.js              50.7 KB  Vista de consola (legacy)
│   ├── notion.js             3.9 KB  Integración Notion
│   ├── storage.js            2.6 KB  Persistencia
│   └── index.js              1.5 KB  Entry point legacy
│
├── Config
│   ├── package.json                   SvelteKit 2 + Svelte 5, adapter-node
│   ├── svelte.config.js               adapter-node
│   ├── vite.config.js                 Config mínima
│   └── config.json                    Config app
│
└── Stack: SvelteKit 2.0 + Svelte 5.0 | Sin DB | JSON planos locales
```

---

## UI/UX — Problemas encontrados y propuestas

### 1. Header sobrecargado

**Problema:** El header sticky (54px) mete en una sola fila: logo + 5 stat chips (sesiones, mes, racha, top grupo, kcal log) + TrendChip + FastingCounter + 4 tabs. En pantallas < 1400px se desborda horizontalmente.

**Propuesta:**
- Mover los stat chips históricos (sesiones totales, racha, top grupo, kcal log) a la página de Perfil, donde conceptualmente pertenecen.
- Mantener en el header solo: logo, TrendChip, FastingCounter y tabs — la info "en vivo".
- Para mobile: header de 2 filas (fila 1 = logo + chips live, fila 2 = tabs).

---

### 2. Sidebars de sesiones y nutrición no escalan

**Problema:** Ambas páginas usan sidebar-izquierda + detalle-derecha. Con 13 entradas funciona, pero en 3 meses habrá 90+ entradas y scrollear será tedioso. No hay búsqueda, filtrado ni agrupación temporal.

**Propuesta:**
- Agregar input de búsqueda/filtro arriba de la sidebar.
- Agrupar items por semana con separadores visuales ("Semana del 10 Mar").
- En sesiones: mostrar kcal total gastada en cada item de la sidebar.
- En nutrición: mostrar indicador visual de déficit/superávit por día.

---

### 3. VentanaDetail.svelte — Componente monolítico (927 líneas)

**Problema:** El componente más grande del proyecto mezcla demasiadas responsabilidades:
- Vista "hoy" (live, con barra de presupuesto calórico) vs vista "pasado" (resumen)
- Barra calórica multi-zona (base / gym / exceso)
- Desglose de gasto energético
- Lista de comidas con indicadores de gaps de ayuno entre ellas
- Micronutrientes calculados desde alimentos_ref
- Detalle por alimento con macros individuales

**Propuesta — dividir en sub-componentes:**

| Componente nuevo | Responsabilidad | Líneas aprox. |
|-----------------|-----------------|---------------|
| `CalorieBudgetBar.svelte` | Barra de progreso calórico multi-zona | ~80 |
| `MealCard.svelte` | Una comida individual con sus alimentos | ~120 |
| `EnergyBreakdown.svelte` | Desglose de gasto (BMR + actividad) | ~60 |
| `MicronutrientPanel.svelte` | Panel de micronutrientes | ~100 |
| `VentanaDetail.svelte` | Orquestador que usa los anteriores | ~250 |

Beneficio adicional: `MealCard` se puede reusar en el calendario.

---

### 4. Calendario — Dos modos sin transición clara

**Problema:**
- El toggle Gregoriano/Lunar es un botón de texto plano, no es intuitivo.
- Cada modo tiene sub-tabs (Gym / Nutrición en gregoriano) = tercer nivel de navegación.
- FullCalendar se carga desde CDN (`cdn.jsdelivr.net`), sin fallback si falla la red.

**Propuesta:**
- Toggle Gregoriano/Lunar como segmented control con iconos (📅 / 🌙).
- Bundlear FullCalendar como dependencia npm (`npm install @fullcalendar/core`).
- Unificar Gym y Nutrición en una sola vista del calendario: cada celda de día muestra ambos.

---

### 5. Perfil — Tabla calórica densa, sin gráficos de tendencia

**Problema:**
- La sección "Historial calórico (últimos 30d)" es una tabla con barras de color por día. Funciona pero es difícil de leer para identificar patrones.
- No hay gráfico de tendencia visual (line chart de peso, bar chart de déficit).
- Info de peso aparece arriba (card con delta) Y abajo (historial). Redundancia.
- No hay comparación semana a semana, solo día a día.

**Propuesta:**
- Agregar line chart de peso (evolución temporal).
- Agregar bar chart de déficit/superávit diario (verde = déficit, rojo = superávit).
- Agregar resumen semanal: promedio de déficit, adherencia al target, kcal promedio.
- Eliminar redundancia peso arriba/abajo.

---

### 6. Problemas menores acumulados

| Aspecto | Problema | Mejora |
|---------|----------|--------|
| Accesibilidad | Emojis como íconos de tabs sin `aria-label` | Agregar labels ARIA a cada tab |
| Responsive | Layout flex con sidebar fija, sin breakpoints mobile | Media queries + sidebar colapsable en < 768px |
| Empty states | "Sin sesiones registradas" genérico | CTA actionable: "Cargá tu primera sesión" |
| Feedback visual | Sin loading states ni transiciones entre selecciones | `transition:fade` al cambiar detalle |
| Leyenda colores | Fuerza=morado, Cardio=azul, Mixed=verde sin documentar | Tooltip o leyenda visual en la sidebar |
| Scroll | Sidebar y detalle scrollean independientemente pero no hay indicador | Scroll shadows (sombra gradiente arriba/abajo) |

---

## Datos — Problemas encontrados y propuestas

### 1. Campos muertos en log.json

| Campo | Estado | Evidencia | Acción |
|-------|--------|-----------|--------|
| `energy` | Siempre `null` | 13/13 sesiones = `null` | Eliminar |
| `nutricion_ref` | Casi siempre `null` | 12/13 sesiones = `null`, 1 apunta a su propia fecha | Eliminar (el join se hace por fecha) |

---

### 2. Cardio — Schema inflado con nulls

**Problema:** Cada entrada de cardio tiene 14 campos, de los cuales 8–10 son `null` en cada registro. Campos como `distancia_m`, `largos`, `pasos` solo se usan en tipos específicos (natación, cinta).

**Ejemplo actual (caminata):**
```json
{
  "ejercicio": "Caminata exterior",
  "equipo": null,
  "hora_inicio": null,
  "hora_fin": null,
  "duracion_min": 21.55,
  "distancia_km": 1.39,
  "distancia_m": null,
  "largos": null,
  "pasos": null,
  "kcal": 145,
  "velocidad_kmh": 3.87,
  "inclinacion": null,
  "intensidad": "baja"
}
```

**Propuesta:** Omitir campos null. Solo incluir campos que tengan valor:
```json
{
  "ejercicio": "Caminata exterior",
  "duracion_min": 21.55,
  "distancia_km": 1.39,
  "kcal": 145,
  "velocidad_kmh": 3.87,
  "intensidad": "baja"
}
```
El código ya usa optional chaining (`s.cardio?.length`), así que tolera campos faltantes.

---

### 3. Sets — Dos formas incompatibles sin discriminador

**Problema:** Los sets de fuerza tienen dos shapes distintas y la forma "standard" no tiene campo `tipo`:
```json
// Standard — sin tipo
{ "set": 1, "reps": 10, "peso_kg": 80 }

// Dropset — con tipo
{ "set": 1, "tipo": "dropset", "drops": [{ "drop": 1, "reps": 16, "peso_kg": 14 }, ...] }
```

**Datos rotos encontrados:** Sesión del 10/03 tiene dropsets con `"reps": null` en los 6 drops. Datos inutilizables para cálculo de volumen.

**Propuesta:** Agregar `"tipo": "standard"` a los sets normales para tener un discriminador uniforme.

---

### 4. Peso duplicado en dos archivos con valores distintos

**Problema:** El peso se registra en dos lugares que no coinciden:

| Fecha | `perfil.json → historial_peso` | `log.json → weight_kg` |
|-------|-------------------------------|------------------------|
| 08/03 | 130 | — |
| 09/03 | — | 130 |
| 11/03 | — | 130 |
| 14/03 | 127.1 | — |
| 17/03 | — | 127 |
| 19/03 | 126.5 | — |

El 17/03 log dice 127 pero perfil no tiene entrada ese día. No hay fuente única de verdad.

**Propuesta:** Consolidar en `perfil.json → historial_peso` como única fuente. Eliminar `weight_kg` de log.json.

---

### 5. Nutrición — Inconsistencias de schema

| Problema | Ejemplo concreto | Propuesta |
|----------|-----------------|-----------|
| `cantidad_g` vs `cantidad_ml` | Cold brew (08/03) usa `cantidad_ml: 269`, todo lo demás usa `cantidad_g` | Siempre `cantidad_g`. Para líquidos: agregar `estado: "liquido"` si necesario |
| Campos ad-hoc en costillas (08/03) | `peso_total_con_hueso_g`, `hueso_y_grasa_retirada_g`, `carne_neta_g` | Mover a `notas` — no son campos del schema |
| `protocolo` repetido en cada ventana | Siempre `"ayuno_intermitente"` × 13 ventanas | Mover a perfil.json (ya está como `perfil.protocolo`) |
| `hora: null` en 7+ comidas | Impide calcular ventana de ayuno y gaps entre comidas | Hacer `hora` obligatorio; si es estimada, agregar `hora_estimada: true` |
| Misma barrita, 2 marcas | "Not." vs "NotCo" para Not. Protein Bar (15/03) | Normalizar marcas consistentemente |
| `tipo: "rompe_ayuno"` inconsistente | Solo usado en 07/03 y 10/03; otros días que rompen ayuno usan `"comida"` | Decidir si `rompe_ayuno` es un tipo válido y usarlo siempre, o eliminarlo |

---

### 6. kcal faltante en ejercicios de fuerza

**Problema:** Las sesiones del 07, 09, 11, 12, 13 y 14/03 NO tienen `kcal` en los ejercicios de fuerza. Solo las del 16 y 17/03 lo incluyen. Esto genera que el gasto energético de esos días sea incompleto.

**Propuesta:** El campo `kcal` en fuerza debería calcularse automáticamente vía `activity.js` (que ya tiene la lógica MET-based con `fuerzaKcal`). No depender de que se cargue manualmente.

---

### 7. alimentos_ref.json — Link frágil por nombre

**Problema:** La relación entre `nutricion.json` y `alimentos_ref.json` es por string matching de nombres, que es frágil:
- "Buñuelo de acelga" (singular en nutri) vs "Buñuelos de acelga" (plural en ref)
- "Sardinas en su jugo con aceite vegetal" (nutri) vs alias en ref

**Propuesta:** Agregar `ref_id` como foreign key en cada alimento de nutricion.json:
```json
{
  "nombre": "Buñuelo de acelga",
  "ref_id": "bunuelo_acelga",
  "cantidad_g": 130,
  "kcal": 307,
  "proteina_g": 9.1,
  "grasa_g": 21.6,
  "carbos_g": 20.8
}
```
Esto habilita:
- Lookup confiable de micronutrientes
- Validación de macros (comparar inline vs calculado desde ref × cantidad)
- Detección de productos nuevos que faltan en la ref

---

### 8. Gimnasios — Nombres inconsistentes

**Nombres actuales encontrados en log.json:**
```
"Sportclub Dot"
"SportClub Dot"                         ← capitalización diferente
"Sportclub Mar Del Plata - Hermitage"
"Sportclub Mar del Plata"               ← sin branch
"Sportclub"                             ← sin especificar cuál
"Sportclub Belgrano + Sportclub Saavedra" ← multi-gym como string
```

**Propuesta:** Crear un archivo de referencia `gimnasios_ref.json`:
```json
[
  { "id": "sc_dot",           "nombre": "SportClub Dot",                        "ciudad": "Buenos Aires",  "cadena": "SportClub" },
  { "id": "sc_belgrano",      "nombre": "SportClub Belgrano",                   "ciudad": "Buenos Aires",  "cadena": "SportClub" },
  { "id": "sc_saavedra",      "nombre": "SportClub Saavedra",                   "ciudad": "Buenos Aires",  "cadena": "SportClub" },
  { "id": "sc_mdp_hermitage", "nombre": "SportClub Mar del Plata - Hermitage",  "ciudad": "Mar del Plata", "cadena": "SportClub" }
]
```
En log.json, usar `"gimnasio_id": "sc_dot"` en vez de string libre. Para multi-gym, usar array: `"gimnasios": ["sc_belgrano", "sc_saavedra"]`.

---

### 9. Datos duplicados entre sesiones (cardio Mar 12)

**Problema encontrado:** La sesión del 12/03 tiene dos entradas de caminata (orden 4 y 5) con valores idénticos:
- Ambas: duración 23 min, distancia 1.74 km, kcal 103
- El orden salta de 5 a 7 (falta orden 6)

Esto parece un duplicado accidental.

---

### 10. Sauna clasificada como cardio

**Problema:** Las entradas de sauna (09, 10, 12/03) están en el array `cardio`, pero tienen null en casi todos los campos (distancia, pasos, velocidad, inclinación). No son actividad cardiovascular.

**Propuesta:** Crear una categoría separada `"otras_actividades"` en la sesión para sauna, stretching, etc. O mantenerlas en cardio pero con un campo `"subtipo": "pasiva"` para filtrarlas de los cálculos de rendimiento cardio.

---

## Proyección de crecimiento de datos

| Archivo | Tasa actual | 6 meses | 1 año | 2 años |
|---------|-------------|---------|-------|--------|
| nutricion.json | ~5 KB/día | ~900 KB | ~1.85 MB | ~3.7 MB |
| log.json | ~3.5 KB/día | ~630 KB | ~1.3 MB | ~2.6 MB |
| alimentos_ref.json | ~2 KB/semana | ~100 KB | ~150 KB | ~250 KB |
| perfil.json | ~0.1 KB/semana | ~3 KB | ~5 KB | ~10 KB |
| **TOTAL** | **~9 KB/día** | **~1.6 MB** | **~3.3 MB** | **~6.6 MB** |

**Recomendación:** Los JSON planos funcionan bien hasta ~3 MB combinados (~1 año). Después conviene migrar a **SQLite** (single-file, sin server, compatible con adapter-node).

**Tablas naturales para SQLite:**

```
sesiones         (id, fecha, gimnasio_id, ciudad, notas)
ejercicios       (id, sesion_id, orden, ejercicio, equipo, musculo_principal, tipo, kcal)
sets             (id, ejercicio_id, set_num, tipo, reps, peso_kg)
drops            (id, set_id, drop_num, reps, peso_kg)
cardio           (id, sesion_id, orden, ejercicio, duracion_min, distancia_km, kcal, intensidad)
ventanas         (id, fecha, protocolo)
comidas          (id, ventana_id, tipo, hora, descripcion)
alimentos        (id, comida_id, nombre, ref_id, cantidad_g, kcal, proteina_g, grasa_g, carbos_g)
alimentos_ref    (id, nombre, categoria, kcal_100g, proteina_100g, ...)
pesajes          (id, fecha, peso_kg)
gimnasios        (id, nombre, ciudad, cadena)
```

---

## Priorización sugerida

### Impacto alto, esfuerzo bajo (hacer primero)
1. ~~**Eliminar campos muertos** (`energy`, `nutricion_ref`)~~ — HECHO. Código refactoreado para vincular nutrición por fecha. Campos eliminados de log.json (11 sesiones).
2. ~~**Unificar peso en perfil.json**~~ — HECHO. Fusionados 3 pesajes de log.json a perfil.json (ahora 6 entradas). Eliminado `weight_kg` de log.json. SessionDetail ahora busca peso por fecha desde perfil con `pesoEnFecha()`, mejorando también la precisión del cálculo MET.
3. ~~**Hacer `hora` obligatorio en comidas**~~ — HECHO. Agregada validación en `+layout.server.js` que loguea warnings para comidas sin hora. 8 comidas existentes sin hora en 5 ventanas (10, 11, 13, 14, 15/03) — requiere corrección manual en nutricion.json.
4. ~~**Quitar nulls de cardio**~~ — HECHO. Eliminados 248 campos null de entradas cardio en log.json. El código ya usa `{#if c.campo}` así que tolera campos faltantes.

### Impacto alto, esfuerzo medio
5. ~~**Agregar `ref_id` a alimentos en nutricion.json**~~ — HECHO. 126/129 alimentos matcheados (97.7%). Se agregaron aliases a alimentos_ref para "Buñuelo de acelga" y "Sardinas en aceite vegetal". Quedan 3 sin match: barra de cereales Muecas, barrita de frutos secos genérica, ensalada mixta compuesta — requieren entries nuevas en alimentos_ref.
6. **Partir VentanaDetail.svelte en sub-componentes** — Mantenibilidad
7. **Normalizar gimnasios** con archivo de referencia

### Impacto medio, esfuerzo medio
8. **Responsive/mobile** — Si se usa desde el celular
9. **Búsqueda/filtro en sidebars** — Necesario pronto (90+ entradas en 3 meses)
10. **Gráficos de tendencia en perfil** — Line chart peso + bar chart déficit

### Impacto bajo, esfuerzo bajo (cuando haya tiempo)
11. Agregar `"tipo": "standard"` a sets normales
12. Bundlear FullCalendar como dependencia npm
13. Mejorar empty states con CTAs
14. Agregar transiciones entre vistas
15. Accesibilidad (aria-labels)
