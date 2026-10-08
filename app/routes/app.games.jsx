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
  return json({ games, couponDays: settings.couponDays ?? 7, requireOrder: settings.requireOrder !== false, freeGiftDailyLimit: settings.freeGiftDailyLimit ?? 6, spreadFreeGifts: settings.spreadFreeGifts !== false });
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
  let data;
  try { data = JSON.parse(String(fd.get("payload") || "{}")); } catch { return json({ ok: false, error: "Could not read the form." }); }

  const warnings = [];
  const ops = [];
  ops.push(prisma.gameSettings.upsert({
    where: { shop },
    update: { couponDays: int(data.couponDays, 1, 90, 7), requireOrder: !!data.requireOrder, freeGiftDailyLimit: int(data.freeGiftDailyLimit, 0, 100000, 6), spreadFreeGifts: !!data.spreadFreeGifts },
    create: { shop, couponDays: int(data.couponDays, 1, 90, 7), requireOrder: !!data.requireOrder, freeGiftDailyLimit: int(data.freeGiftDailyLimit, 0, 100000, 6), spreadFreeGifts: !!data.spreadFreeGifts, testMode: true },
  }));

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
    const payload = { couponDays, requireOrder, freeGiftDailyLimit: freeLimit, spreadFreeGifts: spreadFree, games: {} };
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
            {result?.ok ? (
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
