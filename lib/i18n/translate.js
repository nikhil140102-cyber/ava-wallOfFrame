// Tiny translation engine shared by server and client — no library needed.
//   t("home.greeting.morning", { name: "Kannha" })     → "Good morning, Kannha"
//   t("wall.memories", { count: 3 })                    → picks "wall.memories_one" / "wall.memories_other"
// Missing keys fall back to English, then to the key itself, so nothing ever shows blank.

import { cloneElement, isValidElement } from "react";
import { localeInfo } from "./locales";

export function createTranslator(locale, messages, fallback = {}) {
  const info = localeInfo(locale);
  let plural;
  try {
    plural = new Intl.PluralRules(info.intl);
  } catch {
    plural = new Intl.PluralRules("en");
  }
  const lookup = (key) => messages[key] ?? fallback[key];

  function t(key, params) {
    let msg;
    if (params && typeof params.count === "number") {
      msg = lookup(`${key}_${plural.select(params.count)}`) ?? lookup(`${key}_other`);
    }
    msg = msg ?? lookup(key) ?? key;
    if (!params) return msg;
    return msg.replace(/\{(\w+)\}/g, (m, name) => (params[name] === undefined || params[name] === null ? m : String(params[name])));
  }
  return t;
}

/** Locale-aware dates, numbers and “2 days ago”, using the browser/Node built-in Intl. */
export { createFormatters, formattersFromData } from "./format";

/**
 * Rich sentences whose word order differs by language, with React elements inside:
 *   rich(t("post.thanked"), { author: <b>Syed</b>, people: <b>Kannha</b> })
 * where the message is e.g. "{author} thanked {people}" (English) or "{author} ने {people} को धन्यवाद दिया" (Hindi).
 * Returns an array of strings and elements — render it directly in JSX.
 */
export function rich(message, values) {
  const out = [];
  let last = 0;
  for (const m of message.matchAll(/\{(\w+)\}/g)) {
    if (m.index > last) out.push(message.slice(last, m.index));
    out.push(values[m[1]] ?? m[0]);
    last = m.index + m[0].length;
  }
  if (last < message.length) out.push(message.slice(last));
  return out.map((part, i) => (isValidElement(part) ? cloneElement(part, { key: part.key ?? `r${i}` }) : part));
}
