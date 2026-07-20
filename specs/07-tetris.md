# SPEC 07 — Tetris (leaderboard real)

> **Status:** Finalizado
> **Depends on:** 05-asteroides (patrón de engine portado), 06-leaderboard-asteroides (tabla `scores` compartida)
> **Date:** 2026-07-18
> **Objective:** Portar Tetris desde `references/started-games/03-tetris/game.js` a un componente canvas real (`components/games/tetris/`), integrarlo en `/juego/tetris/jugar` con next-piece preview y ghost piece, introducir el registry genérico (`hasRealBackend` + `components/games/registry.ts`) que reemplaza los 4 puntos hoy hardcodeados a `"asteroides"`, y conectar su leaderboard real a la tabla `scores` compartida de Supabase.

## Scope

**In:**

- Renombrar la entrada existente en `lib/games.ts`: `id: "caida"` → `"tetris"`, `title: "CAÍDA"` → `"TETRIS"`, `cover: "cover-tetro"` → `"cover-tetris"`, reescribiendo `short`/`long` para que el texto coincida con el nombre nuevo. `cat: "PUZZLE"` y `color: "magenta"` se mantienen igual.
- Renombrar la clase CSS `.cover-tetro` → `.cover-tetris` en `app/globals.css` (mismo diseño visual, solo cambia el selector).
- Nuevo componente cliente en `components/games/tetris/` que porta la lógica completa de `game.js`: tablero (`board` matriz 10×20), spawn de piezas (`randomPiece`), colisión (`collide`), rotación con wall-kicks (`rotateCW`/`tryRotate`), fijado y limpieza de líneas (`merge`/`clearLines`), pieza fantasma (`ghostY`), soft drop/hard drop con su scoring (`LINE_SCORES` × nivel, +1/celda soft drop, +2/celda hard drop), progresión de velocidad (`dropInterval` decreciente por nivel vía acumulador de ms) — adaptado a TypeScript + React (canvas vía `ref`, loop `requestAnimationFrame` dentro de `useEffect` con cleanup en desmontaje).
- Next-piece preview: mini-canvas separado (equivalente a `#next-canvas` del original) mostrando la próxima pieza, actualizado en cada spawn.
- Ghost piece: proyección semitransparente (alpha 0.2) de dónde caerá la pieza actual, portada de `ghostY()`.
- El canvas **no dibuja overlay propio** de PAUSA/GAME OVER (a diferencia del `#overlay` del original) — a diferencia de Asteroides tampoco dibuja HUD propio (score/líneas/nivel) dentro del canvas, ya que el original los tenía en DOM externo, no en el canvas; el `player-hud` existente de `GamePlayer.tsx` y el modal de fin de partida ya existentes cubren ambos roles vía `onStateChange`/`onGameOver`.
- Selector de tema visual de piezas con 3 opciones — **RETRO**, **NEÓN PASTEL** y **PIXEL ART** — visible en el `player-hud` solo cuando `game.id === "tetris"`. Cada tema define su propia paleta de 8 colores (uno por tipo de pieza I/O/T/S/Z/J/L/N) y su propio estilo de dibujo de bloque (ver Data model). El tema por defecto es **RETRO**, que reutiliza literal la paleta `COLORS` del `game.js` original (cyan/amarillo/púrpura/verde/rojo/celeste/naranja/gris) sobre fondo `--bg` negro del sitio; los otros dos son paletas y estilos de render nuevos diseñados para este spec (no existían en `references/started-games/03-tetris/`).
- Cambiar de tema actualiza en vivo los colores y el estilo de dibujo del tablero, la pieza actual, la ghost piece y el next-piece preview, sin reiniciar la partida ni perder el progreso (score/líneas/nivel/tablero intactos).
- El tema elegido se persiste en `localStorage` bajo la clave `av_tetris_theme`; si no hay valor guardado, arranca en `"retro"`.
- Controles reales de teclado, portados literal del original: `ArrowLeft`/`ArrowRight` mover, `ArrowDown` soft drop (+1pt/fila), `ArrowUp`/`KeyX` rotar con wall-kicks, `Space` hard drop (+2pts/celda, con `preventDefault()`), `KeyP` alterna pausa (activo incluso si el resto de los controles de movimiento están desactivados por fase). El resto de los listeners de movimiento solo están activos en fase jugable (no en pausa ni gameover).
- **Introducir el registry genérico** (no existe todavía — verificado en `lib/games.ts` y `components/games/`): campo `hasRealBackend?: boolean` en la interfaz `Game`, y `components/games/registry.ts` (mapa `id → componente`, client-only vía `next/dynamic`). Reemplaza los 4 puntos hoy hardcodeados a `game.id === "asteroides"` / `id === "asteroides"`:
  - `components/GamePlayer.tsx`: renderiza `engineRegistry[game.id]` si existe (si no, el placeholder decorativo actual); guardado usa `saveScoreToSupabase` si `game.hasRealBackend`, si no `saveScoreEntry`.
  - `app/juego/[id]/page.tsx`: lee `getTopScores`/`getGameStats` si `game.hasRealBackend`, si no `seededScores`/`game.best`/`game.plays`.
  - `app/salon/page.tsx`: itera los juegos con `hasRealBackend: true` (ahora `asteroides` y `tetris`) y arma un mapa `{ [id]: ScoreRow[] }` con `Promise.all`, en vez de una sola llamada fija a Asteroides.
  - `components/HallOfFame.tsx`: el `useMemo` decide entre datos reales del mapa recibido (si `game.hasRealBackend`) o `seededScores` para el resto.
  - `asteroides` pasa a tener `hasRealBackend: true` en `lib/games.ts` y su entrada correspondiente en `registry.ts`, sin cambiar su comportamiento (cero regresión).
