# Leaderboard Supabase — modelo compartido a reutilizar

Spec 06 creó el modelo de datos del leaderboard real y ya cubre **cualquier** juego, no solo Asteroides. Agregar un juego nuevo con leaderboard real **no crea tablas nuevas** — solo agrega una fila a `games` y empieza a insertar en la `scores` ya existente con un `game_id` distinto.

## Modelo de datos (ya existe, no se toca)

```sql
create table games (
  id text primary key,
  title text not null
);

create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games(id),
  player_name text not null check (char_length(player_name) <= 24),
  score integer not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on scores (game_id, score desc);
```

Políticas RLS ya aplicadas (no se repiten por juego):

```sql
create policy "games_public_read" on games for select using (true);
create policy "scores_public_read" on scores for select using (true);
create policy "scores_public_insert" on scores for insert with check (true);
```

`scores` es **una sola tabla compartida entre todos los juegos**, discriminada por `game_id` — ese fue el diseño explícito de spec 06 precisamente para no tener que crear una tabla nueva cada vez que se agrega un juego real.

## Lo único que un juego nuevo necesita en Supabase

```sql
insert into games (id, title) values ('<slug>', '<TITLE>');
```

Sin esta fila, cualquier `insert` en `scores` con ese `game_id` falla por la FK `scores_game_id_fkey` — es el comportamiento correcto (falla rápido en vez de guardar datos huérfanos), no un bug a mitigar.

Aplica esto con `apply_migration` (MCP de Supabase), como paso independiente del plan — no lo combines con cambios de código en el mismo paso, para poder verificarlo con `execute_sql` de forma aislada (`select * from games` debe mostrar la fila nueva).

## Funciones ya existentes a reutilizar (no reescribir)

**`lib/scores.ts`** — server-side, usa `lib/supabase/server.ts` (cookies vía `next/headers`), se llama desde Server Components:

```ts
export interface ScoreRow { rank: number; name: string; score: number; date: string; }

export async function getTopScores(gameId: string, limit: number): Promise<ScoreRow[]>;
export async function getGameStats(gameId: string): Promise<{ best: number; plays: number }>;
```

`ScoreRow` es intencionalmente idéntica a la interfaz `ScoreRow` que ya devuelve `seededScores` en `lib/games.ts` — así el JSX de `app/juego/[id]/page.tsx` y `HallOfFame.tsx` no cambia de forma, solo cambia el origen de los datos.

**`lib/scores-client.ts`** — client-side, usa `lib/supabase/client.ts` (browser client), se llama desde `GamePlayer.tsx` (Client Component):

```ts
export async function saveScoreToSupabase(entry: {
  gameId: string;
  playerName: string;
  score: number;
}): Promise<void>;
```

Nota: están en **dos archivos separados** a propósito — `scores.ts` (server) importa `next/headers`, que rompe si se importa desde un Client Component; `scores-client.ts` (client) usa el browser client. Un juego nuevo no crea variantes de estas funciones — las llama con su propio `gameId`, igual que hace `GamePlayer.tsx` hoy con `game.id === "asteroides"` (ver `references/integration-checklist.md` para cómo queda esa llamada tras el refactor a registry).

## Convenciones que se mantienen para cualquier juego nuevo

- `user_id` nunca se envía en el insert — queda `null` (no hay auth real todavía).
- `game_id` es el mismo string que el `id` en `lib/games.ts` — sin mapeo intermedio.
- `player_name` tiene tope de 24 caracteres por `check` constraint en la base — no se valida además en el cliente.
- La lectura es server-side simple (`await` en un Server Component), no Realtime — el leaderboard se actualiza al navegar/recargar.
- No hay anti-cheat ni validación de que el score corresponde a una partida real — riesgo aceptado y documentado en spec 06, se hereda igual para cualquier juego nuevo.
- El podio y las listas deben manejar 0/1/2 filas sin acceder a índices fuera de rango (`rows[1]`, `rows[2]`) — mismo cuidado que exige spec 06 para Asteroides, aplica a cualquier juego con la tabla recién sembrada.
