---
name: add-game
description: Diseña el spec para portar un juego arcade (canvas vanilla en references/started-games, o descrito desde cero) a Arcade Vault con leaderboard real de Supabase. Úsalo al agregar cualquier juego nuevo a la plataforma. Genera specs/NN-<slug>.md en Draft; no escribe código.
disable-model-invocation: true
argument-hint: '<slug o descripción del juego a agregar, opcional>'
---

# /add-game — Diseñador de specs para juegos nuevos con leaderboard

Este skill es una **variante especializada de `/spec`** para un tipo de feature muy concreto de Arcade Vault: portar un juego jugable real (nave/paleta/pieza que se mueve en un `<canvas>`) e integrarlo en la plataforma con su tabla de puntuaciones real en Supabase. **No escribes código aquí.** Tu trabajo es clarificar qué juego se agrega y cómo, y producir un spec listo para `/spec-impl` en `specs/`.

## Por qué existe este skill

Ya hay un caso resuelto: Asteroides se portó desde `references/started-games/02-asteroids/game.js` (spec `05-asteroides.md`) y se conectó a un leaderboard real de Supabase (spec `06-leaderboard-asteroides.md`). Ese trabajo dejó un patrón repetible — motor de juego portado a React, wrapper con controles imperativos, tabla `scores` compartida discriminada por `game_id`. Este skill captura ese patrón para que la próxima vez no haya que re-derivarlo desde cero ni releer los dos specs anteriores.

Antes de escribir nada, lee `references/integration-checklist.md` — describe exactamente qué archivos toca una integración de este tipo y por qué, incluyendo una decisión importante: **hoy el único juego real (Asteroides) está hardcodeado por su `id` literal en 4 sitios** (`GamePlayer.tsx`, `app/juego/[id]/page.tsx`, `app/salon/page.tsx`/`HallOfFame.tsx`). El spec que generes debe decidir si esta incorporación introduce el registry genérico que reemplaza esos literales, o si ya existe y solo debe extenderlo.

## Command flow

Sigue las fases en orden, igual que `/spec`. Tus respuestas van en el idioma del prompt inicial del usuario (si escribe en español, respondes en español).

### Fase 1 — Contexto

1. Lee `CLAUDE.md` del proyecto si no lo tienes ya en contexto.
2. Lista `specs/` para determinar el siguiente número secuencial (mismo criterio que `/spec`: si el último es `06-leaderboard-asteroides.md`, este es `07-`).
3. Lee `specs/05-asteroides.md` y `specs/06-leaderboard-asteroides.md` completos — son la fuente de verdad del patrón que vas a repetir. No los resumas de memoria; vuelve a leerlos cada vez que el skill se invoque, porque pueden haber cambiado.
4. Revisa `lib/games.ts`: busca si la interfaz `Game` ya tiene un campo `hasRealBackend` (o equivalente) y si existe `components/games/registry.ts`. Esto te dice si el refactor a registry genérico (ver `references/integration-checklist.md`) **ya se hizo** en un spec anterior o si esta incorporación es la que lo introduce.
5. **Antes de redactar nada, localiza y lee el skill `/spec` real instalado en este entorno** — su `SKILL.md` y su `template.md` completos (normalmente en `~/.claude/skills/spec/`, que es un symlink a `~/.agents/skills/spec/`; si no aparece ahí, búscalo con `find ~/.claude/skills ~/.agents/skills -maxdepth 2 -iname 'SKILL.md' -path '*spec*'`). Este skill (`add-game`) es una variante especializada de `/spec`, no una reescritura independiente: su proceso de preguntas, su regla de "sección por sección con confirmación", su plantilla de header/estados, y sus anti-patrones de acceptance criteria son los que definen `/spec`, no una copia que `add-game` mantiene por separado. `template.md` (en este directorio) solo aporta el contenido específico de "juego + leaderboard" — la forma y el proceso vienen de `/spec`. Si el skill `/spec` no se encuentra instalado, avísale al usuario explícitamente y continúa solo con las convenciones ya documentadas en este skill como fallback.

### Fase 2 — Identificar la fuente del juego

Determina de dónde sale el juego. Dos casos:

**Caso A — Viene de `references/started-games/`:** Lista esa carpeta. Si el usuario ya nombró una subcarpeta (p.ej. "tetris" → `03-tetris`), o si solo hay una que calce razonablemente, confírmalo con el usuario; si hay ambigüedad, pregunta cuál. Lee su `game.js` (y `index.html`/`levels.js`/assets si existen) completo. Usa `references/engine-port-guide.md` para clasificar el molde de ese juego concreto en sus ejes variables (modelo de entidades, estilo de input, timing del loop, dónde vive el HUD, si depende de assets externos) — esa clasificación es lo que va a determinar el contenido real del Data model y el Implementation plan del spec.

**Caso B — Descrito desde cero (no está en `references/started-games/`):** No hay `game.js` que portar. Pide al usuario una descripción de la mecánica suficiente para diseñar el engine (qué entidades se mueven, qué las hace perder/ganar puntos, condición de game over) — trátalo igual que la Fase 2 de `/spec` (preguntas concretas, no abiertas). El resto del flujo es idéntico; el spec describe un engine a diseñar en vez de un engine a portar.

En ambos casos, si el juego ya tiene una entrada en `lib/games.ts` con un `cover-*` decorativo (como pasó con `rocas` → `asteroides`), decide con el usuario si esta incorporación **renombra** esa entrada (igual que hizo spec 05) o crea una entrada nueva.

### Fase 3 — Clarificar (bloques de 3–5 preguntas)

No asumas nada de esto — pregunta, con el mismo estilo directo de `/spec` (2–4 opciones, marcando tu recomendación):

