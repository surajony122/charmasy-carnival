/* Game 8 — Scratch & Win: reveal needs ~65% of the foil scratched, so a tiny scratch shows nothing */
window.CarnivalGames[8] = function (C) {
  var D = C.Draw, W = C.W, H = C.H;
  var cvs = C.canvas(), ctx = cvs.ctx;
  var CX = 30, CY = 150, CW = 300, CH = 270;   // card area
  var NEED = 0.65, BRUSH = 13;

  var O = C.outcome;                 // decided by the server
  var win = !!(O.win && O.prize);
  var big = win ? O.prize.short : "";
  var isGift = win && O.prize.kind === "FREE_PRODUCT";
  var giftName = isGift ? O.prize.label.replace(/^FREE\s*/i, "") : "";

  /* ----- foil layer ----- */
  var foil = document.createElement("canvas"); foil.width = CW * 2; foil.height = CH * 2;
  var fx = foil.getContext("2d"); fx.scale(2, 2);
  (function paintFoil() {
    var g = fx.createLinearGradient(0, 0, CW, CH);
    g.addColorStop(0, "#d7dbe2"); g.addColorStop(0.25, "#f4f6f9"); g.addColorStop(0.5, "#b8bec8"); g.addColorStop(0.75, "#eef0f4"); g.addColorStop(1, "#a9b0bb");
    fx.fillStyle = g; fx.fillRect(0, 0, CW, CH);
    for (var i = 0; i < 700; i++) {
      fx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.55)" : "rgba(120,130,150,.25)";
      fx.fillRect(Math.random() * CW, Math.random() * CH, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    fx.save(); fx.rotate(-0.25); fx.fillStyle = "rgba(255,92,151,.22)"; fx.font = "700 22px Fredoka, sans-serif"; fx.textAlign = "center";
    for (var y = 0; y < CH + 100; y += 46) for (var x = -40; x < CW + 80; x += 150) fx.fillText("✨ SCRATCH", x + (y % 92 ? 0 : 75), y);
    fx.restore();
    fx.strokeStyle = "rgba(255,255,255,.9)"; fx.lineWidth = 3; fx.strokeRect(2, 2, CW - 4, CH - 4);
  })();

  var scratching = false, last = null, pct = 0, revealed = false, fade = 0, checkT = 0, touched = false;

  function scratchTo(p) {
    var x = p.x - CX, y = p.y - CY;
    fx.save(); fx.globalCompositeOperation = "destination-out"; fx.lineCap = "round"; fx.lineJoin = "round"; fx.lineWidth = BRUSH * 2;
    fx.beginPath();
    if (last) fx.moveTo(last.x, last.y); else fx.moveTo(x - 0.1, y);
    fx.lineTo(x, y); fx.stroke(); fx.restore();
    last = { x: x, y: y }; touched = true;
  }
  C.on(cvs.cv, "pointerdown", function (e) { if (revealed) return; scratching = true; last = null; var p = cvs.pt(e); if (inCard(p)) scratchTo(p); });
  C.on(window, "pointerup", function () { scratching = false; last = null; });
  C.on(cvs.cv, "pointermove", function (e) { if (!scratching || revealed) return; var p = cvs.pt(e); if (inCard(p)) scratchTo(p); else last = null; });
  function inCard(p) { return p.x > CX - 10 && p.x < CX + CW + 10 && p.y > CY - 10 && p.y < CY + CH + 10; }

  function measure() {
    var d = fx.getImageData(0, 0, CW * 2, CH * 2).data, cleared = 0, total = 0;
    for (var y = 0; y < CH * 2; y += 8) for (var x = 0; x < CW * 2; x += 8) { total++; if (d[(y * CW * 2 + x) * 4 + 3] < 40) cleared++; }
    return cleared / total;
  }

  function reveal() {
    revealed = true; fade = 0;
    C.timeout(function () {
      if (win) C.result({ won: true, title: "You won!", icon: "🎟️", msg: "Your scratch card is a winner!" });
      else C.result({ won: false, title: "Not this time", icon: "🎟️", msg: "No prize on this card. Scratch another!" });
    }, 1100);
  }

  function drawCard(time) {
    // card body (3D)
    ctx.fillStyle = "rgba(60,0,30,.35)"; D.rr(ctx, CX - 6, CY + 12, CW + 12, CH + 12, 26); ctx.fill();
    ctx.fillStyle = D.lin(ctx, 0, CY - 14, 0, CY + CH + 14, [[0, "#ffe68a"], [1, "#c79a1a"]]); D.rr(ctx, CX - 14, CY - 14, CW + 28, CH + 28, 26); ctx.fill();
    ctx.fillStyle = "#fff"; D.rr(ctx, CX - 4, CY - 4, CW + 8, CH + 8, 18); ctx.fill();
    // prize layer
    ctx.save(); D.rr(ctx, CX, CY, CW, CH, 14); ctx.clip();
    ctx.fillStyle = D.lin(ctx, 0, CY, 0, CY + CH, [[0, "#fff6e0"], [1, "#ffd9e8"]]); ctx.fillRect(CX, CY, CW, CH);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (win) {
      for (var i = 0; i < 9; i++) { ctx.font = "26px sans-serif"; ctx.globalAlpha = 0.25; ctx.fillText(["✨", "🎀", "💖"][i % 3], CX + 30 + (i % 3) * 120 + (Math.floor(i / 3) % 2) * 20, CY + 38 + Math.floor(i / 3) * 100); }
      ctx.globalAlpha = 1;
      D.text3d(ctx, big, CX + CW / 2, CY + 100, big.length > 3 ? 76 : 96, "#e11d63", "#7a0a38");
      if (isGift) {
        ctx.fillStyle = "#a10f4d"; ctx.font = "700 20px Fredoka, sans-serif";
        ctx.fillText(giftName.length > 22 ? giftName.slice(0, 21) + "…" : giftName, CX + CW / 2, CY + 172);
      } else {
        D.text3d(ctx, "OFF", CX + CW / 2, CY + 178, 44, "#e11d63", "#7a0a38");
      }
      ctx.fillStyle = "#a10f4d"; D.rr(ctx, CX + CW / 2 - 70, CY + 214, 140, 30, 15); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 14px Fredoka, sans-serif"; ctx.fillText(isGift ? "FREE GIFT" : "COUPON", CX + CW / 2, CY + 229);
    } else {
      ctx.font = "70px sans-serif"; ctx.fillText("🎈", CX + CW / 2, CY + 95);
      D.text3d(ctx, "OH NO!", CX + CW / 2, CY + 170, 40, "#a10f4d", "#ffd0e0");
      ctx.fillStyle = "#a10f4d"; ctx.font = "600 15px Fredoka, sans-serif"; ctx.fillText("Better luck next time", CX + CW / 2, CY + 218);
    }
    ctx.restore();
    // foil on top
    ctx.save(); D.rr(ctx, CX, CY, CW, CH, 14); ctx.clip();
    ctx.globalAlpha = revealed ? Math.max(0, 1 - fade * 2.2) : 1;
    ctx.drawImage(foil, CX, CY, CW, CH);
    ctx.restore();
  }

  C.raf(function (dt, time) {
    if (!revealed) {
      checkT += dt;
      if (checkT > 0.12 && touched) { checkT = 0; pct = measure(); if (pct >= NEED) reveal(); }
    } else fade += dt;
    ctx.clearRect(0, 0, W, H);
    D.carnivalBg(ctx, time); D.bunting(ctx);
    D.text3d(ctx, "SCRATCH & WIN", W / 2, 108, 30, "#fff", "#a10f4d");
    drawCard(time);
    // progress bar
    var bw = 260, bx = (W - bw) / 2, by = 452, fill = Math.min(1, pct / NEED);
    ctx.fillStyle = "rgba(0,0,0,.22)"; D.rr(ctx, bx, by, bw, 16, 8); ctx.fill();
    if (fill > 0) { ctx.fillStyle = D.lin(ctx, bx, 0, bx + bw, 0, [[0, "#ffc93c"], [1, "#ff5c97"]]); D.rr(ctx, bx, by, Math.max(16, bw * fill), 16, 8); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.font = "600 12px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(revealed ? "Revealed!" : (touched ? "Keep scratching… " + Math.round(fill * 100) + "%" : "Drag your finger over the card"), W / 2, by + 34);
  });
};
