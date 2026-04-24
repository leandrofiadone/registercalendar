# DESIGN.md — Gym Tracker

Guía visual obligatoria. Referencia canónica: `../sistema-fisico/omad-base.html`.
Si un cambio contradice este documento, gana el documento.

## Identidad

Dashboard denso tipo GitHub dark + reporte técnico. Personal, diario, numérico.
No es una app de consumo, es una bitácora. Prioridad: **densidad de información > estética "moderna"**.

**Lo que es**:
- Datos primero, chrome después
- Numeros prominentes, monoespaciados visualmente (tabular-nums)
- Secciones separadas por header uppercase + línea, no por cards flotantes
- Color funcional: cada macro/estado tiene su color fijo
- Lectura en una pantalla, scroll solo para historial

**Lo que NO es**:
- No es shadcn/ui
- No es "slate + violeta + rounded-xl"
- No usa emojis como iconos
- No tiene backdrop-filter, blur, gradientes, soft shadows
- No usa cards con padding generoso y sombra para decorar secciones

## Paleta (tokens)

Definir en `:global(:root)` de `+layout.svelte`.

### Estructurales (chrome)
```css
--bg:        #0d1117;  /* fondo app */
--surface-1: #161b22;  /* cards, tablas, elementos alzados */
--surface-2: #1c2333;  /* hover, acento sutil */
--border-1:  #30363d;  /* borde estándar */
--border-2:  #484f58;  /* borde hover / acento */
--text:      #e6edf3;  /* texto principal */
--muted:     #8b949e;  /* texto secundario, headers de columna */
--dim:       #6e7681;  /* placeholders, timestamps */
```

### Semánticos (datos)
```css
--kcal:  #f0883e;  /* calorías — naranja */
--prot:  #3fb950;  /* proteína — verde */
--fat:   #d29922;  /* grasa — ámbar */
--carb:  #58a6ff;  /* carbos — azul */
--accent:#bc8cff;  /* morado GitHub para highlights puntuales */
--good:  #3fb950;  /* bajo target / déficit cumplido */
--warn:  #d29922;  /* borde de rango */
--bad:   #f85149;  /* sobre target / fuera de rango */
```

Cada macro **siempre** usa su color, en toda la app. Un número de proteína es verde en Perfil, en VentanaDetail, en CalorieBudgetBar, en TrendChip. Sin excepciones.

**Prohibido**: `#7c6af5` (violeta Anthropic actual), `slate-*`, `indigo-*`, gradientes.

## Tipografía — 3 fuentes por rol

**Identidad: cada fuente tiene un trabajo. El stack del sistema es prohibido como default general.**

Cargar en `src/app.html` vía Google Fonts (`Space+Grotesk`, `Geist`, `IBM+Plex+Mono`).

```css
--font-display: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
--font-body:    'Geist', ui-sans-serif, system-ui, sans-serif;
--font-mono:    'IBM Plex Mono', ui-monospace, Menlo, monospace;
```

### Cuándo usa cada una

| Fuente | Uso | Por qué |
|---|---|---|
| **Space Grotesk** (display) | h1, numeros hero de stat cards (`.num-hero`), charts values | Grotesk con carácter, letterforms distintivas, se lee "diseñado" no "default" |
| **Geist** (body) | Párrafos, filas de tabla body, labels de campo, botones | Moderno y limpio, claramente distinto de Inter, lecturable a densidad alta |
| **IBM Plex Mono** (mono) | Numeros tabulares, labels uppercase (h2 section, column headers), timestamps, brand, nav accesorio, chips, captions | Mono con humanidad (no ultra-geometric). Hace que data se vea *data*. Tabular-nums nativos. |

### Regla práctica
- ¿Es un **número** que va a ser comparado visualmente o está en una celda? → mono
- ¿Es un **label administrativo** (UPPERCASE, eyebrow, caption)? → mono
- ¿Es un **título de página o número hero**? → display
- ¿Es **todo lo demás** (texto normal, UI)? → body

### Tamaños clave (base 15-16px)
- `0.66-0.72rem` — mono uppercase: column headers, section labels, captions
- `0.78-0.85rem` — body texto de celda, chips mono
- `0.85-0.95rem` — body párrafos principales
- `1.85-2.2rem` — hero numbers (display, `--num-hero`)
- `2rem` — h1 display

### Letter-spacing por tipo
- Mono uppercase: `0.08em` mínimo, `0.12-0.18em` para branding (`GYM TRACKER`)
- Display headings: `-0.02em` (tighten)
- Body: default `0`