- **Catálogo:** `id`/slug definitivo, `title`, `short`, `long`, `cat` (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `color` (`cyan`/`magenta`/`yellow`/`green`), nombre de la clase `.cover-<slug>`.
- **Controles:** qué teclas/mecánicas de input reales tendrá (derivadas del `game.js` si Caso A, o definidas por el usuario si Caso B).
- **Leaderboard:** confirma que este juego SÍ lleva leaderboard real (es el caso por defecto de este skill — si el usuario en realidad solo quiere una entrada decorativa sin backend, dile que eso no necesita este skill, un `if` de catálogo alcanza).
- **Registry:** si la Fase 1 detectó que el refactor a registry genérico **no existe todavía**, confirma con el usuario que este spec lo incluye (impacto: toca 3 archivos existentes además de crear los nuevos — ver checklist). Si **ya existe**, dilo explícitamente y confirma que este spec solo añade la entrada del juego nuevo al registry, sin tocar los demás.
- **Alcance fuera:** igual que `/spec` — cualquier cosa que se mencione y no vaya en este spec (multijugador, táctil, audio, dificultad extra) se anota explícitamente en Out of scope.

Detén las preguntas cuando puedas responder sin asumir: qué archivos van a aparecer o cambiar, cuál es el primer y último paso ejecutable, y cómo se verifica que quedó terminado.

### Fase 4 — Redactar el spec sección por sección

Sigue exactamente el proceso de la Fase 3 del `/spec` que leíste en la Fase 1 de este skill (mostrar cada sección formateada, preguntar "¿Esta sección queda así o la ajustamos?", no avanzar sin confirmación, nunca generar el spec completo de una vez). El **contenido** de cada sección lo rellenas con `template.md` (en este mismo directorio) — es el `template.md` de `/spec` extendido con el Implementation plan y el Data model ya orientados a "juego + leaderboard"; para cualquier sección que `template.md` no cubra en detalle (p.ej. matices del header o de Decisions), vuelve al `template.md` real de `/spec` que ya leíste. Mismo orden que `/spec`: Header → Scope → Data model → Implementation plan → Acceptance criteria → Decisions → Risks.

Reglas específicas de este tipo de spec:

- El Implementation plan **siempre** sigue el orden: catálogo (`lib/games.ts` + CSS) → engine.ts → `<Slug>Game.tsx` → registry (si aplica) → migración Supabase (`insert into games`) → verificación end-to-end. No reordenes ni saltes pasos — cada uno debe dejar el proyecto compilando (mismo principio que `/spec`: "cada paso debe dejar el sistema funcional").
- El Data model reutiliza literalmente las interfaces `Phase`/`AsteroidsState`/`AsteroidsGameHandle`/`AsteroidsGameProps` de spec 05 como plantilla, renombradas al juego nuevo — no inventes una forma distinta sin razón.
- La migración de Supabase **nunca** crea tablas nuevas — la tabla `scores` ya es compartida entre todos los juegos (ver `references/leaderboard-supabase.md`). El único DDL nuevo es el `insert` en `games`.
- Los Acceptance criteria deben incluir, igual que spec 05/06: que los demás juegos existentes no cambian de comportamiento, que el build pasa, y que el estado vacío del leaderboard (0 scores) no rompe el render.

### Fase 5 — Guardar el spec

1. Genera el slug desde el `id` del juego confirmado en Fase 3.
2. Confirma el nombre de archivo propuesto (`specs/NN-<slug>.md`) con el usuario antes de escribir.
3. Crea el archivo con `Status: Draft`.
4. Si `specs/.spec-config.yml` no existe, créalo con el contenido por defecto que usa `/spec` (no lo dupliques si ya existe).
5. Confirma al usuario: ruta del archivo creado, que sigue en `Draft` hasta que lo revise y lo pase a `Approved`, y que el siguiente paso es `/spec-impl NN-<slug>`.
6. **Para aquí.** No propongas implementar, no escribas código, no toques `lib/`, `app/`, `components/` ni Supabase.

## Reglas duras

- **Nunca escribas código en este skill.** Solo el `.md` del spec al final.
- **Nunca propongas implementar después de guardar el spec.**
- **Nunca asumas decisiones que el usuario no confirmó** (slug, controles, si va con registry o no).
- **Nunca generes el spec completo en una sola respuesta** — sección por sección, con confirmación.
- **Relee siempre `lib/games.ts`, specs 05/06, y el `SKILL.md`/`template.md` reales de `/spec` en vivo** en cada invocación — no confíes en memoria de una invocación anterior de este mismo skill; el estado del registry o el propio `/spec` pueden haber cambiado.

## Referencias

- `~/.claude/skills/spec/SKILL.md` y `~/.claude/skills/spec/template.md` (o su ubicación real bajo `~/.agents/skills/spec/`) — el skill `/spec` original. **Léelos en la Fase 1, en vivo, antes de redactar nada** — de ahí sale el proceso (preguntas por bloques, sección por sección, reglas de header/estados/anti-patrones) que este skill hereda en vez de reinventar.
- `template.md` — plantilla del spec de este skill (extiende la de `/spec` con el Implementation plan y el Data model pre-orientados a "juego + leaderboard"; no sustituye al `template.md` de `/spec`, lo complementa).
- `references/integration-checklist.md` — los puntos de conexión exactos y el refactor a registry genérico.
- `references/engine-port-guide.md` — cómo clasificar y portar un `game.js` vanilla a `engine.ts` + `<Slug>Game.tsx`.
- `references/leaderboard-supabase.md` — el modelo de datos `games`/`scores` compartido y las firmas de `lib/scores.ts`/`lib/scores-client.ts` a reutilizar.
