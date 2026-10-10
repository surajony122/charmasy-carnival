// Receives Bik's webhook events and keeps the WhatsApp log (sent / delivered / read / failed / link clicked / opted out) up to date.
import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "../db.server";
import { decryptKey } from "./omnisend.server";

const RANK = { accepted: 0, sent: 1, delivered: 2, read: 3 };
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// Bik says every request carries "Authorization: Basic <your key>". How the key is encoded is not documented, so accept the
// plain key, "Basic <key>", or base64 of the key / "user:key".
export function webhookKeyOk(settings, authHeader) {
  const key = settings && settings.bikWebhookKeyEnc ? decryptKey(settings.bikWebhookKeyEnc) : "";
  if (!key || !authHeader) return false;
  const h = String(authHeader).trim();
  const cands = [h, h.replace(/^Basic\s+/i, "")];
  try { const dec = Buffer.from(h.replace(/^Basic\s+/i, ""), "base64").toString("utf8"); cands.push(dec, dec.split(":").slice(1).join(":")); } catch (e) {}
  return cands.some((c) => c && same(c, key));
}

async function findLog(shop, info) {
  if (info.messageId) {
    const hit = await prisma.whatsAppLog.findFirst({ where: { shop, messageId: String(info.messageId) } });
    if (hit) return hit;
  }
  // Bik's message id may differ from the one its send call returned: fall back to the newest still-open message to that number
  const phone = String(info.assetValue || "").replace(/[^\d+]/g, "");
  if (!phone) return null;
  return prisma.whatsAppLog.findFirst({
    where: { shop, phone, status: { in: ["accepted", "sent"] }, createdAt: { gte: new Date(Date.now() - 3 * 3600 * 1000) } },
    orderBy: { createdAt: "desc" },
  });
}

// events: the array Bik posts. Returns how many log rows changed.
export async function handleBikEvents(shop, events) {
  let changed = 0;
  for (const ev of events || []) {
    try {
      const info = ev && ev.eventInfo ? ev.eventInfo : ev || {};
      const name = String(ev && ev.eventName || "");
      const at = info.createdAt && !isNaN(new Date(info.createdAt)) ? new Date(info.createdAt) : new Date();
      if (name === "message-status-update") {
        const log = await findLog(shop, info);
        if (!log) continue;
        const status = String(info.status || "").toLowerCase();
        const data = {};
        if (!log.messageId && info.messageId) data.messageId = String(info.messageId);
        if (status === "failed") {
          if ((RANK[log.status] ?? 0) >= 2) continue;                 // already delivered: ignore a late failure
          Object.assign(data, { status: "failed", failedAt: at, error: String(info.failureReason || "Message failed").slice(0, 400) });
        } else if (status in RANK && status !== "accepted") {
          if (RANK[status] > (RANK[log.status] ?? -1) && log.status !== "failed") data.status = status;
          if (status === "sent" && !log.sentAt) data.sentAt = at;
          if (status === "delivered" && !log.deliveredAt) data.deliveredAt = at;
          if (status === "read" && !log.readAt) data.readAt = at;
        }
        if (!Object.keys(data).length) continue;
        await prisma.whatsAppLog.update({ where: { id: log.id }, data });
        changed++;
        if (data.status === "failed" && log.orderId) {                 // stop reminders to a number that cannot receive them
          await prisma.gamePlay.updateMany({ where: { orderId: log.orderId, shop }, data: { waStatus: "failed", waError: data.error } });
        }
      } else if (name === "linkClicked") {
        const log = await findLog(shop, { messageId: info.messageId });
        if (log && !log.clickedAt) { await prisma.whatsAppLog.update({ where: { id: log.id }, data: { clickedAt: info.clickedAt && !isNaN(new Date(info.clickedAt)) ? new Date(info.clickedAt) : at } }); changed++; }
      } else if (name === "optedOut") {
        const log = await findLog(shop, { messageId: info.messageId || ev.messageId });
        if (log) {
          await prisma.whatsAppLog.update({ where: { id: log.id }, data: { optedOutAt: at } }); changed++;
          if (log.phone) await prisma.gamePlay.updateMany({ where: { shop, phone: log.phone }, data: { waStatus: "optedout" } });
        }
      }
    } catch (e) {
      console.error("Bik webhook event failed:", e);
    }
  }
  return changed;
}
