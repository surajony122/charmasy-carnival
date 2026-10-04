import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { buildPage } from "../carnival-page";

const LEGACY_CODES = { P10: "CARNIVAL10", P5: "CARNIVAL5", R50: "CARNIVAL50", R100: "CARNIVAL100", GIFT: "FREESTELLAR" };

const DAILY_PRIZE_CAP = 6; // deck: exactly 6 prizes per game per day

// Start of "today" in India time, as a UTC Date.
function istDayStart() {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600 * 1000);
}

// Small in-memory limiter: at most `max` calls per IP per minute.
const hits = new Map();
function tooMany(request, max = 20) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

function parsePrize(prize) {
  const text = String(prize || "");
  const pct = text.match(/(\d+)\s*%/);
  if (pct) return { kind: "percent", value: parseInt(pct[1], 10), legacy: pct[1] === "10" ? LEGACY_CODES.P10 : LEGACY_CODES.P5 };
  const amt = text.match(/₹\s*(\d+)/);
  if (amt) return { kind: "amount", value: parseInt(amt[1], 10), legacy: amt[1] === "100" ? LEGACY_CODES.R100 : LEGACY_CODES.R50 };
  if (/nia|stellar|gift|eyeliner/i.test(text)) return { kind: "gift", legacy: LEGACY_CODES.GIFT };
  return null;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return "CHM-" + out;
}

// Finds the customer by email or creates one (no marketing consent is set). Returns the customer GID or null.
async function upsertCustomer(admin, email) {
  if (!admin) return null;
  try {
    const found = await (await admin.graphql(
      `#graphql
      query findCustomer($q: String!) { customers(first: 1, query: $q) { nodes { id } } }`,
      { variables: { q: "email:" + JSON.stringify(email) } }
    )).json();
    let id = found?.data?.customers?.nodes?.[0]?.id || null;
    if (!id) {
      const created = await (await admin.graphql(
        `#graphql
        mutation createCustomer($input: CustomerInput!) {
          customerCreate(input: $input) { customer { id } userErrors { field message } }
        }`,
        { variables: { input: { email, tags: ["carnival-2026"] } } }
      )).json();
      id = created?.data?.customerCreate?.customer?.id || null;
      if (!id) console.error("Customer create failed:", JSON.stringify(created?.errors || created?.data?.customerCreate?.userErrors));
    } else {
      await admin.graphql(
        `#graphql
        mutation tag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`,
        { variables: { id, tags: ["carnival-2026"] } }
      );
    }
    return id;
  } catch (e) {
    console.error("Customer upsert error:", e);
    return null;
  }
}

// Backup of the win on the customer profile (metafield carnival.last_win).
async function saveWinToCustomer(admin, customerGid, info) {
  if (!admin || !customerGid) return;
  try {
    const res = await (await admin.graphql(
      `#graphql
      mutation setMeta($m: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $m) { userErrors { message } }
      }`,
      { variables: { m: [{ ownerId: customerGid, namespace: "carnival", key: "last_win", type: "json", value: JSON.stringify(info) }] } }
    )).json();
    const errs = res?.data?.metafieldsSet?.userErrors || [];
    if (errs.length) console.error("Customer metafield failed:", JSON.stringify(errs));
  } catch (e) {
    console.error("Customer metafield error:", e);
  }
}

