// Builds the HTML shell for the storefront game hub. The games themselves live in public/carnival/*.
export function buildPage({ assets, version, cfg }) {
  // JSON for an inline <script>: escape characters that could end the script or open Liquid tags.
  // Strings are stripped of braces/percent (Liquid) and "<" (script end) before being embedded.
  const safe = (v) =>
    JSON.stringify(v, (k, x) => (typeof x === "string" ? x.replace(/[{}%<>]/g, "") : x));
  const games = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((n) => `<script src="${assets}/games/g${n}.js?v=${version}"></script>`)
    .join("\n  ");
  return `{% layout none %}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Charmacy Carnival 2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${assets}/carnival.css?v=${version}">
</head>
<body>
  <div id="app"></div>
  <noscript><p style="padding:24px;text-align:center">Please enable JavaScript to play the Carnival games.</p></noscript>
  <script>
    window.CARNIVAL = Object.assign(${safe(cfg)}, {
      assets: ${safe(assets)},
      liquidEmail: {{ customer.email | default: '' | json }}
    });
  </script>
  <script src="${assets}/carnival.js?v=${version}"></script>
  ${games}
  <script>window.Carnival.start();</script>
</body>
</html>`;
}
