# Basic Stack

Minimal yet modern full-stack boilerplate with hot reloading on both ends. React + Tailwind frontend, Hono backend, powered by superfast Vite 7 (rolldown version). Perfect for rapid prototyping and hobby projects.

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
```
