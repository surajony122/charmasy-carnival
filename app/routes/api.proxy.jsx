import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import prisma from "../db.server";

export const action = async ({ request }) => {
  let shop = "ravistore-shop.myshopify.com";
  try {
    const authResult = await authenticate.public.appProxy(request);
    if (authResult.session) shop = authResult.session.shop;
  } catch (e) {}

  const formData = await request.formData();
  const orderId = formData.get("orderId");
  const won = formData.get("won") === "true";
  const prizeType = formData.get("prizeType");
  const prizeValue = formData.get("prizeValue");
  const gameId = parseInt(formData.get("gameId") || "1", 10);

  if (!orderId) return json({ success: false });

  await prisma.gamePlay.upsert({
    where: { orderId },
    update: { won, prizeType, prizeValue, gameId, playedAt: new Date() },
    create: { shop, orderId, gameId, won, prizeType, prizeValue },
  });

  return json({ success: true });
};

export const loader = async ({ request }) => {
  let shop = "ravistore-shop.myshopify.com";
  try {
    const authResult = await authenticate.public.appProxy(request);
    if (authResult.session) shop = authResult.session.shop;
  } catch (error) {
    console.error("App Proxy Auth Failed:", error);
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id") || "TEST_ORDER";
  const gameParam = url.searchParams.get("game");

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  let todayGame = null;
  if (month === 10 && day >= 12 && day <= 20) todayGame = day - 11;
  const initialGameId = gameParam ? parseInt(gameParam, 10) : (todayGame || 1);

  const html = `{% layout none %}
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Charmacy Carnival 2026</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">

      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

        :root {
          --bg-slide: #F7EFE2;
          --card-white: #FFFFFF;
          --burgundy: #6B2237;
          --burgundy-dark: #4D1222;
          --text-dark: #2C1810;
          --text-muted: #8B7355;
          --border-color: #EBDDCB;
          --gold: #B8860B;
          --gold-bg: #FCF5E8;
          --green-bg: #E8F4EC;
          --green-text: #2D6A4F;
        }

        body {
          background-color: var(--bg-slide);
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--text-dark);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 12px 100px;
        }

        /* ===== FULL SLIDE PRESENTATION WRAPPER (PDF 1:1) ===== */
        .slide-deck-container {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
        }

        /* Slide Top Header Bar */
        .slide-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 12px;
          margin-bottom: 20px;
          gap: 16px;
        }

        .slide-header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .slide-title-row {
          display: flex;
          align-items: baseline;
          gap: 14px;
          flex-wrap: wrap;
        }

        .slide-date-tag {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .slide-main-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--burgundy);
          line-height: 1.1;
        }

        .slide-tagline {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 500;
        }

        .slide-type-badge {
          background: var(--burgundy);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 6px 18px;
          border-radius: 8px;
          white-space: nowrap;
        }

        /* 3-Column Slide Content Grid (PDF 1:1) */
        .slide-columns-grid {
          display: grid;
          grid-template-columns: 1fr 390px 1fr;
          gap: 24px;
          align-items: stretch;
        }

        @media (max-width: 1080px) {
          .slide-columns-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        /* Left and Right Info Columns */
        .slide-side-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .slide-info-card {
          background: var(--card-white);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(107,34,55,0.03);
          transition: transform 0.2s ease;
        }

        .slide-info-card.prize-card {
          background: var(--gold-bg);
          border-color: #E6D2B5;
        }

        .slide-info-card.guardrail-card {
          background: var(--green-bg);
          border-color: #C3E2D0;
        }

        .info-card-header {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--burgundy);
        }

        .guardrail-card .info-card-header {
          color: var(--green-text);
        }

        .info-card-desc {
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-dark);
          font-weight: 500;
          white-space: pre-line;
        }

        .info-card-highlight {
          font-weight: 700;
        }

        /* Center Column: Phone Mockup Container */
        .phone-mockup-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .phone-mockup {
          width: 100%;
          max-width: 370px;
          background: #FFFFFF;
          border-radius: 40px;
          border: 10px solid #2C1810;
          box-shadow: 0 20px 50px rgba(44,24,16,0.22);
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .phone-top-notch {
          width: 130px;
          height: 18px;
          background: #2C1810;
          margin: 0 auto;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          z-index: 50;
        }

        .phone-screen-header {
          padding: 8px 16px 10px;
          border-bottom: 1px solid #F0E6D8;
          text-align: center;
          background: #FFFFFF;
        }

        .phone-screen-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--burgundy);
        }

        .phone-screen-order {
          font-size: 9px;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* Game Arena inside Phone */
        .game-canvas-container {
          position: relative;
          background: #FDFAF6;
          height: 380px;
          width: 100%;
          overflow: hidden;
          user-select: none;
        }

        .phone-action-footer {
          padding: 14px 20px 20px;
          background: #FFFFFF;
          border-top: 1px solid #F0E6D8;
        }

        .btn-game-action {
          width: 100%;
          padding: 14px;
          background: var(--burgundy);
          color: #fff;
          border: none;
          border-radius: 50px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 6px 16px rgba(107,34,55,0.25);
        }

        .btn-game-action:hover { background: var(--burgundy-dark); }
        .btn-game-action:active { transform: scale(0.98); }
        .btn-game-action:disabled {
          background: #D8CCC0;
          box-shadow: none;
          cursor: not-allowed;
        }

        /* ===== SLIDE BOTTOM GUARDRAIL & NAVIGATION STRIP ===== */
        .slide-bottom-deck {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .guardrail-pills-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .guardrail-pill {
          background: #FFFFFF;
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--burgundy);
        }

        .guardrail-pill.unlock-banner {
          background: #EFE4D6;
          color: var(--text-dark);
          margin-left: auto;
        }

        @media (max-width: 1080px) {
          .guardrail-pill.unlock-banner { margin-left: 0; width: 100%; text-align: center; }
        }

        /* The 9-Game Mix Tabs (PDF 1:1) */
        .game-tabs-row {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 8px;
        }

        @media (max-width: 1080px) {
          .game-tabs-row {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #FFFFFF;
            padding: 8px 10px;
            box-shadow: 0 -4px 20px rgba(107,34,55,0.1);
            display: flex;
            overflow-x: auto;
            z-index: 500;
            margin: 0;
          }
          .game-tab-btn {
            flex: 0 0 auto;
            min-width: 85px;
          }
        }

        .game-tab-btn {
          background: #EFE4D6;
          border: none;
          border-radius: 8px;
          padding: 10px 4px;
          text-align: center;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-dark);
          transition: all 0.15s;
          line-height: 1.2;
        }

        .game-tab-btn.active {
          background: var(--burgundy);
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(107,34,55,0.25);
        }

        /* ===== WIN / LOSE POPUP MODAL ===== */
        .game-modal-overlay {
          position: absolute;
          inset: 0;
          background: rgba(253, 250, 246, 0.97);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          z-index: 200;
          animation: popIn 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        .modal-icon { font-size: 50px; margin-bottom: 8px; }
        .modal-title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 1px;
          color: var(--burgundy);
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .modal-body {
          font-size: 13px;
          color: var(--text-dark);
          margin-bottom: 20px;
          line-height: 1.5;
          max-width: 270px;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-anim {
          animation: shake 0.35s ease-in-out;
        }

        .game-toast {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(44, 24, 16, 0.94);
          color: #FFFFFF;
          padding: 8px 18px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          z-index: 150;
          pointer-events: none;
          animation: toastFade 0.25s ease-out;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        }
        @keyframes toastFade {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      </style>
    </head>
    <body>

      <div class="slide-deck-container">
        <!-- Slide Header -->
        <div class="slide-header">
          <div class="slide-header-left">
            <div class="slide-title-row">
              <span class="slide-date-tag" id="slide-date-display">12 OCT</span>
              <h1 class="slide-main-title" id="slide-title-display">CHARMACY CLAW</h1>
            </div>
            <p class="slide-tagline" id="slide-tagline-display">A fast luck-based opener: position the claw, tap to drop, and try to pick a Charmacy prize.</p>
          </div>
          <div class="slide-type-badge" id="slide-type-display">LUCK</div>
        </div>

        <!-- 3-Column Grid Layout -->
        <div class="slide-columns-grid">
          <!-- Left Column (3 Info Cards) -->
          <div class="slide-side-col">
            <div class="slide-info-card">
              <div class="info-card-header">HOW IT WORKS</div>
              <div class="info-card-desc" id="info-how-it-works">1. User moves the claw left / right.
2. Tap drops the claw.
3. Claw either misses or picks a product / prize.</div>
            </div>
            <div class="slide-info-card">
              <div class="info-card-header">WINNER LOGIC</div>
              <div class="info-card-desc" id="info-winner-logic">Only 6 prize outcomes are available for the day. Winning positions are server-controlled; all other plays can show a "come back tomorrow" result.</div>
            </div>
            <div class="slide-info-card prize-card">
              <div class="info-card-header">PROPOSED OFFER / PRIZES</div>
              <div class="info-card-desc info-card-highlight" id="info-proposed-prizes">3 × 5% OFF Coupon • 2 × 10% OFF Coupon • 1 × Free Gift – Stellar Eyeliner</div>
            </div>
          </div>

          <!-- Center Column (Live Phone Mockup) -->
          <div class="phone-mockup-wrapper">
            <div class="phone-mockup">
              <div class="phone-top-notch"></div>
              <div class="phone-screen-header">
                <div class="phone-screen-title" id="phone-game-title">CHARMACY CLAW</div>
                <div class="phone-screen-order">ORDER #${orderId}</div>
              </div>

              <!-- Interactive Game Arena -->
              <div class="game-canvas-container" id="game-arena">
                <!-- Injected via Pure JS Game Controller -->
              </div>

              <div class="phone-action-footer">
                <button class="btn-game-action" id="main-action-btn">TAP TO DROP</button>
              </div>
            </div>
          </div>

          <!-- Right Column (3 Info Cards) -->
          <div class="slide-side-col">
            <div class="slide-info-card">
              <div class="info-card-header">CLAIM LOGIC</div>
              <div class="info-card-desc" id="info-claim-logic">Coupon codes delivered instantly. Free Gift (Stellar Eyeliner) unlocks with any valid Carnival order placed the same day.</div>
            </div>
            <div class="slide-info-card">
              <div class="info-card-header">WHY THIS GAME EARNS ITS DAY</div>
              <div class="info-card-desc" id="info-why-earns">Visually strong launch-day mechanic. The uncertainty makes even non-winning plays feel fun.</div>
            </div>
            <div class="slide-info-card guardrail-card">
              <div class="info-card-header">P&L / TECH GUARDRAIL</div>
              <div class="info-card-desc info-card-highlight" id="info-guardrail">Cap exactly 6 prizes per day. Keep coupon codes single-use and time-bound; Free Gift landed cost stays capped.</div>
            </div>
          </div>
        </div>

        <!-- Slide Bottom Deck -->
        <div class="slide-bottom-deck">
          <div class="guardrail-pills-row">
            <div class="guardrail-pill">1 FREE PLAY / DAY</div>
            <div class="guardrail-pill">6 WINNERS / DAY</div>
            <div class="guardrail-pill">WEBSITE = GAME HUB</div>
            <div class="guardrail-pill">PURCHASE = BONUS PLAY</div>
            <div class="guardrail-pill unlock-banner">CATALOG: 5% / 10% / ₹50 / ₹100 + STELLAR EYELINER</div>
          </div>

          <!-- The 9-Game Mix Tabs -->
          <div class="game-tabs-row" id="game-tabs-container">
            <!-- Tabs rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Pure Native High-Performance 60FPS Game Controller (Zero Babel, Zero Runtime Lag) -->
      <script>
        const ORDER_ID = "${orderId}";
        const INITIAL_GAME = ${initialGameId};

        const GAMES_DATA = [
          {
            id: 1, date: "12 OCT", tabName: "12 CLAW", title: "CHARMACY CLAW", type: "LUCK", color: "#6B2237",
            tagline: "A fast luck-based opener: position the claw, tap to drop, and try to pick a Charmacy prize.",
            howItWorks: "1. User moves the claw left / right.\\n2. Tap drops the claw.\\n3. Claw either misses or picks a product / prize.",
            winnerLogic: "Only 6 prize outcomes are available for the day. Winning positions are server-controlled; all other plays can show a \\"come back tomorrow\\" result.",
            prizes: "3 × 5% OFF Coupon • 2 × 10% OFF Coupon • 1 × Free Gift – Stellar Eyeliner",
            claimLogic: "Coupon codes delivered instantly. Free Gift (Stellar Eyeliner) unlocks with any valid Carnival order placed the same day.",
            whyEarns: "Visually strong launch-day mechanic. The uncertainty makes even non-winning plays feel fun.",
            guardrail: "Cap exactly 6 prizes per day. Keep coupon codes single-use and time-bound; Free Gift landed cost stays capped."
          },
          {
            id: 2, date: "13 OCT", tabName: "13 SPIN", title: "SPIN THE GLAM WHEEL", type: "LUCK", color: "#B8860B",
            tagline: "One spin, multiple possibilities — but only six valuable outcomes are actually released.",
            howItWorks: "1. User taps SPIN.\\n2. Wheel rotates through prize / non-prize segments.\\n3. Winning users receive a unique reward code / prize claim.",
            winnerLogic: "Server controls the six winning outcomes. \\"Try again tomorrow\\" / non-prize segments can remain visible so the wheel still feels dynamic.",
            prizes: "2 × ₹50 OFF Coupon • 2 × 5% OFF Coupon • 1 × 10% OFF Coupon • 1 × Free Gift – Stellar Eyeliner",
            claimLogic: "Coupon winners receive codes immediately. Free Gift (Stellar Eyeliner) unlocks with any valid Carnival order placed today.",
            whyEarns: "Customers instantly understand a wheel. Each prize is single-use and time-bound, so it never becomes a sitewide discount.",
            guardrail: "Keep ₹50 / ₹100 OFF codes single-use and time-bound. Never stack multiple game coupons."
          },
          {
            id: 3, date: "14 OCT", tabName: "14 CATCH", title: "CATCH MY CHARMACY", type: "REFLEX", color: "#C0604A",
            tagline: "Catch falling Charmacy products in the makeup bag, avoid decoys, and climb the leaderboard.",
            howItWorks: "1. Move the Charmacy bag left / right.\\n2. Product = points; golden product = bonus.\\n3. Decoy reduces score. Game lasts ~15–20 sec.",
            winnerLogic: "Skill-based. Top 6 valid scores at the end of the day win. Tie-breaker: earliest time the final score was achieved.",
            prizes: "Ranks 4–6 → 5% OFF Coupon • Ranks 2–3 → ₹50 OFF Coupon • Rank 1 → Free Gift – Stellar Eyeliner",
            claimLogic: "Top 6 ranked winners receive their coupon or unlock the Free Gift with any valid Carnival order placed the same day.",
            whyEarns: "Leaderboard competition encourages repeat visits and score-sharing without giving every player a coupon.",
            guardrail: "Use anti-bot / score validation. Limit attempts per account/device so the leaderboard stays fair."
          },
          {
            id: 4, date: "15 OCT", tabName: "15 SHADE", title: "PICK THE RIGHT SHADE", type: "BEAUTY", color: "#7B5EA7",
            tagline: "A quick beauty-knowledge game: choose the best shade match from four options.",
            howItWorks: "1. Show a model / undertone / shade clue.\\n2. User picks 1 of 4 swatches.\\n3. Correct answer qualifies the user for the day's draw.",
            winnerLogic: "Select 6 winners from valid correct entries after the day closes. This keeps the game easy and avoids rewarding every correct answer.",
            prizes: "4 × 5% OFF Coupon • 2 × 10% OFF Coupon",
            claimLogic: "Product winners unlock the prize with any valid Carnival order placed the same day.",
            whyEarns: "Very low-friction game that also educates customers on Charmacy shades and undertones.",
            guardrail: "One qualifying entry per customer. Keep coupon codes single-use per customer."
          },
          {
            id: 5, date: "16 OCT", tabName: "16 MIRROR", title: "MIRROR MATCH", type: "MEMORY", color: "#5A5AA0",
            tagline: "Flip the vanity cards, match Charmacy product pairs, and finish before the timer runs out.",
            howItWorks: "1. Cards begin face-down.\\n2. User flips two at a time to find matching beauty pairs.\\n3. Complete the board as fast as possible.",
            winnerLogic: "Fastest 6 valid completed boards win. Time starts at first card flip and stops after the final match.",
            prizes: "3 × 10% OFF Coupon • 2 × ₹50 OFF Coupon • 1 × Free Gift – Stellar Eyeliner",
            claimLogic: "Fastest 6 players on the daily board unlock their coupon code or free gift with any valid Carnival order.",
            whyEarns: "Memory creates genuine game tension while the product artwork reinforces Charmacy recognition.",
            guardrail: "Keep the board small on mobile. Use fixed card sets per day and server-side completion times."
          },
          {
            id: 6, date: "17 OCT", tabName: "17 TAP", title: "TAP THE SPARKLE", type: "SPEED", color: "#C06030",
            tagline: "A 10-second reflex game that builds excitement one day before Charmacy's birthday.",
            howItWorks: "1. Sparkles / products appear randomly.\\n2. Tap as many as possible in 10 sec.\\n3. Special sparkle = bonus points.",
            winnerLogic: "Top 6 scores of the day win. Show a live / delayed leaderboard and a birthday countdown after each attempt.",
            prizes: "3 × 5% OFF Coupon • 2 × ₹100 OFF Coupon • 1 × Free Gift – Stellar Eyeliner",
            claimLogic: "Top 6 ranked winners receive single-use coupon codes or unlock Stellar Eyeliner with a valid order.",
            whyEarns: "Fast, addictive and easy to understand. It naturally builds anticipation into the 18 Oct birthday takeover.",
            guardrail: "Cap attempts and validate impossible tap rates. Keep coupon codes single-use and time-bound."
          },
          {
            id: 7, date: "18 OCT", tabName: "18 BIRTHDA", title: "BIRTHDAY BALLOON POP", type: "BIRTHDAY", color: "#A0405A",
            tagline: "Charmacy turns 6: six hourly surprise gift drops + a separate '6 Carts On Us' birthday moment.",
            howItWorks: "1. One new balloon opens every hour (suggested 2–7 PM).\\n2. Customers pop the active balloon for a chance to win that hour's surprise.\\n3. Winner is revealed; next hour gets a new gift.",
            winnerLogic: "6 hourly gift winners + 6 separate Cart On Us winners from eligible birthday orders. Exact selection method and timings to be approved.",
            prizes: "6 HOURS • 1 SURPRISE GIFT EVERY HOUR (5% / 10% / ₹50 / ₹100 OFF Coupon or Free Gift – Stellar Eyeliner) + 6 CARTS ON US* (*suggested refund cap: ₹1,500/order)",
            claimLogic: "Hourly gifts need no purchase (truly free). '6 Carts On Us' applies only to valid 18 Oct orders with suggested max ₹1,500 refund cap.",
            whyEarns: "Creates six traffic spikes, six social moments and a visibly bigger birthday experience without changing the core 15% / 20% offer.",
            guardrail: "Pre-cap Cart On Us exposure (suggested max ₹9,000 total). Vary the hourly reward through the day; coupon value and Free Gift landed cost both count toward finance approval."
          },
          {
            id: 8, date: "19 OCT", tabName: "19 SCRATCH", title: "SCRATCH AND WIN CARD GAME", type: "LUCK", color: "#8B6914",
            tagline: "Scratch the digital card to instantly reveal today's Carnival reward.",
            howItWorks: "1. User taps and drags a finger across the card.\\n2. The scratch animation clears to reveal a reward.\\n3. Winning cards show a coupon code or Free Gift claim; others show 'come back tomorrow.'",
            winnerLogic: "Only 6 winning cards are released for the day. Winning cards are server-controlled; all other scratches show a 'come back tomorrow' result.",
            prizes: "2 × ₹100 OFF Coupon • 2 × 10% OFF Coupon • 1 × 5% OFF Coupon • 1 × Free Gift – Stellar Eyeliner",
            claimLogic: "Winning cards reveal instant single-use coupon codes or Free Gift claims valid on today's order.",
            whyEarns: "Instant gratification mechanic — the reveal itself feels rewarding even before the result appears.",
            guardrail: "No blanket discount. Cap exactly 6 winning cards; keep coupon codes single-use and time-bound."
          },
          {
            id: 9, date: "20 OCT", tabName: "20 PUZZLE", title: "BEAUTY WORD PUZZLE", type: "PUZZLE", color: "#4A3580",
            tagline: "Finale day: find every hidden beauty word in the grid before the timer runs out.",
            howItWorks: "1. User is shown a grid with beauty / Charmacy words hidden inside.\\n2. Tap / drag to circle each word found from the list.\\n3. Complete the full word list as fast as possible to qualify.",
            winnerLogic: "Among valid completed puzzles, the 6 fastest correct completions win. Tie-breaker: earliest time the puzzle was submitted.",
            prizes: "2 × ₹100 OFF Coupon • 2 × 5% OFF Coupon • 1 × 10% OFF Coupon • 1 × Free Gift – Stellar Eyeliner",
            claimLogic: "Fastest 6 finishers receive unique coupon codes or unlock the Free Gift on their finale Carnival purchase.",
            whyEarns: "Finale-worthy: a focused, discovery-led game that gives the Carnival a satisfying close.",
            guardrail: "Fixed word set per day; limit attempts per account/device; validate completion server-side."
          }
        ];

        let currentGameId = INITIAL_GAME;
        let activeAnimationId = null;

        // Backend save
        function recordResult(won, prize) {
          const fd = new FormData();
          fd.append("orderId", ORDER_ID);
          fd.append("gameId", currentGameId);
          fd.append("won", won ? "true" : "false");
          if (prize) {
            fd.append("prizeType", prize.includes("Coupon") || prize.includes("OFF") ? "COUPON" : "PRODUCT");
            fd.append("prizeValue", prize);
          }
          fetch(window.location.href, { method: "POST", body: fd }).catch(() => {});
        }

        function claimPrize(prize) {
          if (!prize) return;
          if (prize.includes("10%")) {
            window.location.href = "/discount/CARNIVAL10?redirect=/collections/all";
          } else if (prize.includes("5%")) {
            window.location.href = "/discount/CARNIVAL5?redirect=/collections/all";
          } else if (prize.includes("50")) {
            window.location.href = "/discount/CARNIVAL50?redirect=/collections/all";
          } else if (prize.includes("100")) {
            window.location.href = "/discount/CARNIVAL100?redirect=/collections/all";
          } else if (prize.toLowerCase().includes("stellar") || prize.toLowerCase().includes("gift") || prize.toLowerCase().includes("eyeliner")) {
            window.location.href = "/discount/FREESTELLAR?redirect=/collections/all";
          } else {
            window.location.href = "/collections/all";
          }
        }

        function showGameToast(msg) {
          const arena = document.getElementById("game-arena");
          if (!arena) return;
          const old = arena.querySelector(".game-toast");
          if (old) old.remove();
          const toast = document.createElement("div");
          toast.className = "game-toast";
          toast.textContent = msg;
          arena.appendChild(toast);
          setTimeout(() => { if (toast.parentNode) toast.remove(); }, 1600);
        }

        function showResultModal(won, title, message, prize, onRetry) {
          const arena = document.getElementById("game-arena");
          const existing = arena.querySelector(".game-modal-overlay");
          if (existing) existing.remove();

          const modal = document.createElement("div");
          modal.className = "game-modal-overlay";
          modal.innerHTML = 
            '<div class="modal-icon">' + (won ? "🎉" : "💫") + '</div>' +
            '<div class="modal-title">' + title + '</div>' +
            '<div class="modal-body">' + message + '</div>' +
            (won 
              ? '<button class="btn-game-action" id="modal-claim-btn" style="max-width:220px;">CLAIM REWARD →</button>'
              : '<button class="btn-game-action" id="modal-retry-btn" style="max-width:220px;">TRY AGAIN</button>'
            );

          arena.appendChild(modal);

          if (won) {
            document.getElementById("modal-claim-btn").onclick = () => claimPrize(prize);
          } else if (onRetry) {
            document.getElementById("modal-retry-btn").onclick = () => {
              modal.remove();
              onRetry();
            };
          }
        }

        // ============================================================
        // GAME 1: CHARMACY CLAW (60FPS requestAnimationFrame)
        // ============================================================
        function launchGame1() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "TAP TO DROP";
          actionBtn.disabled = false;

          arena.innerHTML = 
            '<svg width="100%" height="100%" viewBox="0 0 340 380" style="display:block;">' +
              '<rect x="20" y="16" width="300" height="8" rx="4" fill="#D4C4B4"/>' +
              '<text x="170" y="42" text-anchor="middle" fill="#8B7355" font-size="11" font-weight="700" letter-spacing="2">DROP THE CLAW</text>' +
              '<g id="claw-group" style="will-change: transform;">' +
                '<line id="claw-line" x1="170" y1="20" x2="170" y2="50" stroke="#2C1810" stroke-width="3"/>' +
                '<rect id="claw-box" x="158" y="42" width="24" height="12" rx="3" fill="#2C1810"/>' +
                '<path id="claw-head" d="M 154 70 Q 152 56 170 50 Q 188 56 186 70" stroke="#2C1810" stroke-width="4" fill="none" stroke-linecap="round"/>' +
                '<path id="claw-left-prong" d="M 154 70 Q 148 78 156 84" stroke="#2C1810" stroke-width="4" fill="none" stroke-linecap="round"/>' +
                '<path id="claw-right-prong" d="M 186 70 Q 192 78 184 84" stroke="#2C1810" stroke-width="4" fill="none" stroke-linecap="round"/>' +
                '<g id="claw-held-item" style="display:none;" transform="translate(156, 76) scale(0.7)">' +
                  '<rect width="28" height="60" rx="4" fill="#7A3045"/>' +
                  '<rect x="4" y="-14" width="20" height="14" rx="2" fill="#2C1810"/>' +
                '</g>' +
              '</g>' +
              '<g id="products-row">' +
                '<g transform="translate(42, 275)"><rect x="0" y="16" width="28" height="62" rx="4" fill="#7A3045"/><rect x="6" y="0" width="16" height="16" rx="2" fill="#2C1810"/></g>' +
                '<g transform="translate(125, 315)"><circle cx="0" cy="0" r="26" fill="#7A3045" stroke="#2C1810" stroke-width="2"/><line x1="-22" y1="0" x2="22" y2="0" stroke="#2C1810" stroke-width="3"/></g>' +
                '<g transform="translate(182, 265)"><rect x="0" y="24" width="34" height="64" rx="6" fill="#7A3045"/><rect x="11" y="12" width="12" height="12" fill="#2C1810"/><rect x="7" y="0" width="20" height="12" rx="2" fill="#2C1810"/></g>' +
                '<g transform="translate(258, 270)"><rect x="0" y="20" width="20" height="68" rx="3" fill="#7A3045"/><rect x="0" y="0" width="20" height="20" rx="2" fill="#2C1810"/></g>' +
              '</g>' +
            '</svg>';

          const clawGroup = document.getElementById("claw-group");
          const clawHeld = document.getElementById("claw-held-item");

          let x = 170;
          let dir = 1;
          let state = "SWINGING";

          function swing() {
            if (state !== "SWINGING") return;
            x += dir * 2.8;
            if (x >= 280) { x = 280; dir = -1; }
            if (x <= 60) { x = 60; dir = 1; }
            clawGroup.setAttribute("transform", "translate(" + (x - 170) + ", 0)");
            activeAnimationId = requestAnimationFrame(swing);
          }
          activeAnimationId = requestAnimationFrame(swing);

          actionBtn.onclick = function() {
            if (state !== "SWINGING") return;
            state = "DROPPING";
            actionBtn.disabled = true;

            let curY = 0;
            const dropTimer = setInterval(() => {
              curY += 8;
              clawGroup.setAttribute("transform", "translate(" + (x - 170) + ", " + curY + ")");
              if (curY >= 200) {
                clearInterval(dropTimer);

                const targets = [
                  { x: 56, prize: "5% OFF Coupon" },
                  { x: 125, prize: "Free Gift - Stellar Eyeliner" },
                  { x: 199, prize: "10% OFF Coupon" },
                  { x: 268, prize: "5% OFF Coupon" }
                ];
                const hit = targets.find(t => Math.abs(x - t.x) < 30);

                if (hit) {
                  clawHeld.style.display = "block";
                  const upTimer = setInterval(() => {
                    curY -= 6;
                    clawGroup.setAttribute("transform", "translate(" + (x - 170) + ", " + curY + ")");
                    if (curY <= 0) {
                      clearInterval(upTimer);
                      recordResult(true, hit.prize);
                      showResultModal(true, "YOU WON!", "Congratulations! You grabbed: " + hit.prize, hit.prize, launchGame1);
                    }
                  }, 16);
                } else {
                  setTimeout(() => {
                    const upTimer = setInterval(() => {
                      curY -= 8;
                      clawGroup.setAttribute("transform", "translate(" + (x - 170) + ", " + curY + ")");
                      if (curY <= 0) {
                        clearInterval(upTimer);
                        recordResult(false, null);
                        showResultModal(false, "ALMOST!", "The claw missed! Give it another shot.", null, launchGame1);
                      }
                    }, 16);
                  }, 200);
                }
              }
            }, 16);
          };
        }

        // ============================================================
        // GAME 2: SPIN THE GLAM WHEEL (GPU Accelerated CSS)
        // ============================================================
        function launchGame2() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "SPIN WHEEL";
          actionBtn.disabled = false;

          arena.innerHTML = 
            '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;">' +
              '<div style="width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:24px solid #6B2237;margin-bottom:-10px;z-index:10;"></div>' +
              '<div style="position:relative;width:260px;height:260px;">' +
                '<canvas id="wheel-cvs" width="260" height="260" style="border-radius:50%;box-shadow:0 8px 24px rgba(107,34,55,0.18);will-change:transform;"></canvas>' +
                '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:#6B2237;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>' +
              '</div>' +
            '</div>';

          const cvs = document.getElementById("wheel-cvs");
          const ctx = cvs.getContext("2d");
          const segments = [
            { label: "₹50 OFF", prize: "₹50 OFF Coupon", win: true, color: "#E8D5B5" },
            { label: "Try Again", prize: null, win: false, color: "#F7EFE2" },
            { label: "10% OFF", prize: "10% OFF Coupon", win: true, color: "#D8BF9A" },
            { label: "Come Back", prize: null, win: false, color: "#F7EFE2" },
            { label: "5% OFF", prize: "5% OFF Coupon", win: true, color: "#E8D5B5" },
            { label: "Try Again", prize: null, win: false, color: "#F7EFE2" },
            { label: "Stellar Eye", prize: "Free Gift - Stellar Eyeliner", win: true, color: "#D8BF9A" },
            { label: "Better Luck", prize: null, win: false, color: "#F7EFE2" },
          ];

          const n = segments.length;
          const arc = (Math.PI * 2) / n;
          const cx = 130, cy = 130, r = 126;

          segments.forEach((seg, i) => {
            const angle = arc * i;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, angle, angle + arc);
            ctx.fillStyle = seg.color;
            ctx.fill();
            ctx.strokeStyle = "#C9B8A0";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle + arc / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = "#4A2828";
            ctx.font = "bold 11px DM Sans, sans-serif";
            ctx.fillText(seg.label, r - 12, 4);
            ctx.restore();
          });

          let spinning = false;
          let currentRot = 0;

          actionBtn.onclick = function() {
            if (spinning) return;
            spinning = true;
            actionBtn.disabled = true;

            const extra = 1800 + Math.random() * 720;
            currentRot += extra;
            cvs.style.transition = "transform 3.5s cubic-bezier(0.12, 0.8, 0.15, 1)";
            cvs.style.transform = "rotate(" + currentRot + "deg)";

            setTimeout(() => {
              spinning = false;
              const norm = ((currentRot % 360) + 360) % 360;
              const arcDeg = 360 / n;
              const pointerAngle = (360 - norm + arcDeg / 2) % 360;
              const idx = Math.floor(pointerAngle / arcDeg) % n;
              const seg = segments[idx];

              recordResult(seg.win, seg.prize);
              showResultModal(seg.win, seg.win ? "WINNER!" : "TRY AGAIN", seg.win ? "You won: " + seg.prize : "Better luck tomorrow!", seg.prize, launchGame2);
            }, 3600);
          };
        }

        // ============================================================
        // GAME 3: CATCH MY CHARMACY (High Performance 60FPS Loop)
        // ============================================================
        function launchGame3() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "START 15s ROUND";
          actionBtn.disabled = false;

          let score = 0;
          let timeLeft = 15;
          let running = false;
          let bagX = 170;
          let items = [];
          let spawnCounter = 0;

          arena.innerHTML = 
            '<div style="position:relative;width:100%;height:100%;">' +
              '<div style="position:absolute;top:12px;left:16px;right:16px;display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:#6B2237;">' +
                '<span id="catch-score">SCORE: 0</span>' +
                '<span id="catch-timer">15s</span>' +
              '</div>' +
              '<svg id="catch-svg" width="100%" height="100%" viewBox="0 0 340 380" style="display:block;">' +
                '<g id="catch-items-group"></g>' +
                '<g id="catch-bag" transform="translate(170, 330)">' +
                  '<path d="M -16 -12 Q 0 -26 16 -12" stroke="#6B2237" stroke-width="3" fill="none"/>' +
                  '<rect x="-34" y="-10" width="68" height="42" rx="8" fill="#F0E6D8" stroke="#6B2237" stroke-width="2.5"/>' +
                  '<text x="0" y="16" text-anchor="middle" fill="#6B2237" font-size="9" font-weight="800" letter-spacing="1">CHARMACY</text>' +
                '</g>' +
              '</svg>' +
            '</div>';

          const bag = document.getElementById("catch-bag");
          const itemsGroup = document.getElementById("catch-items-group");
          const scoreEl = document.getElementById("catch-score");
          const timerEl = document.getElementById("catch-timer");

          function updateBagPos(clientX) {
            const rect = arena.getBoundingClientRect();
            const relX = ((clientX - rect.left) / rect.width) * 340;
            bagX = Math.max(40, Math.min(300, relX));
            bag.setAttribute("transform", "translate(" + bagX + ", 330)");
          }

          arena.onmousemove = (e) => { if (running) updateBagPos(e.clientX); };
          arena.ontouchmove = (e) => { if (running && e.touches[0]) updateBagPos(e.touches[0].clientX); };

          actionBtn.onclick = function() {
            if (running) return;
            running = true;
            actionBtn.disabled = true;
            actionBtn.textContent = "CATCH BOTTLES! AVOID ⊗";

            const timerInt = setInterval(() => {
              timeLeft--;
              timerEl.textContent = timeLeft + "s";
              if (timeLeft <= 0) {
                clearInterval(timerInt);
                running = false;
                const won = score >= 50;
                let prize = "5% OFF Coupon";
                if (score >= 90) prize = "Free Gift - Stellar Eyeliner";
                else if (score >= 70) prize = "₹50 OFF Coupon";
                recordResult(won, won ? prize : null);
                showResultModal(won, won ? "TOP RANK SCORE!" : "TIME UP!", "Final Score: " + score + (won ? ". You qualify for today's leaderboard prize: " + prize : ". Need 50+ to rank."), prize, launchGame3);
              }
            }, 1000);

            function loop() {
              if (!running) return;
              spawnCounter++;
              if (spawnCounter % 28 === 0) {
                const isDecoy = Math.random() < 0.28;
                items.push({
                  x: 35 + Math.random() * 270,
                  y: 0,
                  isDecoy,
                  isGolden: !isDecoy && Math.random() < 0.15
                });
              }

              let html = "";
              for (let i = items.length - 1; i >= 0; i--) {
                const it = items[i];
                it.y += 4.5;

                if (it.y >= 310 && it.y <= 345 && Math.abs(it.x - bagX) < 38) {
                  score = Math.max(0, score + (it.isDecoy ? -15 : (it.isGolden ? 30 : 10)));
                  scoreEl.textContent = "SCORE: " + score;
                  items.splice(i, 1);
                  continue;
                }

                if (it.y > 380) {
                  items.splice(i, 1);
                  continue;
                }

                if (it.isDecoy) {
                  html += '<g transform="translate(' + it.x + ',' + it.y + ')"><circle cx="0" cy="0" r="13" fill="#C0604A"/><line x1="-6" y1="-6" x2="6" y2="6" stroke="#fff" stroke-width="2.5"/><line x1="6" y1="-6" x2="-6" y2="6" stroke="#fff" stroke-width="2.5"/></g>';
                } else {
                  html += '<g transform="translate(' + it.x + ',' + it.y + ')"><rect x="-9" y="-6" width="18" height="28" rx="3" fill="' + (it.isGolden ? '#B8860B' : '#7A3045') + '"/><rect x="-5" y="-14" width="10" height="8" rx="2" fill="#2C1810"/></g>';
                }
              }

              itemsGroup.innerHTML = html;
              requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
          };
        }

        // ============================================================
        // GAME 4: PICK THE RIGHT SHADE (Slide 6 Redesign)
        // ============================================================
        function launchGame4() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "SELECT A SHADE SWATCH";
          actionBtn.disabled = true;

          const swatches = [
            { num: 1, label: "Fair Warm", color: "#E8C5A8" },
            { num: 2, label: "Warm Medium", color: "#C8936D", correct: true },
            { num: 3, label: "Tan Warm", color: "#A56942" },
            { num: 4, label: "Deep Rich", color: "#6B3B22" }
          ];

          arena.innerHTML = 
            '<div style="width:100%;height:100%;padding:24px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
              '<div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#8B7355;margin-bottom:6px;">CHARMACY SHADE LAB</div>' +
              '<div style="font-size:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#6B2237;margin-bottom:28px;">MATCH: WARM MEDIUM</div>' +
              
              '<div style="display:flex;gap:18px;align-items:center;justify-content:center;margin-bottom:12px;">' +
                swatches.map(s => 
                  '<div class="shade-slot" data-num="' + s.num + '" style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;">' +
                    '<div style="width:52px;height:52px;border-radius:50%;background:' + s.color + ';box-shadow:0 4px 12px rgba(0,0,0,0.15);border:3px solid #fff;transition:transform 0.15s ease;"></div>' +
                    '<span style="font-size:12px;font-weight:800;color:#2C1810;">' + s.num + '</span>' +
                  '</div>'
                ).join('') +
              '</div>' +

              '<!-- Indicator Selection Dot Row (Slide 6 GIF 1:1) -->' +
              '<div style="height:28px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">' +
                '<div id="shade-selection-dot" style="width:14px;height:14px;border-radius:50%;background:#2C1810;opacity:0;transition:all 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);"></div>' +
              '</div>' +

              '<div style="background:#FFFFFF;border:1px solid #EBDDCB;border-radius:12px;padding:10px 16px;text-align:center;max-width:270px;">' +
                '<div style="font-size:10px;font-weight:800;color:#8B7355;letter-spacing:1px;text-transform:uppercase;">HINT</div>' +
                '<div style="font-size:12px;font-weight:600;color:#2C1810;margin-top:2px;">Look for balanced warm undertones with golden radiance.</div>' +
              '</div>' +
            '</div>';

          const dot = document.getElementById("shade-selection-dot");
          arena.querySelectorAll(".shade-slot").forEach(slot => {
            slot.onclick = () => {
              const num = parseInt(slot.getAttribute("data-num"), 10);
              const sw = swatches.find(s => s.num === num);

              dot.style.opacity = "1";
              dot.style.background = sw.correct ? "#4CAF50" : "#E53935";

              if (sw.correct) {
                recordResult(true, "5% OFF Coupon");
                showGameToast("✨ Perfect Match! Undertone identified.");
                setTimeout(() => {
                  showResultModal(true, "MATCH FOUND!", "Correct! Swatch #2 is Warm Medium. You qualify for the 6-winner draw with a 5% OFF Coupon!", "5% OFF Coupon", launchGame4);
                }, 600);
              } else {
                slot.classList.add("shake-anim");
                showGameToast("❌ Swatch #" + num + " is not Warm Medium.");
                setTimeout(() => {
                  slot.classList.remove("shake-anim");
                  dot.style.opacity = "0";
                }, 600);
              }
            };
          });
        }

        // ============================================================
        // GAME 5: MIRROR MATCH (Slide 7 6-Card Memory Flip Game)
        // ============================================================
        function launchGame5() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "FIND 3 MATCHING PAIRS";
          actionBtn.disabled = true;

          let cards = [
            { id: 1, pair: "LIP", icon: "💄", name: "Lip Color" },
            { id: 2, pair: "COMPACT", icon: "✨", name: "Compact" },
            { id: 3, pair: "SERUM", icon: "🌟", name: "Glow Serum" },
            { id: 4, pair: "LIP", icon: "💄", name: "Lip Color" },
            { id: 5, pair: "COMPACT", icon: "✨", name: "Compact" },
            { id: 6, pair: "SERUM", icon: "🌟", name: "Glow Serum" }
          ];

          cards.sort(() => Math.random() - 0.5);

          arena.innerHTML = 
            '<div style="width:100%;height:100%;padding:18px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
              '<div style="display:flex;justify-content:space-between;width:100%;max-width:270px;margin-bottom:12px;">' +
                '<span style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8B7355;">MATCH BEAUTY PAIRS</span>' +
                '<span id="mirror-timer" style="font-size:11px;font-weight:800;color:#6B2237;">0.0s</span>' +
              '</div>' +
              
              '<div id="mirror-grid" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;width:100%;max-width:270px;">' +
                cards.map((c, i) => 
                  '<div class="mirror-card" data-idx="' + i + '" data-pair="' + c.pair + '" style="perspective:600px;height:95px;cursor:pointer;">' +
                    '<div class="mirror-inner" style="width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform 0.35s ease;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.08);">' +
                      '<!-- Card Back (Vanity) -->' +
                      '<div style="position:absolute;inset:0;backface-visibility:hidden;background:#6B2237;border:2px solid #B8860B;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:24px;font-weight:800;">?</div>' +
                      '<!-- Card Front (Product) -->' +
                      '<div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);background:#FFFFFF;border:2px solid #EBDDCB;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;">' +
                        '<div style="font-size:26px;">' + c.icon + '</div>' +
                        '<div style="font-size:9px;font-weight:800;color:#2C1810;margin-top:2px;">' + c.name + '</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>'
                ).join('') +
              '</div>' +
            '</div>';

          let flipped = [];
          let matchedCount = 0;
          let timerStarted = false;
          let startTime = 0;
          let timerInterval = null;
          const timerEl = document.getElementById("mirror-timer");

          arena.querySelectorAll(".mirror-card").forEach(card => {
            card.onclick = () => {
              if (flipped.length >= 2 || card.classList.contains("matched") || card.classList.contains("is-flipped")) return;

              if (!timerStarted) {
                timerStarted = true;
                startTime = Date.now();
                timerInterval = setInterval(() => {
                  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                  timerEl.textContent = elapsed + "s";
                }, 100);
              }

              const inner = card.querySelector(".mirror-inner");
              inner.style.transform = "rotateY(180deg)";
              card.classList.add("is-flipped");
              flipped.push(card);

              if (flipped.length === 2) {
                const pair1 = flipped[0].getAttribute("data-pair");
                const pair2 = flipped[1].getAttribute("data-pair");

                if (pair1 === pair2) {
                  flipped[0].classList.add("matched");
                  flipped[1].classList.add("matched");
                  flipped[0].querySelector(".mirror-inner").style.boxShadow = "0 0 14px rgba(184,134,11,0.6)";
                  flipped[1].querySelector(".mirror-inner").style.boxShadow = "0 0 14px rgba(184,134,11,0.6)";
                  matchedCount++;
                  flipped = [];

                  if (matchedCount === 3) {
                    clearInterval(timerInterval);
                    const finalSec = ((Date.now() - startTime) / 1000).toFixed(1);
                    recordResult(true, "10% OFF Coupon");
                    setTimeout(() => {
                      showResultModal(true, "BOARD CLEARED!", "Matched in " + finalSec + "s! You qualified for the Fastest 6 Leaderboard with a 10% OFF Coupon!", "10% OFF Coupon", launchGame5);
                    }, 500);
                  }
                } else {
                  setTimeout(() => {
                    flipped.forEach(c => {
                      c.querySelector(".mirror-inner").style.transform = "rotateY(0deg)";
                      c.classList.remove("is-flipped");
                    });
                    flipped = [];
                  }, 650);
                }
              }
            };
          });
        }

        // ============================================================
        // GAME 6: TAP THE SPARKLE (Speed Test)
        // ============================================================
        function launchGame6() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "START 10s SPEED TEST";
          actionBtn.disabled = false;

          let score = 0;
          let timeLeft = 10;
          let running = false;

          arena.innerHTML = 
            '<div style="position:relative;width:100%;height:100%;">' +
              '<div style="position:absolute;top:12px;left:16px;right:16px;display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:#6B2237;">' +
                '<span id="spk-score">SCORE: 0</span>' +
                '<span id="spk-timer">10s</span>' +
              '</div>' +
              '<div id="spk-box" style="position:absolute;inset:40px 10px 10px;overflow:hidden;"></div>' +
            '</div>';

          actionBtn.onclick = function() {
            if (running) return;
            running = true;
            actionBtn.disabled = true;
            actionBtn.textContent = "TAP EVERY STAR!";

            const box = document.getElementById("spk-box");
            const scoreEl = document.getElementById("spk-score");
            const timerEl = document.getElementById("spk-timer");

            const timerInt = setInterval(() => {
              timeLeft--;
              timerEl.textContent = timeLeft + "s";
              if (timeLeft <= 0) {
                clearInterval(timerInt);
                clearInterval(spawner);
                running = false;
                const won = score >= 60;
                let prize = "5% OFF Coupon";
                if (score >= 100) prize = "Free Gift - Stellar Eyeliner";
                else if (score >= 80) prize = "₹100 OFF Coupon";
                recordResult(won, won ? prize : null);
                showResultModal(won, won ? "SPEED CHAMPION!" : "TIME UP!", "Final Score: " + score + (won ? ". Top 6 scores win: " + prize : ". Aim for 60+ next time!"), prize, launchGame6);
              }
            }, 1000);

            const spawner = setInterval(() => {
              const star = document.createElement("div");
              const isGolden = Math.random() < 0.25;
              const x = 12 + Math.random() * 76;
              const y = 12 + Math.random() * 76;
              star.style.cssText = "position:absolute;left:" + x + "%;top:" + y + "%;transform:translate(-50%,-50%);font-size:32px;cursor:pointer;user-select:none;animation:fadeIn 0.2s;";
              star.textContent = isGolden ? "⭐" : "✦";
              star.style.color = isGolden ? "#FFD700" : "#B8860B";

              star.onclick = () => {
                score += isGolden ? 30 : 10;
                scoreEl.textContent = "SCORE: " + score;
                star.remove();
              };

              box.appendChild(star);
              setTimeout(() => { if (star.parentNode) star.remove(); }, 800);
            }, 300);
          };
        }

        // ============================================================
        // GAME 7: BIRTHDAY BALLOON POP (Slide 9 18 Oct Birthday Special)
        // ============================================================
        function launchGame7() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "TAP ANY BALLOON TO POP";
          actionBtn.disabled = true;

          const balloons = [
            { num: 1, x: 65, y: 110, color: "#E89AA8", prize: "5% OFF Coupon" },
            { num: 2, x: 170, y: 85, color: "#D4B860", prize: "10% OFF Coupon" },
            { num: 3, x: 275, y: 110, color: "#C090C0", prize: "₹50 OFF Coupon" },
            { num: 4, x: 85, y: 215, color: "#E09060", prize: "₹100 OFF Coupon" },
            { num: 5, x: 190, y: 235, color: "#90A4D4", prize: "Free Gift - Stellar Eyeliner" },
            { num: 6, x: 275, y: 205, color: "#D07090", prize: "Cart On Us Entry (Max ₹1,500)" },
          ];

          let svgHtml = '<svg width="100%" height="280" viewBox="0 0 340 280" style="display:block;">';
          balloons.forEach(b => {
            svgHtml += '<g class="balloon-node" data-num="' + b.num + '" data-prize="' + b.prize + '" transform="translate(' + b.x + ',' + b.y + ')" style="cursor:pointer;">' +
              '<line x1="0" y1="26" x2="0" y2="65" stroke="#8B7355" stroke-width="1.5"/>' +
              '<ellipse cx="0" cy="0" rx="25" ry="30" fill="' + b.color + '" stroke="#2C1810" stroke-width="1.5"/>' +
              '<text x="0" y="6" text-anchor="middle" fill="#fff" font-size="16" font-weight="800">' + b.num + '</text>' +
            '</g>';
          });
          svgHtml += '</svg>';

          arena.innerHTML = 
            '<div style="width:100%;height:100%;padding:16px;display:flex;flex-direction:column;align-items:center;">' +
              '<div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#8B7355;margin-bottom:6px;">6 YEARS • 6 HOURLY DROPS</div>' +
              svgHtml +
              '<div style="background:#6B2237;color:#fff;border-radius:14px;padding:12px 18px;width:100%;text-align:center;margin-top:6px;">' +
                '<div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">BIRTHDAY EXCEPTION</div>' +
                '<div style="font-size:13px;font-weight:800;">TRULY FREE GIFTS + 6 CARTS ON US</div>' +
              '</div>' +
            '</div>';

          arena.querySelectorAll(".balloon-node").forEach(b => {
            b.onclick = () => {
              const num = b.getAttribute("data-num");
              const prize = b.getAttribute("data-prize");
              b.style.opacity = "0.2";
              recordResult(true, prize);
              showResultModal(true, "BALLOON #" + num + " POPPED!", "Birthday surprise unlocked: " + prize + " (No purchase required to claim today's hourly gift!)", prize, launchGame7);
            };
          });
        }

        // ============================================================
        // GAME 8: SCRATCH AND WIN CARD GAME (Slide 10 Interactive Canvas)
        // ============================================================
        function launchGame8() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "SCRATCH CARD TO REVEAL";
          actionBtn.disabled = true;

          const prizes = ["10% OFF Coupon", "₹100 OFF Coupon", "Free Gift - Stellar Eyeliner", "5% OFF Coupon"];
          const selectedPrize = prizes[Math.floor(Math.random() * prizes.length)];

          arena.innerHTML = 
            '<div style="width:100%;height:100%;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
              '<div style="position:relative;width:240px;height:220px;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(107,34,55,0.2);">' +
                '<div style="position:absolute;inset:0;background:#6B2237;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;text-align:center;color:#FFFFFF;">' +
                  '<div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#F4EAD5;margin-bottom:6px;">★ CARNIVAL REWARD ★</div>' +
                  '<div style="font-size:24px;font-weight:800;color:#FFD700;line-height:1.2;text-shadow:0 2px 8px rgba(0,0,0,0.3);">' + selectedPrize.replace(" Coupon", "") + '</div>' +
                  '<div style="font-size:10px;font-weight:700;color:#F4EAD5;margin-top:6px;opacity:0.9;">UNLOCKED TODAY</div>' +
                '</div>' +
                '<canvas id="scratch-canvas" width="240" height="220" style="position:absolute;inset:0;cursor:crosshair;touch-action:none;"></canvas>' +
              '</div>' +

              '<div style="margin-top:14px;background:#FFFFFF;border:1px solid #EBDDCB;border-radius:12px;padding:8px 12px;display:flex;gap:6px;align-items:center;">' +
                '<span style="font-size:9px;font-weight:800;background:#F7EFE2;padding:3px 8px;border-radius:6px;color:#6B2237;">5%</span>' +
                '<span style="font-size:9px;font-weight:800;background:#F7EFE2;padding:3px 8px;border-radius:6px;color:#6B2237;">10%</span>' +
                '<span style="font-size:9px;font-weight:800;background:#F7EFE2;padding:3px 8px;border-radius:6px;color:#6B2237;">₹50</span>' +
                '<span style="font-size:9px;font-weight:800;background:#F7EFE2;padding:3px 8px;border-radius:6px;color:#6B2237;">₹100</span>' +
                '<span style="font-size:9px;font-weight:800;background:#6B2237;color:#fff;padding:3px 8px;border-radius:6px;">GIFT</span>' +
              '</div>' +
              '<div style="font-size:9px;font-weight:700;color:#8B7355;margin-top:6px;">Drag to scratch and reveal today\'s reward</div>' +
            '</div>';

          const cvs = document.getElementById("scratch-canvas");
          const ctx = cvs.getContext("2d");

          const grad = ctx.createLinearGradient(0, 0, 240, 220);
          grad.addColorStop(0, "#D8C7B5");
          grad.addColorStop(0.5, "#EDE1D1");
          grad.addColorStop(1, "#C9B59F");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 240, 220);

          ctx.fillStyle = "#6B2237";
          ctx.font = "bold 14px DM Sans, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("★ SCRATCH & WIN ★", 120, 100);
          ctx.font = "11px DM Sans, sans-serif";
          ctx.fillStyle = "#8B7355";
          ctx.fillText("RUB HERE TO REVEAL", 120, 126);

          let isScratching = false;
          let scratchedPixels = 0;
          let revealed = false;

          function scratch(e) {
            if (!isScratching || revealed) return;
            const rect = cvs.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.arc(x, y, 22, 0, Math.PI * 2);
            ctx.fill();

            scratchedPixels += 1;
            if (scratchedPixels > 45) {
              revealed = true;
              cvs.style.transition = "opacity 0.4s ease";
              cvs.style.opacity = "0";
              recordResult(true, selectedPrize);
              setTimeout(() => {
                showResultModal(true, "CARD REVEALED!", "You scratched and uncovered: " + selectedPrize + "!", selectedPrize, launchGame8);
              }, 500);
            }
          }

          cvs.onmousedown = (e) => { isScratching = true; scratch(e); };
          cvs.onmousemove = scratch;
          window.onmouseup = () => { isScratching = false; };

          cvs.ontouchstart = (e) => { isScratching = true; scratch(e); };
          cvs.ontouchmove = scratch;
          window.ontouchend = () => { isScratching = false; };
        }

        // ============================================================
        // GAME 9: BEAUTY WORD PUZZLE (Slide 11 Interactive Word Search)
        // ============================================================
        function launchGame9() {
          const arena = document.getElementById("game-arena");
          const actionBtn = document.getElementById("main-action-btn");
          actionBtn.textContent = "FIND BEAUTY WORDS";
          actionBtn.disabled = true;

          const gridLetters = [
            ['G','L','A','M','K','P'],
            ['S','H','I','N','E','R'],
            ['G','L','O','S','S','O'],
            ['X','W','L','I','P','D'],
            ['B','E','A','U','T','Y'],
            ['C','H','A','R','M','S']
          ];

          const targetWords = ["GLAM", "SHINE", "GLOSS", "LIP"];
          let foundWords = [];

          arena.innerHTML = 
            '<div style="width:100%;height:100%;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
              '<div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8B7355;margin-bottom:8px;">FIND 4 HIDDEN BEAUTY WORDS</div>' +
              
              '<div id="puzzle-grid" style="display:grid;grid-template-columns:repeat(6, 1fr);gap:5px;background:#FFFFFF;border:2px solid #EBDDCB;border-radius:14px;padding:8px;box-shadow:0 4px 14px rgba(0,0,0,0.06);margin-bottom:12px;">' +
                gridLetters.map((row, r) => 
                  row.map((char, c) => 
                    '<button class="puzzle-cell" data-r="' + r + '" data-c="' + c + '" data-char="' + char + '" style="width:36px;height:36px;background:#FDFBF7;border:1px solid #F0E6D8;border-radius:8px;font-size:14px;font-weight:800;color:#2C1810;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;">' + char + '</button>'
                  ).join('')
                ).join('') +
              '</div>' +

              '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:280px;">' +
                targetWords.map(w => 
                  '<span class="word-pill" id="word-' + w + '" style="font-size:10px;font-weight:800;background:#FFFFFF;border:1px solid #EBDDCB;color:#6B2237;padding:5px 10px;border-radius:12px;letter-spacing:1px;">' + w + '</span>'
                ).join('') +
              '</div>' +
            '</div>';

          let selectedCells = [];
          const cells = arena.querySelectorAll(".puzzle-cell");

          cells.forEach(cell => {
            cell.onclick = () => {
              if (cell.classList.contains("permanently-found")) return;

              const char = cell.getAttribute("data-char");
              cell.style.background = "#6B2237";
              cell.style.color = "#FFFFFF";
              selectedCells.push(cell);

              const currentString = selectedCells.map(c => c.getAttribute("data-char")).join("");

              const matchedWord = targetWords.find(w => w === currentString && !foundWords.includes(w));
              if (matchedWord) {
                foundWords.push(matchedWord);
                const pill = document.getElementById("word-" + matchedWord);
                if (pill) {
                  pill.style.background = "#4CAF50";
                  pill.style.color = "#FFFFFF";
                  pill.style.borderColor = "#4CAF50";
                  pill.style.textDecoration = "line-through";
                }
                selectedCells.forEach(c => {
                  c.classList.add("permanently-found");
                  c.style.background = "#FFD700";
                  c.style.color = "#2C1810";
                  c.style.fontWeight = "900";
                });
                selectedCells = [];
                showGameToast("✨ Word Found: " + matchedWord + "!");

                if (foundWords.length === targetWords.length) {
                  recordResult(true, "10% OFF Coupon");
                  setTimeout(() => {
                    showResultModal(true, "PUZZLE SOLVED!", "You found all 4 beauty words! Top 6 fastest completions win 10% OFF Coupon or Stellar Eyeliner!", "10% OFF Coupon", launchGame9);
                  }, 500);
                }
              } else if (selectedCells.length >= 6) {
                setTimeout(() => {
                  selectedCells.forEach(c => {
                    if (!c.classList.contains("permanently-found")) {
                      c.style.background = "#FDFBF7";
                      c.style.color = "#2C1810";
                    }
                  });
                  selectedCells = [];
                }, 300);
              }
            };
          });
        }

        // ============================================================
        // GAME SWITCHER CONTROLLER
        // ============================================================
        const LAUNCHERS = [null, launchGame1, launchGame2, launchGame3, launchGame4, launchGame5, launchGame6, launchGame7, launchGame8, launchGame9];

        function switchGame(id) {
          if (activeAnimationId) {
            cancelAnimationFrame(activeAnimationId);
            activeAnimationId = null;
          }

          currentGameId = id;
          const data = GAMES_DATA.find(g => g.id === id);

          // Update Slide Header
          document.getElementById("slide-date-display").textContent = data.date;
          document.getElementById("slide-title-display").textContent = data.title;
          document.getElementById("slide-tagline-display").textContent = data.tagline;
          const typeBadge = document.getElementById("slide-type-display");
          typeBadge.textContent = data.type;
          typeBadge.style.background = data.color;

          // Update Info Cards
          document.getElementById("info-how-it-works").textContent = data.howItWorks;
          document.getElementById("info-winner-logic").textContent = data.winnerLogic;
          document.getElementById("info-proposed-prizes").textContent = data.prizes;
          document.getElementById("info-claim-logic").textContent = data.claimLogic;
          document.getElementById("info-why-earns").textContent = data.whyEarns;
          document.getElementById("info-guardrail").textContent = data.guardrail;

          // Update Phone Header
          document.getElementById("phone-game-title").textContent = data.title;

          // Update Tab Active State
          document.querySelectorAll(".game-tab-btn").forEach(btn => {
            const btnId = parseInt(btn.getAttribute("data-id"), 10);
            if (btnId === id) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
          });

          // Launch Game Canvas
          LAUNCHERS[id]();
        }

        // Render Tabs
        const tabsContainer = document.getElementById("game-tabs-container");
        GAMES_DATA.forEach(g => {
          const btn = document.createElement("button");
          btn.className = "game-tab-btn" + (g.id === currentGameId ? " active" : "");
          btn.setAttribute("data-id", g.id);
          btn.textContent = g.tabName;
          btn.onclick = () => switchGame(g.id);
          tabsContainer.appendChild(btn);
        });

        // Initialize First Game
        switchGame(currentGameId);
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "application/liquid" },
  });
};
