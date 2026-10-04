/* Game 3 — Catch My Charmacy: catch 10 masks in the basket */
window.CarnivalGames[3] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;
  var GOAL = 10, TIME = 30;
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  var basket = { x: 180, tx: 180, w: 96, y: 520, shake: 0 };
  var items = [], pops = [];
  var masks = 0, timeLeft = TIME, spawnT = 0.4, elapsed = 0, over = false, started = false;

  function spawn() {
    var good = Math.random() < 0.55;
    var kinds = ["🐉", "🎪", "🎡"];
    items.push({
      x: C.rand(30, W - 30), y: -30, vy: C.rand(130, 190) + elapsed * 3,
      e: good ? "🎭" : C.pick(kinds), good: good, rot: C.rand(-0.4, 0.4), vr: C.rand(-1.5, 1.5), s: 38
    });
  }

  function moveTo(e) { var p = cvs.pt(e); basket.tx = Math.max(basket.w / 2 + 6, Math.min(W - basket.w / 2 - 6, p.x)); started = true; }
  C.on(cvs.cv, "pointermove", moveTo);
  C.on(cvs.cv, "pointerdown", moveTo);
  var held = { l: false, r: false };
  C.on(window, "keydown", function (e) { if (e.key === "ArrowLeft") held.l = true; if (e.key === "ArrowRight") held.r = true; started = true; });
  C.on(window, "keyup", function (e) { if (e.key === "ArrowLeft") held.l = false; if (e.key === "ArrowRight") held.r = false; });

  function pop(x, y, txt, color) { pops.push({ x: x, y: y, t: 0, txt: txt, c: color }); }

  function end(won) {
    if (over) return; over = true;
    C.timeout(function () {
      if (won) C.result({ won: true, title: "10 masks!", icon: "🎭", msg: "You caught all 10 masks — what a catch!", prize: C.prize(C.weighted({ nia: 3, p5: 7 })) });
      else C.result({ won: false, title: "Time's up!", icon: "⏰", msg: "You caught " + masks + " of " + GOAL + " masks. Try again!" });
    }, 500);
  }

  function drawBasket() {
    var x = basket.x + (basket.shake > 0 ? Math.sin(basket.shake * 60) * 4 : 0), y = basket.y, w = basket.w, top = w / 2, bot = w / 2 - 14, h = 52;
    D.shadow(ctx, x, y + h + 6, w * 0.55, 8, 0.3);
    // handle
    ctx.strokeStyle = "#a10f4d"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y + 2, w * 0.4, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = "#ff8fb8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 2, w * 0.4, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    // inside back
    ctx.fillStyle = "#7a0c3a";
    ctx.beginPath(); ctx.ellipse(x, y, top, 11, 0, 0, Math.PI * 2); ctx.fill();
    // body: stripes clipped to a trapezoid
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x - top, y); ctx.lineTo(x + top, y); ctx.lineTo(x + bot, y + h); ctx.quadraticCurveTo(x, y + h + 12, x - bot, y + h); ctx.closePath(); ctx.clip();
    var cols = ["#ff5c97", "#ffc93c", "#14b8a6", "#ffffff", "#8b5cf6", "#ffc93c"], sw = w / cols.length;
    for (var i = 0; i < cols.length; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(x - top + i * sw, y, sw + 1, h + 14); }
    var sh = ctx.createLinearGradient(x - top, 0, x + top, 0);
    sh.addColorStop(0, "rgba(0,0,0,.28)"); sh.addColorStop(0.3, "rgba(255,255,255,.25)"); sh.addColorStop(0.55, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = sh; ctx.fillRect(x - top, y, w, h + 14);
    ctx.restore();
    // front rim
    ctx.fillStyle = D.lin(ctx, 0, y - 4, 0, y + 14, [[0, "#ffe9a8"], [1, "#e0a82a"]]);
    D.rr(ctx, x - top - 4, y - 3, w + 8, 14, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(x - top + 4, y - 1, w - 8, 2);
    // star badge
    ctx.font = "16px " + EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⭐", x, y + 32);
  }

  function hud() {
    function pill(x, y, w, txt) {
      ctx.fillStyle = "rgba(0,0,0,.18)"; D.rr(ctx, x, y + 3, w, 28, 14); ctx.fill();
      ctx.fillStyle = D.lin(ctx, 0, y, 0, y + 28, [[0, "#fff"], [1, "#ffe3ee"]]); D.rr(ctx, x, y, w, 28, 14); ctx.fill();
      ctx.fillStyle = "#a10f4d"; ctx.font = "700 15px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, x + w / 2, y + 15);
    }
    pill(12, 38, 120, "🎭 " + masks + " / " + GOAL);
    pill(W - 100, 38, 88, "⏱ " + Math.ceil(timeLeft));
    // progress dots
    for (var i = 0; i < GOAL; i++) {
      ctx.fillStyle = i < masks ? "#ffc93c" : "rgba(255,255,255,.55)";
      ctx.beginPath(); ctx.arc(W / 2 - 4.5 * 17 + i * 17, 84, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(161,15,77,.5)"; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  C.raf(function (dt, time) {
    if (!over) {
      if (started) { elapsed += dt; timeLeft -= dt; }
      var dir = (held.r ? 1 : 0) - (held.l ? 1 : 0);
      if (dir) basket.tx = Math.max(basket.w / 2 + 6, Math.min(W - basket.w / 2 - 6, basket.tx + dir * 280 * dt));
      basket.x += (basket.tx - basket.x) * Math.min(1, dt * 14);
      if (basket.shake > 0) basket.shake -= dt;
      if (started) {
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); spawnT = Math.max(0.42, 0.7 - elapsed * 0.006); }
      }
      items.forEach(function (it) {
        it.y += it.vy * dt; it.rot += it.vr * dt;
        if (!it.dead && it.y > basket.y - 6 && it.y < basket.y + 26 && Math.abs(it.x - basket.x) < basket.w / 2 - 4) {
          it.dead = true;
          if (it.good) { masks++; pop(it.x, basket.y - 10, "+1", "#ffc93c"); }
          else { masks = Math.max(0, masks - 1); basket.shake = 0.35; pop(it.x, basket.y - 10, "-1", "#ff4d6d"); }
          if (masks >= GOAL) end(true);
        }
        if (it.y > H + 40) it.dead = true;
      });
      items = items.filter(function (it) { return !it.dead; });
      if (timeLeft <= 0 && !over) { timeLeft = 0; end(false); }
    }
    pops.forEach(function (p) { p.t += dt; });
    pops = pops.filter(function (p) { return p.t < 0.8; });

    ctx.clearRect(0, 0, W, H);
    D.carnivalBg(ctx, time);
    D.bunting(ctx);
    // falling items with soft 3D shadow
    items.forEach(function (it) {
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
      ctx.shadowColor = "rgba(80,0,40,.45)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6;
      if (it.good) { ctx.shadowColor = "rgba(255,201,60,.9)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 0; }
      ctx.font = it.s + "px " + EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(it.e, 0, 0);
      ctx.restore();
    });
    drawBasket();
    pops.forEach(function (p) {
      ctx.globalAlpha = 1 - p.t / 0.8; ctx.fillStyle = p.c; ctx.font = "700 22px Fredoka, sans-serif"; ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(80,0,40,.7)"; ctx.lineWidth = 3; ctx.strokeText(p.txt, p.x, p.y - p.t * 60); ctx.fillText(p.txt, p.x, p.y - p.t * 60); ctx.globalAlpha = 1;
    });
    hud();
    if (!started && !over) {
      ctx.fillStyle = "rgba(161,15,77,.9)"; D.rr(ctx, 40, 300, 280, 70, 20); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 20px Fredoka, sans-serif"; ctx.fillText("Drag to start!", 180, 322);
      ctx.font = "500 13px Fredoka, sans-serif"; ctx.fillText("Catch 10 masks 🎭 — dodge the rest", 180, 348);
    }
  });
};
