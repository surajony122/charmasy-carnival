import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, BlockStack, InlineStack, Text, Badge, Button, Banner, Link, DataTable } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getSettings } from "../carnival/rules.server";

// India-time day of a moment, as "2026-10-21"
const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const handleOf = (shop) => String(shop).replace(/\.myshopify\.com$/, "");

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await getSettings(shop);
  const rows = await prisma.gamePlay.findMany({
    where: { shop, prizeKind: "FREE_PRODUCT", outcomeWin: true, claimedAt: { not: null } },
    orderBy: { claimedAt: "desc" },
    take: 1000,
  });
  const base = `https://admin.shopify.com/store/${handleOf(shop)}`;
  const wins = rows.map((p) => {
    const ref = String(p.orderId || "").split("~")[0];
    return {
      id: p.id,
      when: p.claimedAt.toISOString(),
      day: istDay(p.claimedAt),
      time: new Date(p.claimedAt.getTime() + 5.5 * 3600 * 1000).toISOString().slice(11, 16),
      game: p.gameId,
      email: p.email || "",
      phone: p.phone || "",
      prize: String(p.prizeLabel || "").replace(/^FREE\s+/i, ""),
      orderName: p.orderName || "",
      orderUrl: /^\d{5,}$/.test(ref) ? `${base}/orders/${ref}` : "",
      statusUrl: p.orderStatusUrl || "",
      giftUrl: p.giftToken ? `https://${shop}/apps/carnival-games?gift=${p.giftToken}` : "",
      delivery: p.delivery || "",
      code: p.couponCode || "",
      error: p.deliveryError || "",
      wa: p.waStatus || "",
      test: String(p.orderId || "").includes("~t"),
    };
  });
  return json({ wins, limit: settings.freeGiftDailyLimit ?? 6 });
};

const HOW = { order_edit: ["Added to the order", "success"], pack: ["Pack with the order", "attention"], product_code: ["Personal code", "info"] };

function csvOf(wins) {
  const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const head = ["Day", "Time (IST)", "Game", "Email", "Phone", "Product", "Order", "How", "Code", "Shopify order link", "Gift page link", "WhatsApp"];
  const lines = wins.map((w) => [w.day, w.time, w.game, w.email, w.phone, w.prize, w.orderName, (HOW[w.delivery] || [w.delivery])[0], w.code, w.orderUrl, w.giftUrl, w.wa].map(q).join(","));
  return [head.map(q).join(","), ...lines].join("\n");
}

export default function FreeGifts() {
  const { wins, limit } = useLoaderData();
  const days = [];
  for (const w of wins) {
    let d = days[days.length - 1];
    if (!d || d.day !== w.day) { d = { day: w.day, list: [] }; days.push(d); }
    d.list.push(w);
  }
  const download = () => {
    const blob = new Blob([csvOf(wins)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "carnival-free-gift-winners.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const dayLabel = (day) => new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <Page title="Free gift winners" subtitle="Everyone who won a free product, day by day (India time). Click an order to open it in Shopify."
      primaryAction={wins.length ? { content: "Download CSV", onAction: download } : undefined}>
      <BlockStack gap="400">
        {!wins.length ? <Banner tone="info" title="No free-gift winners yet">Winners appear here as soon as they claim their gift.</Banner> : null}
        {days.map((d) => {
          const real = d.list.filter((w) => !w.test).length;
          return (
            <Card key={d.day}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">{dayLabel(d.day)}</Text>
                  <Badge tone={real >= limit ? "success" : "info"}>{`${real} of ${limit} free gifts`}</Badge>
                </InlineStack>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
                  headings={["Time", "Customer", "Product", "Order", "What happened", "WhatsApp", "Links"]}
                  rows={d.list.map((w) => [
                    <span key="t">{w.time}{w.test ? " (test)" : ""}</span>,
                    <span key="c">{w.email || "-"}<br />{w.phone || ""}</span>,
                    w.prize || "-",
                    w.orderUrl ? <Link key="o" url={w.orderUrl} target="_blank" removeUnderline>{w.orderName || "Open order"}</Link> : (w.orderName || "-"),
                    <span key="h">
                      {HOW[w.delivery] ? <Badge tone={HOW[w.delivery][1]}>{HOW[w.delivery][0]}</Badge> : <Badge>Not delivered</Badge>}
                      {w.code ? <><br />{w.code}</> : null}
                      {w.error ? <><br /><Text as="span" tone="critical" variant="bodySm">{w.error}</Text></> : null}
                    </span>,
                    w.wa === "sent" ? "Sent" : w.wa === "failed" ? "Failed" : w.wa === "skipped" ? "No phone" : "-",
                    <InlineStack key="l" gap="200">
                      {w.statusUrl ? <Link url={w.statusUrl} target="_blank">Order status</Link> : null}
                      {w.giftUrl ? <Link url={w.giftUrl} target="_blank">Gift page</Link> : null}
                    </InlineStack>,
                  ])}
                />
              </BlockStack>
            </Card>
          );
        })}
      </BlockStack>
    </Page>
  );
}
