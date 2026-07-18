# SPEC 04 — Infraestructura base de Supabase

> **Status:** Aprobado
> **Depends on:** Ninguno
> **Date:** 2026-07-18
> **Objective:** Instalar y configurar la infraestructura base de Supabase (`@supabase/ssr`) en Arcade Vault — clientes de browser y de servidor, `proxy.ts` para refresco de sesión, y variables de entorno — sin conectar todavía autenticación real ni persistencia de datos (la auth falsa de `localStorage` y el mock del Salón de la Fama quedan intactos).

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`).
- `lib/supabase/client.ts`: helper `createClient()` con `createBrowserClient`, para usar desde Client Components.
- `lib/supabase/server.ts`: helper `createClient()` async con `createServerClient` + `cookies()` de `next/headers`, para usar desde Server Components y Route Handlers.
- `lib/supabase/proxy.ts`: helper `updateSession(request)` que crea un cliente de servidor con cookies del request/response, refresca la sesión y valida el JWT con `supabase.auth.getClaims()` — sin lógica de redirect (no hay rutas protegidas todavía).
- `proxy.ts` en la raíz del proyecto: exporta `proxy(request)` (convención Next 16 de este proyecto) que llama a `updateSession`, con `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen estáticos.
- Variables de entorno nuevas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, agregadas a `.env.local` (con los valores reales del proyecto ya existente `poxktftdnkhkejsrpbil.supabase.co`) y a `.env.template` (vacías, como referencia).
- Verificación manual de que la conexión funciona: navegar cualquier ruta de la app dispara `proxy.ts` → `getClaims()` sin errores de red/credenciales (confirmable en la consola del servidor durante `npm run dev`).

**Out of scope (para otro spec):**

- Autenticación real con Supabase Auth (reemplazar `lib/auth.ts` y el login falso de `localStorage`). Va en un spec futuro.
- Persistir el Salón de la Fama / puntuaciones (`saveScoreEntry`) en una tabla de Supabase. Va en un spec futuro.
- `SUPABASE_SERVICE_ROLE_KEY` / cualquier operación admin que necesite bypass de RLS.
- Crear cualquier tabla o migración en la base de datos (hoy el proyecto Supabase está vacío, sin tablas).
- Generación de tipos TypeScript desde el esquema (`generate_typescript_types`) — no aplica todavía porque no hay tablas.
- Lógica de rutas protegidas / redirects en `proxy.ts` — se agrega junto con el spec de autenticación real.
- Tocar `SUPABASE_DB_PASSORD` en `.env.local` (queda intacta, sin uso en este spec).

## Data model

Este spec no introduce estructuras de datos persistentes ni tablas — el proyecto Supabase sigue sin tablas al terminar este spec. Introduce únicamente configuración y funciones de creación de cliente.

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient;

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;

