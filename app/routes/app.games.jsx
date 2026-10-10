import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, TextField, Checkbox, Select, Button, Banner, Badge, Thumbnail, Divider,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { GAME_NAMES, SKILL_GAMES } from "../carnival/constants";
import { loadGame, getSettings } from "../carnival/rules.server";
import { encryptKey, omnisendConfigured, keyHint, resolveKey, sendTestEvent } from "../carnival/omnisend.server";

const KINDS = [
  { label: "% OFF coupon", value: "PERCENT" },
  { label: "₹ OFF coupon", value: "AMOUNT" },
  { label: "Free product", value: "FREE_PRODUCT" },
];
const DAYS = { 1: "12 Oct", 2: "13 Oct", 3: "14 Oct", 4: "15 Oct", 5: "16 Oct", 6: "17 Oct", 7: "18 Oct", 8: "19 Oct", 9: "20 Oct" };

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await getSettings(shop);
  const games = {};
  for (let id = 1; id <= 9; id++) {
    const g = await loadGame(shop, id);
    games[id] = {
      enabled: g.cfg.enabled, winChance: g.cfg.winChance, dailyLimit: g.cfg.dailyLimit, saved: g.configured,
      prizes: g.prizes.map((p) => ({
        kind: p.kind, value: p.value ?? "", productId: p.productId || "", variantId: p.variantId || "",
        productTitle: p.productTitle || "", productHandle: p.productHandle || "", imageUrl: p.imageUrl || "", share: p.share ?? 1, dailyLimit: p.dailyLimit ?? "",
      })),
    };
  }
  return json({ games, couponDays: settings.couponDays ?? 7, requireOrder: settings.requireOrder !== false, freeGiftDailyLimit: settings.freeGiftDailyLimit ?? 6, spreadFreeGifts: settings.spreadFreeGifts !== false, giftFallback: settings.giftFallback === "code" ? "code" : "pack", omnisendMode: ["off", "button"].includes(settings.omnisendMode) ? settings.omnisendMode : "auto", omnisendKey: omnisendConfigured(settings), omnisendKeyHint: keyHint(settings) });
};

