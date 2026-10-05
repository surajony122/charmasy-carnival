// Combines the storefront game files into ONE minified file (public/carnival/all.js) so a customer's phone
// makes one request instead of eleven. Runs as part of `npm run build`.
import { readFileSync, writeFileSync } from "node:fs";
import { transform } from "esbuild";

const dir = "public/carnival/";
const files = ["carnival.js", ...Array.from({ length: 9 }, (_, i) => `games/g${i + 1}.js`)];
const src = files.map((f) => `/* ${f} */\n` + readFileSync(dir + f, "utf8")).join("\n;\n");
const out = await transform(src, { minify: true, target: "es2018", loader: "js" });
writeFileSync(dir + "all.js", out.code);
console.log(`[bundle] public/carnival/all.js ${(src.length / 1024).toFixed(0)} KB -> ${(out.code.length / 1024).toFixed(0)} KB`);
