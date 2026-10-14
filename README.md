# Basic Stack

Minimal yet modern full-stack boilerplate with hot reloading on both ends. React + Tailwind frontend, Hono backend, powered by superfast Vite 8 (Rolldown). Perfect for rapid prototyping and hobby projects.

## Quick Start

```sh
bunx degit smtrd3/basic-stack my-app
cd my-app
bun install
bun run dev
```

## Philosophy

- **Fast iterations** — optional TypeScript, relaxed rules
- **Minimal tooling** — no lint/test overhead
- **Long term stability** — standard based approach
- **Low complexity** — no SSR, just SPA + API

## Included Utilities

| Package    | Purpose                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `dotenv`   | Secrets management. Frontend uses `import.meta.env` with `VITE_` prefix |
| `wouter`   | Lightweight, context-free routing                                       |
| `mutative` | Clean immutable state updates without boilerplate                       |
| `nanoid`   | Fast unique ID generation for keys, URLs, identifiers                   |

## Font

[Recursive](https://recursive.design) is self-hosted from `public/fonts/recursive` (variable font, SIL OFL). One font file covers every variant and style; it is split into unicode-range subsets so browsers download only what a page uses. Configured in `src/fonts.css`:

| Variant     | Class                                |
| ----------- | ------------------------------------ |
| Sans Linear | `font-sans` (default)                |
| Sans Casual | `font-casual`                        |
| Mono Linear | `font-mono` (also `<code>`, `<pre>`) |
| Mono Casual | `font-mono casual`                   |

Weights `font-light` (300) to `font-extrablack` (1000), `italic` for slanted cursive forms, and `casual` / `linear` to switch any family. Fine-tune axes with arbitrary properties, e.g. `[--rec-casl:0.5]` or `[--rec-slnt:-8]`.

## PWA (Optional)

Off by default, so the template stays free of Workbox's ~300 packages. To make the app installable and work offline:

```sh
bun add -D vite-plugin-pwa @vite-pwa/assets-generator
```

Then set `const PWA = true` in `vite.config.js`. Icons are generated from `public/appicon.svg` at build time; name and description come from `package.json`. Adjust both in the PWA section of `vite.config.js`.

- Production builds only: dev has no service worker, so hot reload is unaffected
- New deploys take over on the next visit
- `/api/*` requests always reach the server, never the cached app

## How It Works

`vite.config.js` holds the whole full-stack integration. Your `src/server-entry.js` exports `{ fetch, port }` and is never modified. Requests go through the same steps in dev and production:

1. Your server routes
2. Static files (Vite in dev, the client build in production)
3. On 404, page navigations get `index.html` for client-side routing. Other 404s (e.g. an API returning `c.json(..., 404)`) are passed through unchanged

`bun run build` produces a self-contained `dist/` (dependencies bundled), so `bun dist/index.js` runs without `node_modules`.

## Deployment (pm2)

Deploys the production build to `~/.apps/<package name>` on a Linux machine and runs it under [pm2](https://pm2.keymetrics.io).

**Prerequisites** (not installed by the script):

- [Bun](https://bun.sh), which builds and runs the app
- [Node.js](https://nodejs.org), which pm2 itself runs on
- pm2: `bun add -g pm2`

```sh
bun run deploy          # Build, deploy and start; rolls back if the new build doesn't come up
bun run prod:status     # Process, URL, build and log summary
bun run prod:logs       # Follow the logs (-n 100, --no-follow)
bun run prod:cleanup    # Clear the log files
bun run prod:start      # Also: prod:stop, prod:restart, prod:rollback
```

- `.env` and `data/` are copied on the first deploy, then belong to the deployed app (edit `~/.apps/<name>/.env`)
- Logs are written to `~/.apps/<name>/logs/` with timestamps, in production only. Dev logs to the console
- The previous build is kept, so `prod:rollback` switches back instantly
- Settings: `APP_NAME`, `APPS_DIR`, `HEALTH_PATH` (env or `.env`). Run `pm2 startup` once to survive reboots

## TypeScript (Optional)

TypeScript is pre-configured with relaxed rules. Mix `.js` and `.ts` files freely:

- Rename any file to `.ts`/`.tsx` to enable type checking for that file
- No strict mode, no implicit any errors — types are helpers, not constraints
- Run `bun run typecheck` to check types manually

## Setup

Create a `.env` file:

```sh
PORT=3000
```

## Commands

```sh
bun run dev      # Start dev server with HMR
bun run build    # Build for production
bun run start    # Build and run in production mode
bun run format   # Format all files
bun run deploy   # Deploy with pm2 (see Deployment)
```
