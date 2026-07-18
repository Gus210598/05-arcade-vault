# SPEC 06 — Leaderboard real de Asteroides (Supabase)

> **Status:** Implementado
> **Depends on:** 04-supabase-infra-base (clientes Supabase browser/server), 05-asteroides (juego real + `saveScoreEntry` + `GamePlayer.tsx`)
> **Date:** 2026-07-18
> **Objective:** Persistir en Supabase (tablas `games` y `scores`) las puntuaciones reales de Asteroides, reemplazando los datos simulados del Salón de la Fama y del panel "mejores puntuaciones" de `/juego/asteroides` por datos reales de partidas jugadas, sin tocar los demás 7 juegos ni migrar el catálogo visual completo de `lib/games.ts` a la base de datos.

## Scope

**In:**

- Migración de Supabase (vía `apply_migration`) que crea dos tablas nuevas:
  - `games`: `id` (text, primary key, mismos strings que `lib/games.ts` — ej. `"asteroides"`) y `title` (text).
  - `scores`: `id` (bigint identity, primary key), `game_id` (text, FK → `games.id`), `player_name` (text, máx. 24 caracteres), `score` (integer), `user_id` (uuid, FK → `auth.users.id`, nullable), `created_at` (timestamptz, default `now()`).
- Seed en la misma migración: una sola fila en `games` con `id: "asteroides"`, `title: "ASTEROIDES"`.
- Políticas RLS: `SELECT` público en `games` y `scores`; `INSERT` público en `scores` (sin auth real todavía, igual que hoy); sin `UPDATE`/`DELETE` para nadie en ninguna tabla; sin `INSERT`/`UPDATE`/`DELETE` en `games` desde el cliente (se administra solo por migración).
- Nuevas funciones de datos (en `lib/scores.ts` o similar) para leer y escribir en `scores`:
  - Lectura server-side: top N puntuaciones de un `game_id`, ordenadas por `score` descendente.
  - Lectura server-side: estadísticas agregadas de un `game_id` (`best` = `MAX(score)`, `plays` = `COUNT(*)`).
  - Escritura client-side: insertar una puntuación nueva (`game_id`, `player_name`, `score`, `user_id: null`).
- `components/GamePlayer.tsx`: cuando `game.id === "asteroides"`, el botón "GUARDAR PUNTUACIÓN" inserta en la tabla `scores` de Supabase en vez de `localStorage`. Los demás 7 juegos siguen usando `saveScoreEntry` (`localStorage`) exactamente igual que hoy.
- `app/juego/[id]/page.tsx`: cuando `id === "asteroides"`, el panel "MEJORES PUNTUACIONES" y el stat-strip (`Mejor global` / `Partidas`) muestran datos reales leídos de Supabase. Los demás 7 juegos siguen usando `seededScores` y los valores hardcodeados de `lib/games.ts`.
- `app/salon/page.tsx`: se separa en un Server Component (`page.tsx`) que hace `await` de las puntuaciones reales de Asteroides, y un Client Component (recibe esas puntuaciones como prop) que sigue manejando las tabs/interactividad. Solo la tab "ASTEROIDES" usa datos reales; las otras 7 tabs siguen usando `seededScores` calculado en el cliente, sin cambios de comportamiento.
- Generación de tipos TypeScript del esquema nuevo (`generate_typescript_types`), para tipar las consultas a `games`/`scores`.

**Out of scope (para specs futuros):**

- Migrar el resto de los campos de `lib/games.ts` (`short`, `long`, `cat`, `cover`, `color`) a la tabla `games` — sigue siendo un array hardcodeado en código, solo se referencia su `id`/`title` desde la DB.
- Agregar fila en `games` y tabla de scores real para cualquiera de los otros 7 juegos — se hace en el spec que porte ese juego a lógica real (como hizo el spec 05 con Asteroides).
- Autenticación real de Supabase (poblar `user_id` en cada insert) — sigue null por ahora; se conecta cuando exista un spec de auth real.
- Migrar las puntuaciones ya guardadas en `localStorage` (`av_scores`) a Supabase — se descartan, la tabla arranca vacía.
- Cualquier medida anti-cheat o validación server-side de que el `score` insertado corresponde a una partida real jugada (el cliente controla el número igual que hoy).
- Actualización en vivo (Realtime) del leaderboard — la lectura es server-side simple, se refresca al navegar/recargar.
- Borrado o edición de puntuaciones ya guardadas (no hay UI ni política RLS para eso).

## Data model

```sql
-- Tabla de catálogo mínimo (solo lo necesario para integridad referencial)
create table games (
  id text primary key,
  title text not null
);

insert into games (id, title) values ('asteroides', 'ASTEROIDES');

-- Tabla de puntuaciones, compartida entre todos los juegos (game_id como discriminador)
create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games(id),
  player_name text not null check (char_length(player_name) <= 24),
  score integer not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on scores (game_id, score desc);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games_public_read" on games for select using (true);
create policy "scores_public_read" on scores for select using (true);
create policy "scores_public_insert" on scores for insert with check (true);
```

```ts
// lib/scores.ts
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy, formateado desde created_at
}

// Server-side (usa lib/supabase/server.ts) — llamado desde Server Components
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;

export async function getGameStats(
  gameId: string,
): Promise<{ best: number; plays: number }>;

// Client-side (usa lib/supabase/client.ts) — llamado desde GamePlayer.tsx
export async function saveScoreToSupabase(entry: {
  gameId: string;
  playerName: string;
  score: number;
}): Promise<void>;
```

Convenciones:

- `ScoreRow` reutiliza exactamente la forma que ya consumen `app/salon/page.tsx` y `app/juego/[id]/page.tsx` hoy (la que devuelve `seededScores` en `lib/games.ts`), para minimizar cambios en el JSX de ambas páginas — solo cambia el origen de los datos, no su forma.
- `getTopScores`/`getGameStats` corren en Server Components (usan `lib/supabase/server.ts`), igual que el patrón ya establecido en spec 04.
- `saveScoreToSupabase` corre en el navegador (usa `lib/supabase/client.ts`), ya que `GamePlayer.tsx` es un Client Component y la política RLS permite insert público sin pasar por una Route Handler.
- `user_id` nunca se envía en el insert (queda `null` por default en la columna) — no hay auth real todavía; se completará cuando exista un spec de auth real de Supabase.
- `game_id` es `text` (no numérico) para que coincida 1:1 con los `id` string ya usados en `lib/games.ts` (`"asteroides"`), sin necesitar un mapeo adicional.
- No se genera un archivo `database.types.ts` a mano — se usa `generate_typescript_types` de Supabase para tipar `games`/`scores`, y `lib/scores.ts` importa esos tipos en vez de redefinirlos.

## Implementation plan

1. Aplicar la migración de Supabase (`apply_migration`): crea `games` y `scores`, políticas RLS, e inserta la fila seed de `"asteroides"`. Test manual: `list_tables` muestra ambas tablas; `execute_sql` con `select * from games` devuelve la fila `asteroides`; `select * from scores` devuelve 0 filas.
2. Generar tipos TypeScript del esquema (`generate_typescript_types`) y guardarlos en `lib/supabase/database.types.ts`. Test manual: `npm run build` compila sin errores (archivo aún sin usar en ninguna otra parte).
3. Crear `lib/scores.ts` con `getTopScores`, `getGameStats` (usan `lib/supabase/server.ts`) y `saveScoreToSupabase` (usa `lib/supabase/client.ts`), tipadas con `database.types.ts`. Test manual: `npm run build` compila sin errores (funciones aún no invocadas desde ninguna página).
4. Modificar `GamePlayer.tsx`: cuando `game.id === "asteroides"`, el botón "GUARDAR PUNTUACIÓN" llama `saveScoreToSupabase({ gameId: "asteroides", playerName: name, score: displayScore })` en vez de `saveScoreEntry`. Los demás 7 juegos siguen llamando `saveScoreEntry` sin cambios. Test manual: jugar una partida de Asteroides, terminar, guardar puntuación; confirmar sin errores de consola y que `execute_sql` sobre `scores` muestra la fila nueva con el nombre y score correctos.
5. Modificar `app/juego/[id]/page.tsx`: cuando `id === "asteroides"`, reemplazar `seededScores(...)` por `await getTopScores("asteroides", 10)` para el panel "MEJORES PUNTUACIONES", y `game.best`/`game.plays` del stat-strip por `await getGameStats("asteroides")`. Manejar el caso de 0 filas mostrando un estado vacío ("Aún no hay puntuaciones registradas") en vez de romper el render. Los demás 7 juegos no cambian. Test manual: visitar `/juego/asteroides` antes de guardar ningún score (estado vacío correcto), y después de guardar (aparece en la lista, ordenado); visitar `/juego/caida` y confirmar que sigue igual que antes.
6. Dividir `app/salon/page.tsx` en un Server Component `page.tsx` (async, hace `await getTopScores("asteroides", 12)`) que pasa esos datos como prop a un Client Component (el actual, renombrado si hace falta) que sigue manejando las tabs. Solo la tab "ASTEROIDES" usa la prop real; las otras 7 tabs siguen llamando `seededScores` en el cliente sin cambios. El podio (top 1/2/3) debe manejar el caso de menos de 3 filas reales sin romper (mostrar slots vacíos o mensaje, no `rows[1].name` sobre `undefined`). Test manual: `/salon` con la tab por defecto (otro juego) se ve igual que antes; cambiar a la tab "ASTEROIDES" con 0, 1, 2 y 3+ scores reales guardados, confirmando que no hay crash en ningún caso.
7. Pasada final: jugar varias partidas de Asteroides con distintos nombres/puntajes, confirmar que el orden (mayor a menor) es correcto tanto en `/salon` como en `/juego/asteroides`, y que `Mejor global`/`Partidas` reflejan los valores reales (`MAX`/`COUNT`). Recorrer `/juegos`, `/salon` (las 8 tabs), `/juego/asteroides`, `/juego/asteroides/jugar` y los 7 `/juego/[id]` restantes en desktop y móvil confirmando cero regresiones. `npm run build` de punta a punta. Test manual: sin errores de consola en ninguna ruta; build exitoso.

