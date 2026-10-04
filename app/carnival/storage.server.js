// Tells the admin whether the database lives on a persistent disk (survives deploys) or not.
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function storageStatus(mountsText) {
  const url = process.env.DATABASE_URL || "file:./dev.sqlite";
  if (!url.startsWith("file:")) {
    let host = "";
    try { host = new URL(url).hostname; } catch (e) {}
    return { kind: "external", persistent: true, sizeKB: null, message: `Using the PostgreSQL database server${host ? " (" + host + ")" : ""}. It keeps your data across updates and restarts.` };
  }

  const raw = url.slice(5).split("?")[0];
  const abs = raw.startsWith("/") ? raw : resolve("prisma", raw);
  const info = { kind: "file", path: abs, envSet: !!process.env.DATABASE_URL, persistent: null, mount: null, fstype: null, sizeKB: null, createdAt: null };
  try { const st = statSync(abs); info.sizeKB = Math.round(st.size / 1024); info.createdAt = (st.birthtime && st.birthtime.getTime() > 0 ? st.birthtime : st.mtime).toISOString(); } catch (e) {}

  let mounts = null;
  try { mounts = (mountsText ?? readFileSync("/proc/mounts", "utf8")).split("\n").map((l) => l.split(" ")).filter((p) => p.length > 2); } catch (e) {}
  if (!mounts) {
    info.persistent = null; // not Linux (for example a laptop): cannot tell
    info.message = "Cannot check the disk on this machine.";
    return info;
  }
  const dir = dirname(abs);
  let best = null;
  for (const [, mp, fs] of mounts) {
    if ((dir === mp || dir.startsWith(mp.endsWith("/") ? mp : mp + "/")) && (!best || mp.length > best.mp.length)) best = { mp, fs };
  }
  info.mount = best ? best.mp : "/";
  info.fstype = best ? best.fs : null;
  // On Render the app's own files sit on "/" (overlay). A real attached disk shows up as its own mount point.
  info.persistent = !!best && best.mp !== "/" && !["overlay", "tmpfs", "proc", "sysfs"].includes(best.fs);
  info.message = info.persistent
    ? `Saved on the persistent disk mounted at ${info.mount}. It survives updates and restarts.`
    : "NOT on a persistent disk: everything saved here (plays, prizes settings, your Shopify login) is erased on every update and restart.";
  return info;
}
