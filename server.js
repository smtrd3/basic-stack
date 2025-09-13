// server.js
import "dotenv/config";
import path from "path";
import express from "express";
import chokidar from "chokidar";
import { createServer as createViteServer } from "vite";

const IS_DEV = process.env.NODE_ENV === "development";

let routes = null;
let vite = null;

async function loadBackend() {
  const mod = await import(`./src/server/routes.js?update=${Date.now()}`);
  return mod.default;
}

async function startServer() {
  const app = express();

  // Initial backend load
  routes = await loadBackend();

  // Mount backend router
  app.use(process.env.API_PREFIX, (req, res, next) => {
    routes(req, res, next);
  });

  if (IS_DEV) {
    // Watch backend files for changes
    chokidar.watch("./src/server").on("change", async (filePath) => {
      // clear import cache
      delete require.cache[require.resolve(path.resolve(filePath))];

      console.log("♻️ Reloading backend routes...");
      routes = await loadBackend();
    });

    // Create Vite server in middleware mode
    vite = await createViteServer({
      server: { middlewareMode: true },
      root: process.cwd(),
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static("./dist"));
  }

  app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
  });
}

startServer().catch(console.error);