- Migración de Supabase (`apply_migration`): `insert into games (id, title) values ('tetris', 'TETRIS')`. La tabla `scores` no cambia — ya es compartida (ver spec 06).

**Out of scope (para specs futuros):**

- Los demás 6 juegos restantes (Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen con la simulación visual actual, sin tocar.
- Controles táctiles / jugabilidad en móvil.
- Audio/efectos de sonido (el original tampoco los tiene).
- Multijugador.
- El toggle de tema claro/oscuro del original (`body.light-mode`, cambia fondo/texto/bordes de **toda la página** vía `localStorage: "tetris-theme"`) — no se porta; Arcade Vault mantiene su chrome de sitio fijo. Distinto del selector de tema de **piezas** (retro/neón pastel/pixel art) que sí se agrega en este spec — ver Scope/Data model.
- El overlay propio de PAUSA/GAME OVER dibujado dentro del canvas del original — se reemplaza por los controles/modal ya existentes de `GamePlayer.tsx`, no se porta el overlay.
- Cualquier medida anti-cheat o validación server-side del score insertado (mismo riesgo aceptado que en spec 06).
- Auth real de Supabase (`user_id` sigue `null` en los inserts).

## Data model

```ts
// components/games/tetris/engine.ts
export type Phase = "playing" | "gameover";

export interface TetrisState {
  score: number;
  lines: number;
  level: number;
  phase: Phase;
}

// Piezas y tablero portados de game.js (no se exportan fuera del engine):
// PIECES, LINE_SCORES, board (matriz ROWS×COLS), current/next (piece = {type, shape, x, y}).
// COLORS del original se reemplaza por el sistema de temas THEMES (ver abajo).

export type ThemeId = "retro" | "neon-pastel" | "pixel-art";

export type BlockStyle = "flat-highlight" | "soft-glow" | "pixel-outline";

export interface TetrisTheme {
  id: ThemeId;
  label: string;
  colors: [string, string, string, string, string, string, string, string]; // índices 1–8, mismo orden que PIECES: I,O,T,S,Z,J,L,N
  blockStyle: BlockStyle;
}

export const THEMES: Record<ThemeId, TetrisTheme> = {
  retro: {
    id: "retro",
    label: "RETRO",
    colors: [
      "#4dd0e1",
      "#ffd54f",
      "#ba68c8",
      "#81c784",
      "#e57373",
      "#90caf9",
      "#ffb74d",
      "#9e9e9e",
    ],
    blockStyle: "flat-highlight", // rect sólido + highlight translúcido arriba — literal drawBlock() del game.js original
  },
  "neon-pastel": {
    id: "neon-pastel",
    label: "NEÓN PASTEL",
    colors: [
      "#9fe8f5",
      "#fff2a8",
      "#e3b3e8",
      "#b3f0c2",
      "#f5b3c2",
      "#b3d4f5",
      "#f5cfa8",
      "#d8d8e3",
    ],
    blockStyle: "soft-glow", // esquinas redondeadas + shadowBlur suave, sin highlight duro
  },
  "pixel-art": {
    id: "pixel-art",
    label: "PIXEL ART",
    colors: [
      "#00e5ff",
      "#ffee00",
      "#d500f9",
      "#00e676",
      "#ff1744",
      "#2979ff",
      "#ff9100",
      "#616161",
    ],
    blockStyle: "pixel-outline", // contorno duro de 2px + relleno plano + brillo de 4×4px sólido en la esquina, imageSmoothingEnabled = false
  },
};

export class TetrisEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    nextCtx: CanvasRenderingContext2D,
    onStateChange: (state: TetrisState) => void,
    initialTheme?: ThemeId, // default "retro" si se omite
  );
  update(dt: number): void; // acumula dropAccum contra dropInterval, avanza la pieza o hace lockPiece()
  draw(): void; // tablero + ghost piece + pieza actual sobre ctx, con el theme activo; next piece sobre nextCtx
  handleKeyDown(code: string): void; // resuelve la acción completa (mover/rotar/soft drop/hard drop/pausa) en la llamada
  handleKeyUp(code: string): void; // no-op salvo housekeeping — no hay input "mantenido" en Tetris
  pause(): void;
  resume(): void;
  forceGameOver(): void; // usado por el botón FIN
  restart(): void; // usado por "JUGAR DE NUEVO"
  setTheme(theme: ThemeId): void; // reemplaza colors/blockStyle activos; el próximo draw() ya lo refleja, sin tocar el tablero/score
  destroy(): void; // cleanup interno del engine
}
```

```tsx
// components/games/tetris/TetrisGame.tsx
export interface TetrisGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
  setTheme(theme: ThemeId): void;
}

export interface TetrisGameProps {
  onStateChange: (state: TetrisState) => void;
  onGameOver: (finalScore: number) => void;
  initialTheme?: ThemeId; // leído de localStorage por GamePlayer.tsx antes de montar; default "retro"
}

// forwardRef<TetrisGameHandle, TetrisGameProps> — monta <canvas> de tablero (300×600) +
// <canvas> secundario de next-piece (120×120), corre el loop rAF, gestiona listeners de
// teclado (incluye KeyP para alternar pausa), expone el ref imperativo — mismo contrato
// que AsteroidsGame.tsx.
const TetrisGame = forwardRef<TetrisGameHandle, TetrisGameProps>(...);
export default TetrisGame;
```

```ts
// components/games/registry.ts (nuevo)
"use client";
import dynamic from "next/dynamic";

export const engineRegistry: Record<string, ReturnType<typeof dynamic>> = {
  asteroides: dynamic(
    () => import("@/components/games/asteroids/AsteroidsGame"),
  ),
  tetris: dynamic(() => import("@/components/games/tetris/TetrisGame")),
};
```

```ts
// lib/games.ts — campo nuevo en la interfaz Game
export interface Game {
  // ...campos existentes...
  hasRealBackend?: boolean; // true = leaderboard real vía lib/scores.ts; ausente/false = seededScores como hoy
}
// asteroides y tetris pasan a hasRealBackend: true; los demás 6 juegos quedan sin el campo.
```

Convenciones:

- `TetrisState` reemplaza `lives` por `lines` (líneas eliminadas) — Tetris no tiene concepto de vidas; el game over ocurre cuando `spawn()` colisiona de inmediato (torre llena), no por pérdida de vidas.
- `Phase` de Tetris **no incluye** `"dead"` (a diferencia de Asteroids) — no hay estado intermedio de muerte/reaparición, solo `"playing"` y `"gameover"`.
- Los listeners de movimiento (`ArrowLeft/Right/Down/Up`, `KeyX`, `Space`) solo están activos mientras `phase === "playing"` y no está en pausa. El listener de `KeyP` se mantiene activo también en pausa (para poder reanudar), pero no en `"gameover"`.
- `onStateChange` hace dedupe — solo se llama cuando `score`/`lines`/`level`/`phase` cambió respecto al último valor notificado, igual que Asteroids.
- El next-piece preview **no** forma parte de `TetrisState` (no dispara renders de React) — se dibuja directamente sobre `nextCtx` dentro de `draw()`, igual que el ghost piece se dibuja sobre `ctx`.
- `engineRegistry` mapea `id → componente`; `GamePlayer.tsx` renderiza `engineRegistry[game.id]` si existe, si no el placeholder decorativo actual (los 6 juegos restantes sin entrada, sin cambios).
- El sistema de temas (`ThemeId`/`TetrisTheme`/`THEMES`/`setTheme`) es específico de Tetris — no forma parte del contrato genérico que expone `AsteroidsGameHandle` ni el registry; ningún otro juego lo necesita hoy.
- `GamePlayer.tsx` lee/escribe `localStorage` (`av_tetris_theme`) y renderiza el selector de 3 opciones en el `player-hud`, condicionado a `game.id === "tetris"` (hardcodeado, igual criterio que cualquier característica exclusiva de un solo juego); le pasa `initialTheme` a `TetrisGame` al montar y llama `ref.setTheme(id)` en cada cambio posterior, persistiendo el nuevo valor.
- `blockStyle` determina cómo `draw()` pinta cada celda: `"flat-highlight"` (rect + highlight rectangular translúcido, como el original), `"soft-glow"` (`ctx.shadowBlur` suave, sin highlight duro, esquinas redondeadas), `"pixel-outline"` (contorno de 2px sólido + relleno plano + `ctx.imageSmoothingEnabled = false`, sin gradientes) — aplica tanto al tablero principal como al next-piece preview.

## Implementation plan

1. Renombrar en `lib/games.ts` la entrada `id: "caida"` → `"tetris"` (title, short, long, cover) y renombrar la clase CSS `.cover-tetro` → `.cover-tetris` (con sus `::before`/`::after`) en `app/globals.css`. Test manual: `/juegos` muestra la tarjeta "TETRIS" con el cover correcto; `/juego/tetris` carga bien; `/juego/caida` da 404.
2. Crear `components/games/tetris/engine.ts` portando de `game.js` `PIECES`/`LINE_SCORES`, el tablero matricial y las funciones (`randomPiece`, `collide`, `rotateCW`/`tryRotate` con wall-kicks, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`) dentro de una clase `TetrisEngine` (constructor con `ctx`+`nextCtx`+`onStateChange`+`initialTheme`, `update`, `draw`, `handleKeyDown/Up`, `pause`, `resume`, `forceGameOver`, `restart`, `setTheme`, `destroy`), incluyendo `THEMES` con las 3 paletas/`blockStyle` (retro/neón pastel/pixel art) y la lógica de `draw()` que renderiza según el `blockStyle` activo. Test manual: `npm run build` compila sin errores de tipos (módulo aún no usado en ninguna ruta).
3. Crear `components/games/tetris/TetrisGame.tsx`: client component con `<canvas>` de tablero (300×600) y `<canvas>` de next-piece (120×120), monta `TetrisEngine` en `useEffect` con `props.initialTheme`, loop `requestAnimationFrame`, listeners de teclado (movimiento gateados por fase jugable, `KeyP` activo en `"playing"` y en pausa), cleanup completo al desmontar, `forwardRef` exponiendo `TetrisGameHandle` (incluye `setTheme`), invoca `onStateChange`/`onGameOver`. Test manual: `npm run build` sin errores (componente aún no montado en ninguna página).
4. Selector de tema en `GamePlayer.tsx`: al montar Tetris, leer `localStorage.getItem("av_tetris_theme")` (default `"retro"`) y pasarlo como `initialTheme`; renderizar en el `player-hud` un selector de 3 opciones (RETRO / NEÓN PASTEL / PIXEL ART) visible solo si `game.id === "tetris"`; al cambiar, llamar `ref.current.setTheme(id)` y escribir el nuevo valor en `localStorage`. Test manual: cambiar de tema en pleno juego actualiza colores/estilo en vivo sin reiniciar la partida (score/tablero intactos); recargar `/juego/tetris/jugar` y volver a jugar arranca con el último tema elegido.
5. Introducir el registry genérico: agregar `hasRealBackend?: boolean` a la interfaz `Game` en `lib/games.ts`, marcar `asteroides` y `tetris` con `hasRealBackend: true`; crear `components/games/registry.ts` con `engineRegistry` mapeando ambos; modificar `GamePlayer.tsx`, `app/juego/[id]/page.tsx`, `app/salon/page.tsx` y `HallOfFame.tsx` para leer del registry/flag en vez de los `if (id === "asteroides")` hardcodeados (ver `references/integration-checklist.md`). Test manual: Asteroides sigue funcionando exactamente igual que antes del refactor (jugar, pausar, guardar puntuación, ver leaderboard en `/juego/asteroides` y `/salon`) — cero regresión.
6. Aplicar la migración de Supabase (`apply_migration`): `insert into games (id, title) values ('tetris', 'TETRIS')`. Test manual: `execute_sql` sobre `games` muestra la fila nueva junto a `asteroides`; `scores` sigue sin filas para `game_id = 'tetris'`.
7. Verificar manualmente los flujos de control de Tetris: mover/rotar/soft drop/hard drop, `KeyP` pausa y reanuda el engine real, ghost piece visible, next-piece preview actualizado en cada spawn, los 3 temas se ven correctamente distintos (paleta y estilo de bloque), FIN fuerza game over con la puntuación actual, torre llena dispara game over automático, JUGAR DE NUEVO reinicia el engine completo (mantiene el tema activo), GUARDAR PUNTUACIÓN inserta una fila real en `scores` (`game_id: "tetris"`) verificable con `execute_sql`. Test manual: recorrer cada flujo en el navegador y confirmar el resultado descrito.
8. Pasada final: `/juego/tetris` y la tab "TETRIS" de `/salon` muestran leaderboard real ordenado de mayor a menor, manejando 0/1/2 scores sin crash; recorrer `/juegos`, `/salon` (las 8 tabs, ahora con `tetris` y `asteroides` reales), `/juego/tetris`, `/juego/tetris/jugar`, `/juego/asteroides`, `/juego/asteroides/jugar` y los 6 juegos restantes en desktop y móvil confirmando cero regresiones. `npm run build` de punta a punta. Test manual: sin errores de consola en ninguna ruta; build exitoso.

## Acceptance criteria

- [ ] `lib/games.ts` tiene la entrada `id: "tetris"` (ya no existe `id: "caida"`) con `title`, `short`, `long` actualizados, `cover: "cover-tetris"` y `hasRealBackend: true`.
- [ ] `app/globals.css` define `.cover-tetris` (renombrada de `.cover-tetro`, mismo diseño visual); `.cover-tetro` ya no existe.
- [ ] `/juegos` muestra la tarjeta "TETRIS" con su cover correcto; click navega a `/juego/tetris`.
- [ ] `/juego/caida` (y `/juego/caida/jugar`) da 404; `/juego/tetris` carga bien.
- [ ] `/juego/tetris/jugar` muestra un `<canvas>` jugable con tablero, pieza actual, ghost piece semitransparente y preview de la próxima pieza en un canvas separado.
- [ ] Flechas izquierda/derecha mueven la pieza, flecha abajo/`ArrowDown` hace soft drop, flecha arriba/`KeyX` rota con wall-kicks, `Space` hace hard drop; ninguna de estas teclas scrollea la página.
- [ ] `KeyP` alterna pausa/reanudación del engine real, igual que el botón PAUSA del `player-hud`.
- [ ] El `player-hud` externo (Jugador/Puntuación/Líneas/Nivel) muestra los mismos valores reales que recibe vía `onStateChange`, actualizados en tiempo real.
- [ ] Limpiar líneas suma puntos según `LINE_SCORES` × nivel; el nivel sube cada 10 líneas y la velocidad de caída aumenta en consecuencia.
- [ ] Cuando una pieza nueva no puede spawnearse (torre llena), el juego pasa a game over automáticamente y abre el modal de fin de partida con la puntuación final — sin necesidad de pulsar FIN.
- [ ] Pulsar PAUSA (botón o `KeyP`) congela el juego real (tablero/pieza dejan de moverse); REANUDAR continúa exactamente donde quedó.
- [ ] Pulsar FIN fuerza game over inmediato y abre el modal con la puntuación actual.
- [ ] Guardar la puntuación en el modal inserta una fila real en la tabla `scores` de Supabase (`game_id: "tetris"`, `player_name`, `score`, `user_id: null`) — verificable con `execute_sql`.
- [ ] JUGAR DE NUEVO reinicia el engine real por completo (tablero vacío, score, líneas, nivel desde cero) sin salir de la pantalla.
- [ ] SALIR navega de vuelta a `/juego/tetris`.
- [ ] El `player-hud` muestra un selector con las 3 opciones (RETRO / NEÓN PASTEL / PIXEL ART), visible solo cuando se juega Tetris.
- [ ] Cambiar de tema durante la partida actualiza en vivo los colores y el estilo de dibujo de los bloques (tablero, pieza actual, ghost piece, next-piece preview) sin reiniciar el juego ni perder el progreso (score/líneas/nivel/tablero intactos).
- [ ] El tema elegido persiste en `localStorage` bajo la clave `av_tetris_theme`; recargar `/juego/tetris/jugar` y volver a jugar arranca con el último tema elegido (o `"retro"` si nunca se eligió uno).
- [ ] Los demás juegos (incluido Asteroides) no muestran el selector de tema.
- [ ] `/juego/tetris` y la tab "TETRIS" de `/salon` muestran el leaderboard real leído de Supabase, ordenado de mayor a menor, con estado vacío sin crash (0, 1 o 2 puntuaciones guardadas).
- [ ] Asteroides sigue funcionando exactamente igual que antes del refactor al registry (jugar, pausar, guardar puntuación real, ver leaderboard) — cero regresión.
- [ ] Los 6 juegos restantes (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen mostrando la simulación visual actual y `seededScores`, sin cambios.
- [ ] `npm run build` compila el proyecto completo sin errores de tipos ni de build.
- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor al navegar `/juegos`, `/salon`, `/juego/tetris`, `/juego/tetris/jugar`, `/juego/asteroides`, `/juego/asteroides/jugar` y los demás `/juego/[id]`.

## Decisions

- **Sí:** renombrar por completo `caida` → `tetris` (id, title, cover, textos) en vez de mantener el id `caida` con contenido de Tetris. Confirmado explícitamente por el usuario — igual patrón que `rocas` → `asteroides` en spec 05, evita el desajuste que ya existía entre `id: "caida"` y `cover: "cover-tetro"`.
- **Sí:** reescribir `short`/`long` para que el texto quede alineado al nombre final `tetris`, en vez de mantener el copy genérico heredado de `caida`.
- **Sí:** mantener `cat: "PUZZLE"` y `color: "magenta"` sin cambios — ya encajan con el juego y no chocan con Asteroides (`yellow`).
- **Sí:** el motor viene de `references/started-games/03-tetris/game.js` (Caso A del skill), portado casi 1:1, no diseñado desde cero.
- **Sí:** el `<canvas>` **no** dibuja overlay propio de PAUSA/GAME OVER ni HUD propio (score/líneas/nivel) — a diferencia de Asteroides (que sí mantiene su HUD interno), el original de Tetris ya tenía ambos en DOM externo, rol que hoy cumple el `player-hud`/modal existentes de `GamePlayer.tsx`. Confirmado explícitamente por el usuario.
- **Sí:** incluir el next-piece preview (mini-canvas separado) en este spec. Es una mecánica jugable real que el jugador usa para planificar, no una decoración — se porta junto con el resto del engine.
- **Sí:** incluir la ghost piece (proyección semitransparente). Trivial de portar (`ghostY()` ya existe en el original) y es una mecánica esperada en cualquier Tetris.
- **Sí:** mantener el atajo de teclado `KeyP` para alternar pausa, además del botón PAUSA del `player-hud`. Fiel al original, sin conflicto — el listener de `KeyP` se mantiene activo en `"playing"` y en pausa, se apaga en `"gameover"`.
- **No:** portar el toggle de tema claro/oscuro del original (`localStorage: "tetris-theme"`, afecta fondo/texto de toda la página). Arcade Vault mantiene su chrome de sitio fijo — distinto del selector de tema de piezas que sí se agrega (ver punto siguiente).
- **Sí:** agregar un selector de 3 temas de piezas (retro/neón pastel/pixel art), específico de Tetris, en vez de generalizarlo al registry o al contrato compartido de `GameHandle`. Confirmado explícitamente por el usuario — ningún otro juego lo necesita hoy, generalizarlo ahora sería anticipar un requisito hipotético.
- **Sí:** cada tema define paleta de colores **y** estilo de dibujo del bloque (`blockStyle`), no solo color. Confirmado explícitamente — así "pixel art" se distingue como estilo real (contorno duro, sin antialiasing) y no queda como un simple recoloreo del mismo render.
- **Sí:** clave de `localStorage` específica de Tetris (`av_tetris_theme`), no genérica compartida entre juegos. Confirmado explícitamente — ningún otro juego tiene temas hoy, evita comprometer una convención prematura.
- **Sí:** el tema `"retro"` reutiliza literal la paleta `COLORS` de `game.js` (la única paleta real que existía en `references/started-games/03-tetris/`); `"neón pastel"` y `"pixel art"` son paletas y estilos de render nuevos, diseñados para este spec al no encontrarse ninguna referencia previa para ellos.
- **Sí:** `TetrisState` reemplaza `lives` por `lines`, y `Phase` omite `"dead"` (queda solo `"playing"`/`"gameover"`) — Tetris no tiene concepto de vidas ni de muerte/reaparición intermedia; el game over ocurre directo cuando una pieza nueva no puede spawnearse. Desviación explícita respecto a la forma de spec 05, documentada aquí como exige el template.
- **Sí:** introducir ahora el refactor a registry genérico (`hasRealBackend` + `components/games/registry.ts`), en vez de hardcodear un tercer `if (id === "tetris")` junto al de Asteroides. Confirmado explícitamente por el usuario — con un segundo juego real es el momento natural de generalizar; evita seguir acumulando literales en los mismos 4 archivos (ver `references/integration-checklist.md`).
- **Sí:** leaderboard real conectado a Supabase desde este mismo spec (no una entrega decorativa primero). Confirmado explícitamente — es el default de este skill y el usuario lo ratificó.
- **No:** controles táctiles, multijugador ni audio en este spec. Confirmado explícitamente — mismo alcance excluido que en spec 05 para Asteroides.

## Risks

| Riesgo                                                                                                                                                                                                     | Mitigación                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El refactor al registry (paso 4) toca 4 archivos que hoy ya funcionan en producción con Asteroides hardcodeado — generalizarlos puede introducir una regresión real en un juego que ya funciona.           | El paso 4 del plan exige verificar explícitamente que Asteroides sigue funcionando idéntico (jugar, pausar, guardar, leaderboard) antes de continuar con Tetris; es un checkpoint aislado, no se combina con el trabajo de Tetris en el mismo paso. |
| El acumulador `dropAccum` (ms) puede sumar un `dt` muy grande de golpe si la pestaña pierde foco y `requestAnimationFrame` se pausa, provocando que varias piezas se fijen en un solo frame al volver.     | Aplicar el mismo clamp de `dt` que ya usa `AsteroidsGame.tsx` (tope de ~50ms) antes de sumarlo a `dropAccum`, igual que exige el patrón de spec 05 para el timing continuo.                                                                         |
| `KeyP` es un atajo de teclado global — si por un bug el listener sigue activo durante `"gameover"`, podría interferir con el `<input>` de iniciales del modal de fin de partida.                           | El listener de `KeyP` se desactiva explícitamente cuando `phase === "gameover"`, igual criterio que el resto de los controles de movimiento (ver Decisions).                                                                                        |
| Si se prueba el guardado de puntuación de Tetris antes de aplicar la migración (paso 6), el `insert` en `scores` falla por la FK `scores_game_id_fkey` (no existe la fila `tetris` en `games` todavía).    | Orden fijo del plan: la migración de Supabase (paso 6) va antes de la verificación end-to-end (paso 7) — comportamiento esperado, no un bug a mitigar en código.                                                                                    |
| Cambiar de tema en pleno juego podría causar un parpadeo o un frame a medio aplicar si `draw()` no lee el theme de forma consistente.                                                                      | `setTheme()` solo reemplaza la referencia a `TetrisTheme` activa en el engine; `draw()` la lee completa en cada frame, sin estado intermedio — el cambio se refleja entero desde el próximo frame.                                                  |
| El modo "pixel art" desactiva `ctx.imageSmoothingEnabled` en ambos canvas (tablero y next-piece) — si algo reactivara el smoothing por defecto sin pasar por `setTheme()`, el estilo pixelado se perdería. | `setTheme()` reaplica `imageSmoothingEnabled` según el `blockStyle` activo cada vez que se llama, no solo en el mount inicial.                                                                                                                      |
