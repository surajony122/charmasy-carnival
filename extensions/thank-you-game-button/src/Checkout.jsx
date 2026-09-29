import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const orderId = shopify.order?.id || '';
  const orderIdParam = typeof orderId.value === 'string' 
    ? orderId.value.split('/').pop() 
    : (typeof orderId === 'string' ? orderId.split('/').pop() : 'TEST');

  const storefrontUrl = shopify.shop?.storefrontUrl?.value || shopify.shop?.storefrontUrl || "https://ravistore-shop.myshopify.com";
  const baseUrl = storefrontUrl.replace(/\/$/, "");
  const gameUrl = `${baseUrl}/apps/carnival-games?order_id=${orderIdParam}`;

  return (
    <s-banner heading="Charmacy Carnival is LIVE!" tone="success">
      <s-stack gap="base" blockAlignment="center">
        <s-text>
          Thank you for your order! You have unlocked 1 free play for today's Carnival Game.
        </s-text>
        <s-button href={gameUrl} target="_blank" variant="primary">
          Play & Win a Free Gift
        </s-button>
        <s-link href={gameUrl} target="_blank">
          Click here to Play & Win (New Window)
        </s-link>
      </s-stack>
    </s-banner>
  );
}