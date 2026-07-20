# SPEC 09 — Snake (leaderboard real)

> **Status:** Implementado
> **Depends on:** 05-asteroides (patrón de engine portado), 06-leaderboard-asteroides (tabla `scores` compartida), 07-tetris (registry genérico)
> **Date:** 2026-07-20
> **Objective:** Implementar el juego de Snake tradicional como componente canvas real (`components/games/snake/`), usando primitivas de canvas reskineadas en la paleta neón del sitio para la serpiente y los sprites reales de fruta del atlas provisto (`references/source-assets/snake-assets/`), integrarlo en `/juego/snake/jugar`, registrarlo en `components/games/registry.ts`, y conectar su leaderboard a la tabla `scores` compartida de Supabase.

## Scope

**In:**

- Renombrar la entrada existente en `lib/games.ts`: `id: "serpentina"` → `"snake"`, `title: "SERPENTINA"` → `"SNAKE"`, reescribiendo `short`/`long` para reflejar la mecánica real (grid, frutas reales del atlas, sin "núcleos magenta" ficticios). `cat: "ARCADE"`, `color: "green"` y `cover: "cover-snake"` se mantienen sin cambios — la clase CSS ya se llama `.cover-snake`, no requiere renombrarse en `app/globals.css`. Se agrega `hasRealBackend: true`.
- `components/games/snake/assets/spriteAtlas.ts`: puerto a TypeScript del atlas de `references/source-assets/snake-assets/sprites.js` (actualmente un global `window.SPRITE_ATLAS`) como constante tipada exportada, más la copia de `fruits.png` a esa misma carpeta de assets. Solo se porta el bloque `fruits` (22 entradas) — es lo único que existe en el atlas fuente.
- `components/games/snake/engine.ts`: clase `SnakeEngine` diseñada desde cero (no hay `game.js` de origen para Snake en `references/started-games/`) con el contrato de spec 05 (`update`, `draw`, `handleKeyDown`, `pause`, `resume`, `forceGameOver`, `restart`, `destroy`, notificación con dedupe): grid de 20×20 celdas (celda de 30px, canvas interno 600×600), serpiente como array de segmentos de grid, cola de dirección para evitar giros de 180°, movimiento por acumulador de intervalo (mismo patrón de timing que Tetris, no `dt` continuo), fruta en celda aleatoria libre dibujada con un sprite aleatorio del atlas de frutas, cuerpo/cabeza dibujados con primitivas de canvas (rectángulos) reskineadas en la paleta neón del sitio (verde principal, con acentos cyan/magenta/yellow), colisión con borde o con la propia cola = game over inmediato (sin vidas ni invencibilidad), +10 puntos fijos por fruta (mismo valor sin importar el sprite elegido), el intervalo de movimiento baja 5% cada 5 frutas comidas (con un piso mínimo de intervalo para que no se vuelva injugable), serpiente inicial de 3 segmentos moviéndose hacia la derecha.
- `components/games/snake/SnakeGame.tsx`: wrapper `forwardRef` con `<canvas>` 600×600, carga el atlas de sprites antes de arrancar el loop (mismo patrón `load()` async que Arkanoid, ya que depende de `fruits.png`), loop `requestAnimationFrame`, listeners de teclado (flechas para dirección, activos solo en fase jugable; `P`/`Escape` para pausar, mismo criterio que Tetris/Arkanoid), cleanup completo al desmontar.
- El canvas mantiene su propio HUD interno (score/longitud dibujados con `ctx.fillText`, overlay de pausa/game over) — no se borra, coexiste con el `player-hud` externo vía `onStateChange`, igual criterio que los 3 juegos reales anteriores.
- `components/GamePlayer.tsx`: añadir la rama `isSnake` siguiendo el mismo patrón ya usado para `isTetris`/`isArkanoid` — nuevo `useState<SnakeState>`, nuevo `useRef<SnakeGameHandle>`, entrada en el ternario de `GameComponent`/`onStateChange`/`displayScore`/`displayLevel`, rama en `endGame`/`restart`/`togglePause`, atajo de teclado `P`/`Escape` (reutilizando el `useEffect` ya compartido por Tetris/Arkanoid), y el slot HUD "Vidas" reemplazado por "Longitud" (`snakeState.length`) cuando `isSnake`, mismo criterio que el slot "Líneas" de Tetris.
- Registrar `snake` en `components/games/registry.ts` (import dinámico de `SnakeGame`).
- Migración de Supabase (`apply_migration`): `insert into games (id, title) values ('snake', 'SNAKE')`. La tabla `scores` no cambia — ya es compartida.

