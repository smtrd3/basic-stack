#!/usr/bin/env bun
// Production deployments with pm2, for any project built on this template.
//
//   bun run deploy               build, deploy to ~/.apps/<name>, start, roll back on failure
//   bun run prod:<command>       start, stop, restart, rollback, status, logs, cleanup
//
// The deployed app keeps its own .env and data/: copied on the first deploy, never overwritten.
//
// Prerequisites, none installed by this script: Bun, Node.js (pm2 runs on it) and pm2.

import { $ } from "bun";
import { Database } from "bun:sqlite";
import { parse as parseEnv } from "dotenv";
import fs from "node:fs/promises";
import { builtinModules } from "node:module";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

// ─── Settings ───────────────────────────────────────────────────────────────
// APP_NAME, APPS_DIR and HEALTH_PATH can be set in the environment or this project's .env

const ROOT = path.resolve(import.meta.dir, "..");
const pkg = await Bun.file(path.join(ROOT, "package.json")).json();

const NAME = process.env.APP_NAME || slug(pkg.name) || path.basename(ROOT);
const APP = path.join(process.env.APPS_DIR || path.join(os.homedir(), ".apps"), NAME);
const HEALTH_PATH = process.env.HEALTH_PATH || "/";
const BUN = process.execPath;

const at = (...parts) => path.join(APP, ...parts);
const LOGS = { out: at("logs", "out.log"), error: at("logs", "error.log") };
const ECOSYSTEM = at("ecosystem.config.cjs");

$.cwd(ROOT);

// ─── Commands ───────────────────────────────────────────────────────────────

const commands = {
  deploy: { about: "Build, deploy and start; rolls back if the new build fails", run: deploy },
  start: { about: "Start the deployed build", run: start },
  stop: { about: "Stop the app (stays stopped after a reboot)", run: stop },
  restart: { about: "Stop and start again", run: restart },
  rollback: { about: "Switch to the previous build (run again to switch back)", run: rollback },
  status: { about: "Process, URL, build and log summary", run: status },
  logs: { about: "Follow the logs  [-n <lines>] [--no-follow]", run: logs },
  cleanup: { about: "Clear the log files", run: cleanup },
};

async function deploy() {
  await requirePm2();

  say("Building");
  await $`${BUN} run build`;

  say(`Preparing ${tilde(APP)}`);
  await fs.mkdir(at("logs"), { recursive: true });
  await replaceDir(path.join(ROOT, "dist"), at("dist.next"));
  await writeBuildInfo(at("dist.next"));
  await copyFirstDeployFiles();
  await installExternalPackages(at("dist.next"));
  await writeEcosystem();

  // Checked before touching the running instance, so a conflict changes nothing
  const { port } = await endpoint();
  const owner = await portOwner(port);
  if (owner && owner !== (await pm2.process())?.pid) {
    die(`Port ${port} is used by another program (pid ${owner}). Nothing was changed.
  Stop that program, or set another PORT in ${tilde(at(".env"))}, then deploy again.`);
  }

  say("Switching to the new build");
  await pm2.remove();
  await fs.rm(at("dist.prev"), { recursive: true, force: true });
  if (await exists(at("dist"))) await fs.rename(at("dist"), at("dist.prev"));
  await fs.rename(at("dist.next"), at("dist"));

  if (await startAndCheck()) return say(`Deployed: ${NAME} is running on ${await url()}`);
  if (!(await exists(at("dist.prev"))))
    die(`${NAME} did not come up. Its last log lines are above.`);

  say("Rolling back to the previous build");
  await pm2.remove();
  await fs.rm(at("dist.failed"), { recursive: true, force: true });
  await fs.rename(at("dist"), at("dist.failed"));
  await fs.rename(at("dist.prev"), at("dist"));

  if (await startAndCheck()) {
    die(`The new build did not come up, so the previous one is running again.
  The failed build is kept in ${tilde(at("dist.failed"))}.`);
  }
  die("Neither the new nor the previous build came up. Their last log lines are above.");
}

async function start() {
  await requirePm2();
  await requireDeployed();

  const running = await pm2.process();
  if (running?.status === "online") return say(`${NAME} is already running (pid ${running.pid})`);

  await pm2.remove(); // Clears a stopped or errored entry
  const { port } = await endpoint();
  const owner = await portOwner(port);
  if (owner) die(`Port ${port} is used by another program (pid ${owner}).`);

  await writeEcosystem();
  if (!(await startAndCheck())) die(`${NAME} did not come up. Its last log lines are above.`);
  say(`${NAME} is running on ${await url()}`);
}

