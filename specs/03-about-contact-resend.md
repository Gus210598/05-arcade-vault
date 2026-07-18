# SPEC 03 — About page + envío de contacto vía Resend

> **Status:** Aprobado
> **Depends on:** [[02-navbar-home-landing]]
> **Date:** 2026-07-17
> **Objective:** Implementar `app/about/page.tsx` portando `references/templates/home-about/about.jsx` tal cual (hero, highlights, formulario de contacto), conectando el envío del formulario a un endpoint propio (`app/api/contact/route.ts`) que usa Resend para mandar un correo real a `gustavo.barahona.i@gmail.com` con los datos enviados.

**Notas de la ruta ya existente:** el link "Acerca de" en `components/Nav.tsx` ya apunta a `/about` (spec 02) y hoy resuelve al `not-found.tsx` estilizado porque la página no existe — este spec la crea.

## Scope

**In:**

- Nueva ruta `app/about/page.tsx` (Client Component), portando `about.jsx` tal cual: hero "ACERCA DE ARCADE VAULT" con misión y `highlight-row` (3 tarjetas: HEART/BROWSER/PLANT), divider decorativo con pixels animados, sección de contacto con `contact-intro` (kicker, título, subtítulo, tips) y `contact-form`.
- Animación `reveal` vía `IntersectionObserver` idéntica a la plantilla (clases `.reveal` / `.in` ya deben existir en `globals.css` desde specs anteriores — si no existen, se agregan en este spec).
- `HighlightIcon` (SVG pixelado HEART/BROWSER/PLANT) como componente local dentro de `app/about/page.tsx`.
- CSS: portar a `app/globals.css` el bloque `ABOUT PAGE` completo de `references/templates/home-about/styles.css` (líneas 1071–1150 aprox., desde `.about` hasta `.term-body .caret`), **sin** el bloque `GAMEPAD` que le sigue.
- Formulario de contacto con estado `name` / `email` / `message` (+ campo honeypot oculto), validación client-side: campos no vacíos + formato de email básico (regex simple), animación `shake` en error de validación (igual que la plantilla).
- Nuevo endpoint `app/api/contact/route.ts` (Route Handler, `POST`), que recibe `{ name, email, message, honeypot }`, descarta silenciosamente si `honeypot` viene relleno (responde éxito sin enviar nada), valida los mismos campos en servidor, y usa el SDK `resend` para enviar un correo a `gustavo.barahona.i@gmail.com` con `from: onboarding@resend.dev`, `replyTo: <email del remitente>`, asunto y cuerpo con nombre/email/mensaje.
- Estado de carga en el botón de envío ("▶ ENVIANDO..." + `disabled`) mientras se espera la respuesta del endpoint.
- Estado de error: mensaje inline sobre el formulario ("Error al enviar. Intenta de nuevo.") + animación `shake`, sin tocar el bloque visual `terminal-success` existente.
- Estado de éxito: se mantiene igual que la plantilla — el `terminal-success` reemplaza el formulario tras una respuesta 200 real del endpoint (ya no es instantáneo/simulado).
- Dependencia nueva `resend` en `package.json`.
- `.env.local` (no versionado) con `RESEND_API_KEY`, que el usuario ya tiene y pegará en implementación.
- `.env.example` con `RESEND_API_KEY=` vacío, como referencia para el repo.

**Out of scope (para otro spec):**

- Dominio propio verificado en Resend (se usa el sender de pruebas `onboarding@resend.dev`, que solo permite enviar al correo verificado en la cuenta de Resend usada).
- Confirmación por correo al remitente del formulario (solo se notifica a `gustavo.barahona.i@gmail.com`; no se envía copia/auto-respuesta al usuario).
- Rate limiting o protección anti-spam más allá del honeypot (captcha, límites por IP, etc.).
- Bloque CSS `GAMEPAD` de la plantilla — nada en este spec lo usa.
- Cualquier cambio a `components/Nav.tsx` — el link "Acerca de" ya existe y ya apunta a `/about` desde spec 02.
- Persistencia de los mensajes de contacto (no se guardan en base de datos ni localStorage; solo se envían por correo).

## Data model

Este feature no introduce estructuras de datos persistentes. Define únicamente el shape del payload que viaja entre el formulario y el endpoint.

