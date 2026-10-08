/* Game 1 — Charmacy Claw: a real-looking claw machine */
window.CarnivalGames[1] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;

  /* ----- geometry: one machine, two shapes (tall on phones, wide on desktop) ----- */
  var LAND = C.land;
  var G = LAND ? {
    GL: 78, GR: 802, GT: 84, FLOOR: 318, RAIL: 108, K: 1.25,
    outerL: 54, outerR: 826, topY: 6, faceY: 36,
    chute: { x: 92, y: 362, w: 176, h: 150, ix: 102, iy: 373, iw: 156, ih: 130 },
    slab: [[340, 368], [826, 356], [826, 540], [340, 540]], slabShadow: { x: 340, y: 534, w: 486 },
    panel: { x: 360, y: 378, w: 446, h: 118 }, knobs: [442, 583, 724], knobY: 440, knobSize: 64, wellRx: 34, wellRy: 28, labelY: 482,
    logo: { x: 583, y: 520, size: 24 }, bin: { x: 180, y: 492 }, spark1: { x: 232, y: 430 }, spark2: { x: 128, y: 452 },
    holeX0: 94, holeX1: 196, hintY: 150
  } : {
    GL: 30, GR: 330, GT: 92, FLOOR: 398, RAIL: 106, K: 1,
    outerL: 6, outerR: 354, topY: 14, faceY: 44,
    chute: { x: 20, y: 440, w: 108, h: 110, ix: 30, iy: 451, iw: 88, ih: 90 },
    slab: [[140, 452], [352, 440], [352, 592], [140, 592]], slabShadow: { x: 140, y: 586, w: 212 },
    panel: { x: 150, y: 462, w: 192, h: 84 }, knobs: [176, 246, 316], knobY: 512, knobSize: 56, wellRx: 27, wellRy: 22, labelY: 541,
    logo: { x: 246, y: 572, size: 17 }, bin: { x: 74, y: 520 }, spark1: { x: 100, y: 478 }, spark2: { x: 46, y: 492 },
    holeX0: 40, holeX1: 108, hintY: 230
  };
  var GL = G.GL, GR = G.GR, GT = G.GT, FLOOR = G.FLOOR, RAIL = G.RAIL, K = G.K;
  var GW = GR - GL, F = GW / 300;                      // horizontal scale versus the tall layout
  var CHUTE_X = (G.holeX0 + G.holeX1) / 2;             // claw drops the prize here
  var HOLE = { x0: G.holeX0, x1: G.holeX1 };           // hole in the cabinet floor
  var MIN_X = GL + 28 * (LAND ? 1.4 : 1), MAX_X = GR - 28 * (LAND ? 1.4 : 1);
  var SPEED = { move: 50 * F, down: 68, up: 60, carry: 55 * F };   // slow, on purpose
  var PRONG = 48;                                       // claw length in design units (drawn K times bigger)

  var SIZES = {
    L: { w: 68 * K, h: 62 * K, d: 26 * K, grip: 0.88 },
    M: { w: 54 * K, h: 48 * K, d: 21 * K, grip: 0.92 },
    S: { w: 40 * K, h: 36 * K, d: 16 * K, grip: 0.95 }
  };
  var LAYOUT = [
    // back row (drawn first, sits higher); positions are fractions of the glass width
    { f: 0.147, s: "L", c: "#ff4f9a", r: "#fff3b0", row: 0 },
    { f: 0.387, s: "M", c: "#3b82f6", r: "#ffffff", row: 0 },
    { f: 0.613, s: "L", c: "#ffb300", r: "#e11d63", row: 0 },
    { f: 0.84,  s: "M", c: "#8b5cf6", r: "#ffe08a", row: 0 },
    // front row
    { f: 0.093, s: "S", c: "#ef4444", r: "#ffffff", row: 1 },
    { f: 0.3,   s: "M", c: "#14b8a6", r: "#fff3b0", row: 1 },
    { f: 0.487, s: "S", c: "#84cc16", r: "#ffffff", row: 1 },
    { f: 0.707, s: "L", c: "#fb7a1e", r: "#ffffff", row: 1 },
    { f: 0.913, s: "S", c: "#38bdf8", r: "#e11d63", row: 1 }
  ];

  var boxes = LAYOUT.map(function (b, i) {
    var sz = SIZES[b.s], rowDrop = 16 * K;
    return {
      i: i, cx: GL + b.f * GW, by: b.row ? FLOOR : FLOOR - rowDrop, rest: b.row ? FLOOR : FLOOR - rowDrop,
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
    var g = x.createRadialGradient(W / 2, FLOOR - 100, 40, W / 2, FLOOR - 100, LAND ? 520 : 320);
    g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // cabinet back wall
    x.fillStyle = D.lin(x, 0, GT, 0, FLOOR, [[0, "#fff8fb"], [1, "#efdce6"]]);
    x.fillRect(GL, GT, GW, FLOOR - GT);
    // pastel stripes + a vertical rod (like the real machine)
    x.fillStyle = "rgba(255,92,151,.10)";
    for (var sx = GL; sx < GR; sx += 30) x.fillRect(sx, GT, 15, FLOOR - GT);
    x.fillStyle = D.lin(x, 0, 0, 22, 0, [[0, "#9ea4ab"], [0.5, "#eef0f2"], [1, "#8e949b"]]);
    x.fillRect(GL + 38, GT, 12, FLOOR - GT);
    // far-wall shelf
    x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(GL, FLOOR - 102, GW, 3);
    // floor (perspective)
    x.fillStyle = D.lin(x, 0, FLOOR - 8, 0, FLOOR + 8, [[0, "#d9c3cf"], [1, "#a98a9c"]]);
    x.beginPath(); x.moveTo(GL, FLOOR - 4); x.lineTo(GR, FLOOR - 4); x.lineTo(GR, FLOOR + 8); x.lineTo(GL, FLOOR + 8); x.closePath(); x.fill();
    // prize hole
    x.fillStyle = "#2a0a1f";
    x.beginPath(); x.ellipse((HOLE.x0 + HOLE.x1) / 2, FLOOR + 1, (HOLE.x1 - HOLE.x0) / 2, 7 * K, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#ffd45a"; x.lineWidth = 2; x.stroke();
    // rail
    x.fillStyle = D.lin(x, 0, RAIL - 5, 0, RAIL + 5, [[0, "#c9ced3"], [0.5, "#f5f6f7"], [1, "#8a9097"]]);
    x.fillRect(GL, RAIL - 5, GW, 10);
    // little toy silhouettes in the back for depth
    x.fillStyle = "rgba(225,29,99,.12)";
    var nToys = LAND ? 8 : 3;
    for (var t = 0; t < nToys; t++) {
      x.beginPath(); x.arc(GL + (t + 0.5) * GW / nToys, FLOOR - 56 + (t % 2) * 8, (14 + (t % 3) * 3) * K, 0, Math.PI * 2); x.fill();
    }
  }

  function drawFront(x) {
    var oL = G.outerL, oR = G.outerR, ow = oR - oL, wx = ow / 348;
    // glass (very light so the prizes stay bright)
    x.fillStyle = "rgba(255,255,255,.07)"; x.fillRect(GL, GT, GW, FLOOR - GT);
    x.fillStyle = "rgba(255,255,255,.16)";
    x.beginPath(); x.moveTo(GL + 14, GT); x.lineTo(GL + 62 * wx, GT); x.lineTo(GL + 6, FLOOR - 20); x.lineTo(GL, FLOOR - 20); x.lineTo(GL, GT + 68); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(GR - 80 * wx, GT); x.lineTo(GR - 58 * wx, GT); x.lineTo(GR - 150 * wx, FLOOR - 20); x.lineTo(GR - 172 * wx, FLOOR - 20); x.closePath(); x.fill();
    if (LAND) { x.beginPath(); x.moveTo(GL + GW * 0.45, GT); x.lineTo(GL + GW * 0.5, GT); x.lineTo(GL + GW * 0.4, FLOOR - 20); x.lineTo(GL + GW * 0.36, FLOOR - 20); x.closePath(); x.fill(); }
    // silver pillars
    [GL - 22, GR].forEach(function (px) {
      x.fillStyle = D.lin(x, px, 0, px + 22, 0, [[0, "#8a9097"], [0.4, "#f4f5f7"], [0.7, "#c5cacf"], [1, "#7c828a"]]);
      x.fillRect(px, GT - 4, 22, FLOOR + 22 - (GT - 4));
    });
    // canopy: top face
    x.fillStyle = D.lin(x, 0, G.topY, 0, G.faceY, [[0, "#ff7d84"], [1, "#e0262f"]]);
    x.beginPath(); x.moveTo(oL + 28, G.topY); x.lineTo(oR - 28, G.topY); x.lineTo(oR, G.faceY); x.lineTo(oL, G.faceY); x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(oL + 54 * wx, G.topY + 4); x.lineTo(oL + 194 * wx, G.topY + 4); x.lineTo(oL + 170 * wx, G.faceY - 4); x.lineTo(oL + 34 * wx, G.faceY - 4); x.closePath(); x.fill();
    // canopy: front face
    x.fillStyle = D.lin(x, 0, G.faceY, 0, GT, [[0, "#ee3b44"], [0.6, "#c4151f"], [1, "#8d0c14"]]);
    D.rr(x, oL, G.faceY, ow, GT - G.faceY, 6); x.fill();
    x.fillStyle = "rgba(255,255,255,.28)"; x.fillRect(oL + 4, G.faceY + 3, ow - 8, 3);
    // bulbs
    var nb = Math.round((ow - 32) / 21.3);
    for (var i = 0; i < nb; i++) {
      x.fillStyle = i % 2 ? "#fff6c2" : "#ffd45a";
      x.beginPath(); x.arc(oL + 16 + i * (ow - 32) / (nb - 1), GT - 10, 3.4, 0, Math.PI * 2); x.fill();
    }
    D.text3d(x, "CHARMACY CLAW", W / 2, G.faceY + 19, LAND ? 30 : 24, "#ffffff", "#7a0a12");
    // red band (as on the real machine)
    x.fillStyle = D.lin(x, 0, FLOOR + 8, 0, FLOOR + 32, [[0, "#f24a52"], [0.5, "#c4151f"], [1, "#8d0c14"]]);
    D.rr(x, oL, FLOOR + 8, ow, 24, 5); x.fill();
    x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(oL + 4, FLOOR + 10, ow - 8, 2);
    // silver base
    x.fillStyle = D.lin(x, 0, FLOOR + 32, 0, H, [[0, "#f2f3f5"], [1, "#9aa0a8"]]);
    x.fillRect(oL + 2, FLOOR + 32, ow - 4, H - FLOOR - 32);
    x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(oL + 2, H - 10, ow - 4, 10);
    // prize window (chute)
    var c = G.chute;
    x.fillStyle = D.lin(x, 0, c.y, 0, c.y + c.h, [[0, "#f24a52"], [1, "#a8111a"]]);
    D.rr(x, c.x, c.y, c.w, c.h, 12); x.fill();
    x.fillStyle = D.lin(x, 0, c.iy, 0, c.iy + c.ih, [[0, "#3a1030"], [1, "#12040f"]]);
    D.rr(x, c.ix, c.iy, c.iw, c.ih, 8); x.fill();
    x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(c.ix + 4, c.iy + 4, 6, c.ih - 8);
    // control panel slab (jutting forward)
    var sl = G.slab;
    x.fillStyle = D.lin(x, 0, sl[1][1], 0, sl[2][1], [[0, "#ffffff"], [1, "#b9bec5"]]);
    x.beginPath(); x.moveTo(sl[0][0], sl[0][1]); x.lineTo(sl[1][0], sl[1][1]); x.lineTo(sl[2][0], sl[2][1]); x.lineTo(sl[3][0], sl[3][1]); x.closePath(); x.fill();
    x.fillStyle = "rgba(0,0,0,.14)"; x.fillRect(G.slabShadow.x, G.slabShadow.y, G.slabShadow.w, 6);
    // red panel with knob wells
    var p = G.panel;
    x.fillStyle = D.lin(x, 0, p.y, 0, p.y + p.h, [[0, "#ee3b44"], [1, "#9c0f18"]]);
    D.rr(x, p.x, p.y, p.w, p.h, 12); x.fill();
    x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(p.x + 8, p.y + 4, p.w - 16, 3);
    G.knobs.forEach(function (kx) {
      x.fillStyle = "#4a0a10"; x.beginPath(); x.ellipse(kx, G.knobY, G.wellRx, G.wellRy, 0, 0, Math.PI * 2); x.fill();
    });
    x.font = "600 " + (LAND ? 11 : 9) + "px Fredoka, sans-serif"; x.fillStyle = "#fff"; x.textAlign = "center";
    x.fillText("LEFT", G.knobs[0], G.labelY); x.fillText("DROP", G.knobs[1], G.labelY); x.fillText("RIGHT", G.knobs[2], G.labelY);
    // chrome logo
    x.save();
    x.font = "700 " + G.logo.size + "px Fredoka, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#6a1030"; x.fillText("CHARMACY CLAW", G.logo.x + 1, G.logo.y + 1);
    x.fillStyle = D.lin(x, 0, G.logo.y - 8, 0, G.logo.y + 8, [[0, "#ffffff"], [1, "#e11d63"]]); x.fillText("CHARMACY CLAW", G.logo.x, G.logo.y);
    x.restore();
  }

  var back = layer(drawBack), front = layer(drawFront);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { back = layer(drawBack); front = layer(drawFront); });

  /* ----- claw state ----- */
  var S = { mode: "idle", x: GL + GW * 0.53, len: 0, o: 1, t: 0, dir: 0, tgt: null, hold: null, oHold: 0.6, stopTip: 0, len0: 0, slipAt: -1, binBox: null, binT: 0, done: false, msg: "" };
  var keys = { l: false, r: false };
  var started = false;

  function hubY() { return RAIL + 12 + S.len; }
  function tipY() { return hubY() + PRONG * K; }

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
    S.stopTip = S.tgt ? (S.tgt.by - S.tgt.h + 16 * K) : FLOOR - 4;
    S.dir = 0; keys.l = keys.r = false;
    setKnobs(false);
  }

  /* ----- controls: three silver knobs ----- */
  var knobsEl = [];
  function knob(cx, label, kind) {
    var b = C.el("button", "claw-knob" + (kind === "drop" ? " drop" : ""), label);
    var ks = G.knobSize;
    b.style.width = b.style.height = ks + "px"; b.style.left = (cx - ks / 2) + "px"; b.style.top = (G.knobY - ks / 2) + "px";
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
  knob(G.knobs[0], "◀", "left"); knob(G.knobs[1], "DROP", "drop"); knob(G.knobs[2], "▶", "right");

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
      if (tipY() >= S.stopTip) { S.mode = "close"; S.t = 0; S.oHold = S.tgt ? Math.max(0.15, (S.tgt.w / (2 * K) - 4) / 30) : 0; }
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
        b.cx = S.x; b.by = tipY() - 16 * K + b.h;
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
    ctx.save(); ctx.translate(x, hy); ctx.scale(K, K); ctx.translate(-x, -hy);
    prong(x, hy, 0, 0.5, true);
    ctx.restore();
    // held box sits behind the two front prongs
    return function drawFrontProngs() {
      ctx.save(); ctx.translate(x, hy); ctx.scale(K, K); ctx.translate(-x, -hy);
      // hub (3D block)
      ctx.fillStyle = D.lin(ctx, x - 15, 0, x + 15, 0, [[0, "#8d939b"], [0.45, "#f4f5f7"], [1, "#7a8088"]]);
      D.rr(ctx, x - 15, hy - 2, 30, 18, 5); ctx.fill();
      ctx.fillStyle = "#e11d63"; ctx.fillRect(x - 4, hy + 4, 8, 5);
      prong(x, hy, -1, S.o, false);
      prong(x, hy, 1, S.o, false);
      ctx.restore();
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
      var sc = Math.min(1, (LAND ? 78 : 44) / b.w) * (0.4 + 0.6 * k);
      ctx.save(); ctx.translate(G.bin.x, G.bin.y - bounce); ctx.scale(sc, sc);
      D.box3d(ctx, -b.w / 2, -b.h, b.w, b.h, b.d, b.color, b.ribbon);
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "700 16px Fredoka, sans-serif"; ctx.textAlign = "center";
      var sp = (Math.floor(S.binT * 8) % 2) ? "✨" : "⭐"; ctx.fillText(sp, G.spark1.x, G.spark1.y); ctx.fillText(sp, G.spark2.x, G.spark2.y);
    }

    // aim marker: shows which box the claw will grab if you press DROP now
    if (S.mode === "idle") {
      var aim = boxUnder(S.x);
      var bounce = Math.sin(time * 6) * 3;
      ctx.save();
      ctx.setLineDash([4, 5]); ctx.strokeStyle = "rgba(225,29,99,.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(S.x, tipY() + 4); ctx.lineTo(S.x, aim ? aim.by - aim.h - 14 : FLOOR - 4); ctx.stroke();
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
      ctx.fillStyle = "rgba(161,15,77,.9)"; D.rr(ctx, W / 2 - (LAND ? 210 : 132), G.hintY, LAND ? 420 : 264, 32, 16); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "600 13px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(LAND ? "Line up over a box, then press DROP (or ← → and Space)" : "Line up over a box, then press DROP", W / 2, G.hintY + 16);
      ctx.restore();
    }
  }

  C.raf(function (dt, time) { update(dt); render(time); });
};
