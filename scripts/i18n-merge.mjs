// Combines lib/i18n/messages/en/<area>.json into lib/i18n/messages/en.json (flat "area.key" → text),
// then checks every translation file: same keys, same {placeholders}, nothing empty.
import fs from "node:fs";
import path from "node:path";

const dir = path.join("lib", "i18n", "messages");
const enDir = path.join(dir, "en");
const en = {};
for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith(".json")).sort()) {
  const ns = file.replace(/\.json$/, "");
  const obj = JSON.parse(fs.readFileSync(path.join(enDir, file), "utf8"));
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string") throw new Error(`${file}: "${k}" must be a string`);
    en[`${ns}.${k}`] = v;
  }
}
fs.writeFileSync(path.join(dir, "en.json"), JSON.stringify(en, null, 2) + "\n");
console.log(`en.json: ${Object.keys(en).length} strings`);

const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
let problems = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const tr = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const missing = Object.keys(en).filter((k) => !(k in tr));
  const extra = Object.keys(tr).filter((k) => !(k in en));
  const badPh = Object.keys(tr).filter((k) => k in en && ph(tr[k]) !== ph(en[k]));
  const empty = Object.keys(tr).filter((k) => !String(tr[k]).trim());
  const n = missing.length + badPh.length + empty.length;
  problems += n;
  console.log(
    `${file.padEnd(10)} ${Object.keys(tr).length} strings` +
      (missing.length ? ` · ${missing.length} missing` : "") +
      (extra.length ? ` · ${extra.length} unused` : "") +
      (badPh.length ? ` · ${badPh.length} placeholder mismatch (${badPh.slice(0, 3).join(", ")})` : "") +
      (empty.length ? ` · ${empty.length} empty` : "")
  );
}
if (process.argv.includes("--strict") && problems) process.exit(1);
