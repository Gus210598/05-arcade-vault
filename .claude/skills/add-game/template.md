# Plantilla — spec de "juego nuevo + leaderboard"

Este archivo es la referencia que consulta el skill `add-game` al generar un spec. Extiende la plantilla estándar de `/spec` (`~/.agents/skills/spec/template.md`) — mismas reglas globales (una idea por oración, nombres concretos, sin código largo, markdown estándar) — con el Data model y el Implementation plan orientados específicamente a portar un juego con leaderboard real. **No es texto para copiar literal** — es la forma que debe respetar el spec generado, con los nombres reales del juego sustituidos.

---

## Header

Igual que `/spec`:

```markdown
# SPEC NN — <Título del juego> (leaderboard real)

> **Status:** Draft
> **Depends on:** 05-asteroides (patrón de engine portado), 06-leaderboard-asteroides (tabla `scores` compartida)
> **Date:** YYYY-MM-DD
> **Objective:** una sola oración — portar/implementar <juego> como componente canvas real, integrarlo en `/juego/<slug>/jugar`, y conectar su leaderboard a la tabla `scores` de Supabase.
```

Si esta incorporación también introduce el refactor a registry genérico, decláralo en `Depends on` o en el objetivo — es una segunda pieza de trabajo real dentro del mismo spec, no un efecto colateral silencioso.

---

## Scope

Dos sub-bloques, igual que `/spec`. Ejemplos concretos del tipo de ítems que van en cada uno (sustituir `<slug>`/`<Slug>` por el juego real):

```markdown
**In:**

- Nueva entrada (o renombre de una existente) en `lib/games.ts`: `id: "<slug>"`, `title`, `short`, `long`, `cat`, `color`, `cover: "cover-<slug>"`.
- Clase CSS `.cover-<slug>` en `app/globals.css` (`::before`/`::after`, paleta neón del sitio).
- `components/games/<slug>/engine.ts`: clase `<Slug>Engine` portada de `references/started-games/<carpeta>/game.js` (o diseñada desde cero si no hay fuente), con el contrato de spec 05 (`update`, `draw`, `handleKeyDown/Up`, `pause`, `resume`, `forceGameOver`, `restart`, `destroy`, notificación con dedupe).
- `components/games/<slug>/<Slug>Game.tsx`: wrapper `forwardRef` con `<canvas>`, loop rAF, listeners de teclado gateados por fase, cleanup en desmontaje.
- [Solo si el registry aún no existe] `components/games/registry.ts` + el campo `hasRealBackend` en la interfaz `Game`, reemplazando los `if (id === "asteroides")` de `GamePlayer.tsx`, `app/juego/[id]/page.tsx` y `app/salon/page.tsx`/`HallOfFame.tsx` — ver `references/integration-checklist.md`.
- [Si el registry ya existe] Entrada de `<slug>` en `components/games/registry.ts` y `hasRealBackend: true` en su entrada de `lib/games.ts` — sin tocar la lógica de los 3 archivos ya generalizados.
- Migración Supabase (`apply_migration`): `insert into games (id, title) values ('<slug>', '<TITLE>')`. La tabla `scores` no cambia — ya es compartida.

**Out of scope (para specs futuros):**

- Los demás juegos ya existentes — no se tocan salvo los puntos exactos listados arriba.
- Controles táctiles / mecánicas nuevas no presentes en la fuente portada.
- Auth real (`user_id` sigue null en los inserts).
- Cualquier cosa que el usuario haya mencionado durante la clarificación y se haya decidido posponer — anotarla aquí explícitamente.
```

---

## Data model

Reutiliza literalmente la forma de spec 05, renombrada al juego nuevo — no la reinventes:

```ts
// components/games/<slug>/engine.ts
export type Phase = "playing" | "dead" | "gameover";

export interface <Slug>State {
  score: number;
  lives: number;   // omitir si el juego no tiene vidas (p.ej. un puzzle tipo Tetris) y documentarlo
  level: number;
  phase: Phase;
}

export class <Slug>Engine {
  constructor(ctx: CanvasRenderingContext2D, onStateChange: (state: <Slug>State) => void);
  update(dt: number): void;
  draw(): void;
  handleKeyDown(code: string): void;
  handleKeyUp(code: string): void;
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
  destroy(): void;
}
```

```tsx
// components/games/<slug>/<Slug>Game.tsx
export interface <Slug>GameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface <Slug>GameProps {
  onStateChange: (state: <Slug>State) => void;
  onGameOver: (finalScore: number) => void;
}
```

Si el motor fuente (Caso A) no tiene el concepto de `lives` o `level` (p.ej. Tetris usa `lines` en vez de `lives`), adapta los campos del estado a lo que el juego real tiene — no fuerces los 4 campos de Asteroides si no aplican, pero documenta la diferencia explícitamente en Convenciones.

Si el spec introduce el registry genérico, agrega también:

```ts
// components/games/registry.ts
// Mapa id → componente de juego cargado client-only (next/dynamic).
// GamePlayer.tsx renderiza engineRegistry[game.id] si existe, si no el placeholder decorativo.
```

```ts
// lib/games.ts — campo nuevo en la interfaz Game
hasRealBackend?: boolean; // true = leaderboard real vía lib/scores.ts; false/undefined = seededScores como hoy
```

---

## Implementation plan

Orden fijo — cada paso deja el proyecto compilando, igual que exige `/spec`:

```markdown
## Implementation plan

1. Añadir/renombrar la entrada en `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `color`, `cover`) y la clase `.cover-<slug>` en `app/globals.css`. Test manual: `/juegos` muestra la tarjeta correcta; `/juego/<slug>` carga.
2. Crear `components/games/<slug>/engine.ts` portando la lógica fuente (o diseñándola desde cero) dentro de `<Slug>Engine`, reskineada con la paleta neón. Test manual: `npm run build` compila (módulo aún no usado).
3. Crear `components/games/<slug>/<Slug>Game.tsx`: canvas, loop rAF con dt clamp, listeners de teclado activos solo en fases jugables, forwardRef con el handle. Test manual: `npm run build` compila (componente aún no montado).
4. [Solo si el registry no existe] Introducir `hasRealBackend` en `lib/games.ts`, crear `components/games/registry.ts`, y reemplazar los `if (id === "asteroides")` de `GamePlayer.tsx` / `app/juego/[id]/page.tsx` / `app/salon/page.tsx`+`HallOfFame.tsx` por lecturas del registry/flag — ver `references/integration-checklist.md` para el detalle exacto de cada archivo. Test manual: Asteroides sigue funcionando exactamente igual que antes (regresión cero) tras el refactor.
5. [Si el registry ya existe] Registrar `<slug>` en `components/games/registry.ts` y poner `hasRealBackend: true` en su entrada de `lib/games.ts`. Test manual: `/juego/<slug>/jugar` monta el engine real; los demás juegos no cambian.
6. Aplicar la migración de Supabase: `insert into games (id, title) values ('<slug>', '<TITLE>')`. Test manual: `execute_sql` sobre `games` muestra la fila nueva; `scores` sigue vacía para ese `game_id`.
7. Pasada final: jugar varias partidas, guardar puntuaciones con nombres distintos, confirmar orden correcto en `/juego/<slug>` y `/salon` (tab del juego), estado vacío sin crash con 0/1/2 scores, y que los demás juegos (incluido Asteroides) no tuvieron regresiones. `npm run build` de punta a punta.
```

---

## Acceptance criteria

Checklist booleano — incluir siempre estos, además de los específicos del juego:

```markdown
- [ ] `lib/games.ts` tiene la entrada `id: "<slug>"` con los campos correctos.
- [ ] `.cover-<slug>` existe en `app/globals.css` con el diseño esperado.
- [ ] `/juego/<slug>/jugar` muestra un `<canvas>` jugable con los controles reales confirmados en la Fase 3.
- [ ] El `player-hud` externo y el HUD interno del canvas muestran los mismos valores en tiempo real.
- [ ] PAUSA congela el juego real; REANUDAR continúa donde quedó; FIN fuerza game over con la puntuación actual; JUGAR DE NUEVO reinicia el motor completo.
- [ ] Guardar la puntuación en el modal inserta una fila real en `scores` (`game_id: "<slug>"`) — verificable con `execute_sql`.
- [ ] `/juego/<slug>` y la tab correspondiente de `/salon` muestran el leaderboard real ordenado de mayor a menor, con estado vacío sin crash.
- [ ] Los demás juegos (incluido Asteroides) no cambian de comportamiento — cero regresiones tras cualquier refactor al registry.
- [ ] `npm run build` compila sin errores de tipos ni de build.
- [ ] `npm run dev` no muestra errores de consola al navegar `/juegos`, `/salon`, `/juego/<slug>`, `/juego/<slug>/jugar` y los demás `/juego/[id]`.
```

---

## Decisions

Igual que `/spec` — capturar qué se consideró, no solo qué se eligió. Siempre documentar explícitamente:

- Si esta incorporación introduce o extiende el registry genérico, y por qué.
- Si el motor viene de `references/started-games/` o fue diseñado desde cero.
- Cualquier campo del `Data model` que se desvía de la forma de spec 05 (p.ej. sin `lives`) y por qué.

## Risks

Igual que `/spec` — tabla simple, solo si hay riesgos no obvios. Revisar si aplican los mismos riesgos ya documentados en spec 05/06 (INSERT público sin anti-cheat, estado vacío del leaderboard, cleanup de listeners al desmontar) y si el juego nuevo introduce alguno adicional (p.ej. assets externos que tardan en cargar, como el spritesheet de Arkanoid).
