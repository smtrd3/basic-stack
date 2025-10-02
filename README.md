# Basic Stack

Minimal yet modern full-stack boilerplate with hot reloading on both ends. React + Tailwind frontend, Hono backend, powered by superfast vite 7 (rolldown version). Perfect for rapid prototyping and hobby projects.

## Some useful utilities are also included, such as:

`dotenv` -> for secrets management. Note: on frontend `process.env` is not supported however if you prefix your env vars with `VITE_` then they can be used across frontend and backend using native vite integration i.e. `import.meta.env` object.

`wouter` -> for lightweigt and context free routing solution

`mutative` -> makes state updates look cleaner and more expressive (immutability without boilerplate)

`nanoid` -> quick, user-friendly unique ID generation for cases like keys, URLs, or temporary identifiers

## Phylosophy:

⚡ Fast iterations (no typescript bloat)

🪶 Minimal tooling and dependencies (no lint/test)

🛠️ Long term stability

🌉 Standard based and low complexity (no SSR)

## Setup

Create .env file with following information then run one of the command shown below

```
PORT=3000
```

## Commands

`bun run dev` -> start the dev server

`bun run build` -> build the app

`bun run start` -> builds and runs the project in production mode
