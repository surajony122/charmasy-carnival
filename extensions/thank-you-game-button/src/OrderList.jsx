import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<OrderList />, document.body);
};

const BANNER = "https://charmasy-carnival.onrender.com/carnival/img/ty-banner.jpg";
const WEEK = 7 * 24 * 3600 * 1000;

const unwrap = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x && typeof x === 'object' && 'current' in x ? x.current : x);
const lastPart = (gid) => (typeof gid === 'string' && gid ? gid.split('/').pop() : '');

function OrderList() {
  // null = still loading, [] = nothing to play for, undefined = we could not read the orders
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await shopify.query(
          `query { customer { orders(first: 5, sortKey: PROCESSED_AT, reverse: true) { nodes { id name processedAt } } } }`
        );
        const nodes = res?.data?.customer?.orders?.nodes;
        if (!Array.isArray(nodes)) throw new Error('no orders');
        setOrders(nodes.filter((n) => Date.now() - new Date(n.processedAt).getTime() < WEEK));
      } catch (e) {
        setOrders(undefined);
      }
    })();
  }, []);

  if (orders === null) return null;

  const customerId = lastPart(unwrap(shopify.authenticatedAccount?.customer)?.id || '');
  const customerQuery = customerId ? `&customer_id=${customerId}` : '';
  const baseUrl = String(unwrap(shopify.shop?.storefrontUrl) || '').replace(/\/$/, '');
  const urlFor = (id) => `${baseUrl}/apps/carnival-games?order_id=${lastPart(id)}${customerQuery}`;

  return (
    <s-box border="base" borderRadius="large" overflow="hidden" background="subdued">
      <s-stack gap="none">
        <s-image src={BANNER} alt="Charmacy Carnival 2026 - play and win" aspectRatio="1200/440" objectFit="cover" />
        <s-box padding="base">
          <s-stack gap="small-300">
            <s-heading>🎪 Charmacy Carnival is LIVE!</s-heading>
            {orders && orders.length > 0 ? (
              <>
                <s-text>Each order gives you one play. Pick an order and play for a coupon or a free gift! 🎁</s-text>
                {orders.map((o) => (
                  <s-stack key={o.id} direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-text>Order {o.name}</s-text>
                    <s-button href={urlFor(o.id)} target="_blank" variant="primary">🎡 Play & Win</s-button>
                  </s-stack>
                ))}
              </>
            ) : orders === undefined ? (
              <s-text>Open any of your recent orders below and tap "Play & Win" to play for a coupon or a free gift! 🎁</s-text>
            ) : (
              <s-text>Place an order to unlock a play — every order gives you one chance to win a coupon or a free gift! 🎁</s-text>
            )}
          </s-stack>
        </s-box>
      </s-stack>
    </s-box>
  );
}