## Acceptance criteria

- [ ] Existen las tablas `games` y `scores` en el proyecto Supabase (verificable con `list_tables`), con las columnas y tipos descritos en el modelo de datos.
- [ ] `games` tiene exactamente una fila: `id: "asteroides"`, `title: "ASTEROIDES"`.
- [ ] RLS está habilitado en ambas tablas; existen las políticas de `SELECT` público en `games` y `scores`, e `INSERT` público en `scores`; no existen políticas de `UPDATE`/`DELETE` en ninguna, ni de `INSERT`/`UPDATE`/`DELETE` en `games`.
- [ ] `lib/supabase/database.types.ts` existe y tipa correctamente `games`/`scores` (generado con `generate_typescript_types`).
- [ ] `lib/scores.ts` exporta `getTopScores`, `getGameStats` y `saveScoreToSupabase` con las firmas descritas en el modelo de datos.
- [ ] Jugar una partida de Asteroides, terminarla y pulsar "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` (`game_id: "asteroides"`, `player_name`, `score`, `user_id: null`) — verificable con `execute_sql`.
- [ ] Los demás 7 juegos siguen guardando en `localStorage` (`av_scores`) exactamente igual que antes de este spec — sin filas nuevas en `scores` para esos `game_id`.
- [ ] `/juego/asteroides`: el panel "MEJORES PUNTUACIONES" muestra las puntuaciones reales de la tabla `scores`, ordenadas de mayor a menor; `Mejor global` y `Partidas` en el stat-strip muestran `MAX(score)` y `COUNT(*)` reales.
- [ ] `/juego/asteroides` con la tabla `scores` vacía (antes de guardar cualquier puntaje) muestra un estado vacío sin romper el render (sin errores de consola ni de React).
- [ ] Los demás 7 `/juego/[id]` siguen mostrando `seededScores` y los valores hardcodeados de `game.best`/`game.plays`, sin cambios.
- [ ] `/salon`, tab "ASTEROIDES": muestra las puntuaciones reales de `scores`, ordenadas de mayor a menor, incluyendo el podio (top 1/2/3).
- [ ] `/salon`, tab "ASTEROIDES" con 0, 1 o 2 puntuaciones reales guardadas: el podio y la tabla no crashean (slots vacíos o mensaje, sin acceder a `undefined`).
- [ ] `/salon`, las otras 7 tabs siguen mostrando `seededScores` calculado en el cliente, sin cambios de comportamiento.
- [ ] `player_name` con más de 24 caracteres es rechazado por la base (constraint `check`) al intentar guardarse.
- [ ] `npm run build` compila el proyecto completo sin errores de tipos ni de build.
- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor al navegar `/juegos`, `/salon`, `/juego/asteroides`, `/juego/asteroides/jugar` y los demás 7 `/juego/[id]`.

## Decisions