// Removed from pm2 rather than paused: `pm2 resurrect` after a reboot would start a paused app
async function stop() {
  await requirePm2();
  if (!(await pm2.process())) return say(`${NAME} is not running`);
  await pm2.remove();
  say(`Stopped ${NAME}`);
}

async function restart() {
  await stop();
  await start();
}

async function rollback() {
  await requirePm2();
  await requireDeployed();
  if (!(await exists(at("dist.prev")))) die("There is no previous build to roll back to.");

  say("Switching to the previous build");
  await pm2.remove();
  await fs.rename(at("dist"), at("dist.swap"));
  await fs.rename(at("dist.prev"), at("dist"));
  await fs.rename(at("dist.swap"), at("dist.prev"));

  if (!(await startAndCheck())) die(`${NAME} did not come up. Run rollback again to switch back.`);
  say(`Rolled back: ${NAME} is running ${describeBuild(await readBuildInfo(at("dist")))}`);
}

async function status() {
  await requirePm2();
  if (!(await exists(at("dist")))) return say(`${NAME} is not deployed yet. Run: bun run deploy`);

  const proc = await pm2.process();
  const previous = await readBuildInfo(at("dist.prev"));

  say(NAME);
  row("status", proc ? describeProcess(proc) : "stopped");
  row("url", `${await url()} (${(await isHealthy()) ? "responding" : "not responding"})`);
  row("build", describeBuild(await readBuildInfo(at("dist"))));
  if (previous) row("rollback", describeBuild(previous));
  row("folder", tilde(APP));
  row(
    "logs",
    `${tilde(at("logs"))}  out ${size(await fileSize(LOGS.out))} · error ${size(await fileSize(LOGS.error))}`,
  );
}

async function logs(args) {
  const { values } = parseArgs({
    args,
    options: {
      lines: { type: "string", short: "n", default: "50" },
      follow: { type: "boolean", default: true },
    },
    allowNegative: true,
  });
  if (!(await exists(at("logs")))) die(`${NAME} has no logs yet. Run: bun run deploy`);

  const files = Object.values(LOGS);
  await $`touch ${files}`;
  await $`tail -n ${values.lines} ${values.follow ? "-F" : []} ${files}`.nothrow();
}

async function cleanup() {
  let freed = 0;

  // Truncated in place: pm2 keeps the files open in append mode, so it carries on writing
  for (const file of Object.values(LOGS)) {
    freed += await fileSize(file);
    if (await exists(file)) await fs.truncate(file);
  }

  // Rotated files (pm2-logrotate) and logs from before the app had its own logs folder
  const stale = [
    ...(await list(at("logs"), (name) => !Object.values(LOGS).includes(at("logs", name)))),
    ...["out", "error"].map((kind) =>
      path.join(os.homedir(), ".pm2", "logs", `${NAME}-${kind}.log`),
    ),
  ];
  for (const file of stale) {
    freed += await fileSize(file);
    await fs.rm(file, { force: true });
  }

  say(`Cleared the logs of ${NAME}, freed ${size(freed)}`);
}

// ─── pm2 ────────────────────────────────────────────────────────────────────

const pm2 = {
  async process() {
    const text = await $`pm2 jlist`.quiet().text();
    const proc = JSON.parse(text.slice(text.indexOf("["))).find((p) => p.name === NAME);
    return proc && { ...proc, status: proc.pm2_env.status };
  },

  // With a bare environment: `bun run` loaded this project's .env into ours, and pm2 would
  // hand it to the app. The deployed app reads its own .env instead.
  async start() {
    const { HOME, PATH, USER = "", LANG = "C.UTF-8" } = process.env;
    await $`pm2 start ${ECOSYSTEM}`.env({ HOME, PATH, USER, LANG }).quiet();
    await $`pm2 save --force`.quiet();
  },

  async remove() {
    await $`pm2 delete ${NAME}`.quiet().nothrow();
    await $`pm2 save --force`.quiet();
  },
};

// Logs go to the app's own folder, with timestamps. Dev keeps logging to the console only.
async function writeEcosystem() {
  const app = {
    name: NAME,
    cwd: APP,
    script: BUN,
    args: "./dist/index.js",
    interpreter: "none",
    env: { NODE_ENV: "production" },
    out_file: LOGS.out,
    error_file: LOGS.error,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    exp_backoff_restart_delay: 200, // A crashing app backs off instead of restarting in a tight loop
  };
  const config = JSON.stringify({ apps: [app] }, null, 2);
  await Bun.write(
    ECOSYSTEM,
    `// Written by scripts/prod.js: how pm2 runs the app.\nmodule.exports = ${config};\n`,
  );
}

