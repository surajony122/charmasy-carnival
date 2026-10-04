/* Game 5 — Mirror Match: 12 cards, 3 chances, find the one matching pair */
window.CarnivalGames[5] = function (C) {
  var DECOYS = [
    { e: "💅", n: "Nail Polish" }, { e: "🪞", n: "Mirror" }, { e: "🖌️", n: "Brush" }, { e: "🌸", n: "Blush" },
    { e: "✨", n: "Glow" }, { e: "💋", n: "Lip Gloss" }, { e: "👁️", n: "Eyeliner" }, { e: "🧼", n: "Cleanser" },
    { e: "🎀", n: "Hair Bow" }, { e: "💎", n: "Shimmer" }
  ];
  // the matching pair is Foundation OR Diamond Ruh Lipstick — never both
  var SPECIAL = C.pick([{ e: "🧴", n: "Foundation" }, { e: "💄", n: "Diamond Ruh Lipstick" }]);
  var faces = C.shuffle(DECOYS.concat([SPECIAL, SPECIAL]));
  var chances = 3, picked = [], busy = true, over = false;

  C.root.appendChild(C.el("div", "dom-bg"));
  C.bunting();
  var info = C.el("div", "mm-info", '<h2>Find the matching pair</h2><div class="mm-hearts" id="hearts"></div><div class="mm-msg" id="msg"></div>');
  C.root.appendChild(info);
  var hearts = info.querySelector("#hearts"), msg = info.querySelector("#msg");
  var grid = C.el("div", "mm-grid");
  C.root.appendChild(grid);

  var cards = faces.map(function (f, i) {
    var b = C.el("button", "card flip",
      '<span class="back"></span><span class="face"><i>' + f.e + '</i><small>' + (f === SPECIAL ? SPECIAL.n.replace(" Lipstick", "") : f.n) + '</small></span>');
    b.setAttribute("aria-label", "Card " + (i + 1));
    b.onclick = function () { tap(i); };
    grid.appendChild(b);
    return { b: b, f: f, up: true };
  });

  function drawHearts() {
    var s = ""; for (var i = 0; i < 3; i++) s += i < chances ? "❤️" : "🤍";
    hearts.textContent = s;
  }
  drawHearts();

  // memorise phase
  var count = 3;
  msg.textContent = "Memorise the cards… " + count;
  var iv = C.interval(function () {
    count--;
    if (count > 0) { msg.textContent = "Memorise the cards… " + count; return; }
    clearInterval(iv);
    cards.forEach(function (c) { c.b.classList.remove("flip"); c.up = false; });
    msg.textContent = "Pick 2 cards that match! " + chances + " chances";
    busy = false;
  }, 1000);

  function flip(c, up) { c.up = up; c.b.classList.toggle("flip", up); }

  function tap(i) {
    if (busy || over) return;
    var c = cards[i];
    if (c.up) return;
    flip(c, true); picked.push(c);
    if (picked.length < 2) return;
    busy = true;
    var a = picked[0], b = picked[1]; picked = [];
    if (a.f === b.f) {
      a.b.classList.add("hit"); b.b.classList.add("hit");
      msg.textContent = "It's a match! 🎉";
      over = true;
      C.timeout(function () { C.winOrNot({ title: "Perfect match!", icon: "🃏", msg: "You found the matching " + SPECIAL.n + "!" }); }, 1100);
    } else {
      chances--; drawHearts();
      if (chances <= 0) {
        msg.textContent = "No chances left!";
        over = true;
        C.timeout(function () {
          flip(a, false); flip(b, false);
          cards.forEach(function (c) { if (c.f === SPECIAL) { flip(c, true); c.b.classList.add("hit"); } });
        }, 800);
        C.timeout(function () { C.result({ won: false, title: "So close!", icon: "🃏", msg: "The matching pair was " + SPECIAL.n + ". Try again!" }); }, 2400);
      } else {
        msg.textContent = "Not a match — " + chances + (chances === 1 ? " chance" : " chances") + " left";
        C.timeout(function () { flip(a, false); flip(b, false); busy = false; }, 900);
      }
    }
  }
};
