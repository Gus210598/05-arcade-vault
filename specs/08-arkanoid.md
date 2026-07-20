# SPEC 08 — Arkanoid (leaderboard real)

> **Status:** Implementado
> **Depends on:** 05-asteroides (patrón de engine portado), 06-leaderboard-asteroides (tabla `scores` compartida), 07-tetris (registry genérico)
> **Date:** 2026-07-20
> **Objective:** Portar Arkanoid desde `references/started-games/04-arkanoid/game.js` a un componente canvas real (`components/games/arkanoid/`) con spritesheet y audio reales, 5 niveles fijos, controles de teclado + mouse (incluido el menú de salto de nivel en pausa), integrarlo en `/juego/arkanoid/jugar`, registrarlo en `components/games/registry.ts`, y conectar su leaderboard a la tabla `scores` compartida de Supabase.

## Scope

**In:**

- Renombrar la entrada existente en `lib/games.ts`: `id: "bloque-buster"` → `"arkanoid"`, `title: "BLOQUE BUSTER"` → `"ARKANOID"`, `cover: "cover-bricks"` → `"cover-arkanoid"`, reescribiendo `short`/`long`. `cat: "ARCADE"` y `color: "cyan"` se mantienen igual. Se agrega `hasRealBackend: true`.
- Renombrar la clase CSS `.cover-bricks` → `.cover-arkanoid` en `app/globals.css` (mismo diseño visual, solo cambia el selector).
- `components/games/arkanoid/engine.ts`: clase `ArkanoidEngine` portada de `game.js` — paddle, ball, `blocks[]`, `explosions[]`, `lives` (3), `score`, `currentLevel`, fase de juego, colisiones AABB paleta/muros/bloques, sistema de explosiones por bloque roto — con el contrato de spec 05 (`update`, `draw`, `handleKeyDown/Up`, `pause`, `resume`, `forceGameOver`, `restart`, `destroy`, notificación con dedupe). Incluye `LEVELS` portado literal de `levels.js` (5 niveles fijos, cada uno con su patrón de bloques y `ballSpeedMultiplier`).
- `components/games/arkanoid/assets/`: copia de `spritesheet-breakout.png`, `spritesheet.js` (helpers `loadSpritesheet`/`drawSprite`/`drawFrame`) y `sounds/ball-bounce.mp3` + `sounds/break-sound.mp3`, cargados por el engine antes de arrancar el loop (mismo patrón `loadSpritesheet(cb)` del original).
- `components/games/arkanoid/ArkanoidGame.tsx`: wrapper `forwardRef` con `<canvas>` 800×600, loop `requestAnimationFrame` con `dt` clamp, listeners de teclado (`ArrowLeft`/`ArrowRight` para mover la paleta, `P`/`Escape` para pausar) **y** de mouse sobre el canvas (`mousemove` mueve la paleta, `click` en pausa salta al nivel elegido vía el menú de 5 botones dibujado en el overlay de pausa — portado literal del original), cleanup completo al desmontar.
- El canvas mantiene su propio HUD interno (score/nivel/vidas dibujados con `ctx.fillText`, overlays de pausa/game over/victoria) — no se borra, coexiste con el `player-hud` externo vía `onStateChange`, igual criterio que Asteroides.
- Completar el nivel 5 (`gameState: 'win'`) dispara el mismo flujo de fin de partida que perder las 3 vidas (`onGameOver`) — abre el modal existente y permite guardar la puntuación real; el HUD interno distingue el mensaje ("GAME OVER" vs "¡COMPLETASTE EL JUEGO!").
- Registrar `arkanoid` en `components/games/registry.ts` (import dinámico de `ArkanoidGame`) — ver Implementation plan (paso 5) y Decisions para el alcance exacto de este punto.
- Migración de Supabase (`apply_migration`): `insert into games (id, title) values ('arkanoid', 'ARKANOID')`. La tabla `scores` no cambia — ya es compartida.
- El spritesheet se usa fiel al original, sin recolorear a la paleta neón del sitio (incluye bloques `red`/`hotpink`/`gray` que no forman parte del acento cyan/magenta/yellow/green) — excepción documentada, igual que el resto de assets binarios no puede resolver variables CSS.

