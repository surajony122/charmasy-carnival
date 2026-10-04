# Charmacy Carnival 2026 — flow notes (agreed with the owner)

_Last updated: 2026-10-05. Campaign: 12–20 Oct 2026, one game per day._

## How it should work, end to end
1. A customer **places an order** on the store.
2. On the **Thank-you page** and on the **order pages in the customer account**, a button opens the Carnival page
   (`/apps/carnival-games?order_id=…&customer_id=…`). The extension for this exists (`extensions/thank-you-game-button`).
3. The customer plays **today's game** (other days are locked unless Test Mode is on).
4. **If they win a discount (5% / 10% OFF):**
   - They enter / confirm their email.
   - The app finds or creates the Shopify **customer** for that email.
   - The app creates a **unique, single-use discount code automatically**, assigned to that customer only
     (one user, one time), with an expiry. The code is shown on screen with a Copy button.
   - The win is also saved on the customer profile (metafield `carnival.last_win`) and in the app database.
5. **If they win a free product:** that product is **added to the order they just placed** (order edit, price 0).
6. Rules from the deck still apply: 1 free play per day, max 6 prizes per game per day, 1 prize per email.

## What exists today (built)
- 9 redesigned carnival games (static files in `public/carnival/`), win -> email -> copy-code flow.
- Customer find/create + metafield backup + customer-locked single-use code (needs `write_discounts`,
  `read_customers`, `write_customers` approved by the store and a live app session).
- Server rules: verified win required, 6 prizes/game/day, 1 prize/email/day, claim rate limit.
- Fallback when Shopify cannot create a code: shared codes `CARNIVAL5/10/50/100`, `FREESTELLAR`.

## Still to build (requested)
- **Admin page in the app** to set, for each of the 9 games:
  - which prizes the game can give: % coupon (5, 10, any), fixed amount coupon, or **free product**
    (chosen from the store's products in the app back-end)
  - the **winning percentage** (chance of a prize) and the share of each prize
  - daily prize limit, coupon validity (days), game on/off
- **Free product added to the placed order** (needs scope `write_order_edits`).
- Server decides the outcome (win/lose + which prize) using those settings; games animate to the result.
- Email the code to the customer (open question: needs an email service or Shopify Flow/Email).

## Decisions (owner, 2026-10-05)
- **One play per order** ("many orders, many plays"). A play needs a real order; the server checks the order exists,
  is not cancelled and is under 7 days old. Refreshing never re-rolls: the outcome is stored when the play starts.
- **Free product** is added to the player's already placed order (order edit at 100% off, needs `write_order_edits`).
  If the order can no longer be edited (e.g. fulfilled) the player gets a personal 100%-off code for that product.
- **Phone number** is collected with the email when a prize is claimed, saved on the Shopify customer (+91 format) and in the app.
- Claim email must match the order's email (so nobody can claim with someone else's order number).
- **Admin page "Games & prizes"**: per game - on/off, win chance %, max prizes per day, prize list (% coupon,
  rupee coupon, free product chosen from the store's products) with weights and optional per-prize daily caps;
  global: coupon validity days and "a play needs an order".
- Luck games (claw, wheel, balloons, scratch) animate to the server's decision. Skill games (catch, shade, match,
  tap, puzzle) pay out only if the player succeeds AND the server decided the play wins (default chance 100%).
- Real customers never get shared fallback codes; shared test codes exist only while the app's Test Mode is ON.

## Still open
- Emailing the code (not built; code is shown on screen and saved on the customer profile).
- Real store install is deferred (see project memory).