```ts
// Payload enviado por el cliente a POST /api/contact
type ContactPayload = {
  name: string;
  email: string;
  message: string;
  honeypot: string; // campo oculto, debe llegar vacío en envíos legítimos
};

// Respuesta del endpoint
type ContactResponse = { ok: true } | { ok: false; error: string };
```

Conventions:

- Validación de email: regex simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`, aplicada igual en cliente y en el Route Handler.
- El honeypot nunca se muestra al usuario (input oculto vía CSS, fuera del flujo de tab con `tabIndex={-1}` y `autoComplete="off"`).
- Variable de entorno `RESEND_API_KEY` leída solo en el Route Handler (server-side), nunca expuesta al cliente.

## Implementation plan

1. Instalar la dependencia `resend` (`npm install resend`). Crear `.env.example` con `RESEND_API_KEY=` y `.env.local` (gitignorado) con la key real que el usuario ya tiene. Test manual: `npm run dev` sigue levantando sin errores.
2. En `app/globals.css`, agregar al final el bloque `ABOUT PAGE` completo de `references/templates/home-about/styles.css` (de `.about { position: relative; }` hasta `.term-body .caret { ... }`), sin el bloque `GAMEPAD`. Test manual: `npm run dev` sigue sin errores de consola.
3. Crear `app/api/contact/route.ts`: `POST` handler que parsea el body como `ContactPayload`, valida `name`/`email`/`message` no vacíos + formato de email, descarta silenciosamente (responde `{ ok: true }`) si `honeypot` viene relleno, y si todo es válido llama a `resend.emails.send({...})` con `from: "onboarding@resend.dev"`, `to: "gustavo.barahona.i@gmail.com"`, `replyTo: email`, asunto `Nuevo mensaje de contacto — Arcade Vault` y cuerpo con nombre/email/mensaje. Devuelve `{ ok: false, error }` con status 400/500 en validación fallida o error de Resend. Test manual: `curl -X POST http://localhost:3000/api/contact` con body de prueba devuelve `{ ok: true }` y llega el correo a la bandeja de entrada.
4. Crear `app/about/page.tsx` (Client Component) portando `about.jsx`: hero, `highlight-row` con `HighlightIcon` local, divider animado, sección de contacto con `contact-intro` y `contact-form`. El `onSubmit` ahora hace `fetch("/api/contact", { method: "POST", body: JSON.stringify(payload) })`, maneja tres estados (`idle` → `loading` → `success` | `error`): botón muestra "▶ ENVIANDO..." + `disabled` durante `loading`; en `error` muestra mensaje inline + dispara `shake`; en `success` reemplaza el formulario por el `terminal-success` ya existente en la plantilla. Incluye el input honeypot oculto. Reveal con `IntersectionObserver` igual que la plantilla. Test manual: visitar `/about`, ver hero + highlights + divider + formulario; enviar con campos vacíos dispara shake sin llamar al endpoint; enviar con email inválido dispara shake; enviar válido muestra "ENVIANDO...", luego `terminal-success`, y el correo llega a `gustavo.barahona.i@gmail.com`.
5. Pasada final: recorrer `/about` en desktop y en un viewport móvil (<840px), confirmar que el link "Acerca de" del nav (desktop y panel móvil) ya no cae en el 404 sino que carga esta página, y que el resto de rutas (`/`, `/juegos`, `/salon`, `/login`, `/juego/[id]`) no se rompieron. Test manual: sin errores de consola en ninguna ruta; formulario funciona igual en mobile.

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor.
- [ ] `/about` ya no muestra el 404; muestra el hero "ACERCA DE ARCADE VAULT", la misión, las 3 tarjetas de `highlight-row`, el divider animado y el formulario de contacto.
- [ ] El link "Acerca de" del Nav (desktop y panel móvil) navega a `/about` y aparece marcado como activo.
- [ ] Enviar el formulario con algún campo vacío dispara la animación `shake` y no hace ninguna llamada de red.
- [ ] Enviar el formulario con un email con formato inválido (ej. `"abc"`) dispara `shake` y no hace ninguna llamada de red.
- [ ] Enviar el formulario con datos válidos deshabilita el botón y muestra "▶ ENVIANDO..." mientras espera la respuesta.
- [ ] Un envío válido exitoso reemplaza el formulario por el bloque `terminal-success` con el nombre del remitente en mayúsculas.
- [ ] Un envío válido exitoso hace llegar un correo real a `gustavo.barahona.i@gmail.com` con nombre, email y mensaje del remitente, y `Reply-To` apuntando al email del remitente.
- [ ] Si el endpoint `/api/contact` responde error (ej. `RESEND_API_KEY` inválida), el formulario muestra un mensaje de error inline + `shake`, sin perder los datos ya escritos.
- [ ] Rellenar el campo honeypot oculto (simulándolo vía devtools) hace que el endpoint responda éxito sin enviar el correo.
- [ ] `RESEND_API_KEY` no aparece en ningún bundle enviado al cliente (verificable inspeccionando el código fuente servido en el navegador).
- [ ] Recorrer `/`, `/juegos`, `/salon`, `/login`, `/juego/[id]`, `/about` en desktop y en viewport móvil (<840px) sin errores de consola ni links rotos.

