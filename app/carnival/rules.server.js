// Prize rules for the Carnival: per-game settings, prize lists, stock and the server-side win/lose draw.
import prisma from "../db.server";

import { GAME_NAMES, SKILL_GAMES, DEFAULT_CHANCE } from "./constants";
export { GAME_NAMES, SKILL_GAMES };

// Standard coupon mix (agreed with the owner): within percent coupons 90% are 5% and 10% are 10%;
// within rupee coupons 90% are Rs 50 and 10% are Rs 100. Weights below make percent and rupee coupons equally likely.
const coupon = (kind, value, share) => ({ kind, value, share, dailyLimit: null, active: true });
export const STANDARD_MIX = [coupon("PERCENT", 5, 45), coupon("PERCENT", 10, 5), coupon("AMOUNT", 50, 45), coupon("AMOUNT", 100, 5)];
const DEFAULT_PRIZES = { 1: STANDARD_MIX, 2: STANDARD_MIX, 3: STANDARD_MIX, 4: STANDARD_MIX, 5: STANDARD_MIX, 6: STANDARD_MIX, 7: STANDARD_MIX, 8: STANDARD_MIX, 9: STANDARD_MIX };

export function defaultGameConfig(gameId) {
  return { enabled: true, winChance: DEFAULT_CHANCE[gameId] ?? 50, dailyLimit: 6 };
}
export function defaultPrizeRows(gameId) {
  return (DEFAULT_PRIZES[gameId] || []).map((p, i) => ({ ...p, id: `default-${gameId}-${i}`, isDefault: true }));
}

export function prizeLabel(p) {
  if (p.kind === "FREE_PRODUCT") return `FREE ${p.productTitle || "Gift"}`;
  if (p.kind === "AMOUNT") return `₹${p.value} OFF Coupon`;
  return `${p.value}% OFF Coupon`;
}
export function prizeShort(p) {
  if (p.kind === "FREE_PRODUCT") return "FREE";
  if (p.kind === "AMOUNT") return `₹${p.value}`;
  return `${p.value}%`;
}
export function isDeliverable(p) {
  if (!p.active) return false;
  if (p.kind === "FREE_PRODUCT") return !!p.variantId;
  return Number(p.value) > 0;
}

// Start of "today" in India time, as a UTC Date.
export function istDayStart(now = Date.now()) {
  const ist = new Date(now + 5.5 * 3600 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600 * 1000);
}

// Which game is live right now. 0 means the campaign is not running (before 12 Oct / after 20 Oct).
export function activeGameFor(settings, now = Date.now()) {
  if (settings && settings.manualActive && settings.activeGameId >= 1 && settings.activeGameId <= 9) return settings.activeGameId;
  const ist = new Date(now + 5.5 * 3600 * 1000);
  const m = ist.getUTCMonth() + 1, d = ist.getUTCDate();
  if (ist.getUTCFullYear() === 2026 && m === 10 && d >= 12 && d <= 20) return d - 11;
  return 0;
}

