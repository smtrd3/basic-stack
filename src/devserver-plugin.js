import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { mergeConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.resolve(__dirname, "../index.html");
const SERVER_ENTRY = path.join(__dirname, "./server-entry.js");
const OUTPUT_ROOT = path.join(__dirname, "../dist");
const CLIENT_OUTPUT = path.join(__dirname, "../dist/static");

// adds hot reloading stuff and static server routes
const transformEntryModule = (code) => `
${import.meta.env.NODE_ENV === "development" ? "" : `import "dotenv/config";`}
import { resolve } from "node:path";
import { serveStatic } from "hono/bun";

${code}

if (import.meta.env.PROD) {
  const staticServerConfig = {
    root: resolve(__dirname, "./static"),
  };
  const spaConfig = { ...staticServerConfig, path: "index.html" };

  app.get("/*", serveStatic(staticServerConfig));
  app.get("/*", serveStatic(spaConfig));
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
`;

export function devServer() {
	return {
		name: "BasicStackDevServer",
		transform(code, id) {
			if (id.endsWith(SERVER_ENTRY)) {
				return transformEntryModule(code);
			}

			return code;
		},
		config(config) {
			return mergeConfig(config, {
				build: {
					outDir: CLIENT_OUTPUT,
				},
				builder: {
					buildApp: async (builder) => {
						const environments = Object.values(builder.environments).filter(
							(env) => env.name !== "ssr",
						);
						await Promise.all(
							environments.map((environment) => builder.build(environment)),
						);
					},
				},
				environments: {
					server: {
						build: {
							// assetsDir: 'assets', -> default is good enough
							target: "node",
							copyPublicDir: false,
							outDir: OUTPUT_ROOT,
							minify: false,
							commonjsOptions: {
								include: [/node_modules/],
							},
							rolldownOptions: {
								input: {
									index: SERVER_ENTRY,
								},
								output: {
									format: "esm",
									entryFileNames: "[name].js", // will output index.js
								},
							},
						},
					},
				},
			});
		},
		configureServer: (server) => {
			return () => {
				server.middlewares.use(async (req, res, next) => {
					const serverEnv = server.environments.server;

					const url = req.originalUrl;
					if (req.originalUrl) {
						req.url = req.originalUrl;
					}

					// 1. Read index.html
					let template = fs.readFileSync(HTML_PATH, "utf-8");

					// 2. Apply Vite HTML transforms. This injects the Vite HMR client,
					//    and also applies HTML transforms from Vite plugins, e.g. global
					//    preambles from @vitejs/plugin-react
					template = await server.transformIndexHtml(url, template);

					const webReq = new NodeRequest({ req, res });

					try {
						const honoApp = (await serverEnv.runner.import(SERVER_ENTRY))
							.default;
						const matchResult = honoApp.router
							.match(req.method || "GET", url)
							.at(0);

						if ((matchResult?.length || 0) > 0) {
							const webRes = await honoApp.fetch(webReq);
							return sendNodeResponse(res, webRes);
						} else {
							// return HTML if there is no matching api route
							return sendNodeResponse(
								res,
								new Response(template, {
									status: 200,
									headers: { "Content-Type": "text/html" },
								}),
							);
						}
					} catch (ex) {
						console.error(ex);
						try {
							server.ssrFixStacktrace(ex);
						} catch (_e) {}
					}
				});
			};
		},
	};
}
