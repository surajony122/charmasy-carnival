import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Page, Card, BlockStack, InlineStack, Text, Badge, Banner, Button, DataTable, Select, TextField, Link, Box } from "@shopify/polaris";
import { randomBytes } from "node:crypto";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { encryptKey, decryptKey } from "../carnival/omnisend.server";
import { pollStatuses } from "../carnival/bik-poll.server";

const handleOf = (shop) => String(shop).replace(/\.myshopify\.com$/, "");
const appUrl = () => (process.env.SHOPIFY_APP_URL || "https://charmasy-carnival.onrender.com").replace(/\/$/, "");

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  if (fd.get("intent") === "makeKey") {
    const key = randomBytes(18).toString("base64url");
    await prisma.gameSettings.upsert({ where: { shop: session.shop }, update: { bikWebhookKeyEnc: encryptKey(key) }, create: { shop: session.shop, bikWebhookKeyEnc: encryptKey(key) } });
    return json({ newKey: key });
  }
  if (fd.get("intent") === "refresh") {
    const r = await pollStatuses({ shop: session.shop });
    return json({ refreshed: r });
  }
  return json({ ok: true });
};

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const [logs, settings] = await Promise.all([
    prisma.whatsAppLog.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.gameSettings.findUnique({ where: { shop } }),
  ]);
  const orderIds = [...new Set(logs.map((l) => l.orderId).filter(Boolean))];
  const rows = orderIds.length ? await prisma.gamePlay.findMany({ where: { shop, orderId: { in: orderIds } }, select: { orderId: true, email: true, orderName: true, prizeLabel: true } }) : [];
  const byOrder = Object.fromEntries(rows.map((r) => [r.orderId, r]));
  const base = `https://admin.shopify.com/store/${handleOf(shop)}`;
  const items = logs.map((l) => {
    const p = byOrder[l.orderId] || {};
    const ref = String(l.orderId || "").split("~")[0];
    const t = (d) => (d ? new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(5, 16).replace("T", " ") : "");
    return {
      id: l.id, kind: l.kind, status: l.status, phone: l.phone || "", email: p.email || "", prize: p.prizeLabel || "", orderName: p.orderName || "",
      orderUrl: /^\d{5,}$/.test(ref) ? `${base}/orders/${ref}` : "", error: l.error || "", template: l.templateId || "",
      created: t(l.createdAt), sent: t(l.sentAt), delivered: t(l.deliveredAt), read: t(l.readAt), failed: t(l.failedAt), clicked: t(l.clickedAt), optedOut: t(l.optedOutAt),
      day: new Date(l.createdAt.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10),
    };
  });
  // Day-by-day funnel (India time): orders -> plays -> wins -> claimed -> phone -> handed to Bik -> delivered / failed
  const ist = (d) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(ist(new Date(Date.now() - i * 86400000)));
  const sinceDate = new Date(Date.parse(days[days.length - 1] + "T00:00:00Z") - 5.5 * 3600 * 1000);
  const [plays, logs7] = await Promise.all([
    prisma.gamePlay.findMany({ where: { shop, playedAt: { gte: sinceDate }, NOT: { orderId: { contains: "~t" } } }, select: { playedAt: true, outcomeWin: true, claimedAt: true, phone: true, waStatus: true, prizeKind: true, delivery: true } }),
    prisma.whatsAppLog.findMany({ where: { shop, createdAt: { gte: sinceDate }, NOT: { kind: { in: ["test", "email"] } } }, select: { createdAt: true, status: true } }),
  ]);
  const orderCount = async (day) => {
    try {
      const from = new Date(Date.parse(day + "T00:00:00Z") - 5.5 * 3600 * 1000).toISOString(), to = new Date(Date.parse(day + "T00:00:00Z") - 5.5 * 3600 * 1000 + 86400000).toISOString();
      const r = await admin.graphql(`#graphql\nquery c($q: String!) { ordersCount(query: $q) { count } }`, { variables: { q: `created_at:>=${from} created_at:<${to}` } });
      const j = await r.json();
      return j?.data?.ordersCount?.count ?? null;
    } catch (e) { return null; }
  };
  const orders = await Promise.all(days.map(orderCount));
  const funnel = days.map((day, i) => {
    const p = plays.filter((x) => ist(x.playedAt) === day), l = logs7.filter((x) => ist(x.createdAt) === day);
    const claimed = p.filter((x) => x.claimedAt);
    return {
      day, orders: orders[i], plays: p.length, wins: p.filter((x) => x.outcomeWin).length, claimed: claimed.length,
      noPhone: claimed.filter((x) => !x.phone).length, handed: l.length,
      delivered: l.filter((x) => x.status === "delivered" || x.status === "read").length, failed: l.filter((x) => x.status === "failed").length,
      waiting: l.filter((x) => x.status === "accepted" || x.status === "sent").length,
      noMessage: claimed.filter((x) => x.phone && !x.waStatus).length,
    };
  });
  // Why messages failed: the same reason text counted (numbers and codes folded together so similar reasons group)
  const reasonMap = new Map();
  for (const l of logs) {
    if (l.status !== "failed" || l.kind === "test") continue;
    const key = String(l.error || "No reason given").replace(/\+?\d[\d\s-]{6,}/g, "<number>").replace(/wamid\.\S+/g, "<id>").slice(0, 160);
    reasonMap.set(key, (reasonMap.get(key) || 0) + 1);
  }
  const reasons = [...reasonMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, n]) => ({ reason, n }));
  const count = (st) => items.filter((i) => i.status === st).length;
  return json({
    items, counts: { total: items.length, accepted: count("accepted"), sent: count("sent"), delivered: count("delivered"), read: count("read"), failed: count("failed") },
    funnel, reasons, hookUrl: `${appUrl()}/webhooks/bik?shop=${shop}`,
    hasKey: !!(settings && settings.bikWebhookKeyEnc && decryptKey(settings.bikWebhookKeyEnc)),
    hook: settings && settings.bikHookLastAt ? { at: new Date(settings.bikHookLastAt.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " "), result: settings.bikHookLastResult || "" } : null,
  });
};

