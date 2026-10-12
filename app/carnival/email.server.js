// The prize email, sent through Bik's Send Email API: the safety net when WhatsApp does not reach a winner.
import prisma from "../db.server";
import { bikCreds, cleanLanding } from "./bik.server";
import { lastDayText, startDayText } from "./rules.server";

const URL_EMAIL = "https://bikapi.bikayi.app/integrations/bikPlatformFunctions-messages/v2/sendEmail";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeHttps = (u) => (/^https:\/\/[^\s"'<>]+$/.test(String(u || "")) ? String(u) : "");
const storeBase = (v) => { try { const u = new URL(String(v || "")); return u.protocol === "https:" ? u.origin : "https://charmacyworld.com"; } catch (e) { return "https://charmacyworld.com"; } };
const appUrl = () => (process.env.SHOPIFY_APP_URL || "https://charmasy-carnival.onrender.com").replace(/\/$/, "");

let tail = Promise.resolve();
const queued = (job) => { const run = tail.then(job, job); tail = run.then(() => sleep(200), () => sleep(200)); return run; };

export const emailReady = (settings) => !!(bikCreds(settings) && settings.bikEmailFrom && /^[^ @]+@[^ @]+\.[^ @]+$/.test(settings.bikEmailFrom) && settings.bikEmailMode && settings.bikEmailMode !== "off");

// The email for one winner. Coupon wins: code + dates + a button that applies it. Free gifts: the product + a button to the gift page.
export function buildEmail(settings, play, productTitle) {
  const base = storeBase(settings.bikStoreUrl);
  const free = play.prizeKind === "FREE_PRODUCT";
  // Carnival look without images or emoji: bunting from coloured triangle characters, pink header band, ticket-style code box, candy-stripe bar.
  const BUNT = ["#ff5c97", "#ffc93c", "#14b8a6", "#e11d63"];
  const bunting = BUNT.concat(BUNT, BUNT, BUNT).slice(0, 12).map((c) => `<td align="center" style="color:${c};font-size:20px;line-height:22px;padding:0;">&#9660;</td>`).join("");
  const stripes = Array.from({ length: 24 }, (_, k) => `<td style="background:${k % 2 ? "#ffffff" : "#e11d63"};height:10px;font-size:0;line-height:0;">&nbsp;</td>`).join("");
  const wrap = (heading, sub, inner, buttons) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffe3ee;margin:0;padding:0;"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fff6ec;border-radius:16px;overflow:hidden;border:2px solid #e11d63;">
<tr><td style="background:#fff6ec;padding:6px 8px 0 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${bunting}</tr></table></td></tr>
<tr><td align="center" style="background:#e11d63;padding:16px 12px 14px 12px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:26px;line-height:30px;font-weight:bold;letter-spacing:5px;color:#ffffff;">CHARMACY</div><div style="font-size:12px;letter-spacing:4px;color:#ffc93c;margin-top:3px;font-weight:bold;">MILANO &middot; CARNIVAL 2026</div></td></tr>
<tr><td align="center" style="padding:26px 16px 4px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="display:inline-block;background:#ffc93c;color:#a10f4d;font-size:13px;font-weight:bold;letter-spacing:3px;padding:6px 16px;border-radius:20px;">${sub}</span><div style="font-size:34px;line-height:40px;font-weight:bold;color:#e11d63;margin-top:12px;letter-spacing:1px;">${heading}</div></td></tr>
${inner}
<tr><td align="center" style="padding:20px 16px 22px 16px;">${buttons}</td></tr>
<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${stripes}</tr></table></td></tr>
<tr><td align="center" style="padding:14px 16px 20px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7a3a55;">You are receiving this email because you placed an order${play.orderName ? " (" + esc(play.orderName) + ")" : ""} at Charmacy and played the Charmacy Carnival game. This is a one-time message about your prize.<br>Charmacy Milano &middot; charmacyworld.com</td></tr>
</table></td></tr></table>`;
  const btn = (href, label) => `<a href="${esc(href)}" target="_blank" style="display:inline-block;background:#e11d63;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:30px;border-bottom:4px solid #a10f4d;margin:4px;">${esc(label)}</a>`;
  const para = (html) => `<tr><td align="center" style="padding:10px 16px 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#4a0f2b;">${html}</td></tr>`;

  if (free) {
    const title = productTitle || String(play.prizeLabel || "").replace(/^FREE\s+/i, "") || "gift";
    const how = play.delivery === "order_edit" ? `It has been added to your order <b>${esc(play.orderName || "")}</b> at no cost.`
      : play.delivery === "pack" ? `It will be packed together with your order <b>${esc(play.orderName || "")}</b>. Nothing else to do.`
      : play.delivery === "product_code" ? `Add it to your cart and use your personal code <b>${esc(play.couponCode || "")}</b> at checkout.` : "Your gift is on its way.";
    const gift = play.giftToken ? `${base}/apps/carnival-games?gift=${encodeURIComponent(play.giftToken)}` : "";
    const status = safeHttps(play.orderStatusUrl);
    return {
      subject: `Your free ${title} from Charmacy Carnival`,
      html: wrap("YOUR FREE GIFT", "CONGRATULATIONS", para(`Congratulations! You won a FREE <b>${esc(title)}</b> at Charmacy Carnival 2026.`) + para(how),
        (gift ? btn(gift, "VIEW MY GIFT") : "") + (status ? btn(status, "VIEW MY ORDER") : "")),
    };
  }
  const lastDay = play.couponEndsAt ? lastDayText(new Date(play.couponEndsAt)) : "";
  const from = play.couponStartsAt && new Date(play.couponStartsAt).getTime() > Date.now() + 3600000 ? startDayText(new Date(play.couponStartsAt)) : "";
  const land = cleanLanding(settings.bikLandingPath);
  const shop = `${base}/discount/${encodeURIComponent(play.couponCode || "")}${land ? "?redirect=" + land : ""}`;
  const code = `<tr><td align="center" style="padding:14px 16px 6px 16px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:12px;letter-spacing:3px;color:#a10f4d;font-weight:bold;">YOUR CARNIVAL TICKET &middot; ONE ENTRY</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;width:100%;max-width:360px;"><tr><td align="center" style="background:#ffffff;border:3px dashed #e11d63;border-radius:14px;padding:16px 8px;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:32px;letter-spacing:3px;font-weight:bold;color:#a10f4d;word-break:break-all;">${esc(play.couponCode || "")}</td></tr></table>
<div style="font-size:13px;line-height:20px;color:#4a0f2b;margin-top:10px;">Single use, made just for you.${from ? ` Applicable from <b>${esc(from)}</b> to <b>${esc(lastDay)}</b>.` : lastDay ? ` Valid till <b>${esc(lastDay)}</b>.` : ""}</div></td></tr>`;
  return {
    subject: `Your Charmacy Carnival prize: ${play.prizeLabel || "your coupon"}`,
    html: wrap("YOU WON!", "CONGRATULATIONS", para(`Congratulations! You won <span style="font-size:21px;font-weight:bold;color:#e11d63;">${esc(play.prizeLabel || "")}</span> at Charmacy Carnival 2026.`) + code, btn(shop, "SHOP NOW")),
  };
}

export async function sendEmailVia(creds, { from, name, to, subject, html }) {
  if (!creds) return { ok: false, error: "No Bik key saved" };
  const auth = "Basic " + Buffer.from(`${creds.key}:${creds.secret}`).toString("base64");
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(URL_EMAIL, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, htmlText: html, senderName: name || "Charmacy Carnival" }) });
      const text = await res.text().catch(() => ""); let j = null; try { j = JSON.parse(text); } catch (e) {}
      if (res.ok && j && (j.success === true || Number(j.status) === 200) && !j.errors) return { ok: true, id: j.data?.messageId || null };
      const detail = (j && ((j.errors && j.errors.map((e) => e.message).join("; ")) || j.error || j.message)) || text.slice(0, 200) || `HTTP ${res.status}`;
      last = `Bik ${(j && j.status) || res.status}: ${detail}`;
      const code = Number((j && j.status) || res.status);
      if (!(code === 429 || (code >= 500 && code < 600))) return { ok: false, error: last };
    } catch (e) { last = String(e.message || e); }
    await sleep(700 * (attempt + 1));
  }
  return { ok: false, error: last };
}

// Sends the prize email for a stored play once, and records the result. Never throws.
export function notifyEmail(settings, play, productTitle) {
  return queued(async () => {
    if (!emailReady(settings) || !play.email || play.emailSentAt) return { ok: false, skipped: true };
    const claim = await prisma.gamePlay.updateMany({ where: { orderId: play.orderId, emailSentAt: null }, data: { emailSentAt: new Date(), emailStatus: "sending" } });
    if (!claim.count) return { ok: false, skipped: true };                          // another run already took it
    const mail = buildEmail(settings, play, productTitle);
    const r = await sendEmailVia(bikCreds(settings), { from: settings.bikEmailFrom, name: settings.bikEmailName, to: play.email, subject: mail.subject, html: mail.html });
    try {
      await prisma.gamePlay.update({ where: { orderId: play.orderId }, data: { emailStatus: r.ok ? "sent" : "failed", emailError: r.ok ? null : String(r.error || "").slice(0, 400), ...(r.ok ? {} : { emailSentAt: null }) } });
      await prisma.whatsAppLog.create({ data: { shop: settings.shop, orderId: play.orderId, kind: "email", phone: play.email, templateId: null, messageId: r.id || null, status: r.ok ? "sent" : "failed", error: r.ok ? null : String(r.error || "").slice(0, 400), sentAt: r.ok ? new Date() : null, failedAt: r.ok ? null : new Date() } });
    } catch (e) { console.error("Could not save the email result:", e); }
    if (!r.ok) console.error("Prize email failed:", r.error);
    return r;
  });
}

// Fallback mode: winners whose WhatsApp did not arrive within 30 minutes (or could not be tried) get the email.
export async function runEmailFallback({ now = Date.now(), limit = 100 } = {}) {
  const out = { sent: 0, checked: 0 };
  limit = Math.min(limit, 30);                        // a new sender is warmed up gradually: at most 30 emails per run (every 2 minutes)
  const shops = await prisma.gameSettings.findMany({ where: { bikEmailMode: "fallback", bikEmailFrom: { not: null }, bikKeyEnc: { not: null } } });
  for (const settings of shops) {
    if (!emailReady(settings)) continue;
    const plays = await prisma.gamePlay.findMany({
      where: { shop: settings.shop, claimedAt: { not: null, lte: new Date(now - 30 * 60000), gte: new Date(now - 3 * 86400000) }, email: { not: null }, emailSentAt: null, delivery: { in: ["code", "product_code", "order_edit", "pack"] } },
      orderBy: { claimedAt: "asc" }, take: limit * 3,
    });
    for (const p of plays) {
      if (out.checked >= limit) break;
      out.checked++;
      const ok = await prisma.whatsAppLog.count({ where: { shop: settings.shop, orderId: p.orderId, kind: { not: "email" }, status: { in: ["delivered", "read"] } } });
      if (ok) continue;                                                              // WhatsApp arrived: no email needed
      const r = await notifyEmail(settings, p);
      if (r.ok) out.sent++;
    }
  }
  return out;
}

export async function sendTestEmail(settings, to) {
  const play = { orderId: "test", prizeKind: "PERCENT", prizeLabel: "10% OFF Coupon", couponCode: "CHMTEST5", couponStartsAt: new Date(Date.now() - 1000), couponEndsAt: new Date(Date.now() + 20 * 86400000), delivery: "code" };
  const mail = buildEmail(settings, play);
  return sendEmailVia(bikCreds(settings), { from: settings.bikEmailFrom, name: settings.bikEmailName, to, subject: mail.subject, html: mail.html });
}
