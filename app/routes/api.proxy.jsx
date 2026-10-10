import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { existsSync, readFileSync } from "node:fs";
import { buildPage } from "../carnival-page";
import { notifyOmnisend, omnisendConfigured, resolveKey } from "../carnival/omnisend.server";
import {
  GAME_NAMES, activeGameFor, getSettings, loadGame, openPrizes, rollOutcome, prizeForPlay, withLock,
} from "../carnival/rules.server";
import {
  maskEmail, normalizePhone, resolveOrder, upsertCustomer, saveWinToCustomer, createCustomerCode, addFreeProductToOrder, packGiftWithOrder,
} from "../carnival/shopify-ops.server";

// The build step combines the game files into one file; fall back to the separate files if it is missing.
const BUNDLED = existsSync("build/client/carnival/all.js") || existsSync("public/carnival/all.js");

// Stylesheet text, inlined into the page (read once when the server starts).
const CSS = (() => {
  for (const f of ["build/client/carnival/carnival.css", "public/carnival/carnival.css"]) {
    try { if (existsSync(f)) return readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " "); } catch (e) {}
  }
  return "";
})();

const LEGACY_CODES = { 5: "CARNIVAL5", 10: "CARNIVAL10", 50: "CARNIVAL50", 100: "CARNIVAL100", GIFT: "FREESTELLAR" };

const clean = (v, max) => String(v || "").replace(/[^A-Za-z0-9_~-]/g, "").slice(0, max);

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return "CHM-" + out;
}

// Small in-memory limiter. Keyed per order (not per IP: behind Shopify's proxy and mobile networks many
// customers can share one IP), plus a very high per-IP ceiling that only stops scripted abuse.
const hits = new Map();
function tooMany(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 20000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60000) hits.delete(k);
    if (hits.size > 20000) hits.clear();
  }
  return list.length > max;
}
function limited(request, intent, orderId) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (tooMany("ip:" + ip, 12000)) return true;
  if (orderId && (intent === "play" || intent === "claim")) return tooMany(`${intent}:${orderId}`, intent === "play" ? 30 : 15);
  return false;
}

async function context(request) {
  // stays null unless Shopify's signature on the request checks out (CARNIVAL_DEV_SHOP is for local testing only; never set on Render)
  let shop = process.env.CARNIVAL_DEV_SHOP || null, admin = null;
  try {
    const r = await authenticate.public.appProxy(request);
    if (r.session) shop = r.session.shop;
    admin = r.admin || null;
  } catch (e) {}
  const settings = await getSettings(shop);
  return { shop, admin, settings, adminTest: settings.testMode === true };
}

const UNVERIFIED = "We couldn't verify this request. Please open the game from the store.";
const fail = (reason, message, extra = {}) => ({ ok: false, success: false, reason, message, error: message, ...extra });
const publicPrize = (p) => (p ? { label: p.label, kind: p.kind, short: p.short, image: p.image || null, url: p.url || null } : null);

/* ---------------- play: the server decides the outcome when a play starts ---------------- */
async function handlePlay(ctx, fd) {
  const { shop, admin, settings, adminTest } = ctx;
  const baseOrder = clean(fd.get("orderId"), 40);
  const gameId = parseInt(fd.get("gameId") || "0", 10);
  const attempt = parseInt(fd.get("attempt") || "1", 10) || 1;
  const forceFree = adminTest && fd.get("testPrize") === "free";   // Test Mode only: always win the free product
  const customerId = String(fd.get("customerId") || "").replace(/\D/g, "").slice(0, 24);
  if (!(gameId >= 1 && gameId <= 9)) return fail("bad_game", "Unknown game.");

  const { cfg } = await loadGame(shop, gameId);
  if (!cfg.enabled && !adminTest) return fail("disabled", "This game is taking a short break. Please come back soon!");

  const live = activeGameFor(settings);
  if (!adminTest && gameId !== live) {
    return fail("not_live", live ? `Today's game is ${GAME_NAMES[live]}. This one opens on its own day!` : "The Carnival opens on 12 October. See you there!");
  }

  let order = null;
  let playRef = baseOrder;
  if (adminTest) {
    playRef = `${baseOrder || "TEST"}~t${attempt}~${Date.now().toString(36)}`;
    if (admin && /^\d{5,}$/.test(baseOrder)) order = await resolveOrder(admin, baseOrder);   // a real order in the link (test)
    if (order && order.cancelled) return fail("invalid_order", `TEST: order ${order.name} is cancelled. Open the game from the thank-you page of your NEW order.`);
  } else if (settings.requireOrder) {
    if (!baseOrder || /^(PLAY_|ORDER_|TEST)/.test(baseOrder)) return fail("need_order", "Place an order to unlock your play!");
    if (!admin) return fail("unavailable", "We couldn't verify your order right now. Please try again in a moment.");
    order = await resolveOrder(admin, baseOrder);
    if (!order) return fail("invalid_order", "We couldn't find this order. Please open the game from your order page.");
    if (order.cancelled) return fail("invalid_order", "This order was cancelled, so it can't be used to play.");
    if (Date.now() - new Date(order.createdAt).getTime() > 7 * 24 * 3600 * 1000) return fail("old_order", "This order is too old to play. Place a new order for a new play!");
    playRef = order.gid.split("/").pop(); // the same order always maps to the same play, however it is referred to
  } else if (!playRef) {
    playRef = "OPEN_" + Date.now().toString(36);
  }

  let row = await prisma.gamePlay.findUnique({ where: { orderId: playRef } });
  if (row) {
    if (row.claimedAt) {
      return fail("already_claimed", "You've already claimed the prize for this order.", {
        code: row.couponCode || null, delivery: row.delivery || null, prizeLabel: row.prizeLabel,
      });
    }
    if (row.finishedAt) {
      if (row.outcomeWin && row.won) {
        return fail("already_played", "You won! Claim your prize below.", { canClaim: true, autoClaim: !!(order && order.email), playRef, prizeLabel: row.prizeLabel, hint: order ? maskEmail(order.email) : "" });
      }
      return fail("already_played", "You've already used the play for this order. Place another order for another play!");
    }
    // started but not finished (page was closed or refreshed): same outcome, no re-roll
    const { shown } = await openPrizes(shop, gameId);
    return {
      ok: true, success: true, playRef, resumed: true, win: !!row.outcomeWin, soldOut: false, testMode: adminTest, days: settings.couponDays || 7, autoClaim: !!(order && order.email),
      prize: row.outcomeWin ? { label: row.prizeLabel, kind: row.prizeKind, short: shortOf(row) } : null,
      prizes: shown, orderName: order?.name || "", hint: order ? maskEmail(order.email) : "",
    };
  }

  // Roll and reserve in one step per game, so the daily prize limit holds even when many people play at once.
  let o = null, duplicate = false;
  await withLock(shop, async () => {
    o = await rollOutcome(shop, gameId, { forceKind: forceFree ? "FREE_PRODUCT" : null });
    try {
      await prisma.gamePlay.create({
        data: {
          shop, orderId: playRef, customerId: customerId || null, gameId, won: false,
          outcomeWin: o.win, prizeId: o.prize?.id || null, prizeLabel: o.prize?.label || null, prizeKind: o.prize?.kind || null,
          rolledAt: new Date(),
        },
      });
    } catch (e) {
      duplicate = true; // the same order started a play a moment ago: it keeps that one
    }
  });
  if (duplicate) return fail("already_played", "You've already used the play for this order.");
  if (o.noForcedPrize) return fail("no_free_product", "TEST: no free product is set up for this game. Choose one on Games & prizes and press Save.");
  return {
    ok: true, success: true, playRef, resumed: false, win: o.win, soldOut: !!o.soldOut, testMode: adminTest, days: settings.couponDays || 7, autoClaim: !!(order && order.email),
    prize: publicPrize(o.prize), prizes: o.prizes, orderName: order?.name || "", hint: order ? maskEmail(order.email) : "",
  };
}
function shortOf(row) {
  const m = String(row.prizeLabel || "").match(/^(\d+%|₹\d+|FREE)/);
  return m ? m[1] : "";
}

/* ---------------- result: the game reports how it ended ---------------- */
async function handleResult(ctx, fd) {
  const orderId = clean(fd.get("orderId"), 80);
  const row = await prisma.gamePlay.findUnique({ where: { orderId } });
  if (!row || row.shop !== ctx.shop) return fail("no_play", "Unknown play.");
  if (!row.finishedAt) {
    await prisma.gamePlay.update({
      where: { orderId },
      data: { finishedAt: new Date(), won: !!(row.outcomeWin && fd.get("won") === "true"), playedAt: new Date() },
    });
  }
  return { ok: true, success: true };
}

/* ---------------- claim: deliver the prize ---------------- */
function claimView(row, extra = {}) {
  return {
    ok: true, success: true, prizeLabel: row.prizeLabel, delivery: row.delivery, code: row.couponCode || null,
    note: row.deliveryNote || "", email: row.email, notified: row.omnisendStatus === "sent", unique: !!(row.couponCode && row.couponCode.startsWith("CHM-")), ...extra,
  };
}

