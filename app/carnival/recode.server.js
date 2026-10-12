// Moves the dates of coupon codes that were already issued (and not used yet) to the dates now saved in the admin.
import prisma from "../db.server";
import { updateCodeWindow } from "./shopify-ops.server";
import { getSettings, DEFAULT_COUPON_START, DEFAULT_COUPON_END } from "./rules.server";

const running = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function plannedWindow(shop) {
  const s = await getSettings(shop);
  return { startsAt: s.couponStartsAt ? new Date(s.couponStartsAt) : DEFAULT_COUPON_START, endsAt: s.couponEndsAt ? new Date(s.couponEndsAt) : DEFAULT_COUPON_END };
}

const staleWhere = (shop, w) => ({
  shop, couponCode: { not: null }, couponUsedAt: null, NOT: { orderId: { contains: "~t" } },
  OR: [{ couponStartsAt: null }, { couponStartsAt: { not: w.startsAt } }, { couponEndsAt: null }, { couponEndsAt: { not: w.endsAt } }],
});
export const countStale = async (shop) => prisma.gamePlay.count({ where: staleWhere(shop, await plannedWindow(shop)) });
export const isRunning = (shop) => running.has(shop);

// Runs in the background; returns at once with how many codes will be updated.
export async function startReapply(shop, getAdmin, { delayMs = 250 } = {}) {
  if (running.has(shop)) return { started: false, already: true };
  const w = await plannedWindow(shop);
  const rows = await prisma.gamePlay.findMany({ where: staleWhere(shop, w), select: { orderId: true, couponCode: true }, take: 5000 });
  running.add(shop);
  const job = (async () => {
    try {
      const admin = await getAdmin(shop);
      for (const row of rows) {
        const r = await updateCodeWindow(admin, row.couponCode, w.startsAt, w.endsAt);
        if (r.ok) await prisma.gamePlay.update({ where: { orderId: row.orderId }, data: { couponStartsAt: w.startsAt, couponEndsAt: w.endsAt } });
        else console.error("Could not move code dates:", row.couponCode, r.error);
        await sleep(delayMs);
      }
    } catch (e) { console.error("Re-applying coupon dates failed:", e); }
    finally { running.delete(shop); }
  })();
  return { started: true, total: rows.length, job };
}
