# Basic Stack

A minimal full-stack setup with hot reloading for both frontend and backend.
Built with React, Tailwind CSS, Express, and Bun — optimized for fast iteration and simple hobby projects.

## Some useful utilities are also included, such as:

`dotenv` -> for secrets management

`mutative` -> makes state updates look cleaner and more expressive (immutability without boilerplate)

`shortid` -> quick, user-friendly unique ID generation for cases like keys, URLs, or temporary identifiers

## Phylosophy:

⚡ Fast iterations (no typescript bloat)

🪶 Minimal tooling and dependencies (no lint/test)

🛠️ Long term stability

🌉 Sits between "PHP + jQuery" and "Next.js"

## Setup

Create .env file with following information then run one of the command shown below

```
PORT=3000
API_PREFIX = /api
# front-end secrets (read from import.meta.env)
VITE_TEST=test
```

## Project Structure:

`src/server/routes.js` → export your backend routes here

`src/App.jsx` → frontend root component

## Commands

`bun run dev` -> start the dev server

`bun run build` -> build the front-end

`bun run start` -> start the project in production mode