const TONE = { accepted: "info", sent: "info", delivered: "success", read: "success", failed: "critical" };
const LABEL = { accepted: "Handed to Bik", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" };
const KIND = { win: "Win", reminder: "Reminder", gift: "Free gift", test: "Test", email: "Email" };

export default function WhatsAppLogs() {
  const { items, counts, hookUrl, hasKey, hook, funnel, reasons } = useLoaderData();
  const result = useActionData();
  const submit = useSubmit();
  const busy = useNavigation().state === "submitting";
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const shown = items.filter((i) => (status === "all" || i.status === status) && (kind === "all" || i.kind === kind));
  const refresh = () => { const fd = new FormData(); fd.append("intent", "refresh"); submit(fd, { method: "post" }); };
  const makeKey = () => { const fd = new FormData(); fd.append("intent", "makeKey"); submit(fd, { method: "post" }); };

  return (
    <Page title="WhatsApp messages" subtitle="Every message handed to Bik, with its delivery tracking (India time)."
      primaryAction={{ content: "Refresh status from Bik", onAction: refresh, loading: busy }}>
      <BlockStack gap="400">
        {result?.refreshed ? (
          <Banner tone={result.refreshed.error ? "critical" : "success"} title={result.refreshed.error ? "Bik could not be asked" : `Checked ${result.refreshed.checked} message(s) with Bik, ${result.refreshed.changed} updated.`}>
            {result.refreshed.error ? <Text as="p">{result.refreshed.error}</Text> : (
              <BlockStack gap="100">
                <Text as="p">Bik did not know {result.refreshed.notFound} of them yet. What Bik answered for the rest: {Object.keys(result.refreshed.byStatus || {}).length ? Object.entries(result.refreshed.byStatus).map(([k, v]) => `${k} ${v}`).join(", ") : "nothing"}.</Text>
                <Text as="p" tone="subdued">Statuses also refresh by themselves every 2 minutes.</Text>
              </BlockStack>
            )}
          </Banner>
        ) : null}
        <Card>
          <InlineStack gap="400" wrap>
            {[["Total", counts.total, "info"], ["Delivered", counts.delivered, "success"], ["Read", counts.read, "success"], ["Failed", counts.failed, "critical"]].map(([l, n, tone]) => (
              <Box key={l} minWidth="110px"><Text as="p" variant="bodySm" tone="subdued">{l}</Text><Text as="p" variant="headingLg">{n}</Text></Box>
            ))}
          </InlineStack>
        </Card>

        {!hasKey || result?.newKey ? (
          <Banner tone={result?.newKey ? "success" : "warning"} title={result?.newKey ? "Webhook key created - copy it now" : "Delivery tracking is not connected yet"}>
            <BlockStack gap="200">
              <Text as="p">Without this, messages stay at "Handed to Bik" and you never see Delivered, Read or Failed. In Bik go to <b>dashboard.bik.ai → Settings → Developer tools → Webhooks</b> and enter:</Text>
              <Text as="p"><b>Webhook URL:</b> {hookUrl}</Text>
              <Text as="p"><b>Authorization key:</b> {result?.newKey ? <code>{result.newKey}</code> : "click the button to create one"}</Text>
              {result?.newKey ? <Text as="p" tone="subdued">It is shown only now. If you lose it, create a new one and update Bik.</Text> : null}
              <InlineStack><Button onClick={makeKey} loading={busy}>{hasKey ? "Create a new key" : "Create webhook key"}</Button></InlineStack>
            </BlockStack>
          </Banner>
        ) : (
          <Banner tone="info" title="Delivery tracking is set up">
            <Text as="p">Last call from Bik: {hook ? `${hook.at} (${hook.result})` : "never"}. Webhook URL for Bik: {hookUrl}. Lost the key? <Link onClick={makeKey}>Create a new one</Link> (then update it in Bik).</Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Where customers drop out, day by day</Text>
            <Text as="p" variant="bodySm" tone="subdued">Orders in Shopify → opened the game and played → won → claimed the prize → had a phone number → message handed to Bik → delivered. "Claimed, no message" means a winner with a phone for whom no message was tried.</Text>
            <DataTable
              columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric"]}
              headings={["Day", "Orders", "Played", "Won", "Claimed", "No phone", "Claimed, no message", "Handed to Bik", "Delivered / read", "Waiting for Bik", "Failed"]}
              rows={funnel.map((f) => [f.day, f.orders ?? "?", f.plays, f.wins, f.claimed, f.noPhone, f.noMessage, f.handed, f.delivered, f.waiting, f.failed])}
            />
          </BlockStack>
        </Card>

        {reasons.length ? (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Why messages failed</Text>
              <DataTable columnContentTypes={["numeric", "text"]} headings={["Messages", "Reason (as Bik or WhatsApp reported it)"]} rows={reasons.map((r) => [r.n, r.reason])} />
            </BlockStack>
          </Card>
        ) : null}

        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" wrap>
              <div style={{ width: 200 }}><Select label="Status" value={status} onChange={setStatus} options={[{ label: "All", value: "all" }, ...Object.keys(LABEL).map((k) => ({ label: LABEL[k], value: k }))]} /></div>
              <div style={{ width: 200 }}><Select label="Message" value={kind} onChange={setKind} options={[{ label: "All", value: "all" }, ...Object.keys(KIND).map((k) => ({ label: KIND[k], value: k }))]} /></div>
            </InlineStack>
            {!shown.length ? <Text as="p" tone="subdued">No messages yet.</Text> : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Handed over", "To", "Message", "Order", "Status", "Tracking"]}
                rows={shown.map((i) => [
                  i.created,
                  <span key="t">{i.phone}{i.email ? <><br /><Text as="span" tone="subdued" variant="bodySm">{i.email}</Text></> : null}</span>,
                  <span key="m">{KIND[i.kind] || i.kind}{i.prize ? <><br /><Text as="span" tone="subdued" variant="bodySm">{i.prize}</Text></> : null}</span>,
                  i.orderUrl ? <Link key="o" url={i.orderUrl} target="_blank" removeUnderline>{i.orderName || "Open order"}</Link> : (i.orderName || "-"),
                  <span key="s"><Badge tone={TONE[i.status]}>{LABEL[i.status] || i.status}</Badge>{i.error ? <><br /><Text as="span" tone="critical" variant="bodySm">{i.error}</Text></> : null}</span>,
                  <Text key="k" as="span" variant="bodySm">
                    {[i.sent && `Sent ${i.sent}`, i.delivered && `Delivered ${i.delivered}`, i.read && `Read ${i.read}`, i.clicked && `Link clicked ${i.clicked}`, i.failed && `Failed ${i.failed}`, i.optedOut && `Opted out ${i.optedOut}`].filter(Boolean).join(" → ") || "-"}
                  </Text>,
                ])}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
