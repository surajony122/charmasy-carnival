// Builds the HTML shell for the storefront game hub. The games themselves live in public/carnival/*.
export function buildPage({ assets, version, cfg, bundled, css }) {
  // JSON for an inline <script>: escape characters that could end the script or open Liquid tags.
  // Strings are stripped of braces/percent (Liquid) and "<" (script end) before being embedded.
  const safe = (v) =>
    JSON.stringify(v, (k, x) => (typeof x === "string" ? x.replace(/[{}%<>]/g, "") : x));
  const scripts = bundled
    ? `<script src="${assets}/all.js?v=${version}"></script>`
    : `<script src="${assets}/carnival.js?v=${version}"></script>\n  ` +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<script src="${assets}/games/g${n}.js?v=${version}"></script>`).join("\n  ");
  const origin = (() => { try { return new URL(assets).origin; } catch (e) { return ""; } })();
  return `{% layout none %}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script>
    window.CARNIVAL = Object.assign(${safe(cfg)}, {
      assets: ${safe(assets)},
      liquidEmail: {{ customer.email | default: '' | json }}
    });
  </script>
  <script>
    // Start the player's turn right away, while the game files are still downloading.
    (function () {
      try {
        var c = window.CARNIVAL, id = c.initialGame;
        if (!id || (!c.isTest && id !== c.activeGame)) return;
        var fd = new FormData();
        fd.append("intent", "play"); fd.append("orderId", c.orderId); fd.append("gameId", id);
        fd.append("attempt", "1"); fd.append("customerId", c.customerId || "");
        c.earlyPlay = { id: id, p: fetch(location.href, { method: "POST", body: fd }).then(function (r) { return r.json(); }) };
        c.earlyPlay.p.catch(function () {});
      } catch (e) {}
    })();
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Charmacy Carnival 2026</title>
  ${origin ? `<link rel="preconnect" href="${origin}" crossorigin>` : ""}
  ${css ? "" : `<link rel="preload" href="${assets}/carnival.css?v=${version}" as="style">`}
  ${bundled ? `<link rel="preload" href="${assets}/all.js?v=${version}" as="script">` : ""}
  <link rel="preload" href="${assets}/img/bg.jpg" as="image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${css
    // Inlined so the first paint does not wait for another download (image paths made absolute).
    ? `<style>${css.replace(/url\("img\//g, `url("${assets}/img/`)}</style>`
    : `<link rel="stylesheet" href="${assets}/carnival.css?v=${version}">`}
</head>
<body>
  <div id="app"></div>
  <noscript><p style="padding:24px;text-align:center">Please enable JavaScript to play the Carnival games.</p></noscript>
  ${scripts}
  <script>window.Carnival.start();</script>
</body>
</html>`;
}
