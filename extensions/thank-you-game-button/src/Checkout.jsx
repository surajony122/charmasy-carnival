import '@shopify/ui-extensions/preact';
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const confirmation = shopify.orderConfirmation?.value || shopify.orderConfirmation?.current || shopify.orderConfirmation;
  const rawOrderId = confirmation?.order?.id || '';
  const orderNumber = confirmation?.number || '';

  let orderIdParam = '';
  if (rawOrderId && typeof rawOrderId === 'string') {
    orderIdParam = rawOrderId.split('/').pop();
  } else if (orderNumber) {
    orderIdParam = String(orderNumber);
  } else if (typeof shopify.order?.id === 'string' && shopify.order.id) {
    orderIdParam = shopify.order.id.split('/').pop();
  } else {
    orderIdParam = 'ORDER_' + Date.now();
  }

  const customerId = shopify.buyerIdentity?.customer?.id?.value 
    || shopify.buyerIdentity?.customer?.id 
    || shopify.customer?.id?.value 
    || shopify.customer?.id 
    || '';
  const customerIdParam = customerId ? customerId.split('/').pop() : '';
  const customerQuery = customerIdParam ? `&customer_id=${customerIdParam}` : '';

  const storefrontUrl = shopify.shop?.storefrontUrl?.value || shopify.shop?.storefrontUrl || "https://ravistore-shop.myshopify.com";
  const baseUrl = storefrontUrl.replace(/\/$/, "");
  const gameUrl = `${baseUrl}/apps/carnival-games?order_id=${orderIdParam}${customerQuery}`;

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