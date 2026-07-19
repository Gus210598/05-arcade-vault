# Checklist de integración — puntos de conexión de un juego real

Cuando Asteroides se conectó (specs 05 y 06), la condición "¿este juego tiene lógica y leaderboard reales?" quedó resuelta con el literal `game.id === "asteroides"` repetido en 4 sitios. Funciona con un solo juego real; con un segundo, cada uno de esos `if` necesita otra rama. Esta guía describe (a) dónde están esos 4 puntos hoy, y (b) el refactor a un registry genérico que los reemplaza, para que agregar juegos futuros deje de tocarlos.

**Antes de escribir el spec**, comprueba si el refactor ya se hizo: busca `hasRealBackend` en `lib/games.ts` y la existencia de `components/games/registry.ts`. Si ya existen, salta directo a "Después del refactor" más abajo — el spec nuevo solo añade una entrada, no repite el refactor.

## Los 4 puntos hardcodeados hoy

1. **`components/GamePlayer.tsx`** — `const isAsteroids = game.id === "asteroides"`. Controla: qué componente de juego se renderiza (import estático de `AsteroidsGame`), de dónde sale el estado mostrado en el HUD (`asteroidsState` vs `score` simulado por `setInterval`), y qué función de guardado se llama al terminar (`saveScoreToSupabase` vs `saveScoreEntry`/localStorage).
2. **`app/juego/[id]/page.tsx`** — `const isAsteroids = id === "asteroides"`. Controla: si el panel "MEJORES PUNTUACIONES" y el stat-strip (`Mejor global`/`Partidas`) leen `getTopScores`/`getGameStats` de Supabase, o `seededScores`/`game.best`/`game.plays` decorativos.
3. **`app/salon/page.tsx`** — hace `await getTopScores("asteroides", 12)` de forma fija y se lo pasa como única prop real a `HallOfFame`.
4. **`components/HallOfFame.tsx`** — el `useMemo` que elige entre la prop real (solo si `tab === "asteroides"`) y `seededScores(tab.length * 23 + 7, 12)` para las demás tabs.

## El refactor a registry genérico

Dos piezas nuevas, ambas datos/registro — no lógica de negocio nueva:

**a) Campo `hasRealBackend` en `lib/games.ts`:**

```ts
export interface Game {
  // ...campos existentes...
  hasRealBackend?: boolean; // true = leaderboard real vía lib/scores.ts; ausente/false = seededScores como hoy
}
```

Es un dato plano, seguro de leer tanto en Server Components (`app/juego/[id]/page.tsx`, `app/salon/page.tsx`) como en Client Components (`GamePlayer.tsx`, `HallOfFame.tsx`) — no requiere importar nada del engine.

**b) `components/games/registry.ts` — mapa de componentes, client-only:**

```ts
"use client";
import dynamic from "next/dynamic";

// Cada entrada carga su <Slug>Game solo cuando ese juego se monta — evita que
// el bundle de cada juego real se cargue en páginas que no lo necesitan.
export const engineRegistry: Record<string, ReturnType<typeof dynamic>> = {
  asteroides: dynamic(() => import("@/components/games/asteroids/AsteroidsGame")),
  // <slug-nuevo>: dynamic(() => import("@/components/games/<slug-nuevo>/<Slug>Game")),
};
```

El registry solo mapea `id → componente`; no intenta unificar las props de cada `<Slug>Game` más allá del contrato ya compartido (`onStateChange`, `onGameOver`, handle con `pause/resume/forceGameOver/restart`) que define spec 05.

## Cómo queda cada punto después del refactor

1. **`GamePlayer.tsx`:**
   ```ts
   import { engineRegistry } from "@/components/games/registry";
   const GameComponent = engineRegistry[game.id];
   // ...
   {GameComponent ? (
     <GameComponent ref={engineRef} onStateChange={setEngineState} onGameOver={() => setOver(true)} />
   ) : (
     <div className="game-arena">...</div> // placeholder decorativo sin cambios
   )}
   ```
   El guardado al terminar: `game.hasRealBackend ? await saveScoreToSupabase(...) : saveScoreEntry(...)`.

2. **`app/juego/[id]/page.tsx`:**
   ```ts
   const scores = game.hasRealBackend
     ? await getTopScores(game.id, 10)
     : seededScores(id.length * 17 + 3, 10);
   const realStats = game.hasRealBackend ? await getGameStats(game.id) : null;
   ```

3. **`app/salon/page.tsx`:** en vez de una sola llamada fija, itera los juegos con `hasRealBackend` y arma un mapa `{ [id]: ScoreRow[] }` con `Promise.all`, pasado como prop a `HallOfFame`.

4. **`HallOfFame.tsx`:**
   ```ts
   const game = GAMES.find((g) => g.id === tab)!;
   const rows = useMemo(
     () => (game.hasRealBackend ? realScoresByGame[tab] ?? [] : seededScores(tab.length * 23 + 7, 12)),
     [tab, realScoresByGame],
   );
   ```

## Reglas que no cambian con el refactor

- La tabla `scores` sigue siendo **una sola**, compartida por `game_id` — el registry no crea tablas nuevas, solo decide qué `id` va a Supabase y cuál a `seededScores`.
- Un juego con `hasRealBackend: true` **debe** tener su fila correspondiente en la tabla `games` de Supabase (FK `scores.game_id → games.id`) — si falta, el `insert` de `saveScoreToSupabase` falla. Ver `references/leaderboard-supabase.md`.
- Los 7 juegos sin backend real (o los que aún no se han portado) simplemente no aparecen en `engineRegistry` y no tienen `hasRealBackend: true` — su comportamiento actual (simulación decorativa + `seededScores` + localStorage) no se toca.
- El reskin de paleta neón (`--yellow`/`--cyan`/`--magenta`/`--green` sobre `--bg`) es obligatorio en cada engine nuevo porque el `<canvas>` no puede resolver `var(--x)` — los colores van como constantes hex en `engine.ts`, igual que en `components/games/asteroids/engine.ts`.

## Después del refactor (registry ya existe)

Si `hasRealBackend` y `components/games/registry.ts` ya existen (lo confirmaste en Fase 1 del skill), el spec del juego nuevo **no** vuelve a tocar `GamePlayer.tsx`, `app/juego/[id]/page.tsx`, `app/salon/page.tsx` ni `HallOfFame.tsx` — esos archivos ya leen del registro. El Implementation plan de ese spec se reduce a: catálogo → engine.ts → `<Slug>Game.tsx` → una línea nueva en `registry.ts` → `hasRealBackend: true` en `lib/games.ts` → migración Supabase.