// On failure, prints what the app logged during this attempt only
async function startAndCheck() {
  const offsets = Object.fromEntries(
    await Promise.all(
      Object.entries(LOGS).map(async ([kind, file]) => [kind, await fileSize(file)]),
    ),
  );

  say("Starting");
  await pm2.start();
  if (await waitHealthy()) return true;

  for (const [kind, file] of Object.entries(LOGS)) {
    const lines = await lastLines(file, 20, offsets[kind]);
    if (lines) console.log(`\n  ── ${kind}.log ──\n${lines}`);
  }
  return false;
}

// ─── Deploy steps ───────────────────────────────────────────────────────────

async function copyFirstDeployFiles() {
  if (!(await exists(at(".env"))) && (await exists(path.join(ROOT, ".env")))) {
    await fs.copyFile(path.join(ROOT, ".env"), at(".env"));
    await fs.chmod(at(".env"), 0o600);
    info(`first deploy: copied .env. From now on the app reads ${tilde(at(".env"))}`);
  }
  if (!(await exists(at("data"))) && (await exists(path.join(ROOT, "data")))) {
    await copyData(path.join(ROOT, "data"), at("data"));
    info("first deploy: copied data/, so the app starts with your data");
  }
}

// SQLite files are snapshotted, so the copy is consistent even while the dev server has them open
async function copyData(from, to) {
  for await (const file of new Bun.Glob("**/*").scan({ cwd: from, dot: true })) {
    if (/-(wal|shm|journal)$/.test(file)) continue;
    const source = path.join(from, file);
    const target = path.join(to, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (/\.(db|sqlite3?)$/.test(file) && snapshotSqlite(source, target)) continue;
    await fs.copyFile(source, target);
  }
}

function snapshotSqlite(source, target) {
  try {
    const db = new Database(source, { readonly: true });
    db.run("VACUUM INTO ?", [target]);
    db.close();
    return true;
  } catch {
    return false; // Not a SQLite database after all: copied as a plain file
  }
}

// The template bundles all dependencies. Packages a project keeps external are installed here.
async function installExternalPackages(distDir) {
  const packages = await externalPackages(distDir);
  if (!packages.length) return;

  info(`the server imports ${packages.join(", ")} at runtime, installing dependencies`);
  await fs.copyFile(path.join(ROOT, "package.json"), at("package.json"));
  const hasLock = await exists(path.join(ROOT, "bun.lock"));
  if (hasLock) await fs.copyFile(path.join(ROOT, "bun.lock"), at("bun.lock"));
  await $`${BUN} install --production ${hasLock ? "--frozen-lockfile" : []}`.cwd(APP).quiet();
}

// Matches only what the bundler emits: statements at line start and require/import() calls,
// not the import examples inside bundled doc comments
async function externalPackages(distDir) {
  const specifier =
    /^(?:import|export)\b[^;"']*?(?:from\s*)?["']([^"']+)["']|\b(?:__require|require|import)\(\s*["']([^"']+)["']\s*\)/gm;
  const isBuiltin = (spec) =>
    /^(\.|\/|node:|bun:)/.test(spec) || spec === "bun" || builtinModules.includes(spec);
  const packageOf = (spec) =>
    spec
      .split("/")
      .slice(0, spec.startsWith("@") ? 2 : 1)
      .join("/");

  const found = new Set();
  for await (const file of new Bun.Glob("*.{js,mjs,cjs}").scan(distDir)) {
    const code = await Bun.file(path.join(distDir, file)).text();
    for (const [, statement, call] of code.matchAll(specifier)) {
      const spec = statement ?? call;
      if (!isBuiltin(spec)) found.add(packageOf(spec));
    }
  }
  return [...found];
}

async function writeBuildInfo(distDir) {
  const commit = (await $`git rev-parse --short HEAD`.quiet().nothrow().text()).trim();
  const dirty = (await $`git status --porcelain`.quiet().nothrow().text()).trim() !== "";
  const build = { commit: commit || null, dirty, deployedAt: new Date().toISOString() };
  await Bun.write(path.join(distDir, "build.json"), JSON.stringify(build, null, 2));
}

const readBuildInfo = (distDir) =>
  Bun.file(path.join(distDir, "build.json"))
    .json()
    .catch(() => null);

// ─── Network ────────────────────────────────────────────────────────────────

async function endpoint() {
  const file = Bun.file(at(".env"));
  const env = (await file.exists()) ? parseEnv(await file.text()) : {};
  const host = ["", "0.0.0.0", "::"].includes(env.HOST ?? "") ? "127.0.0.1" : env.HOST;
  return { host, port: Number(env.PORT || 3000) };
}

