/* Game 7 — Birthday Balloon Pop: balloons never stop moving; find the lucky one in 3 pops */
window.CarnivalGames[7] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;
  var COLORS = ["#ff2d6f", "#ffc93c", "#14b8a6", "#8b5cf6", "#3b82f6", "#ff7a1a", "#84cc16", "#ec4899", "#06b6d4", "#ef4444"];
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var pops = 3, over = false, bursts = [], texts = [];

  var balloons = [];
  for (var i = 0; i < 10; i++) {
    var z = C.rand(0.7, 1.15);
    balloons.push({
      x: C.rand(40, W - 40), y: C.rand(130, H - 20), z: z, r: 30 * z,
      vy: C.rand(24, 46) * (0.8 + z * 0.4), ph: C.rand(0, 6), sw: C.rand(10, 26), sp: C.rand(0.8, 1.6),
      c: COLORS[i % COLORS.length], lucky: false, dead: false
    });
  }
  C.pick(balloons).lucky = true;

  function burst(b) {
    for (var k = 0; k < 26; k++) {
      var a = C.rand(0, Math.PI * 2), s = C.rand(60, 220);
      bursts.push({ x: b.px, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, c: k % 3 ? b.c : "#ffffff", r: C.rand(2, 6), rot: C.rand(0, 6) });
    }
  }

  function end(won) {
    over = true;
    C.timeout(function () {
      if (won) C.result({ won: true, title: "Lucky balloon!", icon: "🎈", msg: "You popped the birthday surprise!", prize: C.prize(C.weighted({ nia: 3, p5: 4, p10: 3 })) });
      else C.result({ won: false, title: "No more pops!", icon: "🎈", msg: "The lucky balloon got away. Try again!" });
    }, 900);
  }

  C.on(cvs.cv, "pointerdown", function (e) {
    if (over) return;
    var p = cvs.pt(e), best = null, bd = 1e9;
    balloons.forEach(function (b) {
      if (b.dead) return;
      var d = Math.hypot(b.px - p.x, (b.y - p.y) * 0.85);
      if (d < b.r * 1.25 && d < bd) { bd = d; best = b; }
    });
    if (!best) return;
    best.dead = true; pops--; burst(best);
    if (best.lucky) { texts.push({ x: best.px, y: best.y, t: 0, s: "🎁 LUCKY!", c: "#ffc93c" }); end(true); }
    else {
      texts.push({ x: best.px, y: best.y, t: 0, s: "Empty!", c: "#ffffff" });
      if (pops <= 0) end(false);
    }
  });

  C.raf(function (dt, time) {
    balloons.forEach(function (b) {
      if (b.dead) return;
      b.y -= b.vy * dt; b.ph += dt * b.sp;
      b.px = b.x + Math.sin(b.ph) * b.sw;
      if (b.y < -80) { b.y = H + 70; b.x = C.rand(40, W - 40); }
    });
    bursts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.rot += dt * 8; });
    bursts = bursts.filter(function (p) { return p.t < 1; });
    texts.forEach(function (t) { t.t += dt; }); texts = texts.filter(function (t) { return t.t < 1; });

    ctx.clearRect(0, 0, W, H);
    D.carnivalBg(ctx, time);
    D.bunting(ctx);

    balloons.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (b) {
      if (b.dead) return;
      var x = b.px, y = b.y, r = b.r, wob = Math.sin(b.ph * 1.3) * 0.06;
      // string (curvy)
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x, y + r * 1.4);
      ctx.bezierCurveTo(x - 10 * Math.sin(b.ph), y + r * 1.4 + 22, x + 12 * Math.sin(b.ph + 1), y + r * 1.4 + 44, x + 2, y + r * 1.4 + 70); ctx.stroke();
      D.shadow(ctx, x + r * 0.3, y + r * 1.9, r * 0.5, 4, 0.0);
      ctx.save(); ctx.translate(x, y); ctx.rotate(wob); ctx.translate(-x, -y);
      D.balloon(ctx, x, y, r, b.c, 1 + Math.sin(b.ph * 2) * 0.015);
      ctx.restore();
    });

    bursts.forEach(function (p) {
      ctx.globalAlpha = 1 - p.t; ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); ctx.globalAlpha = 1;
    });
    texts.forEach(function (t) {
      ctx.globalAlpha = 1 - t.t; ctx.font = "700 24px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = t.c;
      ctx.strokeStyle = "rgba(80,0,40,.8)"; ctx.lineWidth = 4; ctx.strokeText(t.s, t.x, t.y - t.t * 50); ctx.fillText(t.s, t.x, t.y - t.t * 50); ctx.globalAlpha = 1;
    });

    // HUD
    ctx.fillStyle = "rgba(0,0,0,.18)"; D.rr(ctx, W / 2 - 100, 41, 200, 30, 15); ctx.fill();
    ctx.fillStyle = D.lin(ctx, 0, 38, 0, 68, [[0, "#fff"], [1, "#ffe3ee"]]); D.rr(ctx, W / 2 - 100, 38, 200, 30, 15); ctx.fill();
    ctx.fillStyle = "#a10f4d"; ctx.font = "700 14px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎈 Find the lucky one · " + pops + " pop" + (pops === 1 ? "" : "s") + " left", W / 2, 54);
  });
};
