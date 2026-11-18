import "server-only";
import { asc, eq, gte, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { mondayOf } from "@/lib/pulse";

// Satisfaction report for Pulse surveys: how many answers are happy, neutral or unhappy.
//
//   Faces / stars (1–5):  4–5 = happy · 3 = neutral · 1–2 = unhappy
//   0–10 (eNPS):          9–10 = happy · 7–8 = neutral · 0–6 = unhappy
//
// A response with several rating questions counts as one person: their answers are averaged
// (happy +1, neutral 0, unhappy −1) and the average decides which group they fall in.
// Yes/no, choice and text questions are not counted — "yes" is not always the happy answer.

export const MIN_ANON = 3; // anonymous results stay hidden until at least this many people answered
export const RATED = ["mood", "scale", "nps"];

/** 1 = happy, 0 = neutral, -1 = unhappy, null = not a rating answer */
export function classify(type, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (type === "mood" || type === "scale") return n >= 4 ? 1 : n === 3 ? 0 : -1;
  if (type === "nps") return n >= 9 ? 1 : n >= 7 ? 0 : -1;
  return null;
}

const empty = () => ({ happy: 0, neutral: 0, unhappy: 0, total: 0 });
function add(bucket, c) {
  bucket.total++;
  if (c > 0) bucket.happy++;
  else if (c < 0) bucket.unhappy++;
  else bucket.neutral++;
}
const toClass = (avg) => (avg > 0.33 ? 1 : avg < -0.33 ? -1 : 0);

/**
 * people: one entry per response (a person's answer to one survey period).
 * byQuestion: Map(questionId → counts) for each rating question.
 */
export function satisfactionOf(questions, answers, responseIds) {
  const typeOf = new Map(questions.map((q) => [q.id, q.type]));
  const ids = responseIds instanceof Set ? responseIds : new Set(responseIds);
  const perResponse = new Map();
  const byQuestion = new Map(questions.filter((q) => RATED.includes(q.type)).map((q) => [q.id, empty()]));
  for (const a of answers) {
    if (!ids.has(a.responseId)) continue;
    const c = classify(typeOf.get(a.questionId), a.value);
    if (c === null) continue;
    add(byQuestion.get(a.questionId), c);
    const list = perResponse.get(a.responseId) ?? [];
    list.push(c);
    perResponse.set(a.responseId, list);
  }
  const people = empty();
  for (const list of perResponse.values()) add(people, toClass(list.reduce((x, y) => x + y, 0) / list.length));
  return { people, byQuestion, perResponse };
}

export const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/**
 * Drop answers that could identify someone in an anonymous survey: every period (week, day,
 * or the whole one-time survey) with fewer than MIN_ANON answers is left out.
 */
export function visibleResponses(sv, responses) {
  if (!sv.anonymous) return { visible: responses, small: [] };
  const count = new Map();
  for (const r of responses) count.set(r.period, (count.get(r.period) ?? 0) + 1);
  const small = [...count.keys()].filter((p) => count.get(p) < MIN_ANON);
  return { visible: responses.filter((r) => !small.includes(r.period)), small };
}

const istDay = (date) => new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/**
 * Company-wide report across every survey. `sinceDays` = null for all time.
 * Returns per-survey rows, the overall totals, and a week-by-week trend.
 */
export async function companyReport(sinceDays) {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : null;
  const surveys = await db.select().from(s.surveys).orderBy(asc(s.surveys.createdAt));
  if (!surveys.length) return { rows: [], overall: empty(), weeks: [], hiddenSurveys: 0 };
  const ids = surveys.map((x) => x.id);
  const [questions, responsesAll] = await Promise.all([
    db.select().from(s.surveyQuestions).where(inArray(s.surveyQuestions.surveyId, ids)),
    db
      .select({ id: s.surveyResponses.id, surveyId: s.surveyResponses.surveyId, period: s.surveyResponses.period, at: s.surveyResponses.createdAt })
      .from(s.surveyResponses)
      .where(since ? gte(s.surveyResponses.createdAt, since) : undefined),
  ]);
  const answers = responsesAll.length
    ? await db
        .select()
        .from(s.surveyAnswers)
        .where(
          inArray(
            s.surveyAnswers.responseId,
            responsesAll.map((r) => r.id)
          )
        )
    : [];

  const overall = empty();
  const weekMap = new Map();
  const rows = [];
  let hiddenSurveys = 0;
  for (const sv of surveys) {
    const qs = questions.filter((q) => q.surveyId === sv.id);
    if (!qs.some((q) => RATED.includes(q.type))) continue; // nothing to measure
    const { visible, small } = visibleResponses(
      sv,
      responsesAll.filter((r) => r.surveyId === sv.id)
    );
    const all = responsesAll.filter((r) => r.surveyId === sv.id).length;
    if (all === 0) continue;
    const { people, perResponse } = satisfactionOf(qs, answers, new Set(visible.map((r) => r.id)));
    if (people.total === 0) hiddenSurveys++;
    rows.push({ id: sv.id, title: sv.title, frequency: sv.frequency, anonymous: sv.anonymous, ...people, waiting: all - visible.length, smallPeriods: small.length });
    for (const k of ["happy", "neutral", "unhappy", "total"]) overall[k] += people[k];
    for (const r of visible) {
      const list = perResponse.get(r.id);
      if (!list) continue;
      const wk = mondayOf(istDay(r.at));
      const b = weekMap.get(wk) ?? empty();
      add(b, toClass(list.reduce((x, y) => x + y, 0) / list.length));
      weekMap.set(wk, b);
    }
  }
  const weeks = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([week, b]) => ({ week, ...b }))
    .filter((w) => w.total >= MIN_ANON);
  rows.sort((a, b) => b.total - a.total);
  return { rows, overall, weeks, hiddenSurveys };
}

/** Everything one survey's results need. */
export async function surveyData(id) {
  const sv = await db.select().from(s.surveys).where(eq(s.surveys.id, id)).get();
  if (!sv) return null;
  const [questions, responses] = await Promise.all([
    db.select().from(s.surveyQuestions).where(eq(s.surveyQuestions.surveyId, sv.id)).orderBy(asc(s.surveyQuestions.position)),
    db
      .select({ id: s.surveyResponses.id, period: s.surveyResponses.period, name: s.users.name, at: s.surveyResponses.createdAt })
      .from(s.surveyResponses)
      .leftJoin(s.users, eq(s.users.id, s.surveyResponses.userId))
      .where(eq(s.surveyResponses.surveyId, sv.id)),
  ]);
  const answers = responses.length
    ? await db
        .select()
        .from(s.surveyAnswers)
        .where(
          inArray(
            s.surveyAnswers.responseId,
            responses.map((r) => r.id)
          )
        )
    : [];
  return { sv, questions, responses, answers };
}
