/* Game 9 — Beauty Word Puzzle: find only 2 hidden words (diagonals and reversed words included) */
window.CarnivalGames[9] = function (C) {
  var N = 10, TIME = 60;
  var POOL = ["BLUSH", "SHADE", "GLITTER", "LIPSTICK", "MASCARA", "EYELINER", "PRIMER", "CHARM", "SERUM", "KAJAL", "LASHES", "SPARKLE", "GLOSS", "POWDER"];
  var DIRS = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, 1], [1, -1], [-1, -1]];
  var words = C.shuffle(POOL).slice(0, 2).sort(function (a, b) { return b.length - a.length; });

  // build the grid
  var grid = [], r, c;
  for (r = 0; r < N; r++) { grid.push([]); for (c = 0; c < N; c++) grid[r].push(""); }
  words.forEach(function (w, idx) {
    for (var tries = 0; tries < 300; tries++) {
      // first word: any direction; second word: keep it a little easier (forward or diagonal-down)
      var d = idx === 0 ? C.pick(DIRS) : C.pick(DIRS.slice(0, 3).concat([DIRS[3]]));
      var r0 = Math.floor(Math.random() * N), c0 = Math.floor(Math.random() * N);
      var r1 = r0 + d[0] * (w.length - 1), c1 = c0 + d[1] * (w.length - 1);
      if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
      var ok = true;
      for (var i = 0; i < w.length; i++) { var ch = grid[r0 + d[0] * i][c0 + d[1] * i]; if (ch && ch !== w[i]) { ok = false; break; } }
      if (!ok) continue;
      for (i = 0; i < w.length; i++) grid[r0 + d[0] * i][c0 + d[1] * i] = w[i];
      return;
    }
  });
  var letters = words.join("") + "AEIOURSTLNMCHBD";
  for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = letters[Math.floor(Math.random() * letters.length)];

  C.root.appendChild(C.el("div", "dom-bg"));
  C.bunting();
  var top = C.el("div", "pz-top", '<h2>Find 2 hidden words</h2>'); C.root.appendChild(top);
  var gridEl = C.el("div", "pz-grid"); C.root.appendChild(gridEl);
  var cells = [];
  for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
    var cell = C.el("div", "pz-cell", grid[r][c]); cell.dataset.r = r; cell.dataset.c = c;
    gridEl.appendChild(cell); cells.push(cell);
  }
  var wordsEl = C.el("div", "pz-words", words.map(function (w) { return "<span data-w='" + w + "'>" + w + "</span>"; }).join(""));
  C.root.appendChild(wordsEl);
  var note = C.el("div", "pz-note", "Drag across the letters in a straight line · 60 seconds");
  C.root.appendChild(note);

  var timeLeft = TIME, found = {}, over = false, start = null, path = [];
  var clock = C.el("div", "chip", "⏱ " + TIME); clock.style.cssText = "position:absolute;right:12px;top:40px;z-index:6";
  C.root.appendChild(clock);

  function cellAt(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.classList && el.classList.contains("pz-cell") ? { r: +el.dataset.r, c: +el.dataset.c } : null;
  }
  function line(a, b) {
    var dr = b.r - a.r, dc = b.c - a.c;
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    var n = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc), out = [];
    for (var i = 0; i <= n; i++) out.push({ r: a.r + sr * i, c: a.c + sc * i });
    return out;
  }
  function paint() {
    cells.forEach(function (x) { x.classList.remove("sel"); });
    path.forEach(function (p) { cells[p.r * N + p.c].classList.add("sel"); });
  }
  C.on(gridEl, "pointerdown", function (e) {
    if (over) return; e.preventDefault();
    start = cellAt(e); if (start) { path = [start]; paint(); }
  });
  C.on(window, "pointermove", function (e) {
    if (!start || over) return;
    var cur = cellAt(e); if (!cur) return;
    var l = line(start, cur); if (l) { path = l; paint(); }
  });
  C.on(window, "pointerup", function () {
    if (!start) return;
    var s = path.map(function (p) { return grid[p.r][p.c]; }).join(""), rev = s.split("").reverse().join(""), hit = null;
    words.forEach(function (w) { if (!found[w] && (w === s || w === rev)) hit = w; });
    if (hit) {
      found[hit] = true;
      path.forEach(function (p) { var x = cells[p.r * N + p.c]; x.classList.remove("sel"); x.classList.add("done"); });
      wordsEl.querySelector("[data-w='" + hit + "']").classList.add("found");
      note.textContent = "Found " + hit + "! ✨";
      if (words.every(function (w) { return found[w]; })) {
        over = true;
        C.timeout(function () { C.winOrNot({ title: "Puzzle solved!", icon: "🧩", msg: "You found both hidden words!" }); }, 900);
      }
    }
    start = null; path = []; paint();
  });

  var shown = TIME;
  C.raf(function (dt) {
    if (over) return;
    timeLeft -= dt;
    var s = Math.max(0, Math.ceil(timeLeft));
    if (s !== shown) { shown = s; clock.textContent = "⏱ " + s; }
    if (timeLeft <= 0) {
      over = true;
      C.timeout(function () { C.result({ won: false, title: "Time's up!", icon: "⏱", msg: "The words were " + words.join(" and ") + ". Try again!" }); }, 500);
    }
  });
};