async function handleClaim(ctx, fd) {
  const { shop, admin, settings, adminTest } = ctx;
  const playRef = clean(fd.get("orderId"), 80);
  let row = await prisma.gamePlay.findUnique({ where: { orderId: playRef } });
  if (row && row.shop !== shop) row = null;
  if (!row || !row.outcomeWin || !row.won) return fail("not_won", "We couldn't verify this win. Please play again.");
  if (row.claimedAt && row.delivery && row.delivery !== "pending") return claimView(row);

  // Who is the customer? Taken from the Shopify order (email + phone). Typed details are only a fallback.
  let order = null;
  if (adminTest) {
    // Test Mode: if the link carried a real order number, use that order (so the free product is added to it for real)
    const baseRef = playRef.split("~")[0];
    if (/^\d{5,}$/.test(baseRef)) order = await resolveOrder(admin, baseRef);
  } else if (settings.requireOrder) {
    order = await resolveOrder(admin, playRef);
    if (!order) return fail("unavailable", "We couldn't verify your order right now. Please try again in a moment.");
  }
  const typedEmail = String(fd.get("email") || "").trim().toLowerCase();
  const email = order && order.email ? order.email : typedEmail;
  const phone = normalizePhone(order && order.phone ? order.phone : fd.get("phone"));   // the phone number is optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("need_contact", "Please enter your email so we can send you the prize.", { need: ["email"] });
  }

  const prize = await prizeForPlay(shop, row);
  if (!prize) return fail("no_prize", "This prize is no longer available. Please contact us.");

  // take the claim so double taps can't hand out two prizes
  const stale = new Date(Date.now() - 2 * 60 * 1000);
  const lock = await prisma.gamePlay.updateMany({
    where: { orderId: playRef, OR: [{ claimedAt: null }, { delivery: "pending", claimedAt: { lt: stale } }] },
    data: { claimedAt: new Date(), delivery: "pending" },
  });
  if (lock.count === 0) {
    row = await prisma.gamePlay.findUnique({ where: { orderId: playRef } });
    if (row.delivery && row.delivery !== "pending") return claimView(row);
    return fail("busy", "Your prize is being prepared. Please wait a moment and try again.");
  }
  const release = () => prisma.gamePlay.updateMany({ where: { orderId: playRef }, data: { claimedAt: null, delivery: null } });

  const customerGid = await upsertCustomer(admin, email, phone);
  const days = settings.couponDays || 7;
  let delivery = null, code = null, note = "", unique = false, editError = "";

  if (prize.kind === "FREE_PRODUCT") {
    if (!order?.gid) editError = "No Shopify order is linked to this play (the link had no real order number).";
    else if (order.cancelled) editError = `Order ${order.name} is cancelled, so nothing can be added to it.`;
    else {
      const r = await addFreeProductToOrder(admin, order.gid, prize.variantId);
      if (r.ok) { delivery = "order_edit"; note = `Added to order ${order.name}`; }
      else { editError = `Shopify refused to add it to order ${order.name}: ${r.error}`; console.error("Order edit failed, falling back to a product code:", r.error); }
    }
    // Shopify would not edit the order: tag it and leave a "pack this gift" note for the team (unless the owner prefers a code)
    if (!delivery && order?.gid && !order.cancelled && settings.giftFallback !== "code") {
      const pk = await packGiftWithOrder(admin, order, prize.variantId, prize.productTitle);
      if (pk.ok) { delivery = "pack"; note = `Your free gift will be packed with your order ${order.name}.`; }
      else editError += ` (and the pack-with-order note failed too: ${pk.error})`;
    }
    if (!delivery) {
      code = makeCode();
      const r = await createCustomerCode(admin, { code, kind: "FREE_PRODUCT", customerGid, days, variantId: prize.variantId });
      if (r.ok) { delivery = "product_code"; unique = true; note = `Add ${prize.productTitle || "your gift"} to your cart and use this code at checkout.`; }
      else code = null;
    }
  } else {
    code = makeCode();
    const r = await createCustomerCode(admin, { code, kind: prize.kind, value: prize.value, customerGid, days });
    if (r.ok) { delivery = "code"; unique = true; }
    else code = null;
  }

  if (!delivery) {
    if (adminTest) {
      // testing before the Shopify permissions are approved: hand out a shared test code
      code = LEGACY_CODES[prize.value] || LEGACY_CODES.GIFT; delivery = "code"; note = "TEST MODE: shared code";
    } else {
      await release();
      return fail("delivery_failed", "We couldn't prepare your prize just now. Please tap the button again in a moment.");
    }
  }

  await prisma.gamePlay.update({
    where: { orderId: playRef },
    data: { email, phone, couponCode: code, delivery, deliveryNote: note, deliveryError: editError || null, customerId: customerGid ? customerGid.split("/").pop() : row.customerId },
  });
  await saveWinToCustomer(admin, customerGid, { game: row.gameId, prize: row.prizeLabel, code, delivery, order: order?.name || playRef, wonAt: new Date().toISOString() });

  row = await prisma.gamePlay.findUnique({ where: { orderId: playRef } });
  // Omnisend: in "auto" mode every real win is sent on its own (never blocks or fails the customer's claim)
  if (!adminTest && omnisendConfigured(settings) && (settings.omnisendMode || "auto") === "auto") {
    notifyOmnisend(row, { days, whatsappConsent: false, key: resolveKey(settings) }).catch(() => {});
  }
  return claimView(row, { unique, days, notifyBtn: !adminTest && omnisendConfigured(settings) && settings.omnisendMode === "button" });
}

