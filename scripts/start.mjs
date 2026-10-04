// Production start: sync the database schema, then run the app.
// The database is PostgreSQL (DATABASE_URL). Without it the app must not start, because data would be lost.
import { spawnSync, spawn } from "node:child_process";

const url = process.env.DATABASE_URL || "";
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error("[start] DATABASE_URL is missing or is not a PostgreSQL URL (postgresql://...). Refusing to start.");
  process.exit(1);
}

// "db push" only adds what is missing. It is deliberately run WITHOUT --accept-data-loss, so a change that
// would delete data stops the deploy (Render keeps the previous version running) instead of erasing anything.
const push = spawnSync("npx", ["--no-install", "prisma", "db", "push", "--skip-generate"], { stdio: "inherit", env: process.env });
if (push.status !== 0) {
  console.error("[start] Could not sync the database schema. Not starting, to protect the data.");
  process.exit(1);
}

console.log("[start] Database ready (PostgreSQL).");
const child = spawn("npx", ["--no-install", "remix-serve", "./build/server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, HOST: "0.0.0.0" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => child.kill(sig));