const int = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const fd = await request.formData();
  if (fd.get("omnisendTest")) {
    const email = String(fd.get("omnisendTest")).trim().toLowerCase();
    const phone = String(fd.get("omnisendTestPhone") || "").replace(/[^\d+]/g, "").slice(0, 15);
    if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) return json({ omnisendTest: { ok: false, error: "Type a valid email address first." } });
    const key = resolveKey(await getSettings(shop));
    if (!key) return json({ omnisendTest: { ok: false, error: "Save your Omnisend API key first, then send the test." } });
    const r = await sendTestEvent(key, email, phone);
    return json({ omnisendTest: { ok: r.ok, error: r.error || "", email } });
  }
  let data;
  try { data = JSON.parse(String(fd.get("payload") || "{}")); } catch { return json({ ok: false, error: "Could not read the form." }); }

  const warnings = [];
  const ops = [];
  ops.push(prisma.gameSettings.upsert({
    where: { shop },
    update: { couponDays: int(data.couponDays, 1, 90, 7), requireOrder: !!data.requireOrder, freeGiftDailyLimit: int(data.freeGiftDailyLimit, 0, 100000, 6), spreadFreeGifts: !!data.spreadFreeGifts, giftFallback: data.giftFallback === "code" ? "code" : "pack", omnisendMode: ["off", "button"].includes(data.omnisendMode) ? data.omnisendMode : "auto" },
    create: { shop, couponDays: int(data.couponDays, 1, 90, 7), requireOrder: !!data.requireOrder, freeGiftDailyLimit: int(data.freeGiftDailyLimit, 0, 100000, 6), spreadFreeGifts: !!data.spreadFreeGifts, giftFallback: data.giftFallback === "code" ? "code" : "pack", omnisendMode: ["off", "button"].includes(data.omnisendMode) ? data.omnisendMode : "auto", testMode: false },
  }));
  // Omnisend API key: saved encrypted, only when a new one is typed (empty box keeps the saved key); "remove" clears it
  const newKey = String(data.omnisendKey || "").trim();
  if (data.omnisendRemoveKey) ops.push(prisma.gameSettings.update({ where: { shop }, data: { omnisendKeyEnc: null } }));
  else if (newKey) ops.push(prisma.gameSettings.update({ where: { shop }, data: { omnisendKeyEnc: encryptKey(newKey) } }));

  for (let id = 1; id <= 9; id++) {
    const g = data.games?.[id];
    if (!g) continue;
    const cfg = { enabled: !!g.enabled, winChance: int(g.winChance, 0, 100, 50), dailyLimit: int(g.dailyLimit, 0, 100000, 6) };
    const prizes = [];
    for (const p of g.prizes || []) {
      const kind = ["PERCENT", "AMOUNT", "FREE_PRODUCT"].includes(p.kind) ? p.kind : "PERCENT";
      if (kind === "FREE_PRODUCT") {
        if (!p.variantId) { warnings.push(`${GAME_NAMES[id]}: a free-product prize has no product chosen, so it will not be given out.`); }
        prizes.push({
          shop, gameId: id, kind, value: null, productId: p.productId || null, variantId: p.variantId || null,
          productTitle: p.productTitle || null, productHandle: p.productHandle || null, imageUrl: p.imageUrl || null,
          share: int(p.share, 1, 1000, 1), dailyLimit: p.dailyLimit === "" || p.dailyLimit == null ? null : int(p.dailyLimit, 0, 100000, 0), active: true,
        });
      } else {
        const value = int(p.value, 1, kind === "PERCENT" ? 100 : 100000, 0);
        if (!value) { warnings.push(`${GAME_NAMES[id]}: a coupon prize has no value, so it was skipped.`); continue; }
        prizes.push({
          shop, gameId: id, kind, value, productId: null, variantId: null, productTitle: null, imageUrl: null,
          share: int(p.share, 1, 1000, 1), dailyLimit: p.dailyLimit === "" || p.dailyLimit == null ? null : int(p.dailyLimit, 0, 100000, 0), active: true,
        });
      }
    }
    if (!prizes.some((p) => p.kind !== "FREE_PRODUCT" || p.variantId)) warnings.push(`${GAME_NAMES[id]}: no prize can be given out, so nobody can win it.`);
    ops.push(prisma.gameConfig.upsert({ where: { shop_gameId: { shop, gameId: id } }, update: cfg, create: { shop, gameId: id, ...cfg } }));
    ops.push(prisma.prizeConfig.deleteMany({ where: { shop, gameId: id } }));
    if (prizes.length) ops.push(prisma.prizeConfig.createMany({ data: prizes }));
  }
  await prisma.$transaction(ops);
  return json({ ok: true, warnings });
};

let keySeq = 0;
const withKeys = (games) => {
  const out = {};
  for (const id of Object.keys(games)) out[id] = { ...games[id], prizes: games[id].prizes.map((p) => ({ ...p, _k: ++keySeq })) };
  return out;
};

