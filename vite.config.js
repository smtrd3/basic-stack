import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { NodeRequest, sendNodeResponse } from "srvx/node";

// ─── Project layout ─────────────────────────────────────────────────────────

const root = import.meta.dirname;

const PATHS = {
  html: path.join(root, "index.html"),
  serverEntry: path.join(root, "src/server-entry.js"), // Your Hono app
  serverOutput: path.join(root, "dist"), // dist/index.js
  clientOutput: path.join(root, "dist/static"),
};

// Virtual module that wraps your server entry for production
const PROD_ENTRY_ID = "virtual:basic-stack/server";
const RESOLVED_PROD_ENTRY_ID = `\0${PROD_ENTRY_ID}`;

// ─── Vite config ────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), tailwindcss(), fullStack()],
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
  server: {
    host: true, // Listen on all interfaces, reachable from your network
    port: process.env.PORT, // From .env, defaults to 5173
  },
});

// ─── Full-stack plugin ──────────────────────────────────────────────────────
// Runs your Hono server next to the React SPA, in dev and in the production build.

function fullStack() {
  return {
    name: "BasicStackDevServer",

    config: (_config, { command }) => ({
      appType: "custom", // index.html is served by our middleware, not Vite's SPA fallback
      build: { outDir: PATHS.clientOutput },
      builder: { buildApp: buildClientAndServer },
      environments: { server: serverEnvironment(command) },
    }),

    // Returning a function registers the middleware after Vite's own
    configureServer: (server) => () => server.middlewares.use(devMiddleware(server)),

    resolveId: (id) => (id === PROD_ENTRY_ID ? RESOLVED_PROD_ENTRY_ID : undefined),
    load: (id) => (id === RESOLVED_PROD_ENTRY_ID ? prodEntryCode(PATHS.serverEntry) : undefined),
  };
}

// ─── Request routing (dev and prod) ─────────────────────────────────────────
// 1. Your server routes  2. Static files  3. index.html for page navigations.
// Other 404s (API calls, missing assets) are returned unchanged.

function isPageRequest(req) {
  const isRead = req.method === "GET" || req.method === "HEAD";
  return isRead && (req.headers.get("accept") ?? "").includes("text/html");
}

// ─── Development ────────────────────────────────────────────────────────────
// Vite has already served modules and public files by the time we get here.
// srvx bridges Node's (req, res) to the Fetch API Request/Response Hono expects.

function devMiddleware(vite) {
  return async (req, res, next) => {
    try {
      const { default: app } = await vite.environments.server.runner.import(PATHS.serverEntry);
      const request = new NodeRequest({ req, res });
      let response = await app.fetch(request);

      if (response.status === 404 && isPageRequest(request)) {
        response = await indexHtmlResponse(vite, req.url);
      }
      await sendNodeResponse(res, response);
    } catch (err) {
      next(err); // Vite logs it and renders its error page
    }
  };
}

// index.html with the HMR client and React refresh injected
async function indexHtmlResponse(vite, url) {
  const template = await fs.readFile(PATHS.html, "utf-8");
  const html = await vite.transformIndexHtml(url, template);
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
}

// ─── Production build ───────────────────────────────────────────────────────

function serverEnvironment(command) {
  return {
    resolve: {
      // Bundle dependencies on build so dist/ runs without node_modules
      noExternal: command === "build" ? true : [],
    },
    build: {
      target: "esnext", // Bun runs the latest JS
      outDir: PATHS.serverOutput,
      copyPublicDir: false,
      minify: false,
      rolldownOptions: {
        input: { index: PROD_ENTRY_ID },
        output: { format: "esm", entryFileNames: "[name].js" },
      },
    },
  };
}

// Builds client and server in parallel, skipping Vite's default SSR environment
async function buildClientAndServer(builder) {
  const environments = Object.values(builder.environments).filter((env) => env.name !== "ssr");
  await Promise.all(environments.map((env) => builder.build(env)));
}

// Production entry: imports your server and adds static files + SPA fallback.
// Bun starts a server for any default export with a fetch(); other Bun.serve()
// options you export (port, websocket, ...) are passed through.
function prodEntryCode(serverEntry) {
  return `
import "dotenv/config";
import { join, sep } from "node:path";
import server from ${JSON.stringify(serverEntry)};

const root = join(import.meta.dirname, "static");

${isPageRequest}

// A file from the client build, or undefined
async function serveFile(pathname) {
  try {
    const filePath = join(root, decodeURIComponent(pathname));
    const file = Bun.file(filePath);
    if (filePath.startsWith(root + sep) && (await file.exists())) return new Response(file);
  } catch {} // Malformed URI: not found
}

export default {
  development: false,
  ...server,
  async fetch(req, bunServer) {
    const res = await server.fetch(req, bunServer);
    if (res.status !== 404 || (req.method !== "GET" && req.method !== "HEAD")) return res;

    const file = await serveFile(new URL(req.url).pathname);
    if (file) return file;
    if (isPageRequest(req)) return (await serveFile("/index.html")) ?? res;
    return res;
  },
};
`;
}
