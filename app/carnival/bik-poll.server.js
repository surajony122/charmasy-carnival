// Asks Bik for the real status of messages we handed over (works even if the webhook is not connected).
import prisma from "../db.server";
import { bikCreds, fetchStatuses } from "./bik.server";
import { applyStatusUpdate } from "./bik-webhook.server";

const OPEN = ["accepted", "sent"];

// Checks open messages of one shop (or every shop with Bik credentials). Returns { checked, changed }.
export async function pollStatuses({ shop = null, now = Date.now(), limit = 200 } = {}) {
  const out = { checked: 0, changed: 0, error: "" };
  const shops = await prisma.gameSettings.findMany({ where: { bikKeyEnc: { not: null }, ...(shop ? { shop } : {}) } });
  for (const settings of shops) {
    const creds = bikCreds(settings);
    if (!creds) continue;
    const logs = await prisma.whatsAppLog.findMany({
      where: { shop: settings.shop, status: { in: OPEN }, messageId: { not: null }, createdAt: { gte: new Date(now - 3 * 86400000), lte: new Date(now - 20000) } },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    for (let i = 0; i < logs.length; i += 20) {
      const batch = logs.slice(i, i + 20);
      const r = await fetchStatuses(creds, batch.map((l) => l.messageId));
      if (!r.ok) { out.error = r.error; break; }
      out.checked += batch.length;
      const byId = new Map(r.messages.map((m) => [String(m.messageId), m]));
      for (const log of batch) {
        const m = byId.get(String(log.messageId));
        if (!m || !m.status) continue;
        const at = m.createdAt && !isNaN(new Date(m.createdAt)) ? new Date(m.createdAt) : new Date(now);
        if (await applyStatusUpdate(settings.shop, log, m.status, m.failureReason, new Date(now) > at ? new Date(now) : at)) out.changed++;
      }
    }
  }
  return out;
}
