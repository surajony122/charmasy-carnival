// The "view my gift" page opened from the WhatsApp free-gift message. Shown inside the store through the app proxy.
// No personal details on it: the product, how the gift was handled, and a button to the customer's own order status page.

// Everything dynamic is HTML-escaped, and { } become entities so nothing can open a Liquid tag ("%" itself is harmless and stays: "10% OFF").
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])).replace(/[{}]/g, (c) => (c === "{" ? "&#123;" : "&#125;"));
const safeUrl = (u) => (/^https:\/\/[^\s"'<>{}]+$/.test(String(u || "")) ? String(u) : "");

export function buildGiftPage({ assets, found, kind, title, image, delivery, orderName, code, validTill, activeFrom, statusUrl, shopUrl, shopLink }) {
  const coupon = kind === "coupon";
  let heading = "We couldn't find this prize";
  let line = "This link may be old or mistyped. If you won a prize at Charmacy Carnival, check your message again.";
  if (found) {
    heading = coupon ? "Your Carnival prize!" : "Your free gift!";
    if (coupon) line = `You won <b>${esc(title)}</b> at Charmacy Carnival 2026. Single use, made just for you.`;
    else if (delivery === "order_edit") line = `It has been added to your order <b>${esc(orderName)}</b> at no cost. We will pack it together with your order.`;
    else if (delivery === "pack") line = `It will be packed together with your order <b>${esc(orderName)}</b>. Nothing else to do.`;
    else if (delivery === "product_code") line = `Add it to your cart and use this personal code at checkout${validTill ? " (valid till " + esc(validTill) + ")" : ""}:`;
    else line = "Your gift is on its way. Thank you for playing!";
  }
  const order = safeUrl(statusUrl), shop = esc(shopUrl || "/"), go = esc(String(shopLink || "").replace(/[^A-Za-z0-9/_?=&.%\-]/g, "") || shopUrl || "/");
  const showCode = found && code && (coupon || delivery === "product_code");
  const dates = found && coupon && validTill ? (activeFrom ? `Applicable from <b>${esc(activeFrom)}</b> to <b>${esc(validTill)}</b>.` : `Valid till <b>${esc(validTill)}</b>.`) : "";
  return `{% layout none %}<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Your Charmacy Carnival gift</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Arial,Helvetica,sans-serif;color:#4a0f2b;background:linear-gradient(#ffc4de,#f48cb9);display:flex;align-items:center;justify-content:center;padding:16px}
.card{width:100%;max-width:440px;background:#fff6ec;border:3px solid #e11d63;border-radius:22px;padding:24px 20px;text-align:center;box-shadow:0 10px 30px rgba(161,15,77,.25)}
.logo{width:150px;max-width:55%;height:auto}h1{margin:10px 0 4px;font-size:28px;color:#a10f4d}
.prod{margin:14px auto;max-width:260px}.prod img{width:100%;height:auto;border-radius:16px;border:2px solid #ffe3ee;background:#fff}
.title{font-size:20px;font-weight:bold;color:#e11d63;margin:8px 0}p{font-size:16px;line-height:24px;margin:10px 0}
.code{display:inline-block;margin:6px 0 4px;padding:12px 18px;border:2px dashed #e11d63;border-radius:12px;background:#fff;font:bold 22px "Courier New",monospace;letter-spacing:2px;color:#a10f4d;word-break:break-all}
.btn{display:block;margin:14px auto 0;max-width:320px;padding:14px 20px;border-radius:30px;background:#e11d63;color:#fff;text-decoration:none;font-weight:bold;font-size:16px;border-bottom:4px solid #a10f4d}
.btn.alt{background:#fff;color:#a10f4d;border:2px solid #e11d63;border-bottom-width:4px}.fine{font-size:12px;color:#7a3a55;margin-top:14px}
</style></head><body><div class="card">
<img class="logo" src="${esc(assets)}/img/logo.png" alt="Charmacy">
<h1>${esc(heading)}</h1>
${found && title && !coupon ? `<div class="prod">${image && safeUrl(image) ? `<img src="${safeUrl(image)}" alt="">` : ""}<div class="title">${esc(title)}</div></div>` : ""}
<p>${line}</p>
${showCode ? `<div class="code">${esc(code)}</div>` : ""}
${dates ? `<p>${dates}</p>` : ""}
${found && coupon ? `<a class="btn" href="${go}">SHOP NOW</a>` : ""}
${found && order ? `<a class="btn${coupon ? " alt" : ""}" href="${order}">VIEW MY ORDER</a>` : ""}
${coupon ? "" : `<a class="btn alt" href="${shop}">KEEP SHOPPING</a>`}
<div class="fine">Charmacy Carnival 2026</div>
</div></body></html>`;
}