**Out of scope (para specs futuros):**

- Los demás 5 juegos restantes (Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen con la simulación visual actual, sin tocar.
- Controles táctiles / jugabilidad en móvil.
- Mecánicas nuevas no presentes en `game.js` (power-ups, jefes, niveles adicionales, multijugador).
- Auth real de Supabase (`user_id` sigue `null` en los inserts).
- Cualquier medida anti-cheat o validación server-side del score insertado (mismo riesgo aceptado que en spec 06/07) — incluido el hecho de que el menú de salto de nivel en pausa permite llegar a niveles avanzados sin jugar los previos.
- Recolorear o rediseñar el spritesheet — se porta tal cual viene el PNG.

## Data model

```ts
// components/games/arkanoid/engine.ts
export type Phase = "playing" | "gameover";

export interface ArkanoidState {
  score: number;
  lives: number;
  level: number; // 1-5, currentLevel del original
  phase: Phase;
  won: boolean; // true si el gameover llegó por completar el nivel 5, no por perder las 3 vidas
}

// LEVELS (portado literal de levels.js): 5 entradas { blocks: {col,row,color}[], ballSpeedMultiplier }.
// Estado interno no exportado: paddle, ball, blocks[], explosions[], isPaused — mismo shape que el original.

export class ArkanoidEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    onStateChange: (state: ArkanoidState) => void,
  );
  load(): Promise<void>; // carga spritesheet + audio (loadSpritesheet real), se espera antes de arrancar el loop
  update(dt: number): void;
  draw(): void;
  handleKeyDown(code: string): void;
  handleKeyUp(code: string): void;
  handleMouseMove(canvasX: number, canvasY: number): void; // mueve la paleta, portado de mousemove
  handleClick(canvasX: number, canvasY: number): void; // salto de nivel en pausa, portado del click original
  pause(): void;
  resume(): void;
  forceGameOver(): void; // usado por el botón FIN
  restart(): void; // usado por "JUGAR DE NUEVO"
  destroy(): void; // cleanup de listeners/rAF/audio al desmontar
}
```

```tsx
// components/games/arkanoid/ArkanoidGame.tsx
export interface ArkanoidGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface ArkanoidGameProps {
  onStateChange: (state: ArkanoidState) => void;
  onGameOver: (finalScore: number) => void; // se dispara igual en derrota (lives=0) que en victoria (nivel 5 completo)
}

// forwardRef<ArkanoidGameHandle, ArkanoidGameProps> — monta <canvas>, llama engine.load() en
// useEffect antes de iniciar el rAF loop (muestra "CARGANDO..." mientras tanto), gestiona
// listeners de teclado y mouse sobre el canvas (coordenadas escaladas igual que el original),
// expone el ref imperativo. Mismo contrato externo que AsteroidsGame.tsx/TetrisGame.tsx.
const ArkanoidGame = forwardRef<ArkanoidGameHandle, ArkanoidGameProps>(...);
export default ArkanoidGame;
```

```ts
// components/games/registry.ts — una línea nueva, el resto no cambia
arkanoid: dynamic(() => import("@/components/games/arkanoid/ArkanoidGame")),
```

```ts
// lib/games.ts — entrada "arkanoid" gana hasRealBackend: true (campo ya existe en la interfaz Game)
```

Convenciones:

- `ArkanoidState` no tiene `"dead"` como `Phase` (a diferencia de Asteroids) — el original no tiene invencibilidad parpadeante al perder una bola, solo decrementa `lives` y llama `initBall()` de inmediato (ver Decisions para el porqué de la desviación).
- `won` es un campo aparte de `Phase`, no un tercer valor de `phase` — `won` solo se usa para el texto del HUD interno del canvas (ver Decisions).
- `load()` resuelve cuando `loadSpritesheet()` invoca su callback; `ArkanoidGame.tsx` espera esta promesa antes de arrancar `requestAnimationFrame`, mostrando un estado de carga simple (texto "CARGANDO..." centrado) mientras tanto (ver Decisions para por qué este método es nuevo respecto al contrato de spec 05).
- `handleMouseMove`/`handleClick` reciben coordenadas ya convertidas a espacio del canvas (800×600 interno) — la conversión `clientX/clientY → canvas space` vive en `ArkanoidGame.tsx` (mismo cálculo `scaleX`/`scaleY` que el original), el engine nunca toca `getBoundingClientRect()`.
- Los sonidos (`bounceSound`/`breakSound`) viven como instancias `Audio` dentro del engine, reproducidas con `.cloneNode().play()` igual que el original — sin volumen/mute configurable en este spec.
- `onStateChange` hace dedupe — solo se llama cuando `score`/`lives`/`level`/`phase`/`won` cambió, mismo criterio que Asteroids/Tetris.

## Implementation plan

1. Renombrar en `lib/games.ts` la entrada `id: "bloque-buster"` → `"arkanoid"` (`title`, `short`, `long`, `cover: "cover-arkanoid"`, `hasRealBackend: true`; `cat`/`color` sin cambios) y renombrar la clase CSS `.cover-bricks` → `.cover-arkanoid` (con `::before`/`::after`) en `app/globals.css`. Test manual: `/juegos` muestra la tarjeta "ARKANOID" con el cover correcto; `/juego/arkanoid` carga; `/juego/bloque-buster` da 404.
2. Copiar los assets fuente a `components/games/arkanoid/assets/`: `spritesheet-breakout.png`, `spritesheet.js` (helpers `loadSpritesheet`/`drawSprite`/`drawFrame`/`EXPLOSION_FRAMES`/`EXPLOSION_DURATION`/`SPRITES`) y `sounds/ball-bounce.mp3` + `sounds/break-sound.mp3`. Test manual: los archivos existen en la ruta nueva, sin referenciarse aún desde ningún módulo TS.
3. Crear `components/games/arkanoid/engine.ts`: portar de `game.js`/`levels.js` el estado (`paddle`, `ball`, `blocks[]`, `explosions[]`, `lives`, `score`, `currentLevel`, `isPaused`), `LEVELS` (5 niveles literal), y las funciones (`initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update`, `draw`, `drawOverlay`, `drawPauseOverlay`) dentro de la clase `ArkanoidEngine` (constructor, `load`, `update`, `draw`, `handleKeyDown/Up`, `handleMouseMove`, `handleClick`, `pause`, `resume`, `forceGameOver`, `restart`, `destroy`), reutilizando `spritesheet.js` para `drawSprite`/`drawFrame` y `Audio` para los 2 sonidos. Test manual: `npm run build` compila sin errores de tipos (módulo aún no usado en ninguna ruta).
4. Crear `components/games/arkanoid/ArkanoidGame.tsx`: client component con `<canvas>` de 800×600, `await engine.load()` en `useEffect` antes de arrancar el loop `requestAnimationFrame` (con `dt` capado a 50ms) mostrando estado de carga mientras tanto, listeners de teclado (`ArrowLeft`/`ArrowRight`/`P`/`Escape`) y de mouse sobre el canvas (`mousemove`/`click`, con conversión de coordenadas a espacio 800×600), cleanup completo al desmontar, `forwardRef` exponiendo `ArkanoidGameHandle`, invoca `onStateChange`/`onGameOver`. Test manual: `npm run build` sin errores (componente aún no montado en ninguna página).
5. Registrar `arkanoid` en `components/games/registry.ts` (`dynamic(() => import("@/components/games/arkanoid/ArkanoidGame"))`) — el registry y `hasRealBackend` ya existen desde spec 07, este paso solo añade la entrada; no se toca `GamePlayer.tsx`, `app/juego/[id]/page.tsx`, `app/salon/page.tsx` ni `HallOfFame.tsx`. Test manual: `/juego/arkanoid/jugar` monta el canvas real (con spritesheet cargado) en vez del placeholder decorativo; Asteroides y Tetris siguen funcionando exactamente igual (cero regresión).
6. Aplicar la migración de Supabase (`apply_migration`): `insert into games (id, title) values ('arkanoid', 'ARKANOID')`. Test manual: `execute_sql` sobre `games` muestra la fila nueva junto a `asteroides`/`tetris`; `scores` sigue sin filas para `game_id = 'arkanoid'`.
7. Verificar manualmente los flujos de control: flechas mueven la paleta y `mousemove` también; `P`/`Escape` pausan y muestran el overlay con el menú de 5 niveles, click en un botón salta a ese nivel y despausa; PAUSA/REANUDAR del `player-hud` congelan/continúan el engine real; FIN fuerza game over con la puntuación actual; perder las 3 vidas dispara game over automático; completar el nivel 5 dispara el mismo modal con `won: true` reflejado en el HUD interno ("¡COMPLETASTE EL JUEGO!"); GUARDAR PUNTUACIÓN inserta una fila real en `scores` (`game_id: "arkanoid"`) verificable con `execute_sql`; JUGAR DE NUEVO reinicia el engine completo (nivel 1, score, vidas); rebote y rotura de bloque reproducen sonido. Test manual: recorrer cada flujo en el navegador.
8. Pasada final: `/juego/arkanoid` y la tab "ARKANOID" de `/salon` muestran leaderboard real ordenado de mayor a menor, con estado vacío sin crash (0/1/2 scores); recorrer `/juegos`, `/salon` (todas las tabs, ahora con arkanoid/asteroides/tetris reales), `/juego/arkanoid`, `/juego/arkanoid/jugar`, y los demás juegos en desktop y móvil confirmando cero regresiones. `npm run build` de punta a punta. Test manual: sin errores de consola en ninguna ruta; build exitoso.

## Acceptance criteria

- [ ] `lib/games.ts` tiene la entrada `id: "arkanoid"` (ya no existe `id: "bloque-buster"`) con `title`, `short`, `long` actualizados, `cover: "cover-arkanoid"` y `hasRealBackend: true`.
- [ ] `app/globals.css` define `.cover-arkanoid` (renombrada de `.cover-bricks`, mismo diseño visual); `.cover-bricks` ya no existe.
- [ ] `/juegos` muestra la tarjeta "ARKANOID" con su cover correcto; click navega a `/juego/arkanoid`.
- [ ] `/juego/bloque-buster` (y `/juego/bloque-buster/jugar`) da 404; `/juego/arkanoid` carga bien.
- [ ] `/juego/arkanoid/jugar` muestra un `<canvas>` jugable con el spritesheet real (paleta, bola, bloques con sus colores originales) tras el estado de carga inicial.
- [ ] Flechas izquierda/derecha mueven la paleta; mover el mouse sobre el canvas también mueve la paleta; ninguna tecla usada scrollea la página.
- [ ] `P`/`Escape` pausan el juego real y muestran el overlay con el menú de 5 niveles; hacer click en un botón de nivel salta a ese nivel y despausa.
- [ ] El `player-hud` externo (Jugador/Puntuación/Vidas/Nivel) muestra los mismos valores reales que el HUD interno del canvas, actualizados en tiempo real.
- [ ] Romper un bloque suma 10 puntos, lo elimina, dispara su animación de explosión (4 frames del spritesheet) y reproduce el sonido de rotura.
- [ ] Rebotar la bola contra paredes/paleta reproduce el sonido de rebote.
- [ ] Completar todos los bloques de un nivel (1-4) avanza automáticamente al siguiente, reflejado en ambos HUD.
- [ ] Completar el nivel 5 dispara game over con `won: true` (mensaje "¡COMPLETASTE EL JUEGO!" en el HUD interno) y abre el modal de fin de partida con la puntuación final.
- [ ] Perder las 3 vidas dispara game over automático (mensaje "GAME OVER") sin necesidad de pulsar FIN.
- [ ] Pulsar PAUSA (botón del `player-hud`) congela el juego real; REANUDAR continúa exactamente donde quedó.
- [ ] Pulsar FIN fuerza game over inmediato y abre el modal con la puntuación actual.
- [ ] Guardar la puntuación en el modal inserta una fila real en la tabla `scores` de Supabase (`game_id: "arkanoid"`, `player_name`, `score`, `user_id: null`) — verificable con `execute_sql`.
- [ ] JUGAR DE NUEVO reinicia el engine real por completo (nivel 1, score, vidas, tablero de bloques) sin salir de la pantalla.
- [ ] SALIR navega de vuelta a `/juego/arkanoid`.
- [ ] `/juego/arkanoid` y la tab "ARKANOID" de `/salon` muestran el leaderboard real leído de Supabase, ordenado de mayor a menor, con estado vacío sin crash (0, 1 o 2 scores).
- [ ] Asteroides y Tetris siguen funcionando exactamente igual que antes de este spec (jugar, pausar, guardar, leaderboard) — cero regresión tras añadir la entrada al registry.
- [ ] Los demás 5 juegos (`serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen mostrando la simulación visual actual y `seededScores`, sin cambios.
- [ ] `npm run build` compila el proyecto completo sin errores de tipos ni de build.
- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor al navegar `/juegos`, `/salon`, `/juego/arkanoid`, `/juego/arkanoid/jugar` y los demás `/juego/[id]`.

## Decisions

- **Sí:** renombrar por completo `bloque-buster` → `arkanoid` (id, title, cover, textos) en vez de dejar una entrada nueva separada. Confirmado explícitamente — mismo patrón que `rocas→asteroides` (spec 05) y `caida→tetris` (spec 07).
- **Sí:** mantener `cat: "ARCADE"` y `color: "cyan"` sin cambios — ya encajan y `cyan` queda libre entre los juegos reales (Asteroides usa `yellow`, Tetris `magenta`).
- **Sí:** portar controles completos del original — teclado, mouse para mover la paleta, y el menú de salto de nivel por click en pausa. Confirmado explícitamente por el usuario, a diferencia del criterio "solo teclado" de Asteroides/Tetris — Arkanoid es el primer juego de este skill cuyo original depende del mouse de forma central (no accesoria).
- **No:** simplificar a solo teclado. Se descartó porque el mouse es parte central de cómo se juega Arkanoid en el original (no un extra opcional como sería en Asteroides).
- **Sí:** portar el spritesheet real (`spritesheet-breakout.png` + `spritesheet.js`) y los 2 sonidos (`ball-bounce.mp3`, `break-sound.mp3`), en vez de reemplazar por primitivas de canvas reskineadas en neón. Confirmado explícitamente — primer juego del sitio con audio real; se acepta como excepción a la convención previa ("el original tampoco tiene audio") porque el original de Arkanoid sí lo tiene.
- **No:** recolorear el spritesheet a la paleta de acento del sitio (`cyan`/`magenta`/`yellow`/`green`). Confirmado explícitamente — el PNG se usa tal cual, incluidos los colores de bloque (`red`/`hotpink`/`gray`) que no pertenecen al acento del sitio; editar el asset queda fuera de alcance.
- **Sí:** completar el nivel 5 (`won: true`) dispara el mismo flujo `onGameOver`/modal/guardado que perder las 3 vidas, en vez de una pantalla de victoria separada sin guardado. Confirmado explícitamente — mantiene un único camino de guardado de puntuación, más simple que dos flujos distintos.
- **Sí:** `won` es un campo booleano aparte de `Phase` (`Phase` queda en solo `"playing"`/`"gameover"`, sin un tercer valor `"win"`), para que el contrato de 2 fases sea consistente con Tetris y el modal de `GamePlayer.tsx` no necesite lógica nueva — `won` solo afecta el texto del HUD interno del canvas.
- **Sí:** `Phase` de Arkanoid **no incluye** `"dead"` (a diferencia de Asteroids) — el original no tiene invencibilidad parpadeante al perder una bola, solo decrementa `lives` y reinicia la bola de inmediato. Desviación explícita respecto a spec 05, documentada aquí como exige el template.
- **Sí:** agregar `load(): Promise<void>` al contrato del engine — método nuevo que no existía en Asteroids/Tetris, necesario porque Arkanoid es el primer juego con carga asíncrona de assets externos (eje 5 de la guía de porteo). `ArkanoidGame.tsx` espera esta promesa antes de arrancar el loop, mostrando un estado de carga simple mientras tanto.
- **Sí:** leaderboard real conectado a Supabase desde este mismo spec. Confirmado explícitamente — es el default de este skill.
- **No:** repetir el refactor a registry genérico. El registry (`hasRealBackend` + `components/games/registry.ts`) ya existe desde spec 07 — este spec solo añade la entrada de `arkanoid`, sin tocar `GamePlayer.tsx`, `app/juego/[id]/page.tsx`, `app/salon/page.tsx` ni `HallOfFame.tsx`.
- **No:** controles táctiles, power-ups, jefes ni multijugador en este spec. Confirmado explícitamente — mismo criterio de alcance acotado que specs 05/07.

## Risks

| Riesgo                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los navegadores pueden bloquear `Audio.play()` si no hay interacción previa del usuario (política de autoplay), causando que el primer rebote/rotura no suene.                                         | Aceptado como comportamiento estándar del navegador — el usuario ya interactuó (pulsó JUGAR) antes de que el loop arranque, lo que suele satisfacer la política de autoplay en la mayoría de navegadores; no se agrega manejo especial en este spec.  |
| La carga del spritesheet (`loadSpritesheet`) es asíncrona — si tarda o falla, el canvas puede quedar en blanco o mostrar el estado de carga indefinidamente.                                           | `ArkanoidGame.tsx` muestra un estado de carga explícito mientras `engine.load()` no resuelve; el caso de fallo de red queda como limitación conocida (mismo criterio que el original, que no maneja `rawImg.onerror` más allá de un `console.error`). |
| El menú de salto de nivel en pausa permite llegar al nivel 5 (mayor velocidad, más bloques rotos = más puntos) sin jugar los niveles previos, lo que puede inflar puntuaciones en el leaderboard real. | Aceptado como riesgo conocido — es comportamiento fiel al original y fue confirmado explícitamente por el usuario; mismo criterio que el riesgo ya aceptado de INSERT público sin anti-cheat (spec 06).                                               |
| Los listeners de mouse (`mousemove`/`click`) sobre el canvas, sumados a los de teclado, pueden quedar activos si el componente no limpia correctamente al desmontar.                                   | Cleanup explícito de ambos tipos de listener en el `return` del `useEffect` de `ArkanoidGame.tsx`, mismo patrón que `AsteroidsGame.tsx`/`TetrisGame.tsx`; verificar manualmente navegando fuera de `/juego/arkanoid/jugar` durante una partida.       |
| La política de `INSERT` público en `scores` (heredada de spec 06) permite puntuaciones falsas o spam sin límite de tasa.                                                                               | Mismo riesgo ya aceptado y documentado en specs 06/07 — no se introduce superficie nueva.                                                                                                                                                             |
| Con la tabla `scores` vacía para `"arkanoid"` (estado inicial tras el deploy), el podio de `/salon` y `/juego/arkanoid` puede crashear si el código accede a índices fuera de rango.                   | Mismo patrón ya mitigado por el código existente de `HallOfFame.tsx`/`app/juego/[id]/page.tsx` desde spec 06 — se verifica manualmente en el paso final del plan.                                                                                     |
