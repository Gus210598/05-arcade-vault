# Guía de porteo — de `game.js` vanilla a `engine.ts` + `<Slug>Game.tsx`

Los juegos en `references/started-games/` (`02-asteroids`, `03-tetris`, `04-arkanoid`, y cualquiera que se agregue después) comparten un molde común: HTML mínimo con un `<canvas>` + `<script src="game.js">`, estado del juego en variables globales module-scope, y un loop `requestAnimationFrame`. Pero varían en 5 ejes concretos que hay que identificar antes de portar, porque determinan la forma real del `engine.ts` resultante.

## El molde común (siempre presente)

- `const canvas = document.getElementById(...)`, `const ctx = canvas.getContext('2d')` al tope del archivo.
- Constantes de configuración en mayúsculas (dimensiones, velocidades, colores, puntajes) — estas se reskinean a la paleta neón del sitio al portar.
- Estado del juego en variables/arrays globales (entidades) + escalares (`score`, `lives`/`lines`, `level`) + una variable de máquina de estados (`state`/`gameState`).
- Loop con `dt` calculado desde `lastTime`, separando `update(dt)` de `draw()`.
- `draw()` pinta fondo y luego cada capa de entidades encima.
- Arranque al final del archivo: `init...()` + `requestAnimationFrame(loop)`.

Este molde mapea directo al patrón de spec 05: `ref` al `<canvas>` + `getContext` en `useEffect`, estado mutable del juego en un `useRef` (no `useState` — evita re-renderizar en cada frame), loop rAF con `cancelAnimationFrame` en el cleanup, y `useState` en el wrapper React solo para lo que el HUD JSX necesita mostrar.

## Los 5 ejes que varían — identifícalos antes de portar

Antes de escribir `engine.ts`, lee el `game.js` completo y clasifica el juego en cada eje. Esto determina decisiones concretas del Data model y del plan, no es un ejercicio académico.

### 1. Modelo de entidades

- **OOP con clases** (ej. Asteroids: `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, cada una con `update(dt)`/`draw(ctx)`/flag `dead`) → porta cada clase casi 1:1 a TypeScript dentro de `engine.ts`, sin exportarlas fuera del módulo (mismo patrón que spec 05).
- **Funciones + estado en matriz** (ej. Tetris: sin clases, pieza = `{type, shape, x, y}`, tablero = matriz `board`) → porta las funciones núcleo (`collide`, `merge`, `clearLines`, etc.) como métodos privados o funciones del módulo, y el estado como propiedades planas de la clase `<Slug>Engine`.
- **Funciones + objetos literales** (ej. Arkanoid: `paddle`, `ball`, arrays `blocks[]`) → similar a Tetris, objetos literales se vuelven propiedades tipadas de la clase.

### 2. Estilo de input

- **`keys{}` mantenido + `justPressed{}` consumido** (Asteroids) → el wrapper React registra `keydown`/`keyup` en `window` y delega a `engine.handleKeyDown(code)`/`handleKeyUp(code)`, igual que spec 05.
- **`switch` por evento discreto** (Tetris — cada tecla dispara una acción puntual, no hay estado "mantenido") → `handleKeyDown` puede resolver la acción completa en la llamada, sin necesitar `handleKeyUp` para nada más que housekeeping.
- **Teclado + ratón/clicks en canvas** (Arkanoid) → si el juego fuente usa `mousemove`/`click` sobre el canvas, decide con el usuario en la Fase 3 del skill si esos controles se mantienen (el wrapper necesitará listeners de mouse sobre el `<canvas>` además de teclado) o se simplifican a solo teclado — anótalo en Decisions del spec.

### 3. Timing del loop

- **dt continuo en segundos, capado** (Asteroids, Arkanoid: `Math.min((ts-lastTime)/1000, 0.05)`) → se porta literal, es el mismo patrón que ya usa `AsteroidsGame.tsx`.
- **Acumulador de milisegundos contra un intervalo** (Tetris: `dropAccum += dt; if (dropAccum >= dropInterval) {...}`, con `dropInterval` que baja con el nivel) → el engine necesita guardar ese acumulador como propiedad de instancia; no lo colapses al patrón de dt continuo, son mecánicas de timing distintas.

### 4. Dónde vive el HUD

- **Dibujado dentro del canvas** (Asteroids, Arkanoid: `drawHUD()`/overlays pintados con `ctx.fillText`) → se mantiene tal cual dentro de `draw()` — spec 05 estableció explícitamente que el HUD interno **no se borra**, coexiste con el `player-hud` externo de React vía `onStateChange`.
- **DOM externo** (Tetris: `updateHUD()` escribe en `#score`/`#lines`/`#level`, hay un `#overlay` con botones) → esta parte **no se porta al canvas** — es exactamente el rol que ya cumple el `player-hud` de `GamePlayer.tsx` en React. El engine solo necesita notificar `onStateChange`; no repliques el HUD DOM del original dentro del canvas.

### 5. Assets externos

- **Autocontenido** (Asteroids, Tetris: todo el dibujo es primitivas de canvas — círculos, rectángulos, líneas) → sin pasos adicionales.
- **Spritesheet/audio externos** (Arkanoid: `assets/spritesheet.js` con `loadSpritesheet`/`drawSprite`/`drawFrame`, `levels.js` con niveles procedurales, sonidos `.mp3`) → decide con el usuario en Fase 3 si se portan los assets reales (copiarlos a `public/` o `components/games/<slug>/assets/` y cargarlos antes de arrancar el loop, igual que el original espera el callback de `loadSpritesheet`) o si se reemplazan por primitivas de canvas reskineadas en neón para evitar la dependencia — cualquiera de las dos es válida, pero debe quedar como una Decision explícita en el spec, no asumida.

## Contrato de salida esperado

Independientemente de en qué lado caiga el juego en cada eje, el resultado siempre implementa el mismo contrato público que consume `GamePlayer.tsx` (ver `components/games/asteroids/engine.ts` y `AsteroidsGame.tsx` como referencia viva, línea por línea):

- `<Slug>Engine`: constructor recibe `ctx` + `onStateChange`; expone `update(dt)`, `draw()`, `handleKeyDown(code)`, `handleKeyUp(code)`, `pause()`, `resume()`, `forceGameOver()`, `restart()`, `destroy()`.
- La notificación a `onStateChange` hace **dedupe** — solo llama cuando el estado relevante (`score`/`lives`/`level`/`phase`, o los campos que apliquen a este juego) cambió respecto al último valor notificado, para no forzar renders de React en cada frame.
- `<Slug>Game.tsx`: `forwardRef<Handle, Props>` + `useImperativeHandle` exponiendo `pause/resume/forceGameOver/restart`; callbacks (`onStateChange`/`onGameOver`) guardados en `useRef` y mantenidos actualizados por un `useEffect` aparte, para que el `useEffect` de montaje del loop pueda tener deps `[]` sin capturar closures viejas.
- Listeners de teclado en `window`, activos solo mientras la fase es jugable (nunca durante `pause` ni `gameover`) — evita robarle el foco al `<input>` de iniciales del modal de fin de partida.
- Cleanup completo al desmontar: `cancelAnimationFrame`, remover todos los listeners registrados, `engine.destroy()`.
- `<canvas>` con resolución interna fija (heredada del original — no la recalcules) escalado por CSS (`width:100%; height:auto` o `position:absolute; inset:0` según el layout del `.crt-screen`).