Numeros SIEMPRE con `.num` class (aplica mono + tabular-nums + "tnum" feature).

## Jerarquía de sección — firma visual

Todos los h2 de página siguen este patrón (copiar de omad-base.html):

```css
h2 {
  font-size: 1rem;
  color: var(--muted);
  border-bottom: 1px solid var(--border-1);
  padding-bottom: 0.4rem;
  margin: 1.5rem 0 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

Esto es la firma: **UPPERCASE + muted + underline**. Reemplaza el 90% de los cards decorativos que tenemos hoy.

## Espaciado y forma

- Radius estándar: `6px` (botones, chips, inputs)
- Radius cards/surfaces: `8px`
- Radius circular: solo FAB si se mantiene — evaluar reemplazar por botón rectangular con label
- Borders: siempre `1px solid var(--border-1)`. Sin shadows de elevación. Sombra solo en overlays (drawer, modal).
- Padding cards: `1rem` (16px). No `1.5rem+` — apretado.
- Gap grids: `0.6rem` a `0.8rem` según densidad.

## Componentes

### Stat card (grid de métricas hero)
```
┌──────────────┐
│   2286kcal   │  <- num-hero 1.6rem + unidad inline 0.7em muted
│  CONSUMO 7D  │  <- label uppercase muted 0.70rem
│  target 2276 │  <- sub-label dim 0.70rem (opcional)
└──────────────┘
```
Estructura:
```css
.stat-item {
  background: var(--surface-1); border: 1px solid var(--border-1);
  border-radius: 8px; padding: 0.9rem; text-align: center;
}
.stat-item .num-hero { font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.stat-item .unit { font-size: 0.7em; color: var(--muted); margin-left: 0.15em; }
.stat-item .label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 0.25rem; }
.stat-item .sub-label { font-size: 0.7rem; color: var(--dim); margin-top: 0.15rem; }
```
Grids de 2/3/4 columnas según cantidad. Mobile: 2 columnas. El número siempre lleva color semántico (`--kcal`, `--prot`, `--good`, `--bad`, etc).

### Tabla densa
- Header: `text-transform: uppercase; font-size: 0.72rem; color: var(--muted); border-bottom: 2px solid var(--border-1);`
- Row: `border-bottom: 1px solid var(--border-1);` padding `0.4rem 0.5rem`
- Total row: `font-weight: 700; border-top: 2px solid var(--border-1);`
- Font size tabla: `0.82rem-0.85rem`
- Numeros alineados a la derecha (`text-align: right`) con color semántico según macro

### Barra de progreso inline (dentro de tablas/cards)
```css
.bar-track {
  flex: 1; height: 6px;
  background: var(--bg); border: 1px solid var(--border-1);
  border-radius: 2px; overflow: hidden; min-width: 80px;
}
.bar-fill { height: 100%; transition: width 0.2s; }  /* background dinámico */
```
Color del fill: `--good` si % dentro de objetivo, `--warn` en borde, `--bad` o `--carb` si fuera (según contexto — exceso kcal=bad, exceso micros=carb/ok). Sin gradient. Sin border-radius en el fill.

### Chip / tag
Sin border-radius pill (`9999px`). Max `4-6px`.
```css
padding: 0.1rem 0.3rem;
background: rgba(188, 140, 255, 0.15);  /* tint sutil del color semántico */
color: var(--accent);
font-size: 0.6rem;
border-radius: 4px;
```

### Botón primario
- Sin gradient, sin shadow
- Border 1px, bg surface-1, hover → surface-2 + border-2
- Active: border color del accent semántico relevante

### Input / select
- `background: var(--surface-1)` o `var(--bg)`, `border: 1px solid var(--border-1)`
- Focus: `border-color: var(--carb)` (azul), sin outline glow
- Radius 6px
- Sin placeholder styling fancy

## Iconografía

**Sin emojis**. Ninguno. Ni en tabs, ni en logo, ni en stats.

Sustituir por:
1. **Texto puro** (preferido): `Sesiones · Nutrición · Calendario · Perfil · Ingresar`
2. **Unicode glyphs** selectos si se necesita símbolo:
   - `□ ▪ ▸ ◂ ─ │ ┌ ┐ └ ┘ ╱ ✓ ✕ ↑ ↓ → ← •`
   - Ej: checkbox de lista `□`, indicador de tendencia `↑ ↓`, separador `·`
3. **SVG custom** solo si un glyph no alcanza (graficos, charts). Stroke `1.5px`, color `currentColor`, sin fill decorativo.

Logo: texto `GYM TRACKER` uppercase letter-spacing, sin icono. O `GT` monograma 2 letras.

## Numeros — reglas duras

1. Siempre `tabular-nums` (se alinean verticalmente). Usar clase `.num` global.
2. Color semántico fijo: kcal naranja, prot verde, grasa ámbar, carb azul
3. Signo explícito para deltas: `+2.3kg` `-500kcal`
4. Unidades en la MISMA línea, tamaño `0.7em`, color `--muted`. Ej: `2286<span class="unit">kcal</span>`
5. Separador de miles: punto en español (`12.295`) no coma
6. En tablas, numeros alineados a la derecha (`text-align: right`)
7. Signo unicode **menos** (`−` U+2212) para valores negativos — no hyphen (`-`). Mejor alineación tabular.

### Reglas de delta por contexto
- **Peso**: ↑ subió = `--bad` (rojo), ↓ bajó = `--good` (verde), `—` sin cambio = `--muted`
- **Déficit kcal**: déficit (`−N`) = `--good`, surplus (`+N`) = `--bad`, cerca de 0 = `--warn`
- **Consumo vs target**: bajo = `--good`, borde (±10%) = `--warn`, exceso = `--bad`
- **Micros**: deficit (<50% RDA) = `--bad`, bajo (50-80%) = `--warn`, ok (80-150%) = `--good`, alto (>150%) = `--carb` (azul, "no es malo pero atípico")

## Forbidden (lista negra)

Si el código contiene alguno de estos, está mal:

- [ ] `emojis en UI chrome (🏋️📋🥗📅👤✏️🔥💪 etc)` — borrar
- [ ] `backdrop-filter: blur(...)` — borrar (salvo drawer overlay)
- [ ] `box-shadow: 0 Xpx Ypx rgba(...)` en headers, cards, botones estándar — borrar
- [ ] `background: linear-gradient(...)` — revisar, en 99% de casos borrar
- [ ] `border-radius: 12px | 16px | 20px | 9999px` (excepto drawer top-corners mobile) — reducir a 6-8
- [ ] `slate-*`, `indigo-*`, `zinc-*` naming — renombrar a tokens semánticos
- [ ] `#7c6af5 / #a594f9` (violeta Anthropic) — reemplazar por `--accent` (#bc8cff) o eliminar
- [ ] Font Inter, Poppins, generic sans-serif sin stack — usar stack explícito del doc
- [ ] Cards decorativos sin información (solo para "separar visualmente") — usar h2 uppercase en su lugar
- [ ] Padding > 20px en cards — reducir
- [ ] `font-size` > 16px para body — revisar
- [ ] `text-align: center` en bloques de párrafo — izquierda por defecto