- **Sí:** una sola tabla `scores` compartida entre todos los juegos, discriminada por `game_id`, en vez de una tabla por juego. Decisión del usuario tras reconsiderar la idea inicial de "una tabla por juego" — un esquema relacional con FK a `games` es más estándar y evita crear una tabla nueva cada vez que se agregue un juego real.
- **Sí:** tabla `games` mínima (`id` + `title`), sin migrar el resto de los campos de `lib/games.ts`. Confirmado explícitamente por el usuario — evita ampliar el alcance a migrar todo el catálogo visual (short/long/cat/cover/color) a la base de datos en este spec.
- **Sí:** seed de `games` solo con `"asteroides"`, no con los 8 juegos. Confirmado explícitamente — los otros 7 no tienen lógica real todavía, así que no necesitan fila propia hasta que se porten (mismo patrón que spec 05).
- **Sí:** `user_id` nullable en `scores`, sin poblarse en este spec (siempre `null` al insertar). No hay auth real de Supabase todavía (ver spec 04); la columna queda lista para cuando exista, sin bloquear el leaderboard mientras tanto.
- **Sí:** RLS con lectura pública en ambas tablas y escritura pública solo en `scores` (sin auth real). Refleja el estado actual del sitio — cualquiera puede guardar un puntaje hoy vía `localStorage`, y este spec mantiene esa misma apertura al migrar a Supabase, sin agregar fricción de login todavía.
- **No:** ninguna medida anti-cheat ni validación server-side de que el score corresponde a una partida real. El cliente sigue controlando el número igual que hoy; se acepta como riesgo conocido (ver Risks) hasta un spec futuro si se vuelve un problema real.
- **Sí:** límite de 24 caracteres en `player_name` vía `check` constraint en la base. Confirmado explícitamente por el usuario — evita strings absurdamente largos rompiendo el layout del leaderboard, sin agregar validación adicional (groserías, caracteres especiales) fuera de alcance.
- **Sí:** lectura server-side simple (Server Component con `await`, mismo patrón que `GameDetailPage` de spec 01), no Realtime. Confirmado explícitamente — más simple, consistente con las convenciones ya establecidas en el proyecto; el leaderboard se actualiza al navegar/recargar, no en vivo.
- **Sí:** `best`/`plays` de la entrada `"asteroides"` en `lib/games.ts` se calculan en tiempo real desde `scores` (`MAX`/`COUNT`) en vez de quedar hardcodeados. Confirmado explícitamente — consistencia con tener datos reales ahora que existen partidas reales guardadas.
- **No:** migrar las puntuaciones ya guardadas en `localStorage` (`av_scores`) a Supabase. Confirmado explícitamente — son datos de prueba de desarrollo, la tabla arranca vacía.
- **Sí:** `saveScoreToSupabase` se llama directo desde el navegador (Client Component) usando la política de `INSERT` público, sin pasar por una Route Handler intermedia. Simplifica la arquitectura dado que RLS ya permite el insert público; no hay lógica server-side adicional que justifique una capa API intermedia todavía.
- **Sí:** `app/salon/page.tsx` se divide en Server Component (fetch) + Client Component (interactividad de tabs), en vez de convertir toda la página a Client Component con `useEffect`. Sigue el patrón ya usado en el proyecto (Server Components para data fetching, ver spec 04) y evita un parpadeo de carga en la tab de Asteroides.

## Risks

| Riesgo                                                                                                                                                                                                                                                           | Mitigación                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La política de `INSERT` público en `scores` permite que cualquiera con la publishable key llene la tabla con puntuaciones falsas o spam, sin límite de tasa ni CAPTCHA.                                                                                          | Aceptado como riesgo conocido en esta etapa del proyecto (sin usuarios reales todavía) — si se vuelve un problema, un spec futuro puede agregar rate limiting o requerir auth real para insertar.      |
| El cliente controla el valor de `score` enviado en el insert; no hay verificación server-side de que corresponda a una partida real jugada.                                                                                                                      | Mismo riesgo que ya existe hoy con `localStorage` — no se introduce una superficie nueva, solo se documenta explícitamente. Anti-cheat queda fuera de alcance de este spec.                            |
| Con la tabla `scores` vacía para `"asteroides"` (estado inicial tras el deploy, antes de que alguien juegue), el podio de `/salon` y `/juego/asteroides` puede crashear si el código accede a `rows[0]`/`rows[1]`/`rows[2]` sin verificar la longitud del array. | Mitigado explícitamente en el plan de implementación (pasos 5 y 6): manejar el caso de menos de 3 filas reales con un estado vacío, verificado manualmente antes de cerrar el spec.                    |
| Si en el futuro se intenta guardar un score para otro `game_id` que no sea `"asteroides"` (por un bug o por adelantar código de otro juego), el `INSERT` fallará por la FK a `games`, ya que solo existe la fila `"asteroides"`.                                 | Aceptado — es el comportamiento correcto y deseado (falla rápido en vez de guardar datos huérfanos); se resuelve agregando la fila correspondiente en `games` cuando ese juego se porte a lógica real. |
