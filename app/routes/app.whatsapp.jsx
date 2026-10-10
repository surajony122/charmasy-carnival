import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Page, Card, BlockStack, InlineStack, Text, Badge, Banner, Button, DataTable, Select, TextField, Link, Box } from "@shopify/polaris";
import { randomBytes } from "node:crypto";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { encryptKey, decryptKey } from "../carnival/omnisend.server";

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
  return json({ ok: true });
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
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
  const count = (st) => items.filter((i) => i.status === st).length;
  return json({
    items, counts: { total: items.length, accepted: count("accepted"), sent: count("sent"), delivered: count("delivered"), read: count("read"), failed: count("failed") },
    hookUrl: `${appUrl()}/webhooks/bik?shop=${shop}`,
    hasKey: !!(settings && settings.bikWebhookKeyEnc && decryptKey(settings.bikWebhookKeyEnc)),
  });
};

const TONE = { accepted: "info", sent: "info", delivered: "success", read: "success", failed: "critical" };
const LABEL = { accepted: "Handed to Bik", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" };
const KIND = { win: "Win", reminder: "Reminder", gift: "Free gift", test: "Test" };

export default function WhatsAppLogs() {
  const { items, counts, hookUrl, hasKey } = useLoaderData();
  const result = useActionData();
  const submit = useSubmit();
  const busy = useNavigation().state === "submitting";
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const shown = items.filter((i) => (status === "all" || i.status === status) && (kind === "all" || i.kind === kind));
  const makeKey = () => { const fd = new FormData(); fd.append("intent", "makeKey"); submit(fd, { method: "post" }); };

  return (
    <Page title="WhatsApp messages" subtitle="Every message handed to Bik, with its delivery tracking (India time).">
      <BlockStack gap="400">
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
            <Text as="p">Webhook URL for Bik: {hookUrl}. Lost the key? <Link onClick={makeKey}>Create a new one</Link> (then update it in Bik).</Text>
          </Banner>
        )}

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
