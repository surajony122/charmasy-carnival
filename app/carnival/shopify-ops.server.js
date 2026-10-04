// Everything the Carnival does inside Shopify: look up orders, customers, discount codes, free products.
// All functions take the `admin` GraphQL client and never throw — they return null / {ok:false,...}.

async function gql(admin, query, variables) {
  const res = await admin.graphql(query, { variables });
  return res.json();
}

export function maskEmail(email) {
  const [u, d] = String(email || "").split("@");
  if (!d) return "";
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
}

// Indian mobile numbers: 10 digits starting 6-9, optionally with 91 / +91. Returns E.164 or null.
export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return "+91" + digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return "+" + digits;
  return null;
}

// orderRef is what the thank-you button sends: the numeric order id (or, as a fallback, the order number).
export async function resolveOrder(admin, orderRef) {
  if (!admin || !orderRef) return null;
  const fields = "id name email createdAt cancelledAt displayFulfillmentStatus customer { id email }";
  try {
    if (/^\d{5,}$/.test(orderRef)) {
      const d = await gql(admin, `#graphql\nquery o($id: ID!) { order(id: $id) { ${fields} } }`, { id: `gid://shopify/Order/${orderRef}` });
      if (d?.data?.order) return shape(d.data.order);
    }
    if (/^\d{1,8}$/.test(orderRef)) {
      const d = await gql(admin, `#graphql\nquery o($q: String!) { orders(first: 1, query: $q) { nodes { ${fields} } } }`, { q: `name:#${orderRef}` });
      const n = d?.data?.orders?.nodes?.[0];
      if (n) return shape(n);
    }
  } catch (e) {
    console.error("resolveOrder failed:", e);
  }
  return null;
}
function shape(o) {
  return {
    gid: o.id, name: o.name, email: (o.email || o.customer?.email || "").toLowerCase(),
    customerGid: o.customer?.id || null, createdAt: o.createdAt, cancelled: !!o.cancelledAt,
    fulfillment: o.displayFulfillmentStatus,
  };
}

// Finds the customer by email or creates one (no marketing consent is set). Adds the phone when we have one.
export async function upsertCustomer(admin, email, phone) {
  if (!admin) return null;
  try {
    const found = await gql(admin, `#graphql\nquery c($q: String!) { customers(first: 1, query: $q) { nodes { id phone } } }`, { q: "email:" + JSON.stringify(email) });
    const node = found?.data?.customers?.nodes?.[0];
    let id = node?.id || null;
    if (!id) {
      const input = { email, tags: ["carnival-2026"] };
      if (phone) input.phone = phone;
      let created = await gql(admin, `#graphql\nmutation cc($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }`, { input });
      id = created?.data?.customerCreate?.customer?.id || null;
      if (!id && phone) {
        // the phone may already belong to another customer: create without it
        delete input.phone;
        created = await gql(admin, `#graphql\nmutation cc($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }`, { input });
        id = created?.data?.customerCreate?.customer?.id || null;
      }
      if (!id) console.error("Customer create failed:", JSON.stringify(created?.errors || created?.data?.customerCreate?.userErrors));
    } else {
      await gql(admin, `#graphql\nmutation t($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, { id, tags: ["carnival-2026"] });
      if (phone && !node.phone) {
        await gql(admin, `#graphql\nmutation u($input: CustomerInput!) { customerUpdate(input: $input) { userErrors { message } } }`, { input: { id, phone } });
      }
    }
    return id;
  } catch (e) {
    console.error("Customer upsert error:", e);
    return null;
  }
}

export async function saveWinToCustomer(admin, customerGid, info) {
  if (!admin || !customerGid) return;
  try {
    const res = await gql(admin,
      `#graphql\nmutation m($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }`,
      { m: [{ ownerId: customerGid, namespace: "carnival", key: "last_win", type: "json", value: JSON.stringify(info) }] });
    const errs = res?.data?.metafieldsSet?.userErrors || [];
    if (errs.length) console.error("Customer metafield failed:", JSON.stringify(errs));
  } catch (e) {
    console.error("Customer metafield error:", e);
  }
}

