import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

// Signals expose their data on .value (or .current); older runtimes hand back the plain object.
const unwrap = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x && typeof x === 'object' && 'current' in x ? x.current : x);
const lastPart = (gid) => (typeof gid === 'string' && gid ? gid.split('/').pop() : '');

function Extension() {
  // Thank-you page: orderConfirmation. Customer-account order page: order.
  const confirmation = unwrap(shopify.orderConfirmation);
  const orderObj = unwrap(shopify.order);

  const orderId =
    lastPart(confirmation?.order?.id) ||
    lastPart(orderObj?.id) ||
    String(confirmation?.number || '').replace('#', '') ||
    String(orderObj?.name || '').replace('#', '');

  // No order to play for -> show nothing rather than a link that cannot work.
  if (!orderId) return null;

  const customerId = lastPart(
    unwrap(shopify.buyerIdentity?.customer)?.id ||
    unwrap(shopify.authenticatedAccount?.customer)?.id ||
    ''
  );
  const customerQuery = customerId ? `&customer_id=${customerId}` : '';

  const storefrontUrl = unwrap(shopify.shop?.storefrontUrl) || '';
  const baseUrl = String(storefrontUrl).replace(/\/$/, '');
  const gameUrl = `${baseUrl}/apps/carnival-games?order_id=${orderId}${customerQuery}`;

  return (
    <s-banner heading="Charmacy Carnival is LIVE!" tone="success">
      <s-stack gap="base">
        <s-text>
          Thank you for your order! This order gives you 1 play of today's Carnival game. Play now and you could win a coupon or a free gift.
        </s-text>
        <s-button href={gameUrl} target="_blank" variant="primary">
          Play & Win
        </s-button>
      </s-stack>
    </s-banner>
  );
}
