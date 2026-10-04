/* Charmacy Carnival 2026 — core: layout, tabs, locking, result/claim flow, fortune cookie.
   Each game lives in games/gN.js and registers itself with window.CarnivalGames[N]. */
(function () {
  "use strict";

  var CFG = window.CARNIVAL || {};
  var W = 360, H = 600;
  var Games = (window.CarnivalGames = {});

  var META = [
    null,
    { tab: "Claw", icon: "🕹️", title: "Charmacy Claw", day: 12,
      tips: ["Hold ◀ ▶ to move the claw.", "Press DROP over a gift box.", "Carry it to the chute to win."],
      reward: "Win a NIA free product or a coupon" },
    { tab: "Spin", icon: "🎡", title: "Spin the Glam Wheel", day: 13,
      tips: ["Tap SPIN to turn the wheel.", "Wait for it to stop.", "Land on a prize to win it."],
      reward: "Win a NIA free product · 5% · 10% OFF" },
    { tab: "Catch", icon: "🎭", title: "Catch My Charmacy", day: 14,
      tips: ["Drag the basket left and right.", "Catch 10 masks 🎭 to win.", "Dodge dragons, tents and wheels."],
      reward: "Win a NIA free product or 5% OFF" },
    { tab: "Shade", icon: "💄", title: "Pick the Right Shade", day: 15,
      tips: ["Read the shade name.", "Tap the matching colour.", "You have only 10 seconds."],
      reward: "Win a NIA free product · 5% · 10% OFF" },
    { tab: "Match", icon: "🃏", title: "Mirror Match", day: 16,
      tips: ["Memorise the cards.", "Find the 2 identical ones.", "You get 3 chances."],
      reward: "Win a 5% OFF coupon" },
    { tab: "Tap", icon: "✨", title: "Tap the Sparkle", day: 17,
      tips: ["Tap the products fast.", "Gold sparkles score extra.", "Beat the score to win."],
      reward: "Win a NIA free product or a coupon" },
    { tab: "Balloons", icon: "🎈", title: "Birthday Balloon Pop", day: 18,
      tips: ["Tap a balloon to pop it.", "Find the lucky balloon.", "You get 3 pops."],
      reward: "Win a NIA free product or a coupon" },
    { tab: "Scratch", icon: "🎟️", title: "Scratch & Win", day: 19,
      tips: ["Drag to scratch the card.", "Keep going to reveal it.", "Reveal your coupon prize."],
      reward: "Win a 5% or 10% OFF coupon" },
    { tab: "Puzzle", icon: "🧩", title: "Beauty Word Puzzle", day: 20,
      tips: ["Find the 2 hidden words.", "Drag across the letters.", "Beat the clock to win."],
      reward: "Win a NIA free product or a coupon" }
  ];

  var PRIZE = { nia: "NIA Free Product", p5: "5% OFF Coupon", p10: "10% OFF Coupon" };

  var cleanups = [];
  var curId = 0;
  var attempt = 0;
  var launchToken = 0;
  var PLAY = null;   // what the server decided for the current play
  var PLAYER_EMAIL = CFG.liquidEmail || "";
  try { if (!PLAYER_EMAIL) PLAYER_EMAIL = localStorage.getItem("carnival_email") || ""; } catch (e) {}
  var els = {};
  var testMode = !!CFG.isTest;

  /* ---------------- small helpers ---------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function weighted(map) {
    var total = 0, k;
    for (k in map) total += map[k];
    var r = Math.random() * total;
    for (k in map) { r -= map[k]; if (r <= 0) return k; }
    return Object.keys(map)[0];
  }
  function isLocked(id) { return !testMode && id !== CFG.activeGame; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function post(fields) {
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    return fetch(window.location.href, { method: "POST", body: fd }).then(function (r) { return r.json(); });
  }

  function cleanup() {
    launchToken++;
    var fns = cleanups; cleanups = [];
    for (var i = 0; i < fns.length; i++) { try { fns[i](); } catch (e) {} }
  }

  /* ---------------- drawing helpers (canvas, fake-3D) ---------------- */
  var Draw = (window.CarnivalDraw = {
    rr: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    // lighten (+) / darken (-) a #rrggbb colour by amt in [-1, 1]
    shade: function (hex, amt) {
      var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      function f(c) { return Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)))); }
      return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
    },
    lin: function (ctx, x0, y0, x1, y1, stops) {
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    },
    shadow: function (ctx, cx, cy, rx, ry, a) {
      ctx.save(); ctx.fillStyle = "rgba(40,0,25," + (a == null ? 0.3 : a) + ")";
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    // gift box with 3 visible faces (front, top, right side) and ribbon
    box3d: function (ctx, x, y, w, h, d, color, ribbon) {
      var D = Draw, dx = d * 0.7, dy = d * 0.55;
      ribbon = ribbon || "#ffffff";
      // right side
      ctx.fillStyle = D.shade(color, -0.35);
      ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + dx, y - dy); ctx.lineTo(x + w + dx, y + h - dy); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
      // top
      ctx.fillStyle = D.shade(color, 0.35);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y - dy); ctx.lineTo(x + w + dx, y - dy); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      // front
      ctx.fillStyle = D.lin(ctx, x, y, x + w, y + h, [[0, D.shade(color, 0.18)], [1, D.shade(color, -0.12)]]);
      ctx.fillRect(x, y, w, h);
      // ribbon (front vertical + top)
      var rw = Math.max(4, w * 0.2);
      ctx.fillStyle = ribbon;
      ctx.fillRect(x + w / 2 - rw / 2, y, rw, h);
      ctx.beginPath(); ctx.moveTo(x + w / 2 - rw / 2, y); ctx.lineTo(x + w / 2 - rw / 2 + dx, y - dy); ctx.lineTo(x + w / 2 + rw / 2 + dx, y - dy); ctx.lineTo(x + w / 2 + rw / 2, y); ctx.closePath(); ctx.fill();
      ctx.fillRect(x, y + h / 2 - rw / 2, w, rw);
      // bow
      var bx = x + w / 2 + dx * 0.5, by = y - dy * 0.5 - 1, br = Math.max(4, w * 0.17);
      ctx.fillStyle = D.shade(ribbon, -0.08);
      ctx.beginPath(); ctx.ellipse(bx - br, by - 2, br, br * 0.6, -0.5, 0, Math.PI * 2); ctx.ellipse(bx + br, by - 2, br, br * 0.6, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ribbon; ctx.beginPath(); ctx.arc(bx, by, br * 0.45, 0, Math.PI * 2); ctx.fill();
      // front shine
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(x + 2, y + 2, 3, h - 4);
    },
    // glossy balloon with knot
    balloon: function (ctx, x, y, r, color, sx) {
      var D = Draw; sx = sx || 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
      var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
      g.addColorStop(0, D.shade(color, 0.55)); g.addColorStop(0.35, color); g.addColorStop(1, D.shade(color, -0.45));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, r * 1.18);
      ctx.bezierCurveTo(-r * 1.25, r * 0.55, -r * 1.12, -r * 1.12, 0, -r * 1.12);
      ctx.bezierCurveTo(r * 1.12, -r * 1.12, r * 1.25, r * 0.55, 0, r * 1.18);
      ctx.fill();
      // knot
      ctx.fillStyle = D.shade(color, -0.35);
      ctx.beginPath(); ctx.moveTo(0, r * 1.14); ctx.lineTo(-r * 0.16, r * 1.38); ctx.lineTo(r * 0.16, r * 1.38); ctx.closePath(); ctx.fill();
      // highlights
      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.5, r * 0.2, r * 0.34, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.35, r * 0.1, r * 0.2, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    text3d: function (ctx, str, x, y, size, fill, edge) {
      ctx.save();
      ctx.font = "700 " + size + 'px Fredoka, "DM Sans", sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = edge || "#a10f4d";
      for (var i = 4; i > 0; i--) ctx.fillText(str, x, y + i);
      ctx.fillStyle = fill || "#fff";
      ctx.fillText(str, x, y);
      ctx.restore();
    },
    // string of bulbs/bunting across the top
    bunting: function (ctx, t) {
      var cols = ["#ff5c97", "#ffc93c", "#14b8a6", "#ffffff", "#e11d63"];
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(W / 2, 30, W, 6); ctx.stroke();
      for (var i = 0; i < 9; i++) {
        var u = (i + 0.5) / 9, x = u * W, y = 6 + 2 * 0.5 * 24 * (1 - Math.pow(2 * u - 1, 2)) * 1.0;
        y = 6 + 24 * (1 - Math.pow(2 * u - 1, 2)) * 0.5 * 2 * 0.5 + 0;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y); ctx.lineTo(x - 3, y + 14); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    // pink carnival sky with tent + ferris wheel silhouettes
    carnivalBg: function (ctx, t) {
      var D = Draw;
      ctx.fillStyle = D.lin(ctx, 0, 0, 0, H, [[0, "#ffb3cf"], [0.55, "#ff6fa3"], [1, "#c2185b"]]);
      ctx.fillRect(0, 0, W, H);
      // soft clouds
      ctx.fillStyle = "rgba(255,255,255,.35)";
      [[60, 90, 34], [95, 80, 26], [30, 96, 24], [290, 130, 30], [320, 118, 22], [262, 138, 22]].forEach(function (c) {
        ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill();
      });
      // ferris wheel
      var cx = 280, cy = 250, R = 82;
      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, Math.PI * 2); ctx.stroke();
      var rot = (t || 0) * 0.12;
      for (var i = 0; i < 10; i++) {
        var a = rot + i * Math.PI / 5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
        ctx.fillStyle = ["#ffc93c", "#fff", "#14b8a6", "#ff5c97", "#fff"][i % 5];
        ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - 40, cy + 150); ctx.lineTo(cx, cy); ctx.lineTo(cx + 40, cy + 150); ctx.stroke();
      // tents
      function tent(x, base, w, h, c1) {
        ctx.fillStyle = D.shade(c1, 0.3);
        ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x, base - h); ctx.lineTo(x + w / 2, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.55)";
        for (var k = -2; k <= 2; k += 2) { ctx.beginPath(); ctx.moveTo(x + k * w / 10 - w / 12, base); ctx.lineTo(x, base - h); ctx.lineTo(x + k * w / 10 + w / 12, base); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = "#ffe08a"; ctx.fillRect(x - 1.5, base - h - 14, 3, 14);
        ctx.fillStyle = "#e11d63"; ctx.beginPath(); ctx.moveTo(x + 1.5, base - h - 14); ctx.lineTo(x + 14, base - h - 9); ctx.lineTo(x + 1.5, base - h - 4); ctx.closePath(); ctx.fill();
      }
      tent(70, 470, 130, 90, "#ff5c97");
      tent(190, 480, 110, 70, "#e11d63");
      // ground
      ctx.fillStyle = D.lin(ctx, 0, 480, 0, H, [[0, "#ff8fb8"], [1, "#a10f4d"]]);
      ctx.fillRect(0, 470, W, H - 470);
    }
  });

  /* ---------------- per-game API ---------------- */
  function makeApi() {
    var stage = els.stage;
    var A = { W: W, H: H, root: stage, Draw: Draw };
    A.rand = rand; A.pick = pickOne; A.shuffle = shuffle; A.weighted = weighted;
    A.prize = function (key) { return PRIZE[key] || key; };
    A.el = function (tag, cls, html) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      return e;
    };
    A.canvas = function () {
      var cv = document.createElement("canvas");
      cv.width = W * 2; cv.height = H * 2; cv.className = "cv";
      var ctx = cv.getContext("2d");
      ctx.scale(2, 2);
      stage.appendChild(cv);
      return {
        cv: cv, ctx: ctx,
        pt: function (e) {
          var r = cv.getBoundingClientRect();
          return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
        }
      };
    };
    A.raf = function (fn) {
      var id, last = performance.now(), alive = true, t0 = last;
      function tick(t) {
        if (!alive) return;
        var dt = Math.min(0.05, (t - last) / 1000); last = t;
        fn(dt, (t - t0) / 1000);
        id = requestAnimationFrame(tick);
      }
      id = requestAnimationFrame(tick);
      var stop = function () { alive = false; cancelAnimationFrame(id); };
      cleanups.push(stop);
      return stop;
    };
    A.on = function (target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      cleanups.push(function () { target.removeEventListener(type, fn, opts); });
    };
    A.timeout = function (fn, ms) { var id = setTimeout(fn, ms); cleanups.push(function () { clearTimeout(id); }); return id; };
    A.interval = function (fn, ms) { var id = setInterval(fn, ms); cleanups.push(function () { clearInterval(id); }); return id; };
    A.toast = function (msg) {
      var old = stage.querySelector(".toast"); if (old) old.remove();
      var t = A.el("div", "toast", esc(msg)); stage.appendChild(t);
      A.timeout(function () { t.remove(); }, 1700);
    };
    A.bunting = function () {
      var c = A.el("canvas", "bunting"); c.width = W * 2; c.height = 68;
      var x = c.getContext("2d"); x.scale(2, 2); Draw.bunting(x); stage.appendChild(c);
    };
    A.result = showResult;
    A.relaunch = function () { launch(curId); };
    A.outcome = PLAY;                       // {win, prize:{label,kind,short,image}, prizes:[...], soldOut}
    // A skill game was completed successfully: pay out only if the server decided this play wins.
    A.winOrNot = function (o) {
      if (PLAY && PLAY.win && PLAY.prize) {
        showResult({ won: true, title: o.title, icon: o.icon, msg: o.msg });
      } else {
        showResult({
          won: false, icon: o.icon || "🎉", title: o.noPrizeTitle || "Great play!",
          msg: PLAY && PLAY.soldOut ? "You did it! Today's prizes for this game are all gone — come back tomorrow."
            : "You did it, but there's no prize on this play. Place another order for another chance!"
        });
      }
    };
    return A;
  }

  /* ---------------- result + claim flow ---------------- */
  function recordResult(won) {
    if (!PLAY) return;
    post({ intent: "result", orderId: PLAY.playRef, won: won ? "true" : "false" }).catch(function () {});
  }

  function confetti(host) {
    var cv = document.createElement("canvas");
    cv.width = W * 2; cv.height = H * 2; cv.className = "cv"; cv.style.pointerEvents = "none"; cv.style.zIndex = 60;
    host.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.scale(2, 2);
    var cols = ["#ffc93c", "#ff5c97", "#14b8a6", "#ffffff", "#e11d63", "#7c4dff"], ps = [];
    for (var i = 0; i < 90; i++) ps.push({ x: rand(0, W), y: rand(-200, 0), vx: rand(-30, 30), vy: rand(90, 220), r: rand(3, 7), a: rand(0, 6), va: rand(-6, 6), c: pickOne(cols) });
    var last = performance.now(), id, alive = true, t0 = last;
    (function tick(t) {
      if (!alive) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      });
      if (t - t0 > 3200 || !cv.isConnected) { cv.remove(); return; }
      id = requestAnimationFrame(tick);
    })(last);
    cleanups.push(function () { alive = false; cancelAnimationFrame(id); cv.remove(); });
  }

  function shopUrl() { return "/collections/all"; }

  function showResult(o) {
    var stage = els.stage;
    var old = stage.querySelector(".ov"); if (old) old.remove();
    var won = !!(o.won && PLAY && PLAY.win && PLAY.prize);
    recordResult(won);
    var ov = document.createElement("div"); ov.className = "ov";
    var card = document.createElement("div"); card.className = "ov-card";
    ov.appendChild(card); stage.appendChild(ov);
    if (won) {
      confetti(stage);
      card.innerHTML =
        '<div class="ov-icon">' + (o.icon || "🎉") + '</div>' +
        '<div class="ov-title">' + esc(o.title || "You won!") + '</div>' +
        '<div class="ov-msg">' + esc(o.msg || "") + '</div>' +
        '<div class="ov-prize">' + esc(PLAY.prize.label) + '</div><br>' +
        '<button class="btn3d" id="claimBtn">CLAIM MY PRIZE →</button>';
      card.querySelector("#claimBtn").onclick = function () { claimForm(card); };
    } else {
      var again = PLAY && PLAY.testMode;
      card.innerHTML =
        '<div class="ov-icon">' + (o.icon || "💫") + '</div>' +
        '<div class="ov-title">' + esc(o.title || "Not this time") + '</div>' +
        '<div class="ov-msg">' + esc(o.msg || "Better luck next time!") + '</div>' +
        (again ? '<button class="btn3d" id="againBtn">TRY AGAIN (TEST)</button>'
               : '<div class="fine" style="margin:0 0 12px">Every order gives you a new play.</div><button class="btn3d gold" id="shopBtn">SHOP NOW →</button>');
      if (again) card.querySelector("#againBtn").onclick = function () { ov.remove(); launch(curId); };
      else card.querySelector("#shopBtn").onclick = function () { window.location.href = shopUrl(); };
    }
  }

  function claimForm(card) {
    var prizeLabel = PLAY.prize ? PLAY.prize.label : (PLAY.prizeLabel || "your prize");
    var hint = PLAY.hint ? " Use the email from your order (" + esc(PLAY.hint) + ")." : "";
    var phone0 = ""; try { phone0 = localStorage.getItem("carnival_phone") || ""; } catch (e) {}
    card.innerHTML =
      '<div class="ov-icon">🎁</div>' +
      '<div class="ov-title">Claim your prize</div>' +
      '<div class="ov-msg"><b>' + esc(prizeLabel) + '</b>.' + hint + '</div>' +
      '<input class="ov-input" id="cEmail" type="email" inputmode="email" autocomplete="email" placeholder="Email">' +
      '<input class="ov-input" id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Mobile number" style="margin-top:8px">' +
      '<div class="ov-err" id="cErr"></div>' +
      '<button class="btn3d" id="cGo">GET MY PRIZE →</button>';
    var email = card.querySelector("#cEmail"), phone = card.querySelector("#cPhone"), err = card.querySelector("#cErr"), btn = card.querySelector("#cGo");
    if (PLAYER_EMAIL) email.value = PLAYER_EMAIL;
    phone.value = phone0;
    function go() {
      var e = email.value.trim(), p = phone.value.trim();
      if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(e)) { err.textContent = "Please enter a valid email address."; return; }
      if (p.replace(/\D/g, "").length < 10) { err.textContent = "Please enter your 10-digit mobile number."; return; }
      err.textContent = ""; btn.disabled = true; btn.textContent = "PLEASE WAIT…";
      post({ intent: "claim", orderId: PLAY.playRef, email: e, phone: p })
        .then(function (d) {
          if (d && d.success) {
            PLAYER_EMAIL = d.email || e;
            try { localStorage.setItem("carnival_email", PLAYER_EMAIL); localStorage.setItem("carnival_phone", p); } catch (x) {}
            updatePlayer();
            deliveryScreen(card, d);
          } else {
            err.textContent = (d && (d.error || d.message)) || "Something went wrong. Please try again.";
            btn.disabled = false; btn.textContent = "GET MY PRIZE →";
          }
        })
        .catch(function () { err.textContent = "Network error. Please try again."; btn.disabled = false; btn.textContent = "GET MY PRIZE →"; });
    }
    btn.onclick = go;
    phone.onkeydown = email.onkeydown = function (ev) { if (ev.key === "Enter") go(); };
  }

  function copyText(code, btn) {
    function done() { btn.textContent = "COPIED ✓"; setTimeout(function () { btn.textContent = "COPY"; }, 1800); }
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = code; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(fallback);
    else fallback();
  }

  function codeBox(code) {
    return '<div class="code-box"><span>' + esc(code) + '</span><button class="btn3d small" id="cCopy">COPY</button></div><br>';
  }

  function deliveryScreen(card, d) {
    var label = d.prizeLabel || (PLAY && PLAY.prize && PLAY.prize.label) || "Your prize";
    if (d.delivery === "order_edit") {
      card.innerHTML =
        '<div class="ov-icon">🎁</div><div class="ov-title">Added to your order!</div>' +
        '<div class="ov-msg"><b>' + esc(label) + '</b> has been added to your order at no cost. ' + esc(d.note || "") + '</div>' +
        '<button class="btn3d gold" id="cShop">KEEP SHOPPING →</button>' +
        '<div class="fine">Nothing else to do — we will pack it with your order.</div>';
    } else {
      var isProduct = d.delivery === "product_code";
      card.innerHTML =
        '<div class="ov-icon">🎉</div><div class="ov-title">Your code</div>' +
        '<div class="ov-msg">' + esc(label) + ' is saved for <b>' + esc(d.email || PLAYER_EMAIL) + '</b>.' +
        (isProduct ? " " + esc(d.note || "") : (d.unique ? " Single-use, valid for " + (d.days || 7) + " days." : "")) + '</div>' +
        codeBox(d.code) +
        '<button class="btn3d gold" id="cShop">SHOP NOW →</button>' +
        '<div class="fine">Paste the code at checkout. Copy it now — you will need it.</div>';
      card.querySelector("#cCopy").onclick = function () { copyText(d.code, this); };
    }
    card.querySelector("#cShop").onclick = function () {
      window.location.href = d.code ? "/discount/" + encodeURIComponent(d.code) + "?redirect=" + shopUrl() : shopUrl();
    };
  }

  /* ---------------- play not allowed / loading ---------------- */
  function renderBlocked(d, id) {
    var m = META[id] || META[1];
    var icon = { need_order: "🛍️", invalid_order: "🔎", old_order: "⌛", already_played: "🎟️", already_claimed: "🎁", not_live: "🎪", disabled: "🛠️" }[d.reason] || "🎪";
    var title = { need_order: "Place an order to play", already_played: d.canClaim ? "You won!" : "Play used", already_claimed: "Already claimed", not_live: "Not open yet" }[d.reason] || m.title;
    els.stage.innerHTML =
      '<div class="locked"><div class="big">' + icon + '</div><h3>' + esc(title) + '</h3><p>' + esc(d.message || "Please try again in a moment.") + '</p>' +
      (d.code ? codeBox(d.code) : "") +
      (d.canClaim ? '<button class="btn3d gold" id="bClaim">CLAIM MY PRIZE →</button>' :
        (d.reason === "not_live" && CFG.activeGame ? '<button class="btn3d gold" id="bToday">PLAY TODAY\'S GAME</button>' :
         '<button class="btn3d gold" id="bShop">SHOP NOW →</button>')) +
      '</div>';
    var box = els.stage.querySelector.bind(els.stage);
    if (d.canClaim) {
      box("#bClaim").onclick = function () {
        PLAY = { playRef: d.playRef, win: true, prize: { label: d.prizeLabel }, prizeLabel: d.prizeLabel, hint: d.hint, testMode: false };
        var ov = document.createElement("div"); ov.className = "ov"; var card = document.createElement("div"); card.className = "ov-card";
        ov.appendChild(card); els.stage.appendChild(ov); claimForm(card);
      };
    } else if (box("#bToday")) box("#bToday").onclick = function () { switchGame(CFG.activeGame); };
    else if (box("#bShop")) box("#bShop").onclick = function () { window.location.href = shopUrl(); };
    if (d.code && box("#cCopy")) box("#cCopy").onclick = function () { copyText(d.code, this); };
  }

  function renderLoading() {
    els.stage.innerHTML = '<div class="locked"><div class="big">🎪</div><h3>Getting your play ready…</h3></div>';
  }

  /* ---------------- locked screen ---------------- */
  function renderLocked(id) {
    var m = META[id];
    var target = new Date(2026, 9, m.day, 0, 0, 0);
    var ended = new Date() > new Date(2026, 9, 21, 0, 0, 0);
    els.stage.innerHTML =
      '<div class="locked"><div class="big">🔒</div><h3>' + esc(m.title) + '</h3>' +
      '<p>' + (ended ? 'The Carnival has ended. Thank you for playing!' : 'Unlocks on ' + m.day + ' Oct') + '</p>' +
      '<div class="clock"><div><b id="ckD">0</b><small>DAYS</small></div><div><b id="ckH">00</b><small>HRS</small></div><div><b id="ckM">00</b><small>MIN</small></div><div><b id="ckS">00</b><small>SEC</small></div></div>' +
      (CFG.activeGame ? '<button class="btn3d gold" id="playToday">PLAY TODAY\'S GAME</button>' : '') +
      (testMode ? '<br><button class="btn3d small" id="testGo" style="margin-top:10px">⚡ TEST: PLAY ANYWAY</button>' : '') +
      '</div>';
    if (CFG.activeGame) els.stage.querySelector("#playToday").onclick = function () { switchGame(CFG.activeGame); };
    if (testMode) els.stage.querySelector("#testGo").onclick = function () { launch(id); };
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      var ms = Math.max(0, target - new Date()), s = Math.floor(ms / 1000);
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60;
      var D = els.stage.querySelector("#ckD"); if (!D) return;
      D.textContent = d; els.stage.querySelector("#ckH").textContent = pad(h); els.stage.querySelector("#ckM").textContent = pad(mi); els.stage.querySelector("#ckS").textContent = pad(se);
    }
    tick();
    var iv = setInterval(tick, 1000); cleanups.push(function () { clearInterval(iv); });
  }

  /* ---------------- layout ---------------- */
  function build() {
    var app = document.getElementById("app");
    app.innerHTML =
      '<div class="wrap">' +
      '<header class="hdr"><img class="logo" alt="Charmacy Carnival 2026" src="' + CFG.assets + '/img/logo-mark.png"><div class="player" id="player"></div></header>' +
      '<h1 class="title" id="title"></h1>' +
      (CFG.isTest ? '<button class="mode-pill" id="modeBtn"></button>' : "") +
      '<nav class="tabs" id="tabs" aria-label="Games"></nav>' +
      '<div class="stage-frame" id="frame"><div class="stage-box" id="box"><div class="stage" id="stage"></div></div></div>' +
      '<ul class="tips" id="tips"></ul><div class="reward" id="reward"></div>' +
      '<div class="foot">SHOP • PLAY • WIN • REPEAT</div>' +
      '</div>';
    els.stage = document.getElementById("stage");
    els.box = document.getElementById("box");
    els.frame = document.getElementById("frame");
    els.tabs = document.getElementById("tabs");
    els.title = document.getElementById("title");
    els.tips = document.getElementById("tips");
    els.reward = document.getElementById("reward");
    els.player = document.getElementById("player");
    els.mode = document.getElementById("modeBtn");
    if (els.mode) {
      els.mode.onclick = function () { testMode = !testMode; renderMode(); renderTabs(); switchGame(curId, true); };
      renderMode();
    }
    updatePlayer();
  }
  function renderMode() {
    els.mode.textContent = testMode ? "🟢 Test mode — tap to preview as a customer" : "🔒 Customer preview — tap for test mode";
  }
  function updatePlayer() {
    els.player.textContent = PLAYER_EMAIL ? "👤 " + PLAYER_EMAIL : (CFG.orderBadge || "🎟️ Carnival Player");
  }

  function fit() {
    if (!els.box) return;
    var wrap = els.frame.parentNode;
    var pad = parseFloat(getComputedStyle(els.frame).paddingLeft) || 10;
    var availW = wrap.clientWidth - 2 * pad - 2;
    var vh = window.innerHeight;
    var targetH = Math.max(vh * 0.74 - 2 * pad, 440);
    var s = Math.min(availW / W, targetH / H, 1.45);
    els.box.style.width = Math.round(W * s) + "px";
    els.box.style.height = Math.round(H * s) + "px";
    els.stage.style.transform = "scale(" + s + ")";
  }

  function renderTabs() {
    els.tabs.innerHTML = "";
    for (var i = 1; i <= 9; i++) {
      (function (id) {
        var m = META[id], b = document.createElement("button");
        b.className = "tab" + (id === curId ? " active" : "") + (isLocked(id) ? " tab-locked" : "");
        b.setAttribute("data-id", id);
        b.innerHTML = (isLocked(id) ? "🔒 " : m.icon + " ") + esc(m.tab);
        b.onclick = function () { switchGame(id); };
        els.tabs.appendChild(b);
      })(i);
    }
  }

  function setInfo(id) {
    var m = META[id];
    els.title.textContent = m.title;
    els.tips.innerHTML = m.tips.map(function (t, i) { return "<li><b>" + (i + 1) + "</b>" + esc(t) + "</li>"; }).join("");
    els.reward.textContent = "🎁 " + m.reward;
  }

  function launch(id) {
    cleanup();
    var token = launchToken;
    attempt++;
    PLAY = null;
    els.stage.className = "stage g" + id;
    renderLoading();
    post({ intent: "play", orderId: CFG.orderId, gameId: id, attempt: attempt, customerId: CFG.customerId || "" })
      .then(function (d) {
        if (token !== launchToken) return;
        if (!d || !d.ok) { renderBlocked(d || {}, id); return; }
        PLAY = d;
        els.stage.innerHTML = "";
        try {
          if (!Games[id]) throw new Error("Game " + id + " not loaded");
          Games[id](makeApi());
        } catch (e) {
          console.error(e);
          els.stage.innerHTML = '<div class="locked"><div class="big">🎪</div><h3>Oops!</h3><p>This game could not load. Please refresh the page.</p></div>';
        }
      })
      .catch(function () {
        if (token !== launchToken) return;
        renderBlocked({ message: "Connection problem. Please check your internet and try again." }, id);
      });
  }

  function switchGame(id, force) {
    if (!force && id === curId) return;
    curId = id;
    cleanup();
    renderTabs();
    setInfo(id);
    var active = els.tabs.querySelector(".tab.active");
    if (active && active.scrollIntoView) { try { active.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {} }
    if (isLocked(id)) renderLocked(id); else launch(id);
  }

  /* ---------------- fortune cookie ---------------- */
  var QUOTES = [
    "Glow from within — it shows on the outside.",
    "Today is a great day to try a new shade.",
    "You are the main character. Dress the part.",
    "Confidence is the best lipstick you own.",
    "Small steps every day make big glow-ups.",
    "Be your own kind of beautiful.",
    "Good things are on their way to you.",
    "Your smile is your best accessory.",
    "Sparkle first, apologise never.",
    "A little shimmer makes everything better.",
    "Self-care is not selfish. Treat yourself.",
    "Kindness looks good on everyone.",
    "Luck favours the bold — and the well-moisturised.",
    "Something wonderful is about to happen.",
    "You were born to stand out, not blend in.",
    "Dream big, blush bigger.",
    "Happiness is a fresh coat of your favourite colour.",
    "Today's vibe: unstoppable.",
    "Beauty begins the moment you decide to be yourself.",
    "Your best look is the one that makes you feel amazing.",
    "A surprise treat is coming your way.",
    "Shine bright — the world needs your light.",
    "Take the leap. The glitter will catch you.",
    "You are more radiant than you realise.",
    "Celebrate yourself today. You deserve it."
  ];
  /* ----- crack sound, synthesized (no audio files) ----- */
  var audio = null;
  function audioCtx() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { audio = null; }
    return audio;
  }
  function noiseBurst(ac, at, dur, gain, hp) {
    var n = Math.max(1, Math.floor(ac.sampleRate * dur)), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var src = ac.createBufferSource(); src.buffer = buf;
    var f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    var g = ac.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start(at);
  }
  function crackSound() {
    var ac = audioCtx(); if (!ac) return;
    var t = ac.currentTime;
    noiseBurst(ac, t, 0.05, 0.9, 2500);          // sharp snap
    noiseBurst(ac, t + 0.045, 0.07, 0.7, 1800);  // crunch
    noiseBurst(ac, t + 0.11, 0.09, 0.5, 1200);   // crumble
    noiseBurst(ac, t + 0.2, 0.12, 0.25, 800);
    var o = ac.createOscillator(), og = ac.createGain();   // low "thump"
    o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(og); og.connect(ac.destination); o.start(t); o.stop(t + 0.15);
  }
  function rattleSound() {
    var ac = audioCtx(); if (!ac) return;
    var t = ac.currentTime;
    for (var i = 0; i < 5; i++) noiseBurst(ac, t + i * 0.09, 0.03, 0.22, 3000);
  }
  function slipSound() {
    var ac = audioCtx(); if (!ac) return;
    noiseBurst(ac, ac.currentTime, 0.28, 0.12, 5000);   // soft paper "swish"
  }

  var COOKIE_SVG = "<b class=\"cke\">🥠</b>";   // the glossy cookie, split into two halves by CSS

  function fortune() {
    var fab = document.createElement("button");
    fab.className = "fortune-fab"; fab.setAttribute("aria-label", "Open a fortune cookie");
    fab.innerHTML = '🥠<small>Fortune</small>';
    var hdr = document.querySelector(".hdr");
    hdr.insertBefore(fab, els.player);
    fab.onclick = function () {
      var ov = document.createElement("div"); ov.className = "fortune-ov";
      ov.innerHTML =
        '<div class="fortune-card"><h3>Fortune Cookie</h3>' +
        '<p class="sub">Need a little bit of sage advice or a quick pick-me-up? Crack one open!</p>' +
        '<div class="cookie-stage"><div class="slip" id="slip"></div>' +
        '<button class="ck" id="ck" aria-label="Crack the cookie"><span class="half l">' + COOKIE_SVG + '</span><span class="half r">' + COOKIE_SVG + '</span></button></div>' +
        '<button class="btn3d" id="crack">CRACK IT OPEN</button> <button class="btn3d small gold" id="shut" style="margin-left:6px">CLOSE</button></div>';
      document.body.appendChild(ov);
      var ck = ov.querySelector("#ck"), slip = ov.querySelector("#slip"), crack = ov.querySelector("#crack"), stage = ov.querySelector(".cookie-stage");
      var busy = false, timers = [];
      function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
      function crumbs() {
        for (var i = 0; i < 14; i++) {
          var c = document.createElement("i"); c.className = "crumb";
          var a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60;
          c.style.setProperty("--dx", Math.cos(a) * r + "px"); c.style.setProperty("--dy", (Math.sin(a) * r * 0.7 - 10) + "px");
          c.style.width = c.style.height = (3 + Math.random() * 5) + "px";
          stage.appendChild(c); later(function (el) { return function () { el.remove(); }; }(c), 900);
        }
      }
      function open() {
        if (busy) return; busy = true; crack.disabled = true;
        // reset to a whole cookie first
        ck.classList.remove("cracked", "shake"); slip.classList.remove("out"); slip.textContent = "";
        void ck.offsetWidth;
        ck.classList.add("shake"); rattleSound();
        later(function () {
          crackSound(); crumbs();
          slip.textContent = pickOne(QUOTES);
          ck.classList.remove("shake"); ck.classList.add("cracked");
        }, 560);
        later(function () { slipSound(); slip.classList.add("out"); }, 760);
        later(function () { busy = false; crack.disabled = false; crack.textContent = "ANOTHER ONE"; }, 1900);
      }
      ck.onclick = open; crack.onclick = open;
      function close() { timers.forEach(clearTimeout); ov.remove(); }
      ov.querySelector("#shut").onclick = close;
      ov.onclick = function (e) { if (e.target === ov) close(); };
    };
  }

  /* ---------------- start ---------------- */
  window.Carnival = {
    start: function () {
      build();
      fit();
      window.addEventListener("resize", fit);
      window.addEventListener("orientationchange", function () { setTimeout(fit, 200); });
      var first = CFG.initialGame || CFG.activeGame || 1;
      if (isLocked(first) && CFG.activeGame) first = CFG.activeGame;
      switchGame(first, true);
      fit();
      fortune();
    },
    switchGame: switchGame
  };
})();
