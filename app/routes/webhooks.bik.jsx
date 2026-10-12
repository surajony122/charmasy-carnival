import { json } from "@remix-run/node";
import prisma from "../db.server";
import { webhookKeyOk, handleBikEvents } from "../carnival/bik-webhook.server";

// Bik posts WhatsApp status events here: https://<app>/webhooks/bik?shop=<store>.myshopify.com
export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ ok: false }, { status: 405 });
  const shop = String(new URL(request.url).searchParams.get("shop") || "").replace(/[^a-z0-9.-]/gi, "").slice(0, 120);
  const settings = shop ? await prisma.gameSettings.findUnique({ where: { shop } }) : null;
  const note = (result) => settings ? prisma.gameSettings.update({ where: { shop }, data: { bikHookLastAt: new Date(), bikHookLastResult: result } }).catch(() => {}) : null;   // shown on the WhatsApp messages page
  if (!webhookKeyOk(settings, request.headers.get("authorization"))) { await note("refused: wrong or missing key"); return json({ ok: false }, { status: 401 }); }
  let body;
  try { body = await request.json(); } catch (e) { await note("refused: unreadable body"); return json({ ok: false }, { status: 400 }); }
  await note("ok");
  const changed = await handleBikEvents(shop, Array.isArray(body) ? body : [body]);
  return json({ ok: true, changed });
};

export const loader = () => json({ ok: true });   // a plain GET (for example Bik's "test URL") answers 200
