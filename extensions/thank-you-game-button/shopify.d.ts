import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/Checkout.jsx' {
  const shopify:
    | import('@shopify/ui-extensions/purchase.thank-you.block.render').Api
    | import('@shopify/ui-extensions/customer-account.order-status.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/OrderList.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-index.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
