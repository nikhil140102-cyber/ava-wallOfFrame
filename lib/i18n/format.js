// Dates, numbers, "3 days ago" and "A, B and C" in the reader's language.
//
// Why not just call Intl in the browser? Node and each browser ship different language data
// (Chrome writes "अक्तू" where Node writes "अक्टू", orders day/month differently, and has no Kashmiri at
// all), so the same date would render differently on the server and in the browser — React then throws
// a hydration error. Instead the server builds a small table per language from its own Intl data
// (buildFormatData), passes it to the browser, and BOTH sides format from that table (formattersFromData).
//
// Everything is shown in India time (one company, one time zone) with 0–9 digits in every language.

import { localeInfo } from "./locales";

export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30, no daylight saving

// Every date style the app uses. Add a line here if a new one is needed (unknown styles fall back to Intl).
const DATE_STYLES = [
  { day: "numeric", month: "short", year: "numeric" },
  { day: "numeric", month: "short" },
  { day: "numeric", month: "long" },
  { day: "numeric", month: "long", year: "numeric" },
  { weekday: "long", day: "numeric", month: "long" },
  { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  { month: "long" },
  { month: "long", year: "numeric" },
];
const DEFAULT_DATE = DATE_STYLES[0];

const styleKey = (o = {}) =>
  ["weekday", "day", "month", "year"]
    .filter((k) => o[k])
    .map((k) => `${k}:${o[k]}`)
    .join(",");

// How far each unit goes before the next bigger one takes over (see timeAgo below).
const REL_UNITS = [
  ["year", 31_536_000, 30],
  ["month", 2_592_000, 12],
  ["week", 604_800, 5],
  ["day", 86_400, 7],
  ["hour", 3_600, 24],
  ["minute", 60, 60],
];

function tryIntl(make, fallback) {
  try {
    return make();
  } catch {
    return fallback();
  }
}

/* ---------------------------------------------------------------- building (server) */

const built = new Map();

/** The language table. Runs on the server (Node has full language data); cached per language. */
export function buildFormatData(locale) {
  if (built.has(locale)) return built.get(locale);
  const base = localeInfo(locale).intl;
  const tag = `${base}-u-nu-latn`;

  // Dates: for each style, the order of the parts plus the month / weekday names that style uses.
  const dates = {};
  for (const style of DATE_STYLES) {
    const dtf = tryIntl(
      () => new Intl.DateTimeFormat(tag, { ...style, timeZone: TIME_ZONE }),
      () => new Intl.DateTimeFormat("en-IN", { ...style, timeZone: TIME_ZONE })
    );
    // 15 Jan 2025 (a Wednesday), noon in India.
    const sample = Date.UTC(2025, 0, 15, 6, 30);
    const parts = dtf.formatToParts(sample).map((p) => (p.type === "literal" ? p.value : { t: p.type }));
    const months = style.month
      ? Array.from({ length: 12 }, (_, m) => dtf.formatToParts(Date.UTC(2025, m, 15, 6, 30)).find((p) => p.type === "month")?.value ?? "")
      : null;
    // 12–18 Jan 2026 is Mon…Sun → store as Sun…Sat (getUTCDay order).
    const weekdays = style.weekday
      ? Array.from({ length: 7 }, (_, d) => dtf.formatToParts(Date.UTC(2026, 0, 11 + d, 6, 30)).find((p) => p.type === "weekday")?.value ?? "")
      : null;
    dates[styleKey(style)] = { parts, months, weekdays };
  }

  // "3 days ago" / "in 2 weeks" / "yesterday": a pattern per number, deduplicated.
  const rtf = tryIntl(
    () => new Intl.RelativeTimeFormat(tag, { numeric: "auto" }),
    () => new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  );
  const rel = {};
  for (const [unit, , max] of [...REL_UNITS, ["second", 1, 0]]) {
    const pats = [];
    const idx = {};
    for (let n = -max; n <= max; n++) {
      const s = rtf.format(n, unit);
      const digits = String(Math.abs(n));
      const pat = n !== 0 && s.includes(digits) ? s.replace(digits, "{n}") : s;
      let i = pats.indexOf(pat);
      if (i < 0) i = pats.push(pat) - 1;
      idx[n] = i;
    }
    rel[unit] = { max, pats, idx };
  }

  // "A, B and C": separators taken from 2- and 3-item lists.
  const list = tryIntl(
    () => {
      const lf = new Intl.ListFormat(tag, { type: "conjunction" });
      const seps = (n) => {
        const out = [];
        let pending = "";
        for (const p of lf.formatToParts(Array.from({ length: n }, (_, i) => `#${i}`))) {
          if (p.type === "element") {
            out.push(pending);
            pending = "";
          } else pending += p.value;
        }
        out.push(pending); // after the last item
        return out;
      };
      return { two: seps(2), three: seps(3) };
    },
    () => ({ two: ["", " and ", ""], three: ["", ", ", " and ", ""] })
  );

  const data = { tag: base, dates, rel, list };
  built.set(locale, data);
  return data;
}

/* ---------------------------------------------------------------- formatting (server + browser) */

/** 1234567 → "12,34,567" (Indian grouping, 0–9 digits), the same in every language. */
function formatNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toString().split(".");
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${rest ? `${rest},${last3}` : last3}${dec ? `.${dec}` : ""}`;
}

/** Formatters built only from the table — identical output on the server and in any browser. */
export function formattersFromData(data) {
  const ist = (ms) => new Date(Number(ms) + IST_OFFSET_MS); // read with getUTC*

  function date(ms, opts = DEFAULT_DATE) {
    const d = ist(ms instanceof Date ? ms.getTime() : ms);
    const style = data.dates[styleKey(opts)];
    if (!style) {
      // A style not in DATE_STYLES: use Intl directly (may differ slightly between server and browser).
      return tryIntl(
        () => new Date(Number(ms)).toLocaleDateString(`${data.tag}-u-nu-latn`, { ...opts, timeZone: TIME_ZONE }),
        () => new Date(Number(ms)).toLocaleDateString("en-IN", { ...opts, timeZone: TIME_ZONE })
      );
    }
    return style.parts
      .map((p) => {
        if (typeof p === "string") return p;
        if (p.t === "day") return String(d.getUTCDate());
        if (p.t === "month") return style.months?.[d.getUTCMonth()] ?? "";
        if (p.t === "year") return String(d.getUTCFullYear());
        if (p.t === "weekday") return style.weekdays?.[d.getUTCDay()] ?? "";
        return "";
      })
      .join("");
  }

  function rel(n, unit) {
    const r = data.rel[unit];
    const k = Math.max(-r.max, Math.min(r.max, n));
    return r.pats[r.idx[k]].replace("{n}", formatNumber(Math.abs(n)));
  }

  function timeAgo(ms) {
    const diff = (Number(ms) - Date.now()) / 1000;
    const abs = Math.abs(diff);
    for (const [unit, sec] of REL_UNITS) if (abs >= sec) return rel(Math.round(diff / sec), unit);
    return rel(0, "second");
  }

  /** Separator before each of `count` items, e.g. ["", ", ", " and "]. */
  function listSeps(count) {
    if (count <= 1) return [""];
    const { two, three } = data.list;
    if (count === 2) return two.slice(0, 2);
    return [three[0], ...Array(count - 2).fill(three[1]), three[2]];
  }
  /** Text after the last item (a few languages close the list with a word). */
  const listEnd = (count) => (count <= 1 ? "" : count === 2 ? data.list.two[2] : data.list.three[3]) ?? "";

  function list(items) {
    const seps = listSeps(items.length);
    return items.map((x, i) => `${seps[i] ?? ""}${x}`).join("") + listEnd(items.length);
  }

  return { tag: data.tag, num: formatNumber, date, timeAgo, list, listSeps, listEnd };
}

/** Server-side shortcut. */
export function createFormatters(locale) {
  return formattersFromData(buildFormatData(locale));
}