// lib/supabase/proxy.ts
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse>;
```

Conventions:

- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (prefijo `NEXT_PUBLIC_` porque son seguras de exponer al cliente — es la publishable key, no la secret/service_role).
- Cookie de sesión: nombre por defecto `sb-<project_ref>-auth-token`, manejada automáticamente por `@supabase/ssr` — no se lee ni se escribe manualmente en ningún otro lugar del código.
- No se crea ningún archivo de tipos (`database.types.ts`) en este spec, al no haber tablas que tipar todavía.

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`). Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.local` (valores reales del proyecto `poxktftdnkhkejsrpbil`) y a `.env.template` (vacías). Test manual: `npm run dev` sigue levantando sin errores.
2. Crear `lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr`, leyendo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Test manual: `npm run build` compila sin errores de tipos (el archivo no se usa todavía en ninguna ruta, pero debe tipar correctamente).
3. Crear `lib/supabase/server.ts` con `createClient()` async usando `createServerClient` de `@supabase/ssr` + `cookies()` de `next/headers`, con `getAll`/`setAll` envueltos en try/catch para tolerar el caso de Server Component (sin permiso de escritura de cookies). Test manual: `npm run build` sigue compilando sin errores.
4. Crear `lib/supabase/proxy.ts` con `updateSession(request: NextRequest)`: crea un cliente de servidor con cookies del request/response (patrón `getAll`/`setAll` sincronizado entre `request.cookies` y `supabaseResponse.cookies`), llama a `supabase.auth.getClaims()` para validar el JWT, y devuelve `supabaseResponse` sin ninguna lógica de redirect. Test manual: `npm run build` compila sin errores.
5. Crear `proxy.ts` en la raíz del proyecto: exporta `async function proxy(request: NextRequest)` que llama a `updateSession(request)`, y exporta `config.matcher` excluyendo `_next/static`, `_next/image`, `favicon.ico` y extensiones de imagen estáticas. Test manual: `npm run dev`, abrir cualquier ruta (`/`, `/biblioteca`, `/login`, etc.) y confirmar en la consola del servidor que no aparece ningún error de conexión, credenciales inválidas o cookies — la app se comporta exactamente igual que antes (mismo contenido, misma navegación) porque `proxy.ts` no redirige ni bloquea nada todavía.
6. Pasada final: recorrer `/`, `/biblioteca`, `/salon`, `/login`, `/juego/[id]`, `/about` en desktop y en un viewport móvil, confirmando que ninguna ruta se rompió por la introducción de `proxy.ts`. Correr `npm run build` una vez más de punta a punta para confirmar que el proyecto completo compila con las nuevas dependencias. Test manual: sin errores de consola en ninguna ruta; `npm run build` termina con éxito.

## Acceptance criteria

- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen como dependencias en `package.json`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con valores reales; `.env.template` contiene las mismas dos claves vacías.
- [ ] `SUPABASE_DB_PASSORD` y `RESEND_API_KEY` en `.env.local` no fueron modificadas.
- [ ] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts` y `lib/supabase/proxy.ts`, cada uno exportando exactamente las funciones descritas en el modelo de datos.
- [ ] Existe `proxy.ts` en la raíz del proyecto (no `middleware.ts`), exportando `proxy` y `config.matcher`.
- [ ] `npm run build` compila el proyecto completo sin errores de tipos ni de build.
- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor.
- [ ] Navegar `/`, `/biblioteca`, `/salon`, `/login`, `/juego/[id]`, `/about` en desktop y en viewport móvil (<840px) funciona exactamente igual que antes de este spec — ningún link roto, ningún redirect inesperado.
- [ ] La consola del servidor no muestra errores de red ni de credenciales al ejecutar `getClaims()` en `proxy.ts` durante la navegación.
- [ ] `lib/auth.ts` (login falso de `localStorage`) y el mock del Salón de la Fama siguen funcionando exactamente igual que antes — este spec no los toca.
- [ ] El proyecto Supabase (`poxktftdnkhkejsrpbil`) sigue sin tablas al terminar este spec (verificable con `list_tables`).

## Decisions

