// Tells Omnisend about a win (custom event "carnival_win") so an Omnisend automation can send the coupon by WhatsApp / email.
// The API key is pasted in the app's admin page (stored encrypted); the OMNISEND_API_KEY environment variable also works.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import prisma from "../db.server";
import { GAME_NAMES } from "./constants";

const URL_EVENTS = "https://api.omnisend.com/api/events";
const EVENT_NAME = "carnival_win";

// AES-256-GCM, key derived from the app's own secret (never stored with the data).
const secretKey = () => createHash("sha256").update("carnival-omnisend:" + (process.env.SHOPIFY_API_SECRET || "")).digest();
export function encryptKey(plain) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}
export function decryptKey(stored) {
  try {
    const [iv, tag, enc] = String(stored || "").split(".");
    if (!enc) return "";
    const d = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
  } catch (e) { return ""; }
}
export const resolveKey = (settings) => (settings && settings.omnisendKeyEnc ? decryptKey(settings.omnisendKeyEnc) : "") || process.env.OMNISEND_API_KEY || "";
export const omnisendConfigured = (settings) => !!resolveKey(settings);
export const keyHint = (settings) => { const k = resolveKey(settings); return k ? "…" + k.slice(-4) : ""; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Omnisend allows 400 events a minute: send one at a time, at most ~4 a second.
let tail = Promise.resolve();
const queued = (job) => { const run = tail.then(job, job); tail = run.then(() => sleep(250), () => sleep(250)); return run; };

function expiryText(days) {
  return new Date(Date.now() + (days || 7) * 86400000 + 5.5 * 3600000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function buildEvent(play, { days, whatsappConsent }) {
  const kind = play.prizeKind === "FREE_PRODUCT" ? (play.delivery === "product_code" ? "free_gift_code" : "free_gift") : "coupon";
  const contact = { email: play.email };
  if (play.phone) contact.phone = play.phone;
  return {
    eventName: EVENT_NAME,
    origin: "api",
    eventID: undefined,
    contact,
    properties: {
      coupon_code: play.couponCode || "",
      prize: play.prizeLabel || "",
      expires: play.couponCode ? expiryText(days) : "",
      game: GAME_NAMES[play.gameId] || `Game ${play.gameId}`,
      kind,
      delivery: play.delivery || "",
      order: String(play.orderId || "").split("~")[0],
      note: play.deliveryNote || "",
      whatsapp_consent: !!whatsappConsent,
    },
  };
}

// Sends one event (retries on rate limit / server errors) and returns { ok, error }.
async function post(body, key) {
  if (!key) return { ok: false, error: "No Omnisend API key saved" };
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(URL_EVENTS, {
        method: "POST",
        headers: { Authorization: `Omnisend-API-Key ${key}`, "Omnisend-Version": "2026-preview", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 202 || res.status === 200) return { ok: true };
      const text = await res.text().catch(() => "");
      let detail = text.slice(0, 300);
      try { const j = JSON.parse(text); detail = [j.title, j.detail, ...(j.errors || []).map((e) => `${e.field}: ${e.message}`)].filter(Boolean).join(" - ") || detail; } catch (e) {}
      last = `Omnisend ${res.status}: ${detail}`;
      if (res.status !== 429 && res.status < 500) return { ok: false, error: last };   // a rejected request will not get better
    } catch (e) {
      last = String(e.message || e);
    }
    await sleep(800 * (attempt + 1));
  }
  return { ok: false, error: last };
}

// Sends the event for a stored play and records the result on the play row. Never throws.
export function notifyOmnisend(play, opts) {
  if (!play.email) return Promise.resolve({ ok: false, error: "no email" });
  const body = buildEvent(play, opts);
  delete body.eventID;
  return queued(async () => {
    const r = await post(body, opts.key);
    try {
      await prisma.gamePlay.update({ where: { orderId: play.orderId }, data: { omnisendStatus: r.ok ? "sent" : "failed", omnisendError: r.ok ? null : String(r.error || "").slice(0, 400) } });
    } catch (e) { console.error("Could not save Omnisend status:", e); }
    if (!r.ok) console.error("Omnisend event failed:", r.error);
    return r;
  });
}
