// Weekly WhatsApp reminders for personal coupons that nobody has used yet.
// A coupon gets a reminder when it is active, not used, not expired, and either (a) it was won before the coupons
// switched on and has had no reminder yet (so winners hear "it works now" on activation day), or (b) the last WhatsApp
// message to that customer is 7 or more days old. Messages go out between 10:00 and 20:00 India time only.
import prisma from "../db.server";
import { codeUsage } from "./shopify-ops.server";
import { bikCreds, bikReady, reminderMessage, deliver } from "./bik.server";

export const REMINDER_EVERY_DAYS = 7;
export const MAX_REMINDERS = 6;
const istHour = (now) => new Date(now + 5.5 * 3600 * 1000).getUTCHours();
export const inSendWindow = (now) => { const h = istHour(now); return h >= 10 && h < 20; };

export function isDue(play, now) {
  if (play.waStatus !== "sent" || !play.waLastAt || !play.couponStartsAt) return false;
  const last = play.waLastAt.getTime();
  if (play.waReminders === 0 && last < play.couponStartsAt.getTime()) return true;       // won before activation: tell them it is active now
  return now - last >= REMINDER_EVERY_DAYS * 86400000 - 10 * 60000;
}

// deps.getAdmin(shop) returns the Shopify admin client for a shop. Returns { sent, checked, used }.
export async function runReminders({ now = Date.now(), getAdmin, limit = 200 } = {}) {
  const out = { sent: 0, checked: 0, used: 0, skipped: 0 };
  if (!inSendWindow(now)) return out;
  const shops = await prisma.gameSettings.findMany({ where: { bikMode: "auto", bikReminders: true, bikReminderTemplate: { not: null }, bikKeyEnc: { not: null } } });
  for (const settings of shops) {
    if (!bikCreds(settings) || !bikReady(settings, "reminder")) continue;
    const candidates = await prisma.gamePlay.findMany({
      where: {
        shop: settings.shop, couponCode: { not: null }, phone: { not: null }, waStatus: "sent", couponUsedAt: null,
        OR: [{ prizeKind: null }, { prizeKind: { not: "FREE_PRODUCT" } }],
        couponStartsAt: { lte: new Date(now) }, couponEndsAt: { gt: new Date(now) }, waReminders: { lt: MAX_REMINDERS },
      },
      orderBy: { waLastAt: "asc" }, take: limit * 3,
    });
    const due = candidates.filter((p) => isDue(p, now)).slice(0, limit);
    if (!due.length) continue;
    let admin = null;
    try { admin = await getAdmin(settings.shop); } catch (e) { console.error("Reminders: no Shopify access for", settings.shop, e.message || e); }
    for (const play of due) {
      out.checked++;
      // claim this reminder first, so a second run (or a restart) cannot send it twice
      const claim = await prisma.gamePlay.updateMany({ where: { orderId: play.orderId, waLastAt: play.waLastAt }, data: { waLastAt: new Date(now) } });
      if (!claim.count) { out.skipped++; continue; }
      const usage = admin ? await codeUsage(admin, play.couponCode) : { ok: false };
      if (usage.ok && (usage.used || usage.gone || usage.expired)) {
        await prisma.gamePlay.update({ where: { orderId: play.orderId }, data: { couponUsedAt: new Date(now) } });
        out.used++; continue;
      }
      if (!usage.ok) {                                   // Shopify could not tell us: try again at the next run, do not nag blindly
        await prisma.gamePlay.update({ where: { orderId: play.orderId }, data: { waLastAt: play.waLastAt } });
        out.skipped++; continue;
      }
      const w = { startsAt: play.couponStartsAt, endsAt: play.couponEndsAt };
      const r = await deliver(settings, play, reminderMessage(settings, play, w, now), { reminder: true, at: new Date(now) });
      if (r.ok) out.sent++;
      else await prisma.gamePlay.update({ where: { orderId: play.orderId }, data: { waLastAt: play.waLastAt } });   // retry next run
    }
  }
  return out;
}

let started = false;
export function startReminderLoop() {
  if (started || globalThis.__carnivalReminders || process.env.CARNIVAL_REMINDERS === "off") return;
  started = globalThis.__carnivalReminders = true;
  const tick = async () => {
    try {
      const { unauthenticated } = await import("../shopify.server");
      const r = await runReminders({ getAdmin: async (shop) => (await unauthenticated.admin(shop)).admin });
      if (r.sent || r.used) console.log("Reminders:", JSON.stringify(r));
    } catch (e) { console.error("Reminder run failed:", e); }
  };
  setTimeout(tick, 2 * 60 * 1000);
  setInterval(tick, 30 * 60 * 1000).unref?.();
}