## Decisions

- **Sí:** usar un Route Handler (`app/api/contact/route.ts`) en vez de una Server Action. Resend requiere ejecutarse server-side y un endpoint REST explícito es más fácil de probar con `curl` de forma aislada.
- **No:** usar Server Actions (`"use server"`). Válido en Next 16, pero el Route Handler mantiene el formulario como `fetch` explícito, más cercano al comportamiento original de la plantilla (`onSubmit` con `preventDefault`).
- **Sí:** sender de pruebas `onboarding@resend.dev`, sin dominio propio verificado. El usuario confirmó que aún no tiene dominio verificado en Resend; agregar uno queda fuera de este spec.
- **Sí:** notificar solo a `gustavo.barahona.i@gmail.com`, sin correo de confirmación al remitente. Menor complejidad, y el sender de pruebas de Resend no garantiza entrega a direcciones arbitrarias de todas formas.
- **Sí:** `replyTo` con el email del remitente. Permite responder directamente desde el cliente de correo sin trabajo extra, sin necesitar guardar el mensaje en ningún lado.
- **Sí:** honeypot oculto como única protección anti-spam. Confirmado explícitamente por el usuario como suficiente para este spec; sin captcha ni rate limiting.
- **Sí:** validación de formato de email (regex simple) en cliente y servidor. Confirmado explícitamente por el usuario para evitar que Resend falle silenciosamente por direcciones mal formadas.
- **Sí:** estado de carga ("ENVIANDO...") en el botón de envío. Confirmado explícitamente por el usuario — con red real hay latencia que la plantilla original (simulada) no tenía.
- **Sí:** error de envío se muestra como mensaje inline + `shake`, reutilizando la animación de validación ya existente en la plantilla, en vez de diseñar un nuevo bloque visual tipo `terminal-success` en rojo. Menor esfuerzo de diseño, consistente con el resto del formulario.
- **No:** persistir los mensajes de contacto en base de datos o `localStorage`. Fuera de alcance; el correo es el único canal de registro del mensaje.
- **No:** modificar `components/Nav.tsx`. El link "Acerca de" ya apunta a `/about` desde spec 02; este spec solo crea la página que faltaba.

## Risks

| Riesgo                                                                                                                                                                             | Mitigación                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onboarding@resend.dev` solo entrega a la dirección con la que se creó la cuenta de Resend. Si esa cuenta no es `gustavo.barahona.i@gmail.com`, los envíos fallarán en producción. | Verificar en implementación que la cuenta de Resend usada tenga `gustavo.barahona.i@gmail.com` como email verificado antes de dar el spec por cerrado. |
| `RESEND_API_KEY` ausente o inválida en el entorno de despliegue.                                                                                                                   | El endpoint valida la respuesta de Resend y devuelve `{ ok: false }`, que el formulario muestra como error inline en vez de fallar en silencio.        |

## Qué **no** incluye este spec

- Dominio propio verificado en Resend.
- Correo de confirmación/auto-respuesta al remitente del formulario.
- Rate limiting o captcha (solo honeypot).
- Persistencia de mensajes de contacto en base de datos o `localStorage`.
- Cambios a `components/Nav.tsx`.
- Bloque CSS `GAMEPAD` de la plantilla.

Cada uno de estos, si se implementa, va en su propio spec.
