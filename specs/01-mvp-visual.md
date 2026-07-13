# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Implementado.
> **Depends on:** —
> **Date:** 2026-07-12
> **Objective:** Implementar como rutas reales de Next.js las cinco pantallas visuales del MVP (biblioteca, detalle de juego, reproductor simulado, autenticación y salón de la fama) portando el diseño de `references/templates/`, sin implementar lógica de ningún juego real.

## Scope

**In:**

- 5 rutas reales de Next.js App Router: `/` (biblioteca), `/juego/[id]` (detalle), `/juego/[id]/jugar` (reproductor), `/login` (auth), `/salon` (salón de la fama).
- `Nav`: barra superior + panel móvil (hamburguesa), estados invitado/logueado, resaltado de ruta activa vía `usePathname`.
- Estilos globales portados desde `references/templates/styles.css` (clases custom: `.btn`, `.card`, `.av-nav`, etc.) agregados a `app/globals.css` o un archivo CSS propio importado desde el layout.
- Fuentes `Press Start 2P` y `JetBrains Mono` vía `next/font/google` en `app/layout.tsx`, reemplazando Geist/Geist Mono.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados a un módulo `lib/` en TypeScript.
- Auth simulada: formulario con tabs "Iniciar sesión"/"Crear cuenta", cualquier usuario "entra", botón "Jugar como invitado", sesión guardada en `localStorage` (`av_user`), botón de cerrar sesión en el Nav.
- Biblioteca: hero, buscador y chips de categoría (filtrado en cliente), grid de tarjetas de juego con tilt al hover.
- Detalle de juego: info del juego, tags, stats, botón "Jugar ahora", leaderboard mock determinista (`seededScores`).
- Reproductor: HUD (jugador, puntuación, vidas, nivel), pantalla CRT con animación CSS decorativa (naves/enemigos) y puntuación que sube sola (simulación visual, no es un juego real), pausa, fin de partida, modal de fin con guardado de puntuación en `localStorage` (`av_scores`), reinicio, salir.
- Salón de la fama: tabs por juego, podio top 3, tabla de puntuaciones mock, fila "tu mejor marca" para usuario logueado.
- Página `not-found.tsx` para ids de juego inexistentes en `/juego/[id]` y `/juego/[id]/jugar`.
- Footer con copyright/versión, igual al de la plantilla.
- Comportamiento responsive ya definido en `styles.css` (breakpoints existentes).

**Out of scope (for future specs):**

- Lógica real de cualquier juego jugable (Bloque Buster, Caída, Serpentina, etc.) — la pantalla de reproductor es solo una simulación visual.
- Backend/API real, autenticación real, hashing de contraseñas, sesiones/cookies server-side.
- Persistencia real de puntuaciones o base de datos — el leaderboard es mock determinista; el `localStorage.setItem` al guardar puntuación es decorativo y no se vuelve a leer en el salón.
- Login social (botones Google/GitHub quedan decorativos, sin funcionalidad).
- Sistema de créditos/monedas real — el contador "CRÉDITOS · 03" queda hardcodeado.
- Modo versus/multijugador (Duelo Pixel u otros).
- Tests automatizados (no hay test runner configurado en el proyecto).

## Data model

```ts
// lib/games.ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS del cover art (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[] = [
  /* 8 juegos, portados de data.jsx */
];
export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export const PLAYERS: string[] = [
  /* 18 nombres mock */
];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // DD/MM/2026
}
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// lib/auth.ts — helpers de sesión mock en localStorage
export interface StoredUser {
  name: string;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export function getStoredUser(): StoredUser | null;
export function setStoredUser(user: StoredUser | null): void; // null = invitado/logout
export function saveScoreEntry(entry: {
  game: string;
  score: number;
  name: string;
}): void;
```

Convenciones:

- `id` de juego es el slug usado en la URL (`/juego/bloque-buster`), coincide 1:1 con `Game.id` en `GAMES`.
- `seededScores(seed, count)` es determinista: mismo seed → misma tabla, para que el leaderboard no cambie en cada render.
- `av_user` y `av_scores` son las mismas claves de `localStorage` que usa la plantilla original.

## Implementation plan

1. En `app/layout.tsx`, cargar `Press Start 2P` y `JetBrains Mono` vía `next/font/google` (reemplazando Geist/Geist Mono) y exponerlas como variables CSS. Portar el contenido de `styles.css` a `app/globals.css` (a continuación del `@import "tailwindcss"`), y agregar los divs decorativos `.av-bg` / `.av-noise` en el layout. Test manual: `npm run dev`, la página raíz carga sin errores de consola y se ve el grid/scanlines de fondo.
2. Crear `lib/games.ts` con la interfaz `Game`, el array `GAMES` (8 juegos), `CATS`, `PLAYERS` y `seededScores`, portados de `data.jsx`.
3. Crear `lib/auth.ts` con `getStoredUser`, `setStoredUser`, `saveScoreEntry` sobre `localStorage`.
4. Crear `components/Nav.tsx` (client component): logo, links Biblioteca/Salón con estado activo por `usePathname`, contador de créditos, botón de login/logout leyendo `lib/auth`, panel móvil con hamburguesa. Montarlo en `app/layout.tsx`. Test manual: el nav aparece en toda ruta y el menú móvil abre/cierra.
5. Crear `app/page.tsx` (Biblioteca): hero, buscador + chips de categoría (filtrado en cliente), grid de `GameCard` (nuevo componente) enlazando a `/juego/[id]`. Test manual: buscar y filtrar por categoría funciona; estado vacío se muestra sin resultados.
6. Crear `app/juego/[id]/page.tsx` (Detalle): server component que busca el juego en `GAMES`, llama `notFound()` si no existe; renderiza cover, tags, stats y leaderboard con `seededScores`; botón "Jugar ahora" enlaza a `/juego/[id]/jugar`. Test manual: id válido renderiza, id inválido dispara 404.
7. Crear `app/juego/[id]/jugar/page.tsx` (Reproductor, client component): HUD (puntuación/vidas/nivel), CRT con animación decorativa, pausa/fin, modal de fin de partida que guarda vía `saveScoreEntry`, reinicio, salir hacia el detalle. Test manual: la puntuación sube sola, pausa detiene el conteo, fin de partida abre modal, guardar puntuación escribe en `localStorage`, reiniciar resetea el HUD.
8. Crear `app/login/page.tsx` (Auth, client component): tabs iniciar/crear cuenta, formulario, botón "jugar como invitado", botones sociales decorativos; al enviar llama `setStoredUser` y navega a `/`. Test manual: iniciar sesión con cualquier usuario redirige y el Nav muestra el nombre; "jugar como invitado" navega sin loguear.
9. Crear `app/salon/page.tsx` (Salón de la fama, client component): tabs por juego, podio top 3, tabla de puntuaciones, fila "tu mejor marca" si hay usuario logueado. Test manual: cambiar de tab actualiza podio y tabla; la fila de usuario solo aparece logueado.
10. Crear `app/not-found.tsx` con estética del proyecto y enlace de vuelta a la biblioteca. Test manual: visitar `/juego/no-existe` muestra el 404 estilizado.
11. Pasada final: footer en el layout, verificación responsive en los breakpoints existentes, limpieza de contenido residual del scaffold por defecto. Test manual: recorrer las 5 rutas en desktop y en un viewport móvil sin errores de consola.

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor.
- [ ] `/` muestra la biblioteca con hero, buscador, chips de categoría y grid de juegos.
- [ ] Buscar por nombre y filtrar por categoría en `/` actualiza el grid correctamente; sin resultados muestra el estado vacío.
- [ ] Click en una tarjeta de juego navega a `/juego/[id]` con la URL correcta.
- [ ] `/juego/[id]` con un id válido muestra info del juego, stats y un leaderboard de 10 filas.
- [ ] `/juego/no-existe` (y `/juego/no-existe/jugar`) muestra la página 404 estilizada.
- [ ] Botón "Jugar ahora" en el detalle navega a `/juego/[id]/jugar`.
- [ ] En `/juego/[id]/jugar` la puntuación sube automáticamente y se detiene al pulsar "Pausa".
- [ ] Pulsar "Fin" abre el modal de fin de partida con la puntuación final.
- [ ] Guardar la puntuación en el modal escribe una entrada en `localStorage` bajo la clave `av_scores` y muestra el mensaje de confirmación.
- [ ] "Jugar de nuevo" resetea el HUD (puntuación, vidas, nivel) sin salir de la pantalla.
- [ ] "Salir" desde el reproductor vuelve a `/juego/[id]`.
- [ ] `/login` permite iniciar sesión con cualquier usuario/contraseña, guarda `av_user` en `localStorage` y redirige a `/`.
- [ ] Tras iniciar sesión, el Nav muestra el nombre de usuario en vez del botón "Iniciar Sesión".
- [ ] "Jugar como invitado" en `/login` navega a `/` sin loguear ningún usuario.
- [ ] Cerrar sesión desde el Nav limpia `av_user` de `localStorage` y el botón vuelve a "Iniciar Sesión".
- [ ] `/salon` muestra podio, tabs por juego y tabla de puntuaciones; cambiar de tab actualiza el contenido.
- [ ] Con sesión iniciada, `/salon` muestra la fila "tu mejor marca"; como invitado, no aparece.
- [ ] El menú móvil (hamburguesa) abre y cierra correctamente en viewport angosto (<840px).
- [ ] Recargar la página (F5) en cualquier ruta mantiene la sesión guardada (persistencia vía `localStorage`).