async function url() {
  const { host, port } = await endpoint();
  return `http://${host}:${port}`;
}

// Any response below 500 counts: HEALTH_PATH can point at a dedicated route
async function isHealthy() {
  try {
    const res = await fetch(`${await url()}${HEALTH_PATH}`, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

// Gives up early once pm2 has had to restart the app: it crashes on startup
async function waitHealthy(seconds = 15) {
  for (const deadline = Date.now() + seconds * 1000; Date.now() < deadline; await Bun.sleep(500)) {
    if (await isHealthy()) return true;
    if ((await pm2.process())?.pm2_env.restart_time > 0) return false;
  }
  return false;
}

// pid listening on the port, "?" when it belongs to another user, null when the port is free
async function portOwner(port) {
  const line = await $`ss -ltnpH ${`sport = :${port}`}`.quiet().nothrow().text();
  if (!line.trim()) return null;
  return Number(line.match(/pid=(\d+)/)?.[1]) || "?";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

class Abort extends Error {}

const say = (message) => console.log(`\n▸ ${message}`);
const info = (message) => console.log(`  ${message}`);
const row = (label, value) => console.log(`  ${label.padEnd(9)} ${value}`);
const die = (message) => {
  throw new Abort(message);
};

// Also runs it: pm2 itself needs Node.js, which can be missing even when pm2 is installed
async function requirePm2() {
  if (!Bun.which("pm2")) die("pm2 is not installed. Install it once with: bun add -g pm2");

  const check = await $`pm2 --version`.quiet().nothrow();
  if (check.exitCode !== 0) {
    die(`pm2 is installed but does not run. Node.js is a prerequisite of pm2 and must be installed first.
  ${check.stderr.toString().trim().split("\n")[0]}`);
  }
}

async function requireDeployed() {
  if (!(await exists(at("dist", "index.js"))))
    die(`${NAME} is not deployed yet. Run: bun run deploy`);
}

const exists = (file) =>
  fs.access(file).then(
    () => true,
    () => false,
  );
const fileSize = (file) =>
  fs.stat(file).then(
    (s) => s.size,
    () => 0,
  );
const tilde = (file) => file.replace(os.homedir(), "~");

function slug(name = "") {
  return name.replace(/^@[^/]+\//, "").replace(/[^\w.-]+/g, "-");
}

async function list(dir, keep) {
  const names = await fs.readdir(dir).catch(() => []);
  return names.filter(keep).map((name) => path.join(dir, name));
}

async function replaceDir(from, to) {
  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(from, to, { recursive: true });
}

async function lastLines(file, count, fromByte = 0) {
  const text = await Bun.file(file)
    .slice(fromByte)
    .text()
    .catch(() => "");
  return text.trimEnd().split("\n").slice(-count).join("\n");
}

function size(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes || 1) / Math.log(1024)));
  return `${+(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function duration(ms) {
  const minutes = Math.floor(ms / 60_000);
  const [d, h, m] = [Math.floor(minutes / 1440), Math.floor(minutes / 60) % 24, minutes % 60];
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function describeProcess({ status, pid, pm2_env, monit }) {
  if (status !== "online") return `${status} · ${pm2_env.restart_time} restarts`;
  const uptime = duration(Date.now() - pm2_env.pm_uptime);
  return `online · pid ${pid} · up ${uptime} · ${pm2_env.restart_time} restarts · ${size(monit.memory)} · ${monit.cpu}% cpu`;
}

function describeBuild(build) {
  if (!build) return "unknown";
  const commit = build.commit
    ? `${build.commit}${build.dirty ? " (with uncommitted changes)" : ""}`
    : "no git";
  return `${commit} · deployed ${new Date(build.deployedAt).toLocaleString()}`;
}

function usage() {
  console.log(`Usage: bun scripts/prod.js <command>   (app: ${NAME}, folder: ${tilde(APP)})\n`);
  for (const [name, { about }] of Object.entries(commands))
    console.log(`  ${name.padEnd(10)} ${about}`);
  console.log("\nSettings: APP_NAME, APPS_DIR (default ~/.apps), HEALTH_PATH (default /)");
}

// ─── Main ───────────────────────────────────────────────────────────────────

const [name, ...args] = process.argv.slice(2);
const command = commands[name];

try {
  if (command) await command.run(args);
  else usage();
} catch (err) {
  if (err instanceof Abort) console.error(`\n✗ ${err.message}`);
  else if (err instanceof $.ShellError)
    console.error(`\n✗ ${err.stderr.toString().trim() || err.message}`);
  else throw err;
  process.exit(1);
}