**Out of scope (para specs futuros):**

- Los demás 4 juegos restantes (Glotón, Invasores, Ranaria, Duelo Pixel) — siguen con la simulación visual actual, sin tocar.
- Controles táctiles / swipe en móvil.
- Audio/efectos de sonido (no se proveyeron assets de audio para Snake).
- Wrap-around en los bordes, sistema de vidas múltiples, o puntajes distintos por tipo de fruta — decisiones explícitas de esta ronda de preguntas, documentadas también en Decisions.
- Auth real de Supabase (`user_id` sigue `null` en los inserts).
- Cualquier medida anti-cheat o validación server-side del score insertado (mismo riesgo aceptado que en specs 06/07/08).
- Refactor adicional para hacer `GamePlayer.tsx` completamente genérico (eliminar los `isX` hardcodeados de una vez por todas) — fuera de alcance de este spec, que sigue el patrón ya establecido por Tetris/Arkanoid en vez de generalizar el reproductor.

## Data model

```ts
// components/games/snake/assets/spriteAtlas.ts
export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_ATLAS: Record<string, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  // ...resto de las 22 entradas, portadas literal de sprites.js (fuente: fruits.png, 3790x442px)
};

export const FRUIT_KEYS = Object.keys(FRUIT_ATLAS);
export const FRUITS_IMAGE_SRC = "/games/snake/fruits.png"; // servido desde public/, ver Decisions
```

```ts
// components/games/snake/engine.ts
export type Phase = "playing" | "gameover";

export interface SnakeState {
  score: number;
  length: number; // segmentos actuales de la serpiente (reemplaza "lives" en el HUD)
  level: number; // 1 + floor(fruitsEaten / 5) — tier de velocidad actual
  phase: Phase;
}

// Estado interno no exportado: segments: {x,y}[] (coords de grid), direction/nextDirection,
// food: { cell: {x,y}, fruitKey: string }, moveIntervalMs, moveAccumMs, fruitsEaten — grid fijo 20x20, celda 30px.

export class SnakeEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    onStateChange: (state: SnakeState) => void,
  );
  load(): Promise<void>; // carga fruits.png antes de arrancar el loop, mismo contrato que Arkanoid
  update(dt: number): void;
  draw(): void;
  handleKeyDown(code: string): void; // ArrowUp/Down/Left/Right cambian nextDirection, ignora giro de 180°
  pause(): void;
  resume(): void;
  forceGameOver(): void; // usado por el botón FIN
  restart(): void; // usado por "JUGAR DE NUEVO"
  destroy(): void; // cleanup de listeners/rAF al desmontar
}
```

```tsx
// components/games/snake/SnakeGame.tsx
export interface SnakeGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface SnakeGameProps {
  onStateChange: (state: SnakeState) => void;
  onGameOver: (finalScore: number) => void;
}

// forwardRef<SnakeGameHandle, SnakeGameProps> — monta <canvas> 600x600, llama engine.load()
// en useEffect antes de iniciar el rAF loop (muestra "CARGANDO..." mientras tanto),
// gestiona listeners de teclado, expone el ref imperativo. Mismo contrato externo
// que AsteroidsGame.tsx/TetrisGame.tsx/ArkanoidGame.tsx.
const SnakeGame = forwardRef<SnakeGameHandle, SnakeGameProps>(...);
export default SnakeGame;
```

