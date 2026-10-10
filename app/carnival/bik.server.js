// WhatsApp messages through Bik (bik.ai): the win message, the weekly coupon reminder and the free-gift message.
// The Bik app key + secret are pasted in the app's admin page and stored encrypted (same scheme as the Omnisend key).
import prisma from "../db.server";
import { encryptKey, decryptKey } from "./omnisend.server";
import { lastDayText, startDayText } from "./rules.server";

const URL_SEND = "https://bikapi.bikayi.app/integrations/bikPlatformFunctions-messages/v2/sendTemplateMessage";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- credentials (stored as one encrypted JSON string) ----
export const encryptCreds = (key, secret) => encryptKey(JSON.stringify({ key: String(key).trim(), secret: String(secret).trim() }));
export function bikCreds(settings) {
  if (!settings || !settings.bikKeyEnc) return null;
  try {
    const c = JSON.parse(decryptKey(settings.bikKeyEnc) || "null");
    return c && c.key && c.secret ? c : null;
  } catch (e) { return null; }
}
export const bikHint = (settings) => { const c = bikCreds(settings); return c ? "…" + c.key.slice(-4) : ""; };
export function bikReady(settings, kind = "win") {
  const id = kind === "reminder" ? settings?.bikReminderTemplate : kind === "gift" ? settings?.bikGiftTemplate : settings?.bikWinTemplate;
  return !!(bikCreds(settings) && id && ["auto", "consent"].includes(settings.bikMode || "auto"));
}

// Bik allows no more than we can sensibly send: one message at a time, a short pause between them.
let tail = Promise.resolve();
const queued = (job) => { const run = tail.then(job, job); tail = run.then(() => sleep(150), () => sleep(150)); return run; };

const appUrl = () => (process.env.SHOPIFY_APP_URL || "https://charmasy-carnival.onrender.com").replace(/\/$/, "");
export const bannerUrl = () => appUrl() + "/carnival/img/wa-banner.jpg";

// Sends one template message. components: { body: [...], button: [...] }. Returns { ok, error, id }.
export async function sendTemplate(creds, { to, templateId, body, button, callbackData }) {
  if (!creds) return { ok: false, error: "No Bik key saved" };
  if (!templateId) return { ok: false, error: "No template id saved for this message" };
  if (!to) return { ok: false, error: "No phone number" };
  const payload = {
    medium: "whatsapp",
    contactIdentifier: to,
    payload: { templateId, components: { header: [{ type: "image", data: bannerUrl() }], body, ...(button ? { button } : {}) } },
  };
  if (callbackData) payload.callbackData = JSON.stringify(callbackData);
  const auth = "Basic " + Buffer.from(`${creds.key}:${creds.secret}`).toString("base64");
  let last = "", swapped = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(URL_SEND, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = await res.text().catch(() => "");
      let j = null; try { j = JSON.parse(text); } catch (e) {}
      if (res.ok && j && (j.success === true || Number(j.status) === 200) && !j.error) return { ok: true, id: j.data?.id || null };
      const detail = (j && (j.error || (j.errors && j.errors.map((e) => e.message).join("; ")) || j.message)) || text.slice(0, 200) || `HTTP ${res.status}`;
      last = `Bik ${(j && j.status) || res.status}: ${detail}`;
      const code = Number((j && j.status) || res.status);
      if (/Button at index \d+ must be of type/i.test(String(detail)) && button && button.length === 2 && !swapped) {
        swapped = true; payload.payload.components.button = swapButtons(button); continue;      // the template has the buttons the other way round
      }
      if (!(code === 429 || (code >= 500 && code < 600))) return { ok: false, error: last };   // only rate limits and server errors are worth retrying   // a rejected message will not get better
    } catch (e) {
      last = String(e.message || e);
    }
    await sleep(700 * (attempt + 1));
  }
  return { ok: false, error: last };
}

// ---- the three messages ----
const validText = (w) => (w.startsAt.getTime() > Date.now() + 3600000 ? `${lastDayText(w.endsAt)} (active from ${startDayText(w.startsAt)})` : lastDayText(w.endsAt));
// Order must match the template in Bik: Copy coupon code first, Shop Now (link) second. sendTemplate swaps them if Bik says otherwise.
const codeButtons = (code) => [{ type: "copy_code", index: 0, data: code }, { type: "URL", index: 1, data: code }];
const swapButtons = (btns) => btns.slice().reverse().map((b, i) => ({ ...b, index: i }));

export const winMessage = (settings, play, w) => ({ to: play.phone, templateId: settings.bikWinTemplate, body: [play.prizeLabel, play.couponCode, validText(w)], button: codeButtons(play.couponCode), callbackData: { play: play.orderId, kind: "win" } });
export const reminderMessage = (settings, play, w, now = Date.now()) => ({
  to: play.phone, templateId: settings.bikReminderTemplate,
  body: [play.prizeLabel, play.couponCode, lastDayText(w.endsAt), String(Math.max(1, Math.ceil((w.endsAt.getTime() - now) / 86400000)))],
  button: codeButtons(play.couponCode), callbackData: { play: play.orderId, kind: "reminder" },
});
export const giftMessage = (settings, play, title) => ({ to: play.phone, templateId: settings.bikGiftTemplate, body: [title || "gift"], button: [{ type: "URL", index: 0, data: play.giftToken }], callbackData: { play: play.orderId, kind: "gift" } });

// Sends and records the result on the play row. Never throws.
export function deliver(settings, play, msg, { reminder = false, at = null } = {}) {
  return queued(async () => {
    const r = await sendTemplate(bikCreds(settings), msg);
    try {
      await prisma.whatsAppLog.create({ data: {
        shop: settings.shop, orderId: play.orderId, kind: (msg.callbackData && msg.callbackData.kind) || (reminder ? "reminder" : "win"), phone: msg.to || null, templateId: msg.templateId || null,
        messageId: r.id || null, status: r.ok ? "accepted" : "failed", error: r.ok ? null : String(r.error || "").slice(0, 400), failedAt: r.ok ? null : new Date(),
      } });
    } catch (e) { console.error("Could not write the WhatsApp log:", e); }
    try {
      const now = at || new Date();
      await prisma.gamePlay.update({
        where: { orderId: play.orderId },
        data: r.ok
          ? { waStatus: "sent", waError: null, waSentAt: play.waSentAt || now, waLastAt: now, ...(reminder ? { waReminders: { increment: 1 } } : {}) }
          : { ...(reminder ? {} : { waStatus: "failed" }), waError: String(r.error || "").slice(0, 400) },
      });
    } catch (e) { console.error("Could not save WhatsApp status:", e); }
    if (!r.ok) console.error("Bik message failed:", r.error);
    return r;
  });
}

// Admin "send a test message": the win template with sample values, to a number the owner types.
export async function sendTestMessage(settings, to) {
  const w = { startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 30 * 86400000) };
  return sendTemplate(bikCreds(settings), {
    to, templateId: settings.bikWinTemplate, body: ["10% OFF Coupon", "CHMTEST5", lastDayText(w.endsAt)], button: codeButtons("CHMTEST5"),
    callbackData: { kind: "test" },
  });
}
