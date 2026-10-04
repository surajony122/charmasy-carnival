import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

const BANNER = "https://charmasy-carnival.onrender.com/carnival/img/ty-banner.jpg";

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
    <s-box border="base" borderRadius="large" overflow="hidden" background="subdued">
      <s-stack gap="none">
        <s-image src={BANNER} alt="Charmacy Carnival 2026 - play and win" aspectRatio="1200/440" objectFit="cover" />
        <s-box padding="base">
          <s-stack gap="small-300">
            <s-heading>🎪 Your order unlocked a Carnival play!</s-heading>
            <s-text>
              Play today's game and you could win a coupon or a free gift. One order = one play, so make it count! 🎁
            </s-text>
            <s-button href={gameUrl} target="_blank" variant="primary">
              🎡 Play & Win
            </s-button>
          </s-stack>
        </s-box>
      </s-stack>
    </s-box>
  );
}
