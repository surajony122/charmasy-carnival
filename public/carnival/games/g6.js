/* Game 6 — Tap the Sparkle: beat the score of 50 in 10 seconds */
window.CarnivalGames[6] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var BEAT = 50, TIME = 10, PTS = 3, GOLD = 9, COMBO = 15;
  var KINDS = ["💄", "🧴", "💅", "🪞"];

  var bubbles = [], pops = [], parts = [];
  var score = 0, left = TIME, started = false, over = false, spawnT = 0, streakKind = null, streak = 0, comboFlash = 0;

  function spawn() {
    var gold = Math.random() < 0.13;
    bubbles.push({
      x: C.rand(34, W - 34), y: H + 40, vy: C.rand(150, 235), r: (gold ? 30 : 28) * (C.land ? 1.2 : 1),
      e: gold ? "✨" : C.pick(KINDS), gold: gold, ph: C.rand(0, 6), amp: C.rand(8, 22)
    });
  }

  function burst(x, y, col) {
    for (var i = 0; i < 12; i++) parts.push({ x: x, y: y, vx: C.rand(-120, 120), vy: C.rand(-140, 60), t: 0, c: col, r: C.rand(2, 4.5) });
  }

  function hit(p) {
    var x = p.pt.x, y = p.pt.y, best = null, bd = 1e9;
    bubbles.forEach(function (b) {
      var bx = b.x + Math.sin(b.ph) * b.amp, d = Math.hypot(bx - x, b.y - y);
      if (d < b.r + 14 && d < bd) { bd = d; best = b; }
    });
    if (!best) return;
    best.dead = true;
    var bx2 = best.x + Math.sin(best.ph) * best.amp, add = best.gold ? GOLD : PTS;
    if (best.gold) { streakKind = null; streak = 0; }
    else if (best.e === streakKind) streak++; else { streakKind = best.e; streak = 1; }
    if (streak >= 5) { add += COMBO; streak = 0; streakKind = null; comboFlash = 1.2; pops.push({ x: W / 2, y: 190, t: 0, txt: "COMBO! +" + COMBO, c: "#ffc93c", big: true }); }
    score += add;
    pops.push({ x: bx2, y: best.y, t: 0, txt: "+" + (best.gold ? GOLD : PTS), c: best.gold ? "#ffc93c" : "#ffffff" });
    burst(bx2, best.y, best.gold ? "#ffc93c" : "#ff8fb8");
  }

  C.on(cvs.cv, "pointerdown", function (e) {
    if (over) return;
    var p = { pt: cvs.pt(e) };
    if (!started) { started = true; return; }
    hit(p);
  });

  function end() {
    over = true;
    var won = score > BEAT;
    C.timeout(function () {
      if (won) C.winOrNot({ title: "New high score!", icon: "✨", msg: "You scored " + score + " and beat " + BEAT + "!" });
      else C.result({ won: false, title: "So close!", icon: "✨", msg: "You scored " + score + ". Beat " + BEAT + " to win — try again!" });
    }, 700);
  }

  function pill(x, y, w, txt, fill) {
    ctx.fillStyle = "rgba(0,0,0,.18)"; D.rr(ctx, x, y + 3, w, 28, 14); ctx.fill();
    ctx.fillStyle = fill || D.lin(ctx, 0, y, 0, y + 28, [[0, "#fff"], [1, "#ffe3ee"]]); D.rr(ctx, x, y, w, 28, 14); ctx.fill();
    ctx.fillStyle = "#a10f4d"; ctx.font = "700 14px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, x + w / 2, y + 15);
  }

  C.raf(function (dt, time) {
    if (started && !over) {
      left -= dt;
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = C.rand(0.2, 0.34) * (C.land ? 0.55 : 1); }
      if (left <= 0) { left = 0; end(); }
    }
    if (comboFlash > 0) comboFlash -= dt;
    bubbles.forEach(function (b) { b.y -= b.vy * dt; b.ph += dt * 3; if (b.y < -50) b.dead = true; });
    bubbles = bubbles.filter(function (b) { return !b.dead; });
    pops.forEach(function (p) { p.t += dt; }); pops = pops.filter(function (p) { return p.t < 0.8; });
    parts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }); parts = parts.filter(function (p) { return p.t < 0.6; });

    ctx.clearRect(0, 0, W, H);
    D.carnivalBg(ctx, time);
    D.bunting(ctx);

    // bubbles: glassy sphere + product
    bubbles.forEach(function (b) {
      var x = b.x + Math.sin(b.ph) * b.amp, y = b.y;
      D.shadow(ctx, x + 4, y + b.r + 10, b.r * 0.8, 5, 0.18);
      var g = ctx.createRadialGradient(x - b.r * 0.35, y - b.r * 0.4, 3, x, y, b.r);
      g.addColorStop(0, b.gold ? "rgba(255,244,170,.95)" : "rgba(255,255,255,.9)");
      g.addColorStop(0.6, b.gold ? "rgba(255,201,60,.55)" : "rgba(255,200,225,.45)");
      g.addColorStop(1, b.gold ? "rgba(214,150,0,.75)" : "rgba(225,29,99,.45)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = (b.gold ? 32 : 28) + "px " + EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.e, x, y + 2);
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(x - b.r * 0.4, y - b.r * 0.5, b.r * 0.2, b.r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    });
    parts.forEach(function (p) { ctx.globalAlpha = 1 - p.t / 0.6; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; });
    pops.forEach(function (p) {
      ctx.globalAlpha = 1 - p.t / 0.8; ctx.fillStyle = p.c; ctx.font = "700 " + (p.big ? 30 : 20) + "px Fredoka, sans-serif"; ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(80,0,40,.7)"; ctx.lineWidth = 3; ctx.strokeText(p.txt, p.x, p.y - p.t * 50); ctx.fillText(p.txt, p.x, p.y - p.t * 50); ctx.globalAlpha = 1;
    });

    // HUD
    pill(12, 38, 112, "SCORE " + score);
    pill(W / 2 - 52, 38, 104, "⏱ " + Math.ceil(left));
    pill(W - 124, 38, 112, "TO BEAT " + BEAT, "#fff3c4");
    // progress to beat
    var bw = Math.min(520, W - 60), bx = (W - bw) / 2, by = 80;
    ctx.fillStyle = "rgba(0,0,0,.2)"; D.rr(ctx, bx, by, bw, 12, 6); ctx.fill();
    var pr = Math.min(1, score / (BEAT * 2));
    ctx.fillStyle = score > BEAT ? "#3ddc84" : "#ffc93c"; if (pr > 0) { D.rr(ctx, bx, by, Math.max(12, bw * pr), 12, 6); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.fillRect(bx + bw / 2 - 1.5, by - 4, 3, 20);
    ctx.font = "700 10px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText("🏆 " + BEAT, bx + bw / 2, by + 26);
    // combo streak dots
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < streak ? "#ffc93c" : "rgba(255,255,255,.4)";
      ctx.beginPath(); ctx.arc(W / 2 - 32 + i * 16, 124, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "600 10px Fredoka, sans-serif"; ctx.fillText("5 same in a row = COMBO", W / 2, 140);

    if (!started) {
      ctx.fillStyle = "rgba(161,15,77,.92)"; D.rr(ctx, W / 2 - 150, H / 2 - 45, 300, 86, 22); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      ctx.font = "700 24px Fredoka, sans-serif"; ctx.fillText("TAP TO START", W / 2, H / 2 - 16);
      ctx.font = "500 13px Fredoka, sans-serif"; ctx.fillText("Pop products fast — beat " + BEAT + " points!", W / 2, H / 2 + 14);
    }
  });
};