// "Send my code on WhatsApp" button: the tap is the customer's consent.
async function handleNotify(ctx, fd) {
  const { shop, settings, adminTest } = ctx;
  if (adminTest || !omnisendConfigured(settings) || settings.omnisendMode !== "button") return fail("off", "This isn't available right now.");
  const row = await prisma.gamePlay.findUnique({ where: { orderId: clean(fd.get("orderId"), 80) } });
  if (!row || row.shop !== shop || !row.won || !row.delivery || row.delivery === "pending") return fail("not_won", "We couldn't find your prize.");
  if (row.omnisendStatus === "sent") return { ok: true, success: true, notified: true };
  const r = await notifyOmnisend(row, { days: settings.couponDays || 7, whatsappConsent: true, key: resolveKey(settings) });
  return r.ok ? { ok: true, success: true, notified: true } : fail("send_failed", "We couldn't send it just now. Please copy your code from this screen.");
}

export const action = async ({ request }) => {
  try {
    const fd = await request.formData();
    const intent = fd.get("intent");
    if (limited(request, intent, clean(fd.get("orderId"), 80))) {
      return json(fail("rate", "Too many attempts. Please wait a minute and try again."));
    }
    const ctx = await context(request);
    if (!ctx.shop && (intent === "play" || intent === "result" || intent === "claim" || intent === "notify")) return json(fail("unverified", UNVERIFIED));
    if (intent === "play") return json(await handlePlay(ctx, fd));
    if (intent === "result") return json(await handleResult(ctx, fd));
    if (intent === "claim") return json(await handleClaim(ctx, fd));
    if (intent === "notify") return json(await handleNotify(ctx, fd));
    return json(fail("bad_request", "Unknown request."));
  } catch (err) {
    console.error("Carnival action error:", err);
    return json(fail("error", "Something went wrong. Please try again."));
  }
};

/* ---------------- the page ---------------- */
export const loader = async ({ request }) => {
  const ctx = await context(request);
  const url = new URL(request.url);
  const rawOrderId = clean(url.searchParams.get("order_id"), 40);
  const orderId = rawOrderId !== "" ? rawOrderId : "PLAY_" + Date.now().toString(36);
  const orderBadge = rawOrderId !== "" && /^\d{1,9}$/.test(rawOrderId) ? "ORDER #" + rawOrderId : "";
  const customerId = String(url.searchParams.get("customer_id") || url.searchParams.get("logged_in_customer_id") || "").replace(/\D/g, "").slice(0, 24);
  const gameParam = parseInt(url.searchParams.get("game") || "", 10);

  const testParam = url.searchParams.get("test");
  // The URL only unlocks the tabs for looking around; the server decides what can actually be played.
  const isTest = testParam === "1" ? true : testParam === "0" ? false : ctx.adminTest;
  const activeGame = activeGameFor(ctx.settings);
  const initialGame = gameParam >= 1 && gameParam <= 9 ? gameParam : activeGame || 1;

  const appUrl = (process.env.SHOPIFY_APP_URL || "https://charmasy-carnival.onrender.com").replace(/\/$/, "");
  const version = String(process.env.RENDER_GIT_COMMIT || "").slice(0, 8) || String(Date.now());

  const html = buildPage({
    assets: appUrl + "/carnival",
    version,
    bundled: BUNDLED,
    css: CSS,
    cfg: { orderId, customerId, orderBadge, initialGame, isTest, activeGame, testPrize: ctx.adminTest && url.searchParams.get("testprize") === "free" ? "free" : "" },
  });
  return new Response(html, { headers: { "Content-Type": "application/liquid" } });
};
