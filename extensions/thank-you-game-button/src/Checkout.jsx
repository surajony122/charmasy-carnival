import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

const BANNER = "https://charmasy-carnival.onrender.com/carnival/img/ty-banner.jpg";

// Signals expose their data on .value (or .current); older runtimes hand back the plain object.
const unwrap = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x && typeof x === 'object' && 'current' in x ? x.current : x);
const lastPart = (gid) => (typeof gid === 'string' && gid ? gid.split('/').pop() : '');

// The winner's prize, written on the order by the app (metafield carnival.prize). Only the customer-account order page can read it.
function usePrize(orderGid) {
  const [prize, setPrize] = useState(null);   // null = loading / none
  useEffect(() => {
    if (!orderGid) return;
    (async () => {
      try {
        const res = await shopify.query(`query P($id: ID!) { order(id: $id) { metafield(namespace: "carnival", key: "prize") { value } } }`, { variables: { id: orderGid } });
        const raw = res?.data?.order?.metafield?.value;
        if (raw) setPrize(JSON.parse(raw));
      } catch (e) { /* no prize yet, or not readable: the play button shows instead */ }
    })();
  }, [orderGid]);
  return prize;
}

function PrizeCard({ prize }) {
  const free = prize.kind === 'free';
  return (
    <s-box border="base" borderRadius="large" overflow="hidden" background="subdued">
      <s-box padding="base">
        <s-stack gap="small-300">
          <s-heading>{free ? 'Your Carnival free gift' : 'Your Carnival prize'}</s-heading>
          <s-text>{free ? prize.label : `You won ${prize.label}`}</s-text>
          {prize.code ? (
            <s-stack gap="small-500">
              <s-text type="strong">Your personal code: {prize.code}</s-text>
              <s-text>
                {prize.active === false ? `Applicable from ${prize.from} to ${prize.to}.` : `Valid till ${prize.to}.`} Single use, made just for you.
              </s-text>
            </s-stack>
          ) : (
            <s-text>
              {prize.delivery === 'order_edit' ? 'It has been added to this order at no cost.' : prize.delivery === 'pack' ? 'It will be packed together with this order.' : 'Your gift is on its way.'}
            </s-text>
          )}
          <s-stack direction="inline" gap="small-300">
            {prize.shop && prize.active !== false ? <s-button href={prize.shop} target="_blank" variant="primary">Shop now</s-button> : null}
            {prize.page ? <s-button href={prize.page} target="_blank">{free ? 'View my gift' : 'View my prize'}</s-button> : null}
          </s-stack>
        </s-stack>
      </s-box>
    </s-box>
  );
}

function Extension() {
  // Thank-you page: orderConfirmation. Customer-account order page: order.
  const confirmation = unwrap(shopify.orderConfirmation);
  const orderObj = unwrap(shopify.order);

  const orderId =
    lastPart(confirmation?.order?.id) ||
    lastPart(orderObj?.id) ||
    String(confirmation?.number || '').replace('#', '') ||
    String(orderObj?.name || '').replace('#', '');

  // The winner's prize card replaces the play button once the order has a prize.
  const prize = usePrize(orderObj?.id && String(orderObj.id).startsWith('gid://') ? orderObj.id : '');
  if (prize) return <PrizeCard prize={prize} />;

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
