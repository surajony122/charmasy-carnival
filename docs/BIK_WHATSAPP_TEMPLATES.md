# Charmacy Carnival - WhatsApp templates for Bik

Create in Bik: Templates > Create template. Channel WhatsApp, category **Marketing**, language **English**.
Header image for all three: `wa-banner.jpg` (1200 x 900, 4:3, in `public/carnival/img/`).
Variables must not be at the very start/end of the text or next to each other (Meta rule) - the texts below follow that.

---------------------------------------------------------------------

## 1. carnival_win_coupon  (sent right after a coupon win)

Header: Image -> wa-banner.jpg

Body:
```
🎉 *Congratulations!* You won *{{1}}* at Charmacy Carnival 2026.

Your personal single-use coupon code:
*{{2}}*

Valid till *{{3}}*. Tap Shop now and your code is applied automatically.

We'll remind you once a week until it expires. Reply STOP to opt out.
```
Footer: `Charmacy Milano`

Buttons:
1. Copy code - sample `CHMSURAJ5`
2. Visit website (dynamic URL) - label `Shop now` - URL `https://charmacyworld.com/discount/{{1}}` - sample `CHMSURAJ5`

Body samples: {{1}} `10% OFF Coupon` | {{2}} `CHMSURAJ5` | {{3}} `19 Nov 2026`

---------------------------------------------------------------------

## 2. carnival_coupon_reminder  (weekly, until the coupon is used or expires)

Header: Image -> wa-banner.jpg

Body:
```
⏰ *Your Carnival coupon is waiting!*

You still have *{{1}}* to use.
Code: *{{2}}*
Valid till *{{3}}* ({{4}} days left).

Tap Shop now and the code is applied automatically.
Reply STOP to stop reminders.
```
Footer: `Charmacy Milano`

Buttons: same two as template 1 (Copy code + dynamic "Shop now" URL, sample `CHMSURAJ5`)

Body samples: {{1}} `10% OFF Coupon` | {{2}} `CHMSURAJ5` | {{3}} `19 Nov 2026` | {{4}} `21`

---------------------------------------------------------------------

## 3. carnival_free_gift  (one message for free-product wins, no reminders)

Header: Image -> wa-banner.jpg

Body:
```
🎁 *Congratulations!* You won a FREE *{{1}}* at Charmacy Carnival 2026.

Tap the button below to see your gift and your order.
```
Footer: `Charmacy Milano`

Button: Visit website (dynamic URL) - label `View my gift` - URL `https://charmacyworld.com/apps/carnival-games?gift={{1}}` - sample `a8Kd92LmQx4Tz7Pw`

Body sample: {{1}} `CMC Baked Illuminator`

---------------------------------------------------------------------

After Meta approves them, copy each template's ID from Bik > Templates and paste it into the app (Games & prizes > WhatsApp via Bik).

---------------------------------------------------------------------

## 4. carnival_result_ready  (OPTIONAL - a neutral notice, category UTILITY)

Idea: a plain message about the customer's own game result for their own order, with NO offer wording in the message.
The prize (code, dates) is behind the button, on the prize page. Meta decides the category itself; if it re-labels it
Marketing, nothing is lost (same limits as the other templates). Do not use words like win, prize, coupon, discount, offer, free.

Category: Utility. Header: none (text only). Footer: `Charmacy Milano`

Body:
```
Hi, your Charmacy Carnival game result for order {{1}} is ready. You can see it any time with the button below.
```
Body sample: {{1}} `#314462`

Button: Visit website (dynamic URL) - label `View my result` - URL `https://charmacyworld.com/apps/carnival-games?gift={{1}}` - sample `a8Kd92LmQx4Tz7Pw`

In the app: Games & prizes > WhatsApp via Bik > "Your result is ready" notice template id, then choose
"instead of" or "as well as" the win / gift message.