- **Sí:** alcance limitado a infraestructura base (clientes + proxy.ts + env vars), sin auth real ni persistencia de scores. Evita un spec sobrecargado que mezcle tres dominios de decisiones distintos; auth y scores quedan para specs futuros e independientes.
- **No:** implementar Supabase Auth en este spec. Confirmado explícitamente por el usuario — se prefiere primero la plomería base y validarla antes de reemplazar `lib/auth.ts`.
- **No:** conectar el Salón de la Fama / `saveScoreEntry` a una tabla real en este spec. Mismo motivo — se deja para un spec dedicado.
- **Sí:** usar `@supabase/ssr` en vez de `@supabase/supabase-js` a secas. Es el paquete recomendado por Supabase para frameworks SSR con sesión en cookies (Next.js App Router), y maneja refresh-token rotation automáticamente.
- **Sí:** tres archivos separados (`client.ts`, `server.ts`, `proxy.ts`) en `lib/supabase/`, siguiendo el patrón oficial de la documentación de Supabase para Next.js en vez de un único archivo mezclando responsabilidades de browser y servidor.
- **Sí:** crear `proxy.ts` (no `middleware.ts`) ya en este spec, aunque todavía no exista auth real. Es infraestructura pura (refresco de cookies de sesión) que no depende de que haya usuarios reales, y evita bugs sutiles de sesión expirada cuando se implemente auth en un spec futuro.
- **No:** incluir lógica de redirect a `/login` en `proxy.ts` en este spec. El ejemplo oficial de Supabase redirige a cualquiera sin sesión válida — copiarlo tal cual rompería toda la app hoy, porque nadie tiene sesión real de Supabase todavía. Esa lógica se agrega junto con el spec de autenticación real.
- **Sí:** usar `supabase.auth.getClaims()` en vez de `supabase.auth.getSession()` para validar la sesión en `proxy.ts`. La documentación oficial de Supabase advierte explícitamente que `getSession()` no revalida el JWT server-side y no debe usarse ahí; `getClaims()` sí valida la firma contra las claves públicas del proyecto.
- **Sí:** usar la nueva `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato `sb_publishable_...`) en vez de la `anon` key legacy. Es la convención que Supabase recomienda activamente para proyectos nuevos, y ya está generada para este proyecto.
- **No:** agregar `SUPABASE_SERVICE_ROLE_KEY` en este spec. No hay ningún código server-side que necesite bypass de RLS todavía; se agrega cuando exista esa necesidad real.
- **No:** tocar `SUPABASE_DB_PASSORD` (typo incluido) en `.env.local`. Confirmado explícitamente por el usuario — queda sin uso, reservada para un futuro acceso directo por `psql`/CLI.

## Risks

| Riesgo                                                                                                                                                                                                                                                                                        | Mitigación                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A partir de este spec, `proxy.ts` corre en (casi) todas las rutas, incluida `/api/contact`. Si `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` faltan o son inválidas en el entorno de despliegue, **toda** la app se rompe en cada request, no solo una feature puntual. | Verificar en implementación que ambas variables estén configuradas en el entorno de despliegue (Vercel u otro) antes de dar el spec por cerrado, no solo en `.env.local` local.                                            |
| El matcher de `proxy.ts` no excluye `/api/*`, así que cada llamada a `/api/contact` dispara también `updateSession()` y una llamada a `getClaims()`, agregando latencia innecesaria a un endpoint que no usa Supabase.                                                                        | Aceptado como costo menor en este spec (llamada local de validación JWT, no una consulta pesada); si la latencia importa, ajustar el matcher para excluir `/api/*` queda como mejora futura, no bloqueante para este spec. |
| Los nombres de cookies (`sb-<project_ref>-auth-token`) y el formato de la publishable key son parte de una migración reciente de Supabase (anon/service_role → publishable/secret) — la doc advierte que las keys legacy funcionan solo "hasta fines de 2026".                                | No aplica corto plazo, pero si en un spec futuro algo falla de forma inexplicable con las keys, revisar primero si Supabase cambió el formato o deprecó alguna variante.                                                   |

## Qué **no** incluye este spec

- Autenticación real con Supabase Auth (reemplazar `lib/auth.ts` y el login falso de `localStorage`).
- Persistir el Salón de la Fama / puntuaciones (`saveScoreEntry`) en una tabla de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` ni ninguna operación admin con bypass de RLS.
- Cualquier tabla, migración o cambio de esquema en la base de datos (el proyecto Supabase sigue vacío al terminar este spec).
- Generación de tipos TypeScript desde el esquema (`generate_typescript_types`).
- Lógica de rutas protegidas o redirects en `proxy.ts`.
- Cualquier cambio a `SUPABASE_DB_PASSORD` en `.env.local`.

Cada uno de estos, si se implementa, va en su propio spec.