// Creates a single-use, 7-day Shopify discount. Returns true on success (needs write_discounts scope).
async function createShopifyDiscount(admin, code, parsed, customerGid) {
  if (!admin || !parsed || parsed.kind === "gift") return false;
  const value = parsed.kind === "percent"
    ? { percentage: parsed.value / 100 }
    : { discountAmount: { amount: String(parsed.value), appliesOnEachItem: false } };
  const res = await admin.graphql(
    `#graphql
    mutation createCode($input: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $input) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          title: "Carnival " + code,
          code,
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          usageLimit: 1,
          appliesOncePerCustomer: true,
          customerSelection: customerGid ? { customers: { add: [customerGid] } } : { all: true },
          combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false },
          customerGets: { value, items: { all: true } },
        },
      },
    }
  );
  const data = await res.json();
  const errs = data?.data?.discountCodeBasicCreate?.userErrors || [];
  if (errs.length || !data?.data?.discountCodeBasicCreate?.codeDiscountNode) {
    console.error("Discount create failed:", JSON.stringify(data?.errors || errs));
    return false;
  }
  return true;
}

export const action = async ({ request }) => {
  let shop = "ravistore-shop.myshopify.com";
  let admin = null;
  try {
    const authResult = await authenticate.public.appProxy(request);
    if (authResult.session) shop = authResult.session.shop;
    admin = authResult.admin || null;
  } catch (e) {}

  try {
    const formData = await request.formData();
    const orderId = formData.get("orderId");
    const customerId = formData.get("customerId");
    const gameId = parseInt(formData.get("gameId") || "1", 10);

    if (!orderId) return json({ success: false });

    // Claim: user submits email, gets a code that is saved against that email.
    if (formData.get("intent") === "claim") {
      const email = String(formData.get("email") || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ success: false, error: "Please enter a valid email address." });
      }
      const prizeValue = formData.get("prizeValue");
      const parsed = parsePrize(prizeValue);
      if (!parsed) return json({ success: false, error: "Unknown prize." });

      if (tooMany(request)) return json({ success: false, error: "Too many attempts. Please wait a minute and try again." });

      const existing = await prisma.gamePlay.findUnique({ where: { orderId } });
      if (existing && existing.couponCode) {
        return json({ success: true, code: existing.couponCode, email: existing.email, unique: existing.couponCode.startsWith("CHM-") });
      }

      // Rules from the deck, enforced here because the browser can't be trusted:
      // a recorded win must exist, max 6 prizes per game per day, one prize per email per day.
      // (Skipped only when the admin has switched the app's test mode on.)
      let adminTest = false;
      try {
        const st = (await prisma.gameSettings.findUnique({ where: { shop } })) || (await prisma.gameSettings.findFirst());
        adminTest = !!(st && st.testMode === true);
      } catch (e) {}
      if (!adminTest) {
        if (!existing || !existing.won || existing.prizeValue !== prizeValue) {
          return json({ success: false, error: "We couldn't verify this win. Please play again." });
        }
        const dayStart = istDayStart();
        const already = await prisma.gamePlay.findFirst({ where: { email, claimedAt: { gte: dayStart } } });
        if (already) {
          return json({ success: false, error: "You've already claimed today's prize. Come back tomorrow for the next game!" });
        }
        const claimedToday = await prisma.gamePlay.count({
          where: { shop, gameId: existing.gameId, couponCode: { not: null }, claimedAt: { gte: dayStart } },
        });
        if (claimedToday >= DAILY_PRIZE_CAP) {
          return json({ success: false, error: "All of today's prizes for this game have been claimed. Come back tomorrow!" });
        }
      }

      const customerGid = await upsertCustomer(admin, email);
      let code = makeCode();
      let unique = false;
      try {
        unique = await createShopifyDiscount(admin, code, parsed, customerGid);
      } catch (e) {
        console.error("Discount create error:", e);
      }
      if (!unique) code = parsed.legacy;

      await prisma.gamePlay.upsert({
        where: { orderId },
        update: { email, couponCode: code, claimedAt: new Date(), won: true, prizeValue, customerId: customerId || undefined },
        create: { shop, orderId, customerId: customerId || null, gameId, won: true, prizeType: parsed.kind === "gift" ? "PRODUCT" : "COUPON", prizeValue, email, couponCode: code, claimedAt: new Date() },
      });
      await saveWinToCustomer(admin, customerGid, { game: gameId, prize: prizeValue, code, orderId, wonAt: new Date().toISOString() });
      return json({ success: true, code, email, unique });
    }

    const won = formData.get("won") === "true";
    const prizeType = formData.get("prizeType");
    const prizeValue = formData.get("prizeValue");

    await prisma.gamePlay.upsert({
      where: { orderId },
      update: { won, prizeType, prizeValue, gameId, customerId: customerId || undefined, playedAt: new Date() },
      create: { shop, orderId, customerId: customerId || null, gameId, won, prizeType, prizeValue },
    });

    return json({ success: true });
  } catch (err) {
    console.error("GamePlay action recording error:", err);
    return json({ success: false, error: "Something went wrong. Please try again." });
  }
};

export const loader = async ({ request }) => {
  let shop = "ravistore-shop.myshopify.com";
  try {
    const authResult = await authenticate.public.appProxy(request);
    if (authResult.session) shop = authResult.session.shop;
  } catch (error) {
    console.error("App Proxy Auth Failed:", error);
  }

  const url = new URL(request.url);
  // Only plain id characters are allowed through (these values end up inside the page).
  const clean = (v, max) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, max);
  const rawOrderId = clean(url.searchParams.get("order_id"), 40);
  const orderId = rawOrderId !== "" ? rawOrderId : "PLAY_" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const orderBadge = rawOrderId !== "" ? "ORDER " + rawOrderId : "";
  const customerId = String(url.searchParams.get("customer_id") || url.searchParams.get("logged_in_customer_id") || "").replace(/\D/g, "").slice(0, 24);
  const gameParam = parseInt(url.searchParams.get("game") || "", 10);

  let settings = null;
  try {
    settings = (await prisma.gameSettings.findUnique({ where: { shop } })) || (await prisma.gameSettings.findFirst());
  } catch (e) {
    console.error("Failed to query gameSettings:", e);
  }

  // Campaign day in India time (the server clock is UTC).
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  let todayGame = 1;
  if (ist.getMonth() + 1 === 10 && ist.getDate() >= 12 && ist.getDate() <= 20) {
    todayGame = ist.getDate() - 11;
  }

  const testParam = url.searchParams.get("test");
  let isTestMode = false; // customers never see test mode unless it is switched on
  if (testParam === "1") {
    isTestMode = true;
  } else if (testParam === "0") {
    isTestMode = false;
  } else if (settings && typeof settings.testMode === "boolean") {
    isTestMode = settings.testMode;
  }

  const activeGame = settings && settings.activeGameId ? settings.activeGameId : todayGame;
  const initialGame = gameParam >= 1 && gameParam <= 9 ? gameParam : activeGame;

  const appUrl = (process.env.SHOPIFY_APP_URL || "https://charmasy-carnival.onrender.com").replace(/\/$/, "");
  const version = String(process.env.RENDER_GIT_COMMIT || "").slice(0, 8) || String(Date.now());

  const html = buildPage({
    assets: appUrl + "/carnival",
    version,
    cfg: { orderId, customerId, orderBadge, initialGame, isTest: isTestMode, activeGame },
  });

  return new Response(html, {
    headers: { "Content-Type": "application/liquid" },
  });
};
