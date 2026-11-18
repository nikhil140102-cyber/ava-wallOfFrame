import { requirePermission } from "@/lib/auth";
import { companyReport, MIN_ANON, pct, RATED, satisfactionOf, surveyData, visibleResponses } from "@/lib/pulse-report";

export const dynamic = "force-dynamic";

// CSV download (opens in Excel / Google Sheets) — for one survey (?survey=id&p=period) or
// the company report (?range=30|90|all). Anonymous surveys never include names, and periods
// with fewer than 3 answers are left out, exactly like the screens.

const cell = (v) => {
  const t = String(v ?? "");
  return /[",\n\r]/.test(t) || /^[=+\-@]/.test(t) ? `"${(/^[=+\-@]/.test(t) ? "'" : "") + t.replace(/"/g, '""')}"` : t;
};
const csv = (rows) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "survey";

function file(name, rows) {
  return new Response(csv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

const satRows = (label, b) => [
  [label, "Happy", "Neutral", "Not happy", "Total", "% happy", "% neutral", "% not happy"],
  ["", b.happy, b.neutral, b.unhappy, b.total, pct(b.happy, b.total), pct(b.neutral, b.total), pct(b.unhappy, b.total)],
];

export async function GET(req) {
  await requirePermission("surveys.manage");
  const url = new URL(req.url);
  const id = url.searchParams.get("survey");

  if (!id) {
    const range = { 30: 30, 90: 90 }[url.searchParams.get("range")] ?? null;
    const { rows, overall, weeks } = await companyReport(url.searchParams.get("range") === "all" ? null : range ?? 30);
    const out = [
      ["Satisfaction report", range ? `Last ${range} days` : url.searchParams.get("range") === "all" ? "All time" : "Last 30 days", `Downloaded ${today()}`],
      [],
      ...satRows("Everyone", overall),
      [],
      ["Survey", "Frequency", "Anonymous", "Happy", "Neutral", "Not happy", "Responses", "% happy"],
      ...rows.map((r) => [r.title, r.frequency, r.anonymous ? "yes" : "no", r.happy, r.neutral, r.unhappy, r.total, pct(r.happy, r.total)]),
      [],
      ["Week starting", "Happy", "Neutral", "Not happy", "Responses", "% happy"],
      ...weeks.map((w) => [w.week, w.happy, w.neutral, w.unhappy, w.total, pct(w.happy, w.total)]),
      [],
      ["Happy = 4-5 faces or stars (9-10 on 0-10). Neutral = 3 (7-8). Not happy = 1-2 (0-6)."],
    ];
    return file(`satisfaction-report-${today()}.csv`, out);
  }

  const data = await surveyData(id);
  if (!data) return new Response("Not found", { status: 404 });
  const { sv, questions, answers } = data;
  const p = url.searchParams.get("p");
  let responses = data.responses;
  if (p && p !== "all") responses = responses.filter((r) => r.period === p);
  const { visible } = visibleResponses(sv, responses);
  if (sv.anonymous && visible.length < MIN_ANON) return new Response("Not enough answers yet to keep this survey anonymous.", { status: 403 });
  const ids = new Set(visible.map((r) => r.id));
  const sat = satisfactionOf(questions, answers, ids);
  const mine = answers.filter((a) => ids.has(a.responseId));

  const out = [
    [sv.title, `${sv.frequency}`, sv.anonymous ? "Anonymous" : "Names visible", p && p !== "all" ? `Period ${p}` : "All time", `Downloaded ${today()}`],
    ["Responses", visible.length],
    [],
    ...satRows("How happy people are", sat.people),
    [],
    ["#", "Question", "Type", "Answer", "Count", "%"],
  ];
  questions.forEach((q, i) => {
    const qa = mine.filter((a) => a.questionId === q.id);
    const push = (label, n, total = qa.length) => out.push([i + 1, q.prompt, q.type, label, n, pct(n, total)]);
    if (q.type === "mood" || q.type === "scale") for (let n = 5; n >= 1; n--) push(`${n}`, qa.filter((a) => Number(a.value) === n).length);
    else if (q.type === "nps") for (let n = 10; n >= 0; n--) push(`${n}`, qa.filter((a) => Number(a.value) === n).length);
    else if (q.type === "yesno") ["yes", "no"].forEach((v) => push(v, qa.filter((a) => a.value === v).length));
    else if (q.type === "choice") (q.options ?? []).forEach((o) => push(o, qa.filter((a) => a.value === o).length));
    else if (q.type === "multi") (q.options ?? []).forEach((o) => push(o, qa.filter((a) => JSON.parse(a.value || "[]").includes(o)).length));
    else qa.forEach((a) => out.push([i + 1, q.prompt, q.type, a.value, "", ""]));
    const b = sat.byQuestion.get(q.id);
    if (RATED.includes(q.type) && b) out.push([i + 1, q.prompt, q.type, `Happy ${b.happy} / Neutral ${b.neutral} / Not happy ${b.unhappy}`, b.total, pct(b.happy, b.total)]);
  });

  if (!sv.anonymous) {
    out.push([], ["Name", "Period", ...questions.map((q) => q.prompt)]);
    for (const r of visible) {
      out.push([
        r.name,
        r.period,
        ...questions.map((q) => {
          const a = mine.find((x) => x.responseId === r.id && x.questionId === q.id);
          return a ? (q.type === "multi" ? JSON.parse(a.value).join("; ") : a.value) : "";
        }),
      ]);
    }
  }
  return file(`${slug(sv.title)}-${p && p !== "all" ? p : "all"}.csv`, out);
}
