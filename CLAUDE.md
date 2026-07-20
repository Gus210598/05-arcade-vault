# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Non-standard Next.js version

This project pins `next@16.2.10` with `react@19.2.4`, which is **ahead of your training data and has breaking changes** vs. the Next.js you know. Before writing any App Router code (routing, data fetching, caching, `middleware`, config), check the bundled docs at `node_modules/next/dist/docs/01-app/` rather than relying on prior knowledge.

Known breaking change already surfaced: **`middleware.ts` is deprecated and renamed to `proxy.ts`**, with the exported function named `proxy` instead of `middleware`. This repo already uses `proxy.ts` at the root (it delegates to `updateSession` in `lib/supabase/proxy.ts` to refresh the Supabase session on every request). If a task involves request interception, edit `proxy.ts`, not `middleware.ts`.

There is no test runner configured yet. Verification is done with `npm run build` / `npx tsc --noEmit`, `npx eslint`, and the Playwright MCP server against `npm run dev`.

## Commands

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build — the de facto test suite
npm run lint    # eslint
```

## Skills & workflow

- **Usa siempre `/frontend-design`** para diseñar interfaz de usuario.
- The project follows **Spec Driven Design** via the `/spec` → `/spec-impl` flow from Klerith's `fernando-skills` pack (`npx skills@latest add Klerith/fernando-skills`). Drive new feature work through that flow rather than writing ad hoc code.
- **`/add-game`** (`.claude/skills/add-game/`) — project-local skill, a specialization of `/spec` for porting a new arcade game into the platform with a real Supabase leaderboard. It writes `specs/NN-<slug>.md` in `Draft` and **never writes code**. Its `references/` folder documents the integration points (`integration-checklist.md`), how to port a vanilla `game.js` to `engine.ts` + `<Slug>Game.tsx` (`engine-port-guide.md`), and the shared `games`/`scores` data model (`leaderboard-supabase.md`).

## MCP servers

- **supabase** (`.mcp.json`, project ref `poxktftdnkhkejsrpbil`) — schema inspection, migrations (`apply_migration`), and type generation. Use `list_tables` before schema changes.
- **playwright** — used to verify UI and gameplay end-to-end in a real browser.

## Architecture

```
app/                     App Router
  page.tsx               landing
  juegos/                catálogo
  juego/[id]/            ficha del juego
  juego/[id]/jugar/      pantalla de juego (renderiza GamePlayer)
  salon/                 Hall of Fame (leaderboards)
  about/, login/, not-found.tsx
  api/contact/route.ts   formulario de contacto vía Resend
components/
  Nav, GameCard, HallOfFame
  GamePlayer.tsx         wrapper común: HUD, pausa, game over, guardado de score
  games/registry.ts      id → componente de juego (next/dynamic)
  games/<slug>/          engine.ts + <Slug>Game.tsx (+ assets/)
lib/
  games.ts               catálogo GAMES (metadata, cover, hasRealBackend)
  scores.ts              lectura server-side (getTopScores, getGameStats)
  scores-client.ts       escritura client-side (saveScoreToSupabase)
  auth.ts                sesión decorativa en localStorage
  supabase/              client.ts / server.ts / proxy.ts / database.types.ts
specs/                   specs 01–09 (Spec Driven Design)
references/              implemented-games.md, started-games/ (fuentes vanilla), source-assets/
types/mp3.d.ts           declaración para imports de .mp3
```

- Path alias `@/*` → project root.
- Styling: Tailwind v4 (`@import "tailwindcss"` en `app/globals.css`) + un design system propio de ~1300 líneas de CSS neón (clases `.cover-*`, `.neon-*`, variables `--ink-*`). La mayor parte del look vive en `globals.css`, no en utilidades Tailwind.
- `next.config.ts` añade una regla Turbopack `*.mp3 → asset` para los efectos de sonido de Arkanoid.

### Juegos

Cada juego real vive en `components/games/<slug>/` con dos piezas:

- `engine.ts` — lógica pura + render a canvas, sin React.
- `<Slug>Game.tsx` — componente cliente que monta el canvas y expone un handle imperativo (`forwardRef`) con `pause/resume/restart`, más callbacks de score/game over.

`components/games/registry.ts` mapea `id → componente` con `next/dynamic`. **Al agregar un juego, registrarlo ahí**; `GamePlayer.tsx` lo resuelve por `game.id`. Nota: `GamePlayer` todavía conserva flags por juego (`isTetris`, `isArkanoid`, `isSnake`…) para los controles específicos de cada HUD — el registry genérico solo cubre el montaje del componente.

Los juegos con engine real y leaderboard están listados en `references/implemented-games.md`; **revisa esa lista antes de implementar un juego nuevo**. El resto de entradas en `lib/games.ts` son decorativas (`hasRealBackend` ausente/false).

### Datos (Supabase)

Dos tablas, ya creadas:

- `games` — `id`, `title`. Un `insert` por juego nuevo.
- `scores` — `id`, `game_id`, `player_name`, `score`, `user_id`, `created_at`. **Compartida por todos los juegos**, discriminada por `game_id`.

No crear tablas nuevas al agregar un juego: solo el `insert` en `games`. Los tipos están en `lib/supabase/database.types.ts` (regenerables con el MCP de Supabase).

La "sesión" del jugador (`lib/auth.ts`) es **decorativa**: nombre en `localStorage`, sin auth real de Supabase todavía. `login/page.tsx` no valida credenciales.

### Entorno

`.env.local` (ver `.env.template`): `RESEND_API_KEY`, `SUPABASE_DB_PASSORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Estado de los specs

01–09 todos implementados: MVP visual, navbar/landing, about+contacto (Resend), infra Supabase, asteroides, leaderboard, tetris, arkanoid, snake.

## Product intent

Arcade Vault es una plataforma para jugar juegos online y competir por puntos.
