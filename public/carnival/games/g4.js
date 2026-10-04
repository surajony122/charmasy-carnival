/* Game 4 — Pick the Right Shade (8 shades, 10 second timer) */
window.CarnivalGames[4] = function (C) {
  var D = C.Draw;
  var POOL = [
    { n: "Peach Pataka", c: "#ffb38a" }, { n: "Rosy Ras", c: "#d9798c" }, { n: "Berry Bomb", c: "#8e2a52" },
    { n: "Coral Kiss", c: "#ff6f61" }, { n: "Nude Nawab", c: "#d2a68b" }, { n: "Wine Wow", c: "#6d1a36" },
    { n: "Mocha Magic", c: "#7a4b3a" }, { n: "Fuchsia Fever", c: "#e0218a" }, { n: "Plum Pyaar", c: "#5e2c64" },
    { n: "Brick Beauty", c: "#a8483a" }
  ];
  var TIME = 10;
  var shades = C.shuffle(POOL).slice(0, 8);
  var target = C.pick(shades);
  var answered = false, left = TIME;

  C.root.appendChild(C.el("div", "dom-bg"));
  C.bunting();
  C.root.appendChild(C.el("div", "shade-q", "<small>WHICH ONE IS</small><h2>" + target.n + "?</h2>"));

  var ring = C.el("div", "timer-ring",
    '<svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="31" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.35)" stroke-width="8"/>' +
    '<circle id="tr" cx="37" cy="37" r="31" fill="none" stroke="#ffc93c" stroke-width="8" stroke-linecap="round" stroke-dasharray="194.8" stroke-dashoffset="0"/></svg><b id="tn">10</b>');
  C.root.appendChild(ring);

  var grid = C.el("div", "swatches");
  C.root.appendChild(grid);
  var buttons = shades.map(function (s) {
    var b = C.el("button", "swatch",
      '<span class="pot" style="background:radial-gradient(circle at 35% 30%,' + D.shade(s.c, 0.35) + ',' + s.c + ' 55%,' + D.shade(s.c, -0.35) + ')"></span><span class="nm">' + s.n + '</span>');
    b.setAttribute("aria-label", "Shade " + (s.n));
    b.onclick = function () { choose(s, b); };
    grid.appendChild(b);
    return { s: s, b: b };
  });
  C.root.appendChild(C.el("div", "lipstick-deco", "💄"));

  function reveal() { buttons.forEach(function (x) { x.b.classList.add("show"); if (x.s === target) x.b.classList.add("right"); }); }

  function choose(s, b) {
    if (answered) return; answered = true;
    reveal();
    if (s === target) {
      C.timeout(function () { C.result({ won: true, title: "Perfect match!", icon: "💄", msg: "You found " + target.n + "!", prize: C.prize(C.weighted({ nia: 3, p5: 4, p10: 3 })) }); }, 1000);
    } else {
      b.classList.add("wrong");
      C.timeout(function () { C.result({ won: false, title: "Not quite!", icon: "🎨", msg: "That was " + s.n + ". " + target.n + " is highlighted green." }); }, 1500);
    }
  }

  var tr = ring.querySelector("#tr"), tn = ring.querySelector("#tn");
  C.raf(function (dt) {
    if (answered) return;
    left -= dt;
    tr.setAttribute("stroke-dashoffset", String(194.8 * (1 - Math.max(0, left) / TIME)));
    tn.textContent = Math.max(0, Math.ceil(left));
    if (left <= 3) tr.setAttribute("stroke", "#ff4d6d");
    if (left <= 0) {
      answered = true; reveal();
      C.timeout(function () { C.result({ won: false, title: "Time's up!", icon: "⏱", msg: "It was " + target.n + " — the green one." }); }, 1300);
    }
  });
};
