import 'dotenv/config'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeRequest, sendNodeResponse } from 'srvx/node'
import { mergeConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ============================================================================
// PATHS - Customize these to change project structure
// ============================================================================
const PATHS = {
  html: path.resolve(__dirname, './index.html'),
  serverEntry: path.join(__dirname, './src/server-entry.js'), // Your Hono app
  outputRoot: path.join(__dirname, './dist'), // Server bundle output
  clientOutput: path.join(__dirname, './dist/static'), // Client assets output
}

// ============================================================================
// SERVER CODE INJECTION - Code appended to server-entry.js at build time
// ============================================================================
// This template wraps your server code with:
// - dotenv loading in production
// - Static file serving for the SPA
// - HMR acceptance for dev mode
//
// How the server runs:
// Your server-entry.js exports { fetch, port }. Bun has a convention where
// if a module's default export has these properties, it automatically starts
// an HTTP server — no explicit serve() call needed.
//
// Example: export default { fetch: app.fetch, port: 3000 }
// When you run `bun ./dist/index.js`, Bun sees this and serves on port 3000.
//
// Customize: Add middleware, logging, or other server setup here
const SERVER_INJECTED_CODE = `
${import.meta.env.NODE_ENV === 'development' ? '' : `import "dotenv/config";`}
import { resolve } from "node:path";
import { serveStatic } from "hono/bun";

__CODE__

// Production static file serving - serves client build + SPA fallback
if (import.meta.env.PROD) {
  const staticConfig = { root: resolve(__dirname, "./static") };
  app.get("/*", serveStatic(staticConfig));
  app.get("/*", serveStatic({ ...staticConfig, path: "index.html" })); // SPA fallback
}

// HMR support for server code
if (import.meta.hot) {
  import.meta.hot.accept();
}
`

// ============================================================================
// SERVER BUILD CONFIG - Customize Node/Bun server bundling
// ============================================================================
const serverBuildConfig = {
  build: {
    target: 'node', // Change to 'bun' if using Bun-specific APIs
    copyPublicDir: false,
    outDir: PATHS.outputRoot,
    minify: false, // Set true for smaller production bundles
    commonjsOptions: { include: [/node_modules/] },
    rolldownOptions: {
      input: { index: PATHS.serverEntry },
      output: {
        format: 'esm',
        entryFileNames: '[name].js', // Output: dist/index.js
      },
    },
  },
}

// Builds all environments except SSR (we handle server separately)
const buildAppExcludingSSR = async (builder) => {
  const environments = Object.values(builder.environments).filter((env) => env.name !== 'ssr')
  await Promise.all(environments.map((env) => builder.build(env)))
}

// ============================================================================
// DEV MIDDLEWARE - Handles requests during development
// ============================================================================
// Request flow:
// 1. Transform index.html (injects HMR client, React refresh, etc.)
// 2. Try server routes first
// 3. If 404, serve the SPA shell (client-side routing)
//
// Request conversion (Connect → Fetch API):
// Vite's dev server uses Connect-style middleware (req: IncomingMessage, res: ServerResponse).
// But Hono uses the Fetch API (Request → Response). We bridge them using srvx:
// - NodeRequest: Wraps Node's (req, res) into a Web API Request object
// - sendNodeResponse: Converts a Web API Response back to Node's res.end()
// This lets us use the same Hono server code in both dev (Vite/Node) and prod (Bun).
//
// Customize: Add request logging, auth checks, or custom headers here

const htmlResponse = (template) =>
  new Response(template, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })

const createDevMiddleware = (server) => async (req, res) => {
  if (req.originalUrl) req.url = req.originalUrl

  const template = await server.transformIndexHtml(req.url, fs.readFileSync(PATHS.html, 'utf-8'))

  try {
    const serverApp = (await server.environments.server.runner.import(PATHS.serverEntry)).default
    const serverRes = await serverApp.fetch(new NodeRequest({ req, res }))

    // API routes return their response, everything else gets the SPA
    const response = serverRes.status === 404 ? htmlResponse(template) : serverRes
    return sendNodeResponse(res, response)
  } catch (err) {
    console.error(err)
    server.ssrFixStacktrace?.(err)
  }
}

// ============================================================================
// VITE PLUGIN - Ties everything together
// ============================================================================
function devServer() {
  return {
    name: 'BasicStackDevServer',

    // Injects production code into server entry
    transform: (code, id) =>
      id.endsWith(PATHS.serverEntry) ? SERVER_INJECTED_CODE.replace('__CODE__', code) : code,

    // Merges our config with user's vite config
    config: (config) =>
      mergeConfig(config, {
        build: { outDir: PATHS.clientOutput },
        builder: { buildApp: buildAppExcludingSSR },
        environments: { server: serverBuildConfig },
      }),

    // Registers dev middleware (returned fn runs after Vite's built-in middleware)
    configureServer: (server) => () => server.middlewares.use(createDevMiddleware(server)),
  }
}

// ============================================================================
// MAIN CONFIG
// ============================================================================
// Add/remove plugins here:
// - react(): React Fast Refresh + JSX transform
// - tailwindcss(): Tailwind CSS JIT compilation
// - devServer(): Our custom full-stack dev server
export default defineConfig({
  plugins: [react(), tailwindcss(), devServer()],
  server: {
    port: process.env.PORT, // Set in .env or defaults to 5173
  },
})
