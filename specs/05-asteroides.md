# SPEC 05 — Asteroides (primer juego jugable real)

> **Status:** Aprobado
> **Depends on:** 01-mvp-visual (reproductor, GAMES, saveScoreEntry)
> **Date:** 2026-07-18
> **Objective:** Implementar el primer juego jugable real de Arcade Vault — Asteroides — portando la lógica de `references/started-games/02-asteroids/game.js` a un componente canvas de React aislado (`components/games/asteroids/`), reskineado con la paleta neón del sitio, integrado en `/juego/asteroides/jugar` con HUD dual (React + canvas) y controles reales de pausa/fin/reinicio, sin modificar los demás 7 juegos ni generalizar la arquitectura del reproductor.

## Scope

**In:**

- Renombrar la entrada existente en `lib/games.ts`: `id: "rocas"` → `"asteroides"`, `title: "ROCAS"` → `"ASTEROIDES"`, `cover: "cover-rocas"` → `"cover-asteroides"`, y reescribir `short`/`long` para que el texto coincida con el nombre nuevo. `color: "yellow"`, `best` y `plays` se mantienen igual.
- Renombrar la clase CSS `.cover-rocas` → `.cover-asteroides` en `app/globals.css` (mismo diseño visual, solo cambia el selector).
- Nuevo componente cliente en `components/games/asteroids/` que porta la lógica completa de `game.js`: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` (incluye el power-up de disparo triple), wrap toroidal, colisiones, split de asteroides, progresión de niveles, 3 vidas con invencibilidad parpadeante — adaptado a TypeScript + React (canvas vía `ref`, loop `requestAnimationFrame` dentro de `useEffect` con cleanup en desmontaje).
- El canvas **mantiene su propio HUD interno** dibujado como en el original (score/nivel/vidas arriba del canvas) — no se borra. Además, el componente notifica a React (prop callback, p.ej. `onStateChange({score, lives, level})`) en cada cambio relevante, para que el `player-hud` externo de `GamePlayer.tsx` (ya existente) muestre los mismos valores reales en paralelo. Ambos HUDs coexisten mostrando el mismo estado real.
- Reskin visual: nave, asteroides, balas, partículas y HUD interno usan la paleta neón de Arcade Vault (`--yellow` como acento del juego, `--cyan`/`--magenta`/`--green` de apoyo) sobre fondo `--bg` negro, en vez de la paleta blanco/negro del original.
- Controles reales de teclado: `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space`, con `preventDefault()` para no scrollear la página. Los listeners solo están activos mientras el estado interno es `'playing'`/`'dead'`; se desactivan en pausa y en `'gameover'` (para no interferir con el input de iniciales del modal existente).
- Botón **PAUSA** (ya existente en `player-hud`) congela el loop real del juego (deja de actualizarse `update`/`draw`); **REANUDAR** continúa exactamente donde quedó.
- Botón **FIN** (ya existente) fuerza game over inmediato con la puntuación actual, reutilizando el modal de fin de partida y `saveScoreEntry` ya implementados en `GamePlayer.tsx`.
- Botón **JUGAR DE NUEVO** (ya existente en el modal) reinicia el juego real por completo (equivalente a `initGame()`: nave, asteroides, score, vidas, nivel desde cero).
- Botón **SALIR** conserva su comportamiento actual (navega a `/juego/asteroides`).
- `GamePlayer.tsx` renderiza condicionalmente este componente en lugar del `.crt`/`.game-arena` decorativo únicamente cuando `game.id === "asteroides"`; para los demás 7 juegos el bloque decorativo actual queda intacto, sin abstraer ni generalizar el reproductor.
- Canvas con resolución interna fija 800×600 (igual que el original, del que dependen las constantes físicas), escalado por CSS (`width: 100%; height: auto`, `max-width`) para caber en `.crt-screen` en desktop y en viewport móvil — sin ser jugable por táctil.
- Guardado real de puntuación: al game over, el modal ya existente llama `saveScoreEntry({ game: "asteroides", score, name })` con el score real final del juego (la mecánica de guardado no cambia, solo el origen del número).

**Out of scope (para specs futuros):**

- Los demás 7 juegos (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen con la simulación visual actual, sin tocar.
- Generalizar `GamePlayer.tsx` en un registro/arquitectura de plugins para múltiples juegos reales. Cada juego se implementa aislado a medida que se aborda.
- Controles táctiles / jugabilidad en móvil.
- Audio/efectos de sonido (el original tampoco los tiene).
- Leaderboard real conectado a Supabase — el Salón de la Fama sigue usando `seededScores` mock; el guardado de esta partida sigue en `localStorage` (`av_scores`), igual que en spec 01.
- Cualquier cambio a infraestructura de Supabase (auth, tablas) del spec 04.
- Mecánicas nuevas no presentes en `game.js` (jefes, dificultad distinta, multijugador, etc.).

## Data model

`lib/games.ts` no gana una interfaz nueva — solo se modifica la entrada existente (`id`, `title`, `cover`, `short`, `long`), manteniendo la forma de `Game` ya definida en spec 01.

```ts
// components/games/asteroids/engine.ts
export type Phase = "playing" | "dead" | "gameover";

