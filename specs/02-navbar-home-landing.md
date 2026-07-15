# SPEC 02 — Navbar nuevo + landing Home

> **Status:** Implementado
> **Depends on:** [[01-mvp-visual]]
> **Date:** 2026-07-14
> **Objective:** Implementar el nuevo navbar de `references/templates/home-about/nav.jsx` (links Inicio / Biblioteca / Salón de la Fama / Acerca de) junto con la nueva landing `/` portada de `home.jsx`, moviendo la Biblioteca actual a `/biblioteca`, sin implementar el contenido de la página Acerca de (el link queda apuntando a `/about`, que no existe y muestra el 404 estilizado ya presente en el proyecto).

## Scope

**In:**

- `components/Nav.tsx` actualizado con 4 links (desktop + panel móvil): Inicio → `/`, Biblioteca → `/biblioteca`, Salón de la Fama → `/salon`, Acerca de → `/about`. Lógica de ruta activa (`usePathname`) ajustada a la nueva estructura.
- Nueva landing en `app/page.tsx`, portando `home.jsx` completo: hero con silhouettes decorativas, sección "¿Por qué Arcade Vault?", preview de juegos (usando `GAMES.slice(0,6)` de `lib/games.ts`), stats, actividad en vivo (ticker + top jugadores, datos mock hardcodeados igual que la plantilla), precios (plan único gratuito), CTA final.
- CTAs de la nueva landing mapeadas a rutas reales: "Explorar juegos" / "Ver todos los juegos" / CTA final → `/biblioteca`; "Crear cuenta" / "Empezar gratis" → `/login`; "Ver salón" → `/salon`; tarjetas de preview de juego → `/juego/[id]`.
- Biblioteca actual (contenido íntegro de hoy `app/page.tsx`: hero, buscador, chips, grid) movida a `app/biblioteca/page.tsx`.
- CSS: portar a `app/globals.css` los bloques nuevos de `references/templates/home-about/styles.css` que usa `home.jsx` — secciones `HOME PAGE`, `ACTIVITY` (ticker + top-list) y `PRICING`.
- Link "Acerca de" en el nav apunta a `/about`; como la ruta no existe, Next.js muestra el `not-found.tsx` estilizado ya existente del proyecto.
- Actualizar los 3 links "volver" existentes que hoy apuntan a `/` esperando la Biblioteca (`app/not-found.tsx`, `app/juego/[id]/page.tsx`, `app/salon/page.tsx`) para que apunten a `/biblioteca`.

**Out of scope (para otro spec):**

- Contenido real de la página Acerca de (`about.jsx`: hero de about, formulario de contacto, highlights). Solo se agrega el link en el nav.
- Renombrar `/juego/[id]` a `/juegos/[id]`. Se confirmó explícitamente fuera de alcance.
- Bloque CSS `ABOUT PAGE` y el bloque `GAMEPAD` de la plantilla (controles táctiles), no se portan porque nada en este spec los usa.
- Conectar la sección "Actividad en vivo" / "Top jugadores" a datos reales (`seededScores`, `localStorage`) — se mantiene mock hardcodeado, igual que la plantilla original.
- Cualquier lógica de precios/pagos real — la sección "Precios" es puramente decorativa.

## Data model

Este spec no introduce estructuras de datos nuevas ni persistencia.

- Reutiliza `Game` y `GAMES` ya definidos en `lib/games.ts` (sin cambios) para el preview de juegos.
- Los datos de "Actividad en vivo" (ticker de puntuaciones) y "Top jugadores · hoy" son arrays literales embebidos directamente en `app/page.tsx`, copiados tal cual de `home.jsx` (nombres, juegos y puntuaciones ficticias) — no se leen de `lib/games.ts` ni de `localStorage`.

## Implementation plan