```ts
// components/games/registry.ts — una línea nueva, el resto no cambia
snake: dynamic(() => import("@/components/games/snake/SnakeGame")),
```

```ts
// lib/games.ts — entrada "snake" gana hasRealBackend: true (campo ya existe en la interfaz Game)
```

Convenciones:

- `SnakeState` no tiene `lives` (a diferencia de Asteroids/Arkanoid) — Snake es de una sola vida, `phase` pasa directo de `"playing"` a `"gameover"` sin un estado `"dead"` intermedio, mismo criterio de desviación documentado que Arkanoid respecto a Asteroids.
- `handleKeyDown` no necesita `handleKeyUp` — el input de Snake es discreto (cambia `nextDirection` una vez por tecla), no mantenido, mismo eje de clasificación que usó Tetris según la guía de porteo.
- `load()` resuelve cuando `fruits.png` termina de cargar (`Image.onload`); `SnakeGame.tsx` espera esta promesa antes de arrancar `requestAnimationFrame`, mismo patrón que `ArkanoidGame.tsx`.
- `onStateChange` hace dedupe — solo se llama cuando `score`/`length`/`level`/`phase` cambió, mismo criterio que los 3 engines anteriores.
- `level` se deriva de `fruitsEaten`, no es un campo independiente que el jugador controle — sirve tanto para el HUD como para calcular `moveIntervalMs` en cada tick.

## Implementation plan