export interface AsteroidsState {
  score: number;
  lives: number;
  level: number;
  phase: Phase;
}

// Clases internas portadas de game.js (no se exportan fuera del engine):
// Bullet, Asteroid, Ship, Particle, PowerUp — mismos campos/métodos
// (update(dt), draw(ctx)) que el original, reskineadas con la paleta del sitio.

export class AsteroidsEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    onStateChange: (state: AsteroidsState) => void,
  );
  update(dt: number): void;
  draw(): void;
  handleKeyDown(code: string): void;
  handleKeyUp(code: string): void;
  pause(): void;
  resume(): void;
  forceGameOver(): void; // usado por el botón FIN
  restart(): void; // usado por "JUGAR DE NUEVO"
  destroy(): void; // cleanup de listeners/rAF al desmontar
}
```

```tsx
// components/games/asteroids/AsteroidsGame.tsx
export interface AsteroidsGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface AsteroidsGameProps {
  onStateChange: (state: AsteroidsState) => void; // sincroniza el player-hud externo
  onGameOver: (finalScore: number) => void;        // dispara el modal existente (lives=0 o FIN)
}

// forwardRef<AsteroidsGameHandle, AsteroidsGameProps> — expone comandos imperativos
// para que GamePlayer.tsx controle pausa/fin/reinicio desde sus botones existentes,
// igual que hoy controla la simulación por setState.
const AsteroidsGame = forwardRef<AsteroidsGameHandle, AsteroidsGameProps>(...);
export default AsteroidsGame;
```

Convenciones:

- `AsteroidsEngine` es la lógica pura portada de `game.js` (framework-agnostic salvo que dibuja sobre un `CanvasRenderingContext2D` recibido); `AsteroidsGame.tsx` es la capa React que monta el `<canvas>`, corre el loop `requestAnimationFrame`, gestiona los listeners de teclado (activos solo si `phase !== "gameover"` y no está en pausa) y expone el `ref` imperativo.
- `onStateChange` se llama en cada frame donde cambia `score`/`lives`/`level`/`phase`, no en cada frame del loop — evita renders de React innecesarios.
- `onGameOver` se dispara tanto cuando `lives` llega a 0 de forma natural como cuando `GamePlayer.tsx` llama `forceGameOver()` vía el botón FIN — en ambos casos abre el mismo modal existente con el mismo flujo de `saveScoreEntry`.
- `GamePlayer.tsx` reemplaza su `useState`/`setInterval` de score simulado por el `AsteroidsState` recibido de `onStateChange` **solo cuando `game.id === "asteroides"`**; para los demás juegos conserva la simulación actual sin cambios.

## Implementation plan

1. Renombrar en `lib/games.ts` la entrada `id: "rocas"` → `"asteroides"` (title, short, long, cover) y renombrar la clase CSS `.cover-rocas` → `.cover-asteroides` (con sus `::before`/`::after`) en `app/globals.css`. Test manual: `/juegos` muestra la tarjeta "ASTEROIDES" con el cover correcto; `/juego/asteroides` carga bien; `/juego/rocas` ahora da 404.
2. Crear `components/games/asteroids/engine.ts` portando de `game.js` las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y las funciones (`wrap`, `dist`, `rand`, `randInt`, `spawnAsteroids`, `explode`, `killShip`, `nextLevel`) dentro de una clase `AsteroidsEngine` (constructor, `update`, `draw`, `handleKeyDown/Up`, `pause`, `resume`, `forceGameOver`, `restart`, `destroy`), reskineada con la paleta neón (`--yellow`/`--cyan`/`--magenta`/`--green` sobre `--bg`). Test manual: `npm run build` compila sin errores de tipos (módulo aún no usado en ninguna ruta).
3. Crear `components/games/asteroids/AsteroidsGame.tsx`: client component con `<canvas>` de 800×600, monta `AsteroidsEngine` en `useEffect`, loop `requestAnimationFrame` con `dt` capado a 50ms, listeners de teclado activos solo en `'playing'`/`'dead'` (con `preventDefault`), cleanup completo al desmontar, `forwardRef` exponiendo `AsteroidsGameHandle`, invoca `onStateChange`/`onGameOver`. Test manual: `npm run build` sin errores (componente aún no montado en ninguna página).
4. Modificar `GamePlayer.tsx`: cuando `game.id === "asteroides"`, renderizar `<AsteroidsGame ref={...} />` en lugar del bloque `.crt`/`.game-arena` decorativo, y reemplazar el score simulado (`setInterval`) por el estado real recibido vía `onStateChange`. Cablear PAUSA/REANUDAR → `ref.pause()/resume()`, FIN → `ref.forceGameOver()`, JUGAR DE NUEVO → `ref.restart()` + reset del estado local (`over`/`saved`/`customName`). El modal de fin de partida y `saveScoreEntry` no cambian de lógica, solo reciben el score real. Test manual: `/juego/asteroides/jugar` muestra el canvas jugable; flechas rotan/aceleran, espacio dispara; el HUD interno del canvas y el `player-hud` externo muestran los mismos valores en tiempo real.
5. Verificar manualmente los flujos de control: PAUSA congela nave/asteroides/HUD, REANUDAR continúa exactamente donde quedó; FIN abre el modal con la puntuación actual; perder las 3 vidas también abre el modal automáticamente (sin pulsar FIN); GUARDAR PUNTUACIÓN escribe en `localStorage` (`av_scores`) con `game: "asteroides"`; JUGAR DE NUEVO reinicia nave/asteroides/score/vidas/nivel desde cero sin salir de la pantalla; SALIR vuelve a `/juego/asteroides`. Test manual: recorrer cada flujo en el navegador y confirmar el resultado descrito.
6. Verificar responsive y pasada final: el canvas se escala dentro de `.crt-screen` en viewport móvil (<840px) sin romper el layout ni el `player-hud` (se ve, no es jugable sin teclado — limitación documentada). Recorrer `/juegos`, `/juego/asteroides`, `/juego/asteroides/jugar` en desktop y móvil, y confirmar que los demás 7 juegos siguen intactos con su simulación visual. `npm run build` de punta a punta. Test manual: sin errores de consola en ninguna ruta; build exitoso.

## Acceptance criteria

- [ ] `lib/games.ts` tiene la entrada `id: "asteroides"` (ya no existe `id: "rocas"`) con `title`, `short`, `long` actualizados y `cover: "cover-asteroides"`.
- [ ] `app/globals.css` define `.cover-asteroides` (renombrada de `.cover-rocas`, mismo diseño visual); `.cover-rocas` ya no existe.
- [ ] `/juegos` muestra la tarjeta "ASTEROIDES" con su cover correcto; click navega a `/juego/asteroides`.
- [ ] `/juego/rocas` (y `/juego/rocas/jugar`) da 404; `/juego/asteroides` carga bien.
- [ ] `/juego/asteroides/jugar` muestra un `<canvas>` jugable con nave, asteroides y HUD interno dibujado (score/nivel/vidas), reskineado con la paleta neón del sitio (no blanco/negro).
- [ ] Flechas izquierda/derecha rotan la nave, flecha arriba acelera, espacio dispara; ninguna de estas teclas scrollea la página.
- [ ] El `player-hud` externo (Jugador/Puntuación/Vidas/Nivel) muestra los mismos valores reales que el HUD interno del canvas, actualizados en tiempo real.
- [ ] Destruir asteroides suma puntos (20/50/100 según tamaño), los parte en fragmentos más pequeños, y genera partículas de explosión.
- [ ] Aparece el power-up de disparo triple y al recogerlo la nave dispara 3 balas durante su duración.
- [ ] Al perder las 3 vidas, el juego pasa a game over automáticamente y abre el modal de fin de partida con la puntuación final — sin necesidad de pulsar FIN.
- [ ] Pulsar PAUSA congela el juego real (nave/asteroides/HUD dejan de moverse); REANUDAR continúa exactamente donde quedó.
- [ ] Pulsar FIN fuerza game over inmediato y abre el modal con la puntuación actual.
- [ ] Guardar la puntuación en el modal escribe una entrada en `localStorage` (`av_scores`) con `game: "asteroides"` y la puntuación real final.
- [ ] JUGAR DE NUEVO reinicia el juego real por completo (nave, asteroides, score, vidas, nivel) sin salir de la pantalla.
- [ ] SALIR navega de vuelta a `/juego/asteroides`.
- [ ] Completar un nivel (destruir todos los asteroides) avanza de nivel, generando más asteroides y reflejándose en ambos HUD.
- [ ] El canvas se escala correctamente dentro de `.crt-screen` en viewport móvil (<840px) sin romper el layout del reproductor.
- [ ] Los demás 7 juegos (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen mostrando la simulación visual actual sin cambios.
- [ ] `npm run build` compila el proyecto completo sin errores de tipos ni de build.
- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor al navegar `/juegos`, `/juego/asteroides` y `/juego/asteroides/jugar`.

## Decisions

- **Sí:** alcance limitado únicamente a `asteroides` (antes `rocas`), sin tocar los demás 7 juegos. Confirmado explícitamente por el usuario — cada juego se implementa aislado a medida que se aborda.
- **No:** generalizar `GamePlayer.tsx` en un registro/arquitectura de plugin para múltiples juegos reales en este spec. Prematuro con un solo juego real; se evalúa si aparece un segundo juego real que lo justifique.
- **Sí:** mantener el HUD dibujado dentro del canvas (fiel al original) **y** el `player-hud` externo de React, sincronizados vía `onStateChange` — no se elimina ninguno. Confirmado explícitamente por el usuario.
- **Sí:** reskin visual con la paleta neón de Arcade Vault (`--yellow`/`--cyan`/`--magenta`/`--green`) en vez del blanco/negro del original. Consistencia con la identidad visual del sitio.
- **Sí:** control imperativo vía `forwardRef`/`useImperativeHandle` (`pause`/`resume`/`forceGameOver`/`restart`) en vez de levantar todo el estado interno del juego a props reactivas. El estado del juego (posiciones, velocidades, colisiones) es mutable frame a frame y no conviene modelarlo como estado de React.
- **Sí:** PAUSA congela el loop real (el `update`/`rAF` se detiene de verdad), FIN fuerza game over real, JUGAR DE NUEVO reinicia el motor completo (equivalente a `initGame()`). Confirmado explícitamente por el usuario — no son controles decorativos como en la simulación anterior.
- **No:** listener de teclado siempre activo con chequeo de `document.activeElement`. Se prefiere desactivar los listeners directamente cuando el estado es `'gameover'` o está en pausa — más simple, sin riesgo de fugas de foco con el input de iniciales del modal.
- **No:** controles táctiles ni jugabilidad en móvil en este spec. El original tampoco los tiene; queda documentado como limitación conocida para un spec futuro si se pide.
- **Sí:** canvas con resolución interna fija 800×600 (como el original, del que dependen las físicas y el spawn de asteroides), escalado por CSS. Evita reescribir toda la matemática de `W`/`H` para hacerlo "verdaderamente" responsive.
- **Sí:** separar la lógica portada (`engine.ts`, framework-agnostic) del wrapper de React (`AsteroidsGame.tsx`). Facilita comparar/portar contra el original línea por línea, y deja el código más testeable si en el futuro se agrega un test runner.
- **No:** conectar el guardado de puntuación a Supabase en este spec. Sigue usando `localStorage` (`av_scores`) igual que el resto del sitio hoy — la persistencia real en Supabase queda fuera de alcance (ver spec 04).
- **Sí:** renombrar por completo `rocas` → `asteroides` (id, title, cover, textos) en vez de dejar una mezcla de nombres. Evita inconsistencia entre el nombre real del juego y los datos mock.

## Risks

| Riesgo                                                                                                                                                                                                            | Mitigación                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El canvas de resolución fija 800×600 escalado por CSS puede verse borroso o con bordes/"letterboxing" en pantallas muy angostas o con proporciones distintas a 4:3.                                               | Aceptado como costo menor (igual que el original); usar `max-width`/`aspect-ratio` en CSS para mantener proporción. Si la nitidez importa, ajustar `devicePixelRatio` queda como mejora futura.                |
| El reskin de colores (blanco/negro → paleta neón) puede introducir bajo contraste entre asteroides/nave/fondo, dificultando ver el juego.                                                                         | Verificar manualmente en pantalla antes de cerrar el spec — ajustar colores si algún elemento se pierde visualmente contra `--bg`.                                                                             |
| Cambiar `id` de `rocas` a `asteroides` rompe cualquier referencia/bookmark existente a `/juego/rocas`.                                                                                                            | Aceptado — el proyecto está en desarrollo, sin usuarios reales todavía.                                                                                                                                        |
| Los listeners de teclado (`keydown`/`keyup` en `window`) portados del original pueden quedar activos si el componente no limpia correctamente al desmontar (p. ej. el usuario navega a otra ruta mientras juega). | Cleanup explícito en el `return` del `useEffect` de `AsteroidsGame.tsx`; verificar manualmente navegando fuera de `/juego/asteroides/jugar` durante una partida y confirmando que no quedan listeners activos. |