// Single-use discount code locked to one customer. `items`: "all" or a variant id (for the free-product fallback).
export async function createCustomerCode(admin, { code, kind, value, customerGid, days, variantId }) {
  if (!admin) return { ok: false, error: "no admin session" };
  try {
    const gets = {
      value: kind === "AMOUNT" ? { discountAmount: { amount: String(value), appliesOnEachItem: false } } : { percentage: (kind === "FREE_PRODUCT" ? 100 : value) / 100 },
      items: variantId ? { products: { productVariantsToAdd: [variantId] } } : { all: true },
    };
    const d = await gql(admin,
      `#graphql\nmutation d($input: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $input) { codeDiscountNode { id } userErrors { field message } } }`,
      {
        input: {
          title: "Carnival " + code,
          code,
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
          usageLimit: 1,
          appliesOncePerCustomer: true,
          customerSelection: customerGid ? { customers: { add: [customerGid] } } : { all: true },
          combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false },
          customerGets: gets,
        },
      });
    const r = d?.data?.discountCodeBasicCreate;
    if (r?.codeDiscountNode) return { ok: true };
    console.error("Discount create failed:", JSON.stringify(d?.errors || r?.userErrors));
    return { ok: false, error: (r?.userErrors?.[0]?.message) || "discount failed" };
  } catch (e) {
    console.error("Discount create error:", e);
    return { ok: false, error: String(e.message || e) };
  }
}

// Adds the won product to the order the customer already placed, at 100% off. Needs write_order_edits.
export async function addFreeProductToOrder(admin, orderGid, variantId) {
  if (!admin) return { ok: false, error: "no admin session" };
  try {
    const begin = await gql(admin, `#graphql\nmutation b($id: ID!) { orderEditBegin(id: $id) { calculatedOrder { id } userErrors { message } } }`, { id: orderGid });
    const calc = begin?.data?.orderEditBegin?.calculatedOrder?.id;
    if (!calc) return { ok: false, error: begin?.data?.orderEditBegin?.userErrors?.[0]?.message || JSON.stringify(begin?.errors || "begin failed") };

    const add = await gql(admin,
      `#graphql\nmutation a($id: ID!, $v: ID!) { orderEditAddVariant(id: $id, variantId: $v, quantity: 1, allowDuplicates: true) { calculatedLineItem { id } userErrors { message } } }`,
      { id: calc, v: variantId });
    const line = add?.data?.orderEditAddVariant?.calculatedLineItem?.id;
    if (!line) return { ok: false, error: add?.data?.orderEditAddVariant?.userErrors?.[0]?.message || "add failed" };

    const disc = await gql(admin,
      `#graphql\nmutation d($id: ID!, $l: ID!) { orderEditAddLineItemDiscount(id: $id, lineItemId: $l, discount: { percentValue: 100, description: "Charmacy Carnival free gift" }) { userErrors { message } } }`,
      { id: calc, l: line });
    const derr = disc?.data?.orderEditAddLineItemDiscount?.userErrors || [];
    if (derr.length) return { ok: false, error: derr[0].message };

    const commit = await gql(admin,
      `#graphql\nmutation c($id: ID!) { orderEditCommit(id: $id, notifyCustomer: false, staffNote: "Charmacy Carnival free gift") { order { id } userErrors { message } } }`,
      { id: calc });
    if (commit?.data?.orderEditCommit?.order?.id) return { ok: true };
    return { ok: false, error: commit?.data?.orderEditCommit?.userErrors?.[0]?.message || "commit failed" };
  } catch (e) {
    console.error("addFreeProductToOrder error:", e);
    return { ok: false, error: String(e.message || e) };
  }
}
