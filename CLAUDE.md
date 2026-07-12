# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Non-standard Next.js version

This project pins `next@16.2.10` with `react@19.2.4`, which is **ahead of your training data and has breaking changes** vs. the Next.js you know. Before writing any App Router code (routing, data fetching, caching, `middleware`, config), check the bundled docs at `node_modules/next/dist/docs/01-app/` rather than relying on prior knowledge.

Known breaking change already surfaced: **`middleware.ts` is deprecated and renamed to `proxy.ts`**, with the exported function named `proxy` instead of `middleware` (see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). If a task involves request interception, use `proxy.ts`, not `middleware.ts`.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config via `eslint.config.mjs`, `eslint-config-next` core-web-vitals + typescript rules)

There is no test runner configured yet.

## Project state

This is a freshly scaffolded `create-next-app` project (App Router, TypeScript, Tailwind CSS v4) — `app/page.tsx` and `app/layout.tsx` still contain the default starter content. No custom routes, components, or domain logic exist yet.

- `app/` — App Router root (`layout.tsx`, `page.tsx`, `globals.css`)
- Path alias `@/*` maps to the project root (`tsconfig.json`)
- Styling: Tailwind v4 via `@import "tailwindcss"` in `app/globals.css`, using `@theme inline` for CSS-variable-driven theming (light/dark via `prefers-color-scheme`), and `next/font/google` (Geist, Geist Mono) wired through CSS variables in `layout.tsx`

## Product intent (from README)

Arcade Vault is a platform to play games online and compete for points. The project follows **Spec Driven Design**, built around the `/spec` and `/spec-impl` workflow from Klerith's `fernando-skills` skill pack (`npx skills@latest add Klerith/fernando-skills`). If those skills are installed in this environment, prefer driving new feature work through that spec → spec-impl flow rather than writing ad hoc code.
