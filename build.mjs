import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const out = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const readDir = (dir, ext) =>
  readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => readFileSync(join(dir, f), "utf8"));

const css = readDir(join(src, "styles"), ".css").join("");
const js = "\n(function(){\n" + readDir(join(src, "js"), ".js").join("") + "})();\n";
const ach = readFileSync(join(src, "assets", "achievements.json"), "utf8");

let html = readFileSync(join(src, "index.html"), "utf8");
for (const [key, val] of [["css", css], ["ach", ach], ["js", js]]) {
  const tag = `/*@inject:${key}*/`;
  if (!html.includes(tag)) throw new Error(`Missing ${tag} in src/index.html`);
  html = html.split(tag).join(val);
}

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "public"), out, { recursive: true });
rmSync(join(out, "sw.template.js"));
writeFileSync(join(out, "index.html"), html);

const hash = createHash("sha256").update(html).digest("hex").slice(0, 8);
const version = `${pkg.version}-${hash}`;
const sw = readFileSync(join(root, "public", "sw.template.js"), "utf8").replace("__VERSION__", version);
writeFileSync(join(out, "sw.js"), sw);

console.log(`Built dist/ (cache ${version}, ${(html.length / 1024).toFixed(0)} KB)`);