## Decisions

- **Sí:** rutas reales de Next.js App Router en vez de SPA con hash-routing. Es lo idiomático para App Router, da URLs compartibles y navegación atrás/adelante nativa.
- **No:** portar el enrutador manual de `app.jsx` (estado de ruta + `location.hash`). Quedaría un antipatrón dentro de Next.js.
- **Sí:** sesión mock vía `localStorage` (`av_user`), sin backend. Es suficiente para demostrar los estados visuales de invitado/logueado que pide el MVP.
- **No:** autenticación real (hashing, cookies, API). Fuera del alcance de un MVP "solo visual".
- **Sí:** mantener la simulación visual del reproductor (puntuación automática, animación CSS de naves/enemigos). Es decorativo, no es un juego jugable, y da fidelidad a la plantilla.
- **No:** implementar cualquier juego real. Explícitamente fuera de alcance según el pedido inicial.
- **Sí:** portar `styles.css` casi tal cual como hoja de estilos global con clases custom. Prioriza velocidad y fidelidad visual sobre "pureza" Tailwind para un MVP.
- **No:** reescribir todo el diseño a utilidades Tailwind v4. Alto costo, alto riesgo de romper fidelidad visual, sin beneficio claro para el MVP.
- **Sí:** reemplazar Geist/Geist Mono por `Press Start 2P` + `JetBrains Mono` vía `next/font/google`. Consistencia visual retro-pixel en toda la app.
- **Sí:** `notFound()`/`not-found.tsx` para ids de juego inexistentes. Es el patrón estándar de Next.js App Router para recursos no encontrados.
- **No:** leer `av_scores` desde `/salon` para mostrar puntuaciones reales guardadas. La plantilla original tampoco lo hace — el salón sigue siendo mock determinista (`seededScores`); el guardado es decorativo.

## What is **not** in this spec

- Lógica jugable de ningún juego (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Rocas, Ranaria, Duelo Pixel).
- Backend, API, base de datos o autenticación real.
- Persistencia real de puntuaciones o rankings globales.
- Login social funcional (Google/GitHub).
- Sistema de créditos/monedas real.
- Modo versus o multijugador.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
