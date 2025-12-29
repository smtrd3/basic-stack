# Basic Stack

Minimal yet modern full-stack boilerplate with hot reloading on both ends. React + Tailwind frontend, Hono backend, powered by superfast Vite 7 (rolldown version). Perfect for rapid prototyping and hobby projects.

## Philosophy

- **Fast iterations** — no TypeScript bloat
- **Minimal tooling** — no lint/test overhead
- **Long term stability** — standard based approach
- **Low complexity** — no SSR, just SPA + API

## Included Utilities

| Package | Purpose |
|---------|---------|
| `dotenv` | Secrets management. Frontend uses `import.meta.env` with `VITE_` prefix |
| `wouter` | Lightweight, context-free routing |
| `mutative` | Clean immutable state updates without boilerplate |
| `nanoid` | Fast unique ID generation for keys, URLs, identifiers |

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
