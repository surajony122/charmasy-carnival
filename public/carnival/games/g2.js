/* Game 2 — Spin the Glam Wheel */
window.CarnivalGames[2] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;
  var LAND = C.land;
  var R = LAND ? 186 : 128, RIM = LAND ? 20 : 15, CX = LAND ? W * 0.37 : 180, CY = LAND ? H * 0.5 - 4 : 300, K = R / 128;

  // The wheel shows the prizes this game can really give (set in the app's admin), with "try again" between.
  var O = C.outcome;
  var shown = (O.prizes && O.prizes.length) ? O.prizes : [{ label: "5% OFF Coupon", short: "5%", kind: "PERCENT" }];
  var WIN_COLORS = [["#ffc93c", "#7a4a00"], ["#ff5c97", "#ffffff"], ["#14b8a6", "#ffffff"], ["#8b5cf6", "#ffffff"]];
  var LOSE = [{ l: ["TRY", "AGAIN"], icon: "💫", c: "#ffffff" }, { l: ["TRY", "AGAIN"], icon: "💫", c: "#ffe3ee" }, { l: ["TRY", "AGAIN"], icon: "💫", c: "#ffffff" }, { l: ["OH", "NO!"], icon: "🙈", c: "#ffe3ee" }];
  var SEGS = [];
  for (var wi = 0; wi < 4; wi++) {
    var wp = shown[wi % shown.length], gift = wp.kind === "FREE_PRODUCT";
    SEGS.push({ l: [wp.short, gift ? "GIFT" : "OFF"], icon: gift ? "🎁" : "", c: WIN_COLORS[wi][0], t: WIN_COLORS[wi][1], win: true, label: wp.label });
    var lo = LOSE[wi]; SEGS.push({ l: lo.l, icon: lo.icon, c: lo.c, t: "#a10f4d", win: false });
  }
  var SA = Math.PI * 2 / SEGS.length;
  var theta = 0, spinning = false, spinT = 0, spinDur = 5.2, from = 0, to = 0, target = 0, finished = false;

  // The server already decided this play. Land on a slice that matches it.
  function chooseSegment() {
    var pool = [];
    SEGS.forEach(function (s, i) {
      if (O.win ? (s.win && O.prize && s.label === O.prize.label) : !s.win) pool.push(i);
    });
    if (!pool.length) SEGS.forEach(function (s, i) { if (s.win === !!O.win) pool.push(i); });
    return C.pick(pool);
  }

  var btn = C.el("button", "btn3d spin-btn", "SPIN!");
  btn.style.cssText = LAND
    ? "position:absolute;left:" + Math.round(W * 0.8) + "px;top:" + Math.round(H * 0.5) + "px;transform:translate(-50%,-50%);min-width:210px;font-size:32px;padding:20px 38px;z-index:6;letter-spacing:3px"
    : "position:absolute;left:50%;bottom:26px;transform:translateX(-50%);min-width:170px;font-size:24px;padding:14px 30px;z-index:6;letter-spacing:2px";
  C.root.appendChild(btn);

  function start() {
    if (spinning || finished) return;
    spinning = true; spinT = 0; btn.disabled = true; btn.textContent = "…";
    target = chooseSegment();
    from = theta;
    var jitter = (Math.random() - 0.5) * SA * 0.6;
    var want = -((target + 0.5) * SA) + jitter;
    var delta = (((want - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    to = from + Math.PI * 2 * 5 + delta;
  }
  btn.onclick = start;

  function drawWheel(time, tilt) {
    // stand + base
    D.shadow(ctx, CX, CY + R + 52, 120, 16, 0.32);
    ctx.fillStyle = D.lin(ctx, CX - 70, 0, CX + 70, 0, [[0, "#b0124f"], [0.5, "#ff7fae"], [1, "#a10f4d"]]);
    ctx.beginPath(); ctx.moveTo(CX - 26, CY + 10); ctx.lineTo(CX + 26, CY + 10); ctx.lineTo(CX + 78, CY + R + 52); ctx.lineTo(CX - 78, CY + R + 52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = D.lin(ctx, 0, CY + R + 40, 0, CY + R + 62, [[0, "#ffd45a"], [1, "#c79a1a"]]);
    D.rr(ctx, CX - 92, CY + R + 42, 184, 20, 10); ctx.fill();

    // wheel drop shadow
    D.shadow(ctx, CX + 6, CY + R + 8, R * 0.9, 14, 0.25);
    // outer rim (3D thickness)
    ctx.fillStyle = "#7a4a00"; ctx.beginPath(); ctx.arc(CX, CY + 7, R + RIM, 0, Math.PI * 2); ctx.fill();
    var rg = ctx.createLinearGradient(CX - R, CY - R, CX + R, CY + R);
    rg.addColorStop(0, "#fff0a8"); rg.addColorStop(0.5, "#ffc93c"); rg.addColorStop(1, "#b37a00");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(CX, CY, R + RIM, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a5a00"; ctx.beginPath(); ctx.arc(CX, CY, R + 2, 0, Math.PI * 2); ctx.fill();

    // segments
    for (var i = 0; i < SEGS.length; i++) {
      var a0 = theta + i * SA - Math.PI / 2, a1 = a0 + SA, s = SEGS[i];
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.arc(CX, CY, R, a0, a1); ctx.closePath();
      var g = ctx.createRadialGradient(CX, CY, 8, CX, CY, R);
      g.addColorStop(0, D.shade(s.c, 0.25)); g.addColorStop(1, D.shade(s.c, -0.12));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.stroke();
      // label
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(a0 + SA / 2);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = s.t;
      if (s.icon) { ctx.font = (22 * K) + "px sans-serif"; ctx.fillText(s.icon, R * 0.74, 0); }
      var big = !s.icon;
      ctx.font = "700 " + ((big ? 26 : 13) * K) + "px Fredoka, sans-serif";
      if (big) {
        ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
        ctx.fillText(s.l[0], R * 0.68, -6 * K);
        ctx.font = "700 " + (14 * K) + "px Fredoka, sans-serif"; ctx.fillText(s.l[1], R * 0.68, 14 * K);
      } else {
        ctx.fillText(s.l[0], R * 0.5, -8 * K); ctx.fillText(s.l[1], R * 0.5, 8 * K);
      }
      ctx.restore();
    }
    // inner gloss (fake 3D bulge)
    var gl = ctx.createRadialGradient(CX - 40, CY - 50, 10, CX, CY, R);
    gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(0.5, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(0,0,0,.18)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();

    // bulbs on the rim
    for (var b = 0; b < 20; b++) {
      var ba = b * Math.PI * 2 / 20, on = ((b + Math.floor(time * 4)) % 2) === 0;
      var bx = CX + Math.cos(ba) * (R + RIM / 2 + 1), by = CY + Math.sin(ba) * (R + RIM / 2 + 1);
      ctx.fillStyle = on ? "#fffbe0" : "#e0a82a";
      ctx.beginPath(); ctx.arc(bx, by, 4 * K, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.fillStyle = "rgba(255,240,150,.45)"; ctx.beginPath(); ctx.arc(bx, by, 8 * K, 0, Math.PI * 2); ctx.fill(); }
    }

    // hub dome
    var hg = ctx.createRadialGradient(CX - 8, CY - 10, 3, CX, CY, 28);
    hg.addColorStop(0, "#fff7c4"); hg.addColorStop(0.5, "#ffc93c"); hg.addColorStop(1, "#a86f00");
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.arc(CX + 2, CY + 5, 28 * K, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(CX, CY, 28 * K, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e11d63"; ctx.font = "700 " + (12 * K) + "px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("CMC", CX, CY);

    // pointer
    ctx.save(); ctx.translate(CX, CY - R - RIM - 4); ctx.rotate(tilt); ctx.scale(K, K);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.moveTo(-14, -8 + 4); ctx.lineTo(14, -8 + 4); ctx.lineTo(0, 30 + 4); ctx.closePath(); ctx.fill();
    var pg = ctx.createLinearGradient(-14, 0, 14, 0); pg.addColorStop(0, "#ff7d84"); pg.addColorStop(0.5, "#ff2d45"); pg.addColorStop(1, "#9c0f18");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3.2); }

  C.raf(function (dt, time) {
    var tilt = 0;
    if (spinning) {
      spinT += dt;
      var p = Math.min(1, spinT / spinDur);
      var prev = theta;
      theta = from + (to - from) * ease(p);
      var speed = (theta - prev) / Math.max(dt, 0.001);
      var frac = ((((-theta) % SA) + SA) % SA) / SA;
      tilt = speed > 0.5 ? Math.max(0, 0.3 - frac * 1.4) * Math.min(1, speed / 6) : 0;
      if (p >= 1 && !finished) {
        finished = true; spinning = false;
        var seg = SEGS[target];
        C.timeout(function () {
          if (seg.win) C.result({ won: true, title: "Winner!", icon: "🎡", msg: "The wheel landed on your prize!" });
          else C.result({ won: false, title: seg.l.join(" "), icon: seg.icon || "💫", msg: "So close! Spin again for another chance." });
        }, 800);
      }
    }
    ctx.clearRect(0, 0, W, H);
    D.carnivalBg(ctx, time);
    D.bunting(ctx);
    drawWheel(time, tilt);
  });
};