export default function GamesAndPrizes() {
  const data = useLoaderData();
  const result = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const shopify = useAppBridge();
  const saving = nav.state === "submitting";

  const [games, setGames] = useState(() => withKeys(data.games));
  const [couponDays, setCouponDays] = useState(String(data.couponDays));
  const [requireOrder, setRequireOrder] = useState(data.requireOrder);
  const [freeLimit, setFreeLimit] = useState(String(data.freeGiftDailyLimit));
  const [spreadFree, setSpreadFree] = useState(data.spreadFreeGifts);
  const [giftFallback, setGiftFallback] = useState(data.giftFallback);
  const [omniMode, setOmniMode] = useState(data.omnisendMode);
  const [omniKey, setOmniKey] = useState("");
  const [omniRemove, setOmniRemove] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const sendTest = () => {
    const fd = new FormData();
    fd.append("omnisendTest", testEmail);
    fd.append("omnisendTestPhone", testPhone);
    submit(fd, { method: "post" });
  };

  const setGame = useCallback((id, patch) => setGames((g) => ({ ...g, [id]: { ...g[id], ...patch } })), []);
  const setPrize = useCallback((id, k, patch) => setGames((g) => ({
    ...g, [id]: { ...g[id], prizes: g[id].prizes.map((p) => (p._k === k ? { ...p, ...patch } : p)) },
  })), []);
  const addPrize = (id) => setGames((g) => ({
    ...g, [id]: { ...g[id], prizes: [...g[id].prizes, { _k: ++keySeq, kind: "PERCENT", value: 5, productId: "", variantId: "", productTitle: "", productHandle: "", imageUrl: "", share: 1, dailyLimit: "" }] },
  }));
  const removePrize = (id, k) => setGames((g) => ({ ...g, [id]: { ...g[id], prizes: g[id].prizes.filter((p) => p._k !== k) } }));

  const pickProduct = async (id, k) => {
    const selected = await shopify.resourcePicker({ type: "product", multiple: false, action: "select" });
    if (!selected || !selected.length) return;
    const prod = selected[0];
    const variant = (prod.variants || [])[0];
    setPrize(id, k, {
      productId: prod.id, productHandle: prod.handle || "", variantId: variant ? variant.id : "", productTitle: prod.title + (variant && variant.title && variant.title !== "Default Title" ? ` (${variant.title})` : ""),
      imageUrl: prod.images?.[0]?.originalSrc || prod.images?.[0]?.src || "",
    });
  };

  // 5% / 10% and Rs50 / Rs100 coupons, 90:10 inside each pair; free-product prizes are left as they are.
  const applyMix = () => setGames((g) => {
    const out = {};
    for (const id of Object.keys(g)) {
      const keep = g[id].prizes.filter((p) => p.kind === "FREE_PRODUCT");
      const blank = { productId: "", variantId: "", productTitle: "", productHandle: "", imageUrl: "", dailyLimit: "" };
      const mix = [["PERCENT", 5, 45], ["PERCENT", 10, 5], ["AMOUNT", 50, 45], ["AMOUNT", 100, 5]].map(([kind, value, share]) => ({ _k: ++keySeq, kind, value, share, ...blank }));
      out[id] = { ...g[id], prizes: [...mix, ...keep] };
    }
    return out;
  });

  const save = () => {
    const payload = { couponDays, requireOrder, freeGiftDailyLimit: freeLimit, spreadFreeGifts: spreadFree, giftFallback, omnisendMode: omniMode, omnisendKey: omniKey, omnisendRemoveKey: omniRemove, games: {} };
    for (const id of Object.keys(games)) payload.games[id] = { ...games[id], prizes: games[id].prizes.map(({ _k, ...p }) => p) };
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    submit(fd, { method: "post" });
  };

  return (
    <Page
      title="Games & prizes"
      subtitle="Choose what each game gives away and how often people win."
      primaryAction={{ content: "Save all changes", onAction: save, loading: saving }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {result?.omnisendTest ? (
              result.omnisendTest.ok
                ? <Banner tone="success" title={`Test event sent for ${result.omnisendTest.email}.`}>Open Omnisend > Store settings > API > API logs to see it, and check your automation ran.</Banner>
                : <Banner tone="critical" title="The test event was not sent.">{result.omnisendTest.error}</Banner>
            ) : result?.ok ? (
              <Banner tone="success" title="Saved. Changes apply to the next play.">
                {result.warnings?.length ? <ul>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
              </Banner>
            ) : result && !result.ok ? <Banner tone="critical" title={result.error || "Could not save."} /> : null}

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Rules for every game</Text>
                <Checkbox
                  label="A play needs an order (one play per order)"
                  helpText="On: customers play from their thank-you / order page and each order gives exactly one play. Off: anyone can play (not recommended)."
                  checked={requireOrder} onChange={setRequireOrder}
                />
                <InlineStack gap="400" wrap>
                  <div style={{ width: 260 }}>
                    <TextField label="Coupon valid for (days)" type="number" min={1} value={couponDays} onChange={setCouponDays} autoComplete="off" />
                  </div>
                  <div style={{ width: 300 }}>
                    <TextField label="Free gifts per day (all games together)" type="number" min={0} value={freeLimit} onChange={setFreeLimit} autoComplete="off"
                      helpText="Once this many free products are given today, games only give coupons until tomorrow." />
                  </div>
                </InlineStack>
                <div style={{ maxWidth: 560 }}>
                  <Select
                    label="If a free product cannot be added to the customer's order"
                    helpText="Shopify does not allow editing orders created by some outside checkouts (for example Shiprocket). Then: tag the order 'carnival-free-gift' and add a 'please pack this gift' note, or give the customer a personal 100%-off code for the product."
                    options={[{ label: "Pack it with the order (tag + note on the order)", value: "pack" }, { label: "Give a personal 100%-off code", value: "code" }]}
                    value={giftFallback} onChange={setGiftFallback}
                  />
                </div>
                <div style={{ maxWidth: 560 }}>
                  <TextField
                    label="Omnisend API key"
                    type="password" autoComplete="off" value={omniKey} onChange={(v) => { setOmniKey(v); setOmniRemove(false); }}
                    placeholder={data.omnisendKey ? "Saved (" + data.omnisendKeyHint + ") - type a new key only to replace it" : "Paste your Omnisend API key"}
                    helpText="Create it in Omnisend: Store settings > API > Create API key. It is saved encrypted and never shown again."
                  />
                  {data.omnisendKey ? <Checkbox label="Remove the saved key" checked={omniRemove} onChange={(v) => { setOmniRemove(v); if (v) setOmniKey(""); }} /> : null}
                </div>
                <div style={{ maxWidth: 560 }}>
                  <Select
                    label="Send wins to Omnisend (WhatsApp / email)"
                    helpText={data.omnisendKey ? "Sends a 'carnival_win' event with the coupon code, so your Omnisend automation can message the customer. 'Button' = the customer taps 'Send my code on WhatsApp' (their consent)." : "Not connected yet: paste your Omnisend API key above and Save."}
                    options={[{ label: "Automatically for every win", value: "auto" }, { label: "Only when the customer taps a button", value: "button" }, { label: "Off", value: "off" }]}
                    value={omniMode} onChange={setOmniMode}
                  />
                </div>
                {data.omnisendKey ? (
                  <div style={{ maxWidth: 560 }}>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">Test Omnisend</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Sends a sample win (code CHM-TEST01) to the address below, so you can check your automation, email and WhatsApp without placing an order.</Text>
                      <TextField label="Send the test to this email" type="email" value={testEmail} onChange={setTestEmail} autoComplete="off" />
                      <TextField label="Mobile number for WhatsApp (optional, with country code)" type="tel" value={testPhone} onChange={setTestPhone} autoComplete="off" placeholder="+919876543210" />
                      <InlineStack><Button onClick={sendTest} loading={saving} disabled={!testEmail}>Send test event</Button></InlineStack>
                    </BlockStack>
                  </div>
                ) : null}
                <Checkbox
                  label="Spread the free gifts through the day"
                  helpText="On: the day's free gifts are released gradually (for 6 gifts, one every 4 hours), so they do not all go in the first hour. Customers are never told how many there are."
                  checked={spreadFree} onChange={setSpreadFree}
                />
                <BlockStack gap="100">
                  <Button onClick={applyMix}>Apply the standard coupon mix to all games</Button>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Sets every game's coupons to: 5% OFF (90%) / 10% OFF (10%) and ₹50 OFF (90%) / ₹100 OFF (10%), with percent and rupee coupons equally likely. Your free-product prizes are kept. Press "Save all changes" afterwards.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>

            {Object.keys(games).map((key) => {
              const id = Number(key);
              const g = games[key];
              const skill = SKILL_GAMES.includes(id);
              const total = g.prizes.reduce((a, p) => a + Math.max(1, parseInt(p.share, 10) || 1), 0);
              return (
                <Card key={key}>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">{DAYS[id]} · {GAME_NAMES[id]}</Text>
                        <Badge tone={skill ? "info" : "attention"}>{skill ? "Skill game" : "Luck game"}</Badge>
                        {!g.saved ? <Badge>Defaults, not saved yet</Badge> : null}
                      </InlineStack>
                      <Checkbox label="Game on" checked={g.enabled} onChange={(v) => setGame(id, { enabled: v })} />
                    </InlineStack>

                    <InlineStack gap="400" wrap>
                      <div style={{ width: 240 }}>
                        <TextField
                          label={skill ? "Chance a successful player wins" : "Chance a play wins a prize"}
                          type="number" min={0} max={100} suffix="%" value={String(g.winChance)}
                          onChange={(v) => setGame(id, { winChance: v })} autoComplete="off"
                          helpText={skill ? "The player must complete the game first. 100% = every successful player wins." : "Decided by the server for each play."}
                        />
                      </div>
                      <div style={{ width: 240 }}>
                        <TextField
                          label="Max prizes per day" type="number" min={0} value={String(g.dailyLimit)}
                          onChange={(v) => setGame(id, { dailyLimit: v })} autoComplete="off"
                          helpText="Once reached, nobody else wins that day."
                        />
                      </div>
                    </InlineStack>

                    <Divider />
                    <Text as="h3" variant="headingSm">Prizes (when someone wins, one of these is given)</Text>

                    {g.prizes.map((p) => {
                      const share = Math.max(1, parseInt(p.share, 10) || 1);
                      const overall = ((share / total) * (parseInt(g.winChance, 10) || 0)).toFixed(1);
                      return (
                        <Card key={p._k} background="bg-surface-secondary">
                          <BlockStack gap="300">
                            <InlineStack gap="300" blockAlign="end" wrap>
                              <div style={{ width: 170 }}>
                                <Select label="Prize type" options={KINDS} value={p.kind} onChange={(v) => setPrize(id, p._k, { kind: v })} />
                              </div>
                              {p.kind !== "FREE_PRODUCT" ? (
                                <div style={{ width: 130 }}>
                                  <TextField label={p.kind === "PERCENT" ? "Percent off" : "Rupees off"} type="number" min={1} value={String(p.value)}
                                    prefix={p.kind === "AMOUNT" ? "₹" : undefined} suffix={p.kind === "PERCENT" ? "%" : undefined}
                                    onChange={(v) => setPrize(id, p._k, { value: v })} autoComplete="off" />
                                </div>
                              ) : (
                                <InlineStack gap="200" blockAlign="center">
                                  {p.imageUrl ? <Thumbnail source={p.imageUrl} alt="" size="small" /> : null}
                                  <BlockStack gap="050">
                                    <Text as="span" variant="bodyMd">{p.productTitle || "No product chosen"}</Text>
                                    <Button size="slim" onClick={() => pickProduct(id, p._k)}>{p.productTitle ? "Change product" : "Choose product"}</Button>
                                  </BlockStack>
                                </InlineStack>
                              )}
                              <div style={{ width: 110 }}>
                                <TextField label="Weight" type="number" min={1} value={String(p.share)} onChange={(v) => setPrize(id, p._k, { share: v })} autoComplete="off" />
                              </div>
                              <div style={{ width: 130 }}>
                                <TextField label="Max per day" type="number" min={0} value={String(p.dailyLimit)} placeholder="no limit" onChange={(v) => setPrize(id, p._k, { dailyLimit: v })} autoComplete="off" />
                              </div>
                              <Button tone="critical" variant="plain" onClick={() => removePrize(id, p._k)}>Remove</Button>
                            </InlineStack>
                            <Text as="p" variant="bodySm" tone="subdued">
                              About {overall}% of {skill ? "successful players" : "plays"} get this prize
                              {p.kind === "FREE_PRODUCT" && !p.variantId ? " — choose a product or it will not be given out" : ""}.
                            </Text>
                          </BlockStack>
                        </Card>
                      );
                    })}
                    <div><Button onClick={() => addPrize(id)}>+ Add a prize</Button></div>
                  </BlockStack>
                </Card>
              );
            })}
            <InlineStack align="end"><Button variant="primary" onClick={save} loading={saving}>Save all changes</Button></InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
