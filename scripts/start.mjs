// Production start: pick a usable database location, sync the schema, then run the app.
// A bad DATABASE_URL (for example a disk that is not mounted) must never stop the app from booting.
import { mkdirSync, accessSync, readFileSync, constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";

const DEFAULT_URL = "file:./dev.sqlite";
let url = process.env.DATABASE_URL || DEFAULT_URL;

function sqlitePath(u) {
  const p = u.slice("file:".length);
  return p.startsWith("/") ? p : resolve("prisma", p); // Prisma resolves relative paths from the schema folder
}

if (url.startsWith("file:")) {
  const dir = dirname(sqlitePath(url));
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    try {
      if (dir.startsWith("/var/data") && !readFileSync("/proc/mounts", "utf8").includes(" /var/data ")) {
        console.warn("[start] WARNING: /var/data is not a mounted disk — data will be lost on every restart. Add a Render disk mounted at /var/data.");
      }
    } catch {}
  } catch (e) {
    console.warn(`[start] ${dir} is not writable (${e.code}); using ${DEFAULT_URL} — data will NOT persist.`);
    url = DEFAULT_URL;
  }
}

function pushSchema(u) {
  return spawnSync("npx", ["--no-install", "prisma", "db", "push", "--accept-data-loss", "--skip-generate"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: u },
  }).status;
}

let status = pushSchema(url);
if (status !== 0 && url !== DEFAULT_URL) {
  console.warn("[start] Schema sync failed on the configured database; falling back to the local file.");
  url = DEFAULT_URL;
  status = pushSchema(url);
}
if (status !== 0) {
  console.error("[start] Could not prepare the database.");
  process.exit(1);
}

console.log(`[start] Database: ${url}`);
const child = spawn("npx", ["--no-install", "remix-serve", "./build/server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, HOST: "0.0.0.0" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => child.kill(sig));
