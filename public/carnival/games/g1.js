/* Game 1 — Charmacy Claw: a real-looking claw machine */
window.CarnivalGames[1] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;

  /* ----- geometry ----- */
  var GL = 30, GR = 330;          // glass left / right
  var FLOOR = 398;                // cabinet floor (front-row box baseline)
  var RAIL = 106;                 // rail y
  var CHUTE_X = 74;               // claw drops the prize here
  var HOLE = { x0: 40, x1: 108 }; // hole in the cabinet floor
  var MIN_X = 58, MAX_X = 302;
  var SPEED = { move: 50, down: 68, up: 60, carry: 55 };   // slow, on purpose
  var PRONG = 48;

  var SIZES = {
    L: { w: 68, h: 62, d: 26, grip: 0.88 },
    M: { w: 54, h: 48, d: 21, grip: 0.92 },
    S: { w: 40, h: 36, d: 16, grip: 0.95 }
  };
  var LAYOUT = [
    // back row (drawn first, sits higher)
    { cx: 74,  s: "L", c: "#ff4f9a", r: "#fff3b0", row: 0 },
    { cx: 146, s: "M", c: "#3b82f6", r: "#ffffff", row: 0 },
    { cx: 214, s: "L", c: "#ffb300", r: "#e11d63", row: 0 },
    { cx: 282, s: "M", c: "#8b5cf6", r: "#ffe08a", row: 0 },
    // front row
    { cx: 58,  s: "S", c: "#ef4444", r: "#ffffff", row: 1 },
    { cx: 120, s: "M", c: "#14b8a6", r: "#fff3b0", row: 1 },
    { cx: 176, s: "S", c: "#84cc16", r: "#ffffff", row: 1 },
    { cx: 242, s: "L", c: "#fb7a1e", r: "#ffffff", row: 1 },
    { cx: 304, s: "S", c: "#38bdf8", r: "#e11d63", row: 1 }
  ];

  var boxes = LAYOUT.map(function (b, i) {
    var sz = SIZES[b.s];
    return {
      i: i, cx: b.cx, by: b.row ? FLOOR : FLOOR - 16, rest: b.row ? FLOOR : FLOOR - 16,
      w: sz.w, h: sz.h, d: sz.d, grip: sz.grip, color: b.c, ribbon: b.r, row: b.row, size: b.s,
      prize: C.weighted({ nia: 2, p10: 3, p5: 5 }),
      state: "rest", vy: 0, scale: 1
    };
  });

  /* ----- offscreen static layers ----- */
  function layer(fn) {
    var c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2;
    var x = c.getContext("2d"); x.scale(2, 2); fn(x); return c;
  }

  function drawBack(x) {
    D.carnivalBg(x, 0);
    // soft glow behind the machine
    var g = x.createRadialGradient(W / 2, 300, 40, W / 2, 300, 320);
    g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // cabinet back wall
    x.fillStyle = D.lin(x, 0, 92, 0, FLOOR, [[0, "#fff8fb"], [1, "#efdce6"]]);
    x.fillRect(GL, 92, GR - GL, FLOOR - 92);
    // pastel stripes + a vertical rod (like the real machine)
    x.fillStyle = "rgba(255,92,151,.10)";
    for (var sx = GL; sx < GR; sx += 30) x.fillRect(sx, 92, 15, FLOOR - 92);
    x.fillStyle = D.lin(x, 0, 0, 22, 0, [[0, "#9ea4ab"], [0.5, "#eef0f2"], [1, "#8e949b"]]);
    x.fillRect(GL + 38, 92, 12, FLOOR - 92);
    // far-wall shelf with sparkles
    x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(GL, 296, GR - GL, 3);
    // floor (perspective)
    x.fillStyle = D.lin(x, 0, FLOOR - 8, 0, FLOOR + 8, [[0, "#d9c3cf"], [1, "#a98a9c"]]);
    x.beginPath(); x.moveTo(GL, FLOOR - 4); x.lineTo(GR, FLOOR - 4); x.lineTo(GR, FLOOR + 8); x.lineTo(GL, FLOOR + 8); x.closePath(); x.fill();
    // prize hole
    x.fillStyle = "#2a0a1f";
    x.beginPath(); x.ellipse((HOLE.x0 + HOLE.x1) / 2, FLOOR + 1, (HOLE.x1 - HOLE.x0) / 2, 7, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#ffd45a"; x.lineWidth = 2; x.stroke();
    // rail
    x.fillStyle = D.lin(x, 0, RAIL - 5, 0, RAIL + 5, [[0, "#c9ced3"], [0.5, "#f5f6f7"], [1, "#8a9097"]]);
    x.fillRect(GL, RAIL - 5, GR - GL, 10);
    // little toy silhouettes in the back for depth
    x.fillStyle = "rgba(225,29,99,.12)";
    [[96, 340, 18], [186, 346, 14], [262, 338, 20]].forEach(function (t) { x.beginPath(); x.arc(t[0], t[1], t[2], 0, Math.PI * 2); x.fill(); });
  }

  function drawFront(x) {
    // glass (very light so the prizes stay bright)
    x.fillStyle = "rgba(255,255,255,.07)"; x.fillRect(GL, 92, GR - GL, FLOOR - 92);
    x.fillStyle = "rgba(255,255,255,.16)";
    x.beginPath(); x.moveTo(GL + 14, 92); x.lineTo(GL + 62, 92); x.lineTo(GL + 6, FLOOR - 20); x.lineTo(GL, FLOOR - 20); x.lineTo(GL, 160); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(GR - 80, 92); x.lineTo(GR - 58, 92); x.lineTo(GR - 150, FLOOR - 20); x.lineTo(GR - 172, FLOOR - 20); x.closePath(); x.fill();
    // silver pillars
    [8, GR].forEach(function (px) {
      x.fillStyle = D.lin(x, px, 0, px + 22, 0, [[0, "#8a9097"], [0.4, "#f4f5f7"], [0.7, "#c5cacf"], [1, "#7c828a"]]);
      x.fillRect(px, 88, 22, FLOOR + 22 - 88);
    });
    // canopy: top face
    x.fillStyle = D.lin(x, 0, 14, 0, 44, [[0, "#ff7d84"], [1, "#e0262f"]]);
    x.beginPath(); x.moveTo(34, 14); x.lineTo(326, 14); x.lineTo(354, 44); x.lineTo(6, 44); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(60, 18); x.lineTo(200, 18); x.lineTo(176, 40); x.lineTo(40, 40); x.closePath(); x.fill();
    // canopy: front face
    x.fillStyle = D.lin(x, 0, 44, 0, 92, [[0, "#ee3b44"], [0.6, "#c4151f"], [1, "#8d0c14"]]);
    D.rr(x, 6, 44, 348, 48, 6); x.fill();
    x.fillStyle = "rgba(255,255,255,.28)"; x.fillRect(10, 47, 340, 3);
    // bulbs
    for (var i = 0; i < 16; i++) {
      x.fillStyle = i % 2 ? "#fff6c2" : "#ffd45a";
      x.beginPath(); x.arc(22 + i * 21.3, 82, 3.4, 0, Math.PI * 2); x.fill();
    }
    D.text3d(x, "CHARMACY CLAW", W / 2, 63, 24, "#ffffff", "#7a0a12");
    // red band (as on the real machine)
    x.fillStyle = D.lin(x, 0, FLOOR + 8, 0, FLOOR + 32, [[0, "#f24a52"], [0.5, "#c4151f"], [1, "#8d0c14"]]);
    D.rr(x, 6, FLOOR + 8, 348, 24, 5); x.fill();
    x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(10, FLOOR + 10, 340, 2);
    // silver base
    x.fillStyle = D.lin(x, 0, FLOOR + 32, 0, H, [[0, "#f2f3f5"], [1, "#9aa0a8"]]);
    x.fillRect(8, FLOOR + 32, 344, H - FLOOR - 32);
    x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(8, H - 10, 344, 10);
    // prize window (chute)
    x.fillStyle = D.lin(x, 0, 440, 0, 548, [[0, "#f24a52"], [1, "#a8111a"]]);
    D.rr(x, 20, 440, 108, 110, 12); x.fill();
    x.fillStyle = D.lin(x, 0, 452, 0, 540, [[0, "#3a1030"], [1, "#12040f"]]);
    D.rr(x, 30, 451, 88, 90, 8); x.fill();
    x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(34, 455, 6, 82);
    // control panel slab (jutting forward)
    x.fillStyle = D.lin(x, 0, 440, 0, 590, [[0, "#ffffff"], [1, "#b9bec5"]]);
    x.beginPath(); x.moveTo(140, 452); x.lineTo(352, 440); x.lineTo(352, 592); x.lineTo(140, 592); x.closePath(); x.fill();
    x.fillStyle = "rgba(0,0,0,.14)"; x.fillRect(140, 586, 212, 6);
    // red panel with knob wells
    x.fillStyle = D.lin(x, 0, 462, 0, 546, [[0, "#ee3b44"], [1, "#9c0f18"]]);
    D.rr(x, 150, 462, 192, 84, 12); x.fill();
    x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(158, 466, 176, 3);
    [176, 246, 316].forEach(function (kx) {
      x.fillStyle = "#4a0a10"; x.beginPath(); x.ellipse(kx, 512, 27, 22, 0, 0, Math.PI * 2); x.fill();
    });
    x.font = "600 9px Fredoka, sans-serif"; x.fillStyle = "#fff"; x.textAlign = "center";
    x.fillText("LEFT", 176, 541); x.fillText("DROP", 246, 541); x.fillText("RIGHT", 316, 541);
    // chrome logo
    x.save();
    x.font = "700 17px Fredoka, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#6a1030"; x.fillText("CHARMACY CLAW", 247, 573);
    x.fillStyle = D.lin(x, 0, 565, 0, 581, [[0, "#ffffff"], [1, "#e11d63"]]); x.fillText("CHARMACY CLAW", 246, 572);
    x.restore();
  }

  var back = layer(drawBack), front = layer(drawFront);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { back = layer(drawBack); front = layer(drawFront); });

  /* ----- claw state ----- */
  var S = { mode: "idle", x: 190, len: 0, o: 1, t: 0, dir: 0, tgt: null, hold: null, oHold: 0.6, stopTip: 0, len0: 0, slipAt: -1, binBox: null, binT: 0, done: false, msg: "" };
  var keys = { l: false, r: false };
  var started = false;

  function hubY() { return RAIL + 12 + S.len; }
  function tipY() { return hubY() + PRONG; }

  function boxUnder(x) {
    var best = null;
    boxes.forEach(function (b) {
      if (b.state !== "rest") return;
      if (Math.abs(x - b.cx) <= b.w / 2 + 14) {
        var top = b.by - b.h;
        if (!best || top < best.by - best.h) best = b;
      }
    });
    return best;
  }

  function drop() {
    if (S.mode !== "idle") return;
    S.mode = "down"; S.t = 0;
    S.tgt = boxUnder(S.x);
    S.stopTip = S.tgt ? (S.tgt.by - S.tgt.h + 16) : FLOOR - 4;
    S.dir = 0; keys.l = keys.r = false;
    setKnobs(false);
  }

  /* ----- controls: three silver knobs ----- */
  var knobsEl = [];
  function knob(cx, label, kind) {
    var b = C.el("button", "claw-knob" + (kind === "drop" ? " drop" : ""), label);
    b.style.left = (cx - 28) + "px"; b.style.top = (512 - 28) + "px";
    b.setAttribute("aria-label", kind);
    C.root.appendChild(b); knobsEl.push(b);
    function down(e) { e.preventDefault(); begin(kind); try { b.setPointerCapture(e.pointerId); } catch (x) {} b.classList.add("down"); }
    function up() { end(kind); b.classList.remove("down"); }
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
    return b;
  }
  function begin(kind) {
    if (S.mode !== "idle") return;
    started = true;
    if (kind === "left") keys.l = true; else if (kind === "right") keys.r = true; else drop();
  }
  function end(kind) { if (kind === "left") keys.l = false; else if (kind === "right") keys.r = false; }
  function setKnobs(on) { knobsEl.forEach(function (k) { k.style.opacity = on ? 1 : 0.55; }); }
  knob(176, "◀", "left"); knob(246, "DROP", "drop"); knob(316, "▶", "right");

  C.on(window, "keydown", function (e) {
    if (e.key === "ArrowLeft") { begin("left"); e.preventDefault(); }
    else if (e.key === "ArrowRight") { begin("right"); e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter") { begin("drop"); e.preventDefault(); }
  });
  C.on(window, "keyup", function (e) {
    if (e.key === "ArrowLeft") end("left"); else if (e.key === "ArrowRight") end("right");
  });

  /* ----- finishing ----- */
  function finish(won, o) {
    if (S.done) return; S.done = true;
    C.timeout(function () { C.result(Object.assign({ won: won }, o)); }, won ? 1000 : 650);
  }

  /* ----- update ----- */
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  function update(dt) {
    S.t += dt;
    var m = S.mode;
    if (m === "idle") {
      S.dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      S.x = Math.max(MIN_X, Math.min(MAX_X, S.x + S.dir * SPEED.move * dt));
    } else if (m === "down") {
      if (S.tgt) S.x += (S.tgt.cx - S.x) * Math.min(1, dt * 4);
      S.len += SPEED.down * dt;
      if (tipY() >= S.stopTip) { S.mode = "close"; S.t = 0; S.oHold = S.tgt ? Math.max(0.15, (S.tgt.w / 2 - 4) / 30) : 0; }
    } else if (m === "close") {
      S.o = 1 + (S.oHold - 1) * ease(S.t / 0.8);
      if (S.t >= 0.8) {
        var ok = !!S.tgt;                       // lined up over a box = the claw grips it
        if (ok) {
          S.hold = S.tgt; S.hold.state = "held";
          // the server already decided this play: a winning play carries the box to the chute,
          // any other play lets it slip on the way up
          S.slipAt = C.outcome.win ? -1 : 0.3 + Math.random() * 0.4;
        } else {
          S.msg = "Missed! Line the claw up over a gift box.";
        }
        S.len0 = S.len; S.mode = "up"; S.t = 0;
      }
    } else if (m === "up") {
      S.len -= SPEED.up * dt;
      if (S.hold && S.slipAt >= 0 && S.len / S.len0 <= S.slipAt) {
        S.hold.state = "falling"; S.hold.vy = 0; S.hold.slip = true; S.hold = null; S.slipAt = -1;
        S.msg = "Oh no, it slipped! Try again.";
      }
      if (S.len <= 0) {
        S.len = 0;
        if (S.hold) { S.mode = "carry"; S.t = 0; } else { S.mode = "end"; S.t = 0; }
      }
    } else if (m === "carry") {
      S.x -= SPEED.carry * dt;
      if (S.x <= CHUTE_X) { S.x = CHUTE_X; S.mode = "release"; S.t = 0; }
    } else if (m === "release") {
      S.o = S.oHold + (1 - S.oHold) * ease(S.t / 0.45);
      if (S.t >= 0.45) { S.hold.state = "falling"; S.hold.vy = 0; S.hold.chute = true; S.binBox = S.hold; S.hold = null; S.mode = "wait"; S.t = 0; }
    } else if (m === "end") {
      S.o += (1 - S.o) * Math.min(1, dt * 4);
      if (S.t > 0.5) { S.mode = "over"; finish(false, { title: "So close!", msg: S.msg, icon: "🎈" }); }
    }

    // boxes
    boxes.forEach(function (b) {
      if (b.state === "held") {
        b.cx = S.x; b.by = tipY() - 16 + b.h;
      } else if (b.state === "falling") {
        b.vy += 900 * dt; b.by += b.vy * dt;
        if (b.chute) {
          if (b.by >= FLOOR + 2) { b.state = "sink"; b.t = 0; }
        } else if (b.by >= b.rest) {
          b.by = b.rest; b.state = "rest"; b.vy = 0;
        }
      } else if (b.state === "sink") {
        b.t += dt; b.scale = Math.max(0, 1 - b.t / 0.4);
        if (b.t >= 0.4) {
          b.state = "gone"; S.binT = 0; S.mode = "bin";
          finish(true, { title: "You got it!", icon: "🎁", msg: "The claw delivered your gift box!" });
        }
      }
    });
    if (S.mode === "bin") S.binT += dt;
    if (S.mode === "wait") { /* box is falling */ }
  }

  /* ----- draw ----- */
  function drawBox(b, alpha) {
    ctx.save();
    if (b.state === "sink") {
      ctx.globalAlpha = Math.max(0, b.scale);
      ctx.translate(b.cx, b.by); ctx.scale(b.scale, b.scale); ctx.translate(-b.cx, -b.by + 10 * (1 - b.scale));
    }
    D.shadow(ctx, b.cx + b.d * 0.3, b.rest + 3, b.w * 0.7, 5, b.state === "rest" ? 0.28 : 0.12);
    D.box3d(ctx, b.cx - b.w / 2, b.by - b.h, b.w, b.h, b.d, b.color, b.ribbon);
    ctx.restore();
  }

  function drawClaw() {
    var x = S.x, hy = hubY();
    // carriage on the rail
    ctx.fillStyle = D.lin(ctx, x - 20, 0, x + 20, 0, [[0, "#9aa0a8"], [0.5, "#f3f4f6"], [1, "#7e848c"]]);
    D.rr(ctx, x - 20, RAIL - 9, 40, 20, 4); ctx.fill();
    ctx.fillStyle = "#e11d63"; ctx.fillRect(x - 5, RAIL - 6, 10, 4);
    // cable
    ctx.strokeStyle = "#5a6068"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, RAIL + 10); ctx.lineTo(x, hy); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 1, RAIL + 10); ctx.lineTo(x - 1, hy); ctx.stroke();

    // back prong (small, centred) for depth
    prong(x, hy, 0, 0.5, true);
    // held box sits behind the two front prongs
    return function drawFrontProngs() {
      // hub (3D block)
      ctx.fillStyle = D.lin(ctx, x - 15, 0, x + 15, 0, [[0, "#8d939b"], [0.45, "#f4f5f7"], [1, "#7a8088"]]);
      D.rr(ctx, x - 15, hy - 2, 30, 18, 5); ctx.fill();
      ctx.fillStyle = "#e11d63"; ctx.fillRect(x - 4, hy + 4, 8, 5);
      prong(x, hy, -1, S.o, false);
      prong(x, hy, 1, S.o, false);
    };
  }

  function prong(x, hy, s, o, back) {
    var sx = back ? 0 : s;
    var px = x + (back ? 0 : s * 10), py = hy + 8;
    var ex = x + (back ? 0 : s * (12 + 26 * o)), ey = py + 22;
    var tx = x + (back ? 0 : s * (4 + 30 * o)), ty = hy + PRONG;
    if (back) { ex = x; tx = x; ty = hy + PRONG - 6; ctx.globalAlpha = 0.8; }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // shadow edge
    ctx.strokeStyle = "#4b5159"; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
    // metal
    ctx.strokeStyle = D.lin(ctx, x - 40, 0, x + 40, 0, [[0, "#9aa0a8"], [0.5, "#f5f6f8"], [1, "#8a9097"]]);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
    // shine
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px - 1, py); ctx.lineTo(ex - 1, ey); ctx.stroke();
    // tip
    ctx.fillStyle = "#e11d63"; ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(back, 0, 0, W, H);

    // loose boxes: back row first
    var order = boxes.slice().sort(function (a, b) { return (a.row - b.row) || (a.cx - b.cx); });
    order.forEach(function (b) { if (b.state !== "held" && b.state !== "gone" && !b.chute) drawBox(b); });

    var finishClaw = drawClaw();
    boxes.forEach(function (b) { if (b.state === "held") drawBox(b); });
    boxes.forEach(function (b) { if ((b.chute && b.state !== "gone")) drawBox(b); });
    finishClaw();

    ctx.drawImage(front, 0, 0, W, H);

    // prize appears in the chute window
    if (S.mode === "bin" && S.binBox) {
      var b = S.binBox, k = Math.min(1, S.binT / 0.35), bounce = Math.sin(Math.min(1, S.binT / 0.5) * Math.PI) * 10;
      var sc = Math.min(1, 44 / b.w) * (0.4 + 0.6 * k);
      ctx.save(); ctx.translate(74, 520 - bounce); ctx.scale(sc, sc);
      D.box3d(ctx, -b.w / 2, -b.h, b.w, b.h, b.d, b.color, b.ribbon);
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "700 16px Fredoka, sans-serif"; ctx.textAlign = "center";
      var sp = (Math.floor(S.binT * 8) % 2) ? "✨" : "⭐"; ctx.fillText(sp, 100, 478); ctx.fillText(sp, 46, 492);
    }

    // aim marker: shows which box the claw will grab if you press DROP now
    if (S.mode === "idle") {
      var aim = boxUnder(S.x);
      var bounce = Math.sin(time * 6) * 3;
      ctx.save();
      ctx.setLineDash([4, 5]); ctx.strokeStyle = "rgba(225,29,99,.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(S.x, hubY() + PRONG + 4); ctx.lineTo(S.x, aim ? aim.by - aim.h - 14 : FLOOR - 4); ctx.stroke();
      ctx.setLineDash([]);
      if (aim) {
        var ay = aim.by - aim.h - 18 + bounce;
        ctx.fillStyle = "#ffc93c"; ctx.strokeStyle = "#a10f4d"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(aim.cx - 9, ay - 12); ctx.lineTo(aim.cx + 9, ay - 12); ctx.lineTo(aim.cx, ay); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // first-time hint
    if (!started && S.mode === "idle") {
      var pulse = 0.55 + 0.45 * Math.sin(time * 4);
      ctx.save(); ctx.globalAlpha = pulse;
      ctx.fillStyle = "rgba(161,15,77,.9)"; D.rr(ctx, 48, 230, 264, 32, 16); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "600 13px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Line up over a box, then press DROP", 180, 246);
      ctx.restore();
    }
  }

  C.raf(function (dt, time) { update(dt); render(time); });
};