## Patrones de página

Estructura recomendada:
```
<h1>Título página</h1>
<p class="sub">subtítulo contexto</p>

<div class="resumen-grid">stat cards hero</div>

<h2>SECCIÓN 1</h2>
<table>…</table>

<h2>SECCIÓN 2</h2>
<div class="grid2">cards con info</div>

<h2>SECCIÓN 3</h2>
…
```

Sin wrappers extras. Sin `.container .card .card-body`. Plano.

## Cómo prompteas con este doc

Cuando pidas cambios de UI, abre con:

> Siguiendo `DESIGN.md`. NO usar: emojis, gradientes, shadows, rounded>8px, violeta #7c6af5.
> Colores semánticos: kcal=naranja, prot=verde, grasa=ámbar, carb=azul.

Si el output tiene algo de la lista negra, señalá el item y pedí rework.

## Migración incremental (orden sugerido)

1. Reemplazar tokens de color en `+layout.svelte` (`--accent`, `--s*`, `--b*` → los nuevos)
2. Borrar emojis de `+layout.svelte` tabs + logo
3. Aplicar patrón h2 uppercase en `perfil/+page.svelte`
4. Revisar `CalorieBudgetBar` — colores semánticos + quitar gradients
5. Revisar `VentanaDetail` — tabla densa con colores macros
6. `FastingCounter`, `TrendChip` — signos explícitos + color bueno/malo
7. FAB → evaluar rectangular con label "+ Ingresar"

Pantalla por pantalla, no todo de una. Después de cada pantalla: verificar contra `Forbidden` y contra `omad-base.html` en el navegador lado a lado.