// The window in which a won personal code can be used. Default for this campaign: from 21 Oct 2026 00:00 IST for 30 days
// (until the end of 19 Nov). Test Mode codes work immediately so they can be tried before the campaign.
export const DEFAULT_COUPON_START = new Date(Date.UTC(2026, 9, 21) - 5.5 * 3600 * 1000);
export const DEFAULT_COUPON_END = new Date(Date.UTC(2026, 10, 20) - 5.5 * 3600 * 1000);
export function couponWindow(settings, { testMode = false, now = Date.now() } = {}) {
  const planned = settings && settings.couponStartsAt ? new Date(settings.couponStartsAt) : DEFAULT_COUPON_START;
  const startsAt = testMode ? new Date(now) : new Date(Math.max(planned.getTime(), now - 60000));
  let endsAt = settings && settings.couponEndsAt ? new Date(settings.couponEndsAt) : DEFAULT_COUPON_END;
  if (endsAt.getTime() <= startsAt.getTime() + 24 * 3600 * 1000) {      // the campaign window is over: fall back to "valid for X days"
    endsAt = new Date(startsAt.getTime() + ((settings && settings.couponDays) || 7) * 86400000);
  }
  return { startsAt, endsAt };
}
// "19 Nov 2026" - the last day the code works (the window ends at 00:00 IST of the next day)
export function lastDayText(endsAt) {
  return new Date(endsAt.getTime() - 1000 + 5.5 * 3600 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
export function startDayText(startsAt) {
  return new Date(startsAt.getTime() + 5.5 * 3600 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export async function getSettings(shop) {
  let st = null;
  try {
    if (shop) st = await prisma.gameSettings.findUnique({ where: { shop } });   // each store has its own settings
  } catch (e) {
    console.error("Failed to read settings:", e);
  }
  return st || { testMode: false, manualActive: false, activeGameId: 1, couponDays: 7, requireOrder: true, freeGiftDailyLimit: 6, spreadFreeGifts: true };
}

export async function loadGame(shop, gameId) {
  const [cfg, rows] = await Promise.all([
    prisma.gameConfig.findUnique({ where: { shop_gameId: { shop, gameId } } }),
    prisma.prizeConfig.findMany({ where: { shop, gameId }, orderBy: { id: "asc" } }),
  ]);
  return {
    cfg: cfg || defaultGameConfig(gameId),
    prizes: rows.length ? rows : defaultPrizeRows(gameId),
    configured: !!cfg || rows.length > 0,
  };
}

// Prizes already promised today: claimed ones, plus fresh unclaimed wins (held for 30 minutes).
function usedWhere(shop, gameId, dayStart, extra = {}) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  return {
    shop, ...(gameId ? { gameId } : {}), outcomeWin: true, rolledAt: { gte: dayStart }, ...extra,
    OR: [
      { claimedAt: { not: null } },
      { AND: [{ claimedAt: null }, { rolledAt: { gte: cutoff } }, { OR: [{ finishedAt: null }, { won: true }] }] },
    ],
  };
}

// Prizes that can be handed out right now for a game (stock left today, deliverable, active).
export async function openPrizes(shop, gameId, { ignoreFreeLimit = false } = {}) {
  const { cfg, prizes } = await loadGame(shop, gameId);
  const dayStart = istDayStart();
  const usedTotal = await prisma.gamePlay.count({ where: usedWhere(shop, gameId, dayStart) });
  const roomTotal = cfg.dailyLimit - usedTotal;
  // Free gifts have one daily limit shared by ALL games together.
  const settings = await getSettings(shop);
  const freeLimit = settings.freeGiftDailyLimit ?? 6;
  const freeUsed = await prisma.gamePlay.count({ where: usedWhere(shop, null, dayStart, { prizeKind: "FREE_PRODUCT" }) });
  // Spread through the day (India time): 1 gift is available from midnight, then one more every 24h / limit
  // (every 4 hours for 6). Gifts nobody won earlier stay available later in the same day.
  const spread = settings.spreadFreeGifts !== false;
  const dayFrac = Math.min(0.999999, (Date.now() - dayStart.getTime()) / 86400000);
  const releasedByNow = spread ? Math.min(freeLimit, Math.floor(freeLimit * dayFrac) + 1) : freeLimit;
  const freeLeft = Math.min(freeLimit, releasedByNow) - freeUsed;
  const open = [];
  for (const p of prizes) {
    if (!isDeliverable(p)) continue;
    if (p.kind === "FREE_PRODUCT" && freeLeft <= 0 && !ignoreFreeLimit) continue;
    if (p.dailyLimit != null && !p.isDefault) {
      const used = await prisma.gamePlay.count({ where: usedWhere(shop, gameId, dayStart, { prizeId: p.id }) });
      if (used >= p.dailyLimit) continue;
    }
    open.push(p);
  }
  const shown = open.map((p) => ({ id: p.id, kind: p.kind, label: prizeLabel(p), short: prizeShort(p), image: p.imageUrl || null, url: p.productHandle ? "/products/" + p.productHandle : null }));
  return { cfg, open, roomTotal, shown };
}

// forceKind is for the admin's Test Mode only: it makes the play win a prize of that kind (for example a free product).
export async function rollOutcome(shop, gameId, { forceWin = false, forceKind = null } = {}) {
  const base = await openPrizes(shop, gameId, { ignoreFreeLimit: !!forceKind });
  const { cfg, roomTotal, shown } = base;
  let open = base.open;
  if (forceKind) {
    open = open.filter((p) => p.kind === forceKind);
    if (!open.length) return { win: false, prize: null, soldOut: false, prizes: shown, noForcedPrize: true };
  } else if (roomTotal <= 0 || !open.length) return { win: false, prize: null, soldOut: true, prizes: shown };

  const wins = !!forceKind || forceWin || Math.random() * 100 < cfg.winChance;
  if (!wins) return { win: false, prize: null, soldOut: false, prizes: shown };

  const totalShare = open.reduce((a, p) => a + Math.max(1, p.share || 1), 0);
  let r = Math.random() * totalShare, chosen = open[0];
  for (const p of open) { r -= Math.max(1, p.share || 1); if (r <= 0) { chosen = p; break; } }
  return {
    win: true,
    soldOut: false,
    prizes: shown,
    prize: { id: chosen.id, kind: chosen.kind, label: prizeLabel(chosen), short: prizeShort(chosen), image: chosen.imageUrl || null, url: chosen.productHandle ? "/products/" + chosen.productHandle : null },
  };
}

// The prize row behind a stored play (DB prize, or one of the built-in defaults).
export async function prizeForPlay(shop, play) {
  if (!play.prizeId) return null;
  if (play.prizeId.startsWith("default-")) {
    const [, g, i] = play.prizeId.split("-");
    return defaultPrizeRows(Number(g))[Number(i)] || null;
  }
  return prisma.prizeConfig.findUnique({ where: { id: play.prizeId } });
}

// Runs jobs with the same key one after another (this app runs as a single server process).
// Used so "check how many prizes are left" and "reserve one" can never interleave between two players.
const lockTails = new Map();
export function withLock(key, job) {
  const prev = lockTails.get(key) || Promise.resolve();
  const run = prev.then(job, job);
  lockTails.set(key, run.catch(() => {}));
  return run;
}