1. En `app/globals.css`, agregar al final (después de las secciones ya portadas) los bloques `HOME PAGE`, `ACTIVITY` y `PRICING` de `references/templates/home-about/styles.css`, ajustando solo lo necesario para consistencia con las variables de fuente ya usadas (`var(--font-press-start-2p)`, etc., igual que el resto del archivo). Test manual: `npm run dev` sigue cargando sin errores de consola.
2. Crear `app/biblioteca/page.tsx` con el contenido íntegro y sin cambios del actual `app/page.tsx` (hero, buscador, chips, grid con `GameCard`). Test manual: visitar `/biblioteca` muestra la biblioteca funcionando igual que antes en `/`.
3. Reescribir `app/page.tsx` portando `home.jsx`: hero con silhouettes SVG decorativas, sección "¿Por qué Arcade Vault?" (`feature-grid` con los 4 `FeatureIcon`), preview de juegos con `GAMES.slice(0,6)` de `lib/games.ts` enlazando a `/juego/[id]`, sección de stats, sección de actividad en vivo (ticker + top jugadores con `Link` a `/salon`), sección de precios con CTA a `/login`, CTA final a `/biblioteca`. Componentes auxiliares (`FloatingSilhouettes`, `MiniCard`, `FeatureIcon`) como funciones locales en el mismo archivo o en `components/`, según convenga al tamaño del archivo. Test manual: `/` muestra las 6 secciones, sin errores de consola; los links del preview navegan a `/juego/[id]` correctos.
4. Actualizar `components/Nav.tsx`: agregar link "Inicio" (`/`, activo solo en `pathname === "/"`), cambiar el link "Biblioteca" para apuntar a `/biblioteca` (activo en `/biblioteca` y `/juego/*`), agregar link "Acerca de" (`/about`, activo en `pathname === "/about"`), replicar los mismos 4 links en el panel móvil, manteniendo el resto del nav (logo, contador de créditos, botón login/logout, hamburguesa) sin cambios. Test manual: los 4 links aparecen en desktop y en el panel móvil; el resaltado de "activo" es correcto en cada ruta.
5. No crear `app/about/page.tsx` — se deja intencionalmente sin implementar para que Next.js resuelva `/about` con `not-found.tsx`. Test manual: click en "Acerca de" navega a `/about` y se ve la página 404 estilizada del proyecto.
6. Actualizar los 3 links "volver" que hoy apuntan a `/` esperando la Biblioteca: `href="/"` → `href="/biblioteca"` en `app/not-found.tsx`, `app/juego/[id]/page.tsx` y `app/salon/page.tsx`. Test manual: desde detalle de juego, salón y la página 404, "volver" lleva a `/biblioteca`.
7. Pasada final: recorrer `/`, `/biblioteca`, `/salon`, `/login`, `/juego/[id]`, `/about` (404) en desktop y en un viewport móvil, confirmando que ningún link interno quedó roto tras el movimiento de la Biblioteca a `/biblioteca`. Test manual: sin errores de consola en ninguna ruta; navegación circular completa (Inicio → Biblioteca → Detalle → Jugar → volver) funciona.

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor.
- [ ] `/` muestra la nueva landing (home.jsx portado): hero, "¿Por qué Arcade Vault?", preview de juegos, stats, actividad en vivo, precios, CTA final.
- [ ] El preview de juegos en `/` usa los primeros 6 juegos de `lib/games.ts` y cada tarjeta navega a `/juego/[id]` correcto.
- [ ] Las CTAs "Explorar juegos" / "Ver todos los juegos →" / CTA final navegan a `/biblioteca`.
- [ ] Las CTAs "Crear cuenta" / "Empezar gratis →" navegan a `/login`.
- [ ] El link "Ver salón →" navega a `/salon`.
- [ ] `/biblioteca` muestra exactamente el mismo contenido y comportamiento (buscador, chips, grid) que tenía `/` antes de este spec.
- [ ] El Nav (desktop y panel móvil) muestra 4 links: Inicio, Biblioteca, Salón de la Fama, Acerca de.
- [ ] En `/`, el link "Inicio" aparece activo; en `/biblioteca` y en `/juego/[id]`, el link "Biblioteca" aparece activo; en `/salon`, "Salón de la Fama"; en `/about`, "Acerca de".
- [ ] Click en "Acerca de" navega a `/about` y muestra la página 404 estilizada del proyecto (`not-found.tsx`).
- [ ] El menú móvil (hamburguesa) abre/cierra correctamente y muestra los mismos 4 links + el botón de login/logout.
- [ ] El resto del comportamiento del Nav (contador de créditos, botón login/logout, sesión vía `localStorage`) sigue funcionando igual que antes de este spec.
- [ ] Los botones "volver" en `/juego/no-existe` (404), `/juego/[id]` y `/salon` navegan a `/biblioteca`, no a `/`.
- [ ] Recorrer `/`, `/biblioteca`, `/salon`, `/login`, `/juego/[id]`, `/about` en desktop y en viewport móvil (<840px) sin errores de consola ni links rotos.

## Decisions

- **Sí:** mover la Biblioteca actual de `/` a `/biblioteca` y usar `/` para la nueva landing (`home.jsx`). Es la estructura fiel de la plantilla original, donde "Inicio" y "Biblioteca" son rutas distintas.
- **No:** mantener "Inicio" apuntando al mismo contenido que "Biblioteca". Generaría un link "Inicio" redundante sin aportar nada del diseño nuevo.
- **Sí:** dejar el link "Acerca de" apuntando a `/about` sin crear la página, dependiendo del `not-found.tsx` ya existente. Cumple el pedido explícito de no implementar About, y evita crear una página placeholder que luego haya que descartar.
- **No:** renombrar `/juego/[id]` a `/juegos/[id]`. Confirmado explícitamente fuera de alcance de este spec.
- **Sí:** portar la sección "Actividad en vivo" y "Precios" de `home.jsx` con sus datos mock hardcodeados, sin conectarlas a `lib/games.ts` ni `localStorage`. Consistente con la decisión ya tomada en el spec 01 de mantener el salón como mock determinista; aquí también es puramente decorativo.
- **No:** portar los bloques CSS `ABOUT PAGE` y `GAMEPAD` de la nueva `styles.css`. Nada en este spec los usa; se agregan cuando exista un spec que sí implemente About o controles táctiles.
- **Sí:** reutilizar `GAMES.slice(0,6)` de `lib/games.ts` para el preview de juegos en Home, en vez de duplicar datos embebidos en el JSX de la plantilla. Evita divergencia entre el preview y la Biblioteca real.
- **Sí:** actualizar los 3 links "volver" existentes (`href="/"`) a `/biblioteca`. Sin este cambio, esos botones llevarían a la nueva landing en vez de a la Biblioteca, rompiendo el flujo de navegación esperado.

## Identified risks

- **Links rotos por el movimiento de ruta.** Cualquier otro `href="/"` o `router.push("/")` que asuma contenido de Biblioteca (no detectado en esta revisión) quedaría apuntando a la landing en vez de a la Biblioteca. Mitigación: la pasada final del plan (paso 7) incluye recorrer todas las rutas manualmente.