1. Renombrar en `lib/games.ts` la entrada `id: "serpentina"` → `"snake"` (`title`, `short`, `long`, `hasRealBackend: true`; `cat`/`color`/`cover` sin cambios). Test manual: `/juegos` muestra la tarjeta "SNAKE" con el cover correcto; `/juego/snake` carga bien; `/juego/serpentina` da 404.
2. Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`, y portar `sprites.js` (bloque `fruits`, 22 entradas) a `components/games/snake/assets/spriteAtlas.ts` como constante tipada `FRUIT_ATLAS` + `FRUIT_KEYS` + `FRUITS_IMAGE_SRC`. Test manual: `npm run build` compila sin errores de tipos (módulo aún no usado en ninguna ruta).
3. Crear `components/games/snake/engine.ts`: clase `SnakeEngine` con grid 20×20 (celda 30px, canvas 600×600), `load()` que carga `fruits.png`, movimiento por acumulador de intervalo, cola de dirección con bloqueo de giro de 180°, spawn de fruta en celda libre aleatoria con sprite aleatorio de `FRUIT_ATLAS`, colisión con borde/cola → `gameover` inmediato, +10 puntos por fruta, `moveIntervalMs` -5% cada 5 frutas comidas (con piso mínimo), serpiente inicial de 3 segmentos hacia la derecha, paleta neón para cuerpo/cabeza. Test manual: `npm run build` compila sin errores de tipos (módulo aún no usado en ninguna ruta).
4. Crear `components/games/snake/SnakeGame.tsx`: client component con `<canvas>` 600×600, `await engine.load()` en `useEffect` antes de arrancar el loop `requestAnimationFrame` (con estado de carga "CARGANDO..." mientras tanto), listeners de teclado (flechas, activos solo en fase `playing`; `P`/`Escape` delegado a través de `onPauseChange`-style callback si aplica, ver paso 5), cleanup completo al desmontar, `forwardRef` exponiendo `SnakeGameHandle`, invoca `onStateChange`/`onGameOver`. Test manual: `npm run build` sin errores (componente aún no montado en ninguna página).
5. Modificar `components/GamePlayer.tsx`: agregar `isSnake`, `useState<SnakeState>`, `useRef<SnakeGameHandle>`; extender los ternarios de `GameComponent`/`onStateChange`/`displayScore`/`displayLevel`; agregar rama `isSnake` en `endGame`/`restart`/`togglePause`; sumar `isSnake` al `useEffect` de atajo `P`/`Escape` ya compartido por Tetris/Arkanoid; reemplazar el slot HUD "Vidas" por "Longitud" (`snakeState.length`) cuando `isSnake`, mismo patrón que el slot "Líneas" de Tetris. Test manual: `/juego/snake/jugar` muestra el canvas jugable tras "CARGANDO..."; flechas mueven la serpiente sin scrollear la página; `P`/`Escape` pausan; el HUD externo muestra "Longitud" en vez de "Vidas"; Asteroides/Tetris/Arkanoid siguen funcionando exactamente igual (cero regresión).
6. Registrar `snake` en `components/games/registry.ts` (`dynamic(() => import("@/components/games/snake/SnakeGame"))`). Test manual: el import dinámico resuelve sin error; los demás 3 juegos reales siguen cargando bien.
7. Aplicar la migración de Supabase (`apply_migration`): `insert into games (id, title) values ('snake', 'SNAKE')`. Test manual: `execute_sql` sobre `games` muestra la fila nueva junto a `asteroides`/`tetris`/`arkanoid`; `scores` sigue sin filas para `game_id = 'snake'`.
8. Verificar manualmente los flujos de control: flechas cambian dirección sin permitir giro de 180°; comer una fruta suma 10 puntos, alarga la serpiente en 1 segmento y hace aparecer una fruta nueva en una celda libre con sprite distinto; cada 5 frutas el juego se siente más rápido y "Nivel" sube en el HUD; chocar contra el borde o contra la propia cola dispara game over inmediato sin pulsar FIN; PAUSA/REANUDAR (botón y `P`/`Escape`) congelan/continúan el engine real; FIN fuerza game over con la puntuación actual; GUARDAR PUNTUACIÓN inserta una fila real en `scores` (`game_id: "snake"`) verificable con `execute_sql`; JUGAR DE NUEVO reinicia el engine completo (serpiente de 3 segmentos, score, velocidad) sin salir de la pantalla. Test manual: recorrer cada flujo en el navegador.
9. Pasada final: `/juego/snake` y la tab "SNAKE" de `/salon` muestran leaderboard real ordenado de mayor a menor, con estado vacío sin crash (0/1/2 scores); recorrer `/juegos`, `/salon` (todas las tabs), `/juego/snake`, `/juego/snake/jugar`, y los demás juegos reales/decorativos en desktop y móvil confirmando cero regresiones. `npm run build` de punta a punta. Test manual: sin errores de consola en ninguna ruta; build exitoso.

## Acceptance criteria

- [x] `lib/games.ts` tiene la entrada `id: "snake"` (ya no existe `id: "serpentina"`) con `title`, `short`, `long` actualizados, `cover: "cover-snake"` y `hasRealBackend: true`.
- [x] `/juegos` muestra la tarjeta "SNAKE" con su cover correcto; click navega a `/juego/snake`.
- [x] `/juego/serpentina` (y `/juego/serpentina/jugar`) da 404; `/juego/snake` carga bien.
- [x] `/juego/snake/jugar` muestra, tras un estado de carga breve, un `<canvas>` 600×600 jugable con la serpiente (primitivas neón) y frutas reales del atlas (`fruits.png`) dibujadas en el grid.
- [x] Las 4 flechas cambian la dirección de movimiento; no se puede invertir 180° instantáneamente (ir a la izquierda mientras se mueve a la derecha no causa colisión consigo misma); ninguna tecla usada scrollea la página.
- [x] `P`/`Escape` pausan el juego real; el botón PAUSA del `player-hud` hace lo mismo; REANUDAR continúa exactamente donde quedó.
- [x] El `player-hud` externo muestra Jugador/Puntuación/Longitud/Nivel con los mismos valores reales que el HUD interno del canvas, actualizados en tiempo real.
- [x] Comer una fruta suma exactamente 10 puntos, alarga la serpiente en 1 segmento, y hace aparecer una fruta nueva en una celda libre del grid con un sprite elegido al azar del atlas.
- [x] Cada 5 frutas comidas, el intervalo de movimiento baja ~5% (la serpiente se mueve visiblemente más rápido) y "Nivel" sube en ambos HUD.
- [x] Chocar contra cualquier borde del grid dispara game over inmediato, sin necesidad de pulsar FIN.
- [x] Chocar contra el propio cuerpo dispara game over inmediato, sin necesidad de pulsar FIN.
- [x] Pulsar FIN fuerza game over inmediato y abre el modal con la puntuación actual.
- [x] Guardar la puntuación en el modal inserta una fila real en la tabla `scores` de Supabase (`game_id: "snake"`, `player_name`, `score`, `user_id: null`) — verificable con `execute_sql`.
- [x] JUGAR DE NUEVO reinicia el engine real por completo (serpiente de 3 segmentos hacia la derecha, score 0, velocidad inicial) sin salir de la pantalla.
- [x] SALIR navega de vuelta a `/juego/snake`.
- [x] `/juego/snake` y la tab "SNAKE" de `/salon` muestran el leaderboard real leído de Supabase, ordenado de mayor a menor, con estado vacío sin crash (0, 1 o 2 scores).
- [x] Asteroides, Tetris y Arkanoid siguen funcionando exactamente igual que antes de este spec (jugar, pausar, guardar, leaderboard) — cero regresión tras añadir la rama `isSnake` a `GamePlayer.tsx`.
- [x] Los demás 4 juegos decorativos (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen mostrando la simulación visual actual y `seededScores`, sin cambios.
- [x] `npm run build` compila el proyecto completo sin errores de tipos ni de build.
- [x] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor al navegar `/juegos`, `/salon`, `/juego/snake`, `/juego/snake/jugar` y los demás `/juego/[id]`.

## Decisions

- **Sí:** renombrar por completo `serpentina` → `snake` (id, title, textos) en vez de dejar una entrada nueva separada. Confirmado explícitamente por el usuario — mismo patrón que `rocas→asteroides`/`caida→tetris`/`bloque-buster→arkanoid`.
- **No:** renombrar la clase CSS `.cover-snake`. Ya se llamaba así antes de este spec (coincidencia con el nombre nuevo), así que `app/globals.css` no se toca.
- **Sí:** motor diseñado desde cero (Caso B del skill), no portado de `references/started-games/` — no existe un `game.js` de Snake en esa carpeta. La mecánica clásica (grid, colisión con borde/cola, crecimiento al comer) es suficientemente conocida como para no requerir una fuente adicional.
- **Sí:** colisión con el borde del grid = game over inmediato (snake tradicional clásico), no wrap-around. Confirmado explícitamente por el usuario.
- **No:** sistema de vidas múltiples (3 vidas como Asteroides/Arkanoid). Snake tradicional es de un solo intento; `Phase` queda en `"playing"`/`"gameover"` sin un tercer estado `"dead"`, mismo criterio de desviación que ya documentó Arkanoid respecto a Asteroides.
- **Sí:** velocidad progresiva (-5% de intervalo cada 5 frutas, con piso mínimo). Confirmado explícitamente por el usuario — snake clásico se vuelve más difícil con el tiempo.
- **Sí:** todas las frutas del atlas otorgan el mismo puntaje fijo (10 pts), elegidas al azar solo por variedad visual — sin tabla de valores por tipo de fruta. Confirmado explícitamente por el usuario, evita una tabla de valores sin justificación visible en los assets.
- **Sí:** el atlas de frutas (`sprites.js`) se porta a un módulo TypeScript tipado (`spriteAtlas.ts`) en vez de cargarse como script global (`window.SPRITE_ATLAS`). El original usaba un global `<script>` para un HTML plano; en un componente React/TS eso rompería el aislamiento de módulos — se prefiere una constante exportada e importable, sin cambiar las coordenadas ni la estructura de datos.
- **Sí:** cuerpo/cabeza de la serpiente dibujados con primitivas de canvas reskineadas en la paleta neón, y solo la fruta usa el sprite real del atlas. Confirmado explícitamente — el atlas provisto no incluye sprites de serpiente, y agregar/generar uno queda fuera de alcance de este spec.
- **Sí:** grid de 20×20 celdas de 30px (canvas interno 600×600), en vez de reusar el 800×600 de los demás 3 juegos reales. Un grid más chico y cuadrado es más natural para snake tradicional; el `<canvas>` sigue escalándose por CSS igual que los demás.
- **Sí:** input discreto (`handleKeyDown` cambia `nextDirection` una vez por tecla, sin `handleKeyUp`), siguiendo el mismo eje de clasificación que Tetris según la guía de porteo — snake no tiene mecánica de "tecla mantenida".
- **Sí:** `P`/`Escape` como atajo de pausa, reutilizando el `useEffect` compartido ya existente en `GamePlayer.tsx` para Tetris/Arkanoid, en vez de crear uno nuevo específico de Snake.
- **Sí:** el slot HUD "Vidas" se reemplaza por "Longitud" (`snakeState.length`) cuando `isSnake`, mismo patrón que "Líneas" en Tetris — más relevante que mostrar un corazón fijo para un juego de una sola vida.
- **No:** generalizar `GamePlayer.tsx` para eliminar los `isX` hardcodeados de una vez por todas. El registry (`engineRegistry`) ya resuelve qué componente de canvas montar, pero el HUD sigue con ramas manuales por juego (patrón real ya establecido por Tetris/Arkanoid, pese a lo que sugería el texto de decisiones de spec 08) — este spec sigue ese mismo patrón en vez de emprender un refactor mayor no solicitado.
- **Sí:** leaderboard real conectado a Supabase desde este mismo spec. Confirmado explícitamente — es el default de este skill.
- **No:** controles táctiles, power-ups, obstáculos ni multijugador en este spec. Confirmado explícitamente — mismo criterio de alcance acotado que specs 05/07/08.

## Risks

| Riesgo                                                                                                                                                                                                       | Mitigación                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La carga de `fruits.png` (`load()`) es asíncrona — si tarda o falla, el canvas puede quedar en blanco o en estado "CARGANDO..." indefinidamente.                                                             | Mismo criterio ya aceptado en Arkanoid (spec 08): estado de carga explícito mientras `engine.load()` no resuelve; el caso de fallo de red queda como limitación conocida.                                               |
| Si el jugador pulsa dos teclas de dirección opuestas muy rápido dentro del mismo tick de movimiento (ej. arriba→abajo antes de que la serpiente avance), podría causar una colisión consigo misma injusta.   | El engine solo aplica la última dirección válida en `nextDirection` y bloquea explícitamente el giro de 180° respecto a la dirección actual (no a la última tecla presionada), mismo patrón estándar de snake clásico.  |
| Cada juego nuevo (incluido Snake) sigue agregando una rama `isX` más a `GamePlayer.tsx` (estado, ref, ternarios) en vez de generalizarse — el archivo crece linealmente y se vuelve más difícil de mantener. | Aceptado como decisión explícita de este spec (ver Decisions) — generalizar `GamePlayer.tsx` es un refactor mayor no solicitado; se evalúa en un spec futuro si el patrón deja de ser sostenible con más juegos reales. |
| La política de `INSERT` público en `scores` (heredada de spec 06) permite puntuaciones falsas o spam sin límite de tasa.                                                                                     | Mismo riesgo ya aceptado y documentado en specs 06/07/08 — no se introduce superficie nueva.                                                                                                                            |
| Con la tabla `scores` vacía para `"snake"` (estado inicial tras el deploy), el podio de `/salon` y `/juego/snake` puede crashear si el código accede a índices fuera de rango.                               | Mismo patrón ya mitigado por el código existente de `HallOfFame.tsx`/`app/juego/[id]/page.tsx` desde spec 06 — se verifica manualmente en el paso final del plan.                                                       |
