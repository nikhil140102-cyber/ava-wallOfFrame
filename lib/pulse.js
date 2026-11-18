import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";

// Pulse surveys run on India time. A "period" is how often someone may answer:
//   once   → "once"
//   daily  → "2026-11-18"
//   weekly → "2026-11-16"  (the Monday of that week)

export const QUESTION_TYPES = ["scale", "mood", "nps", "choice", "multi", "yesno", "text"];

export function istToday(now = Date.now()) {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

export function mondayOf(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function periodFor(frequency, day = istToday()) {
  if (frequency === "daily") return day;
  if (frequency === "weekly") return mondayOf(day);
  return "once";
}

export function isOpen(survey, day = istToday()) {
  return survey.active && survey.startsOn <= day && (!survey.endsOn || day <= survey.endsOn);
}

/** "upcoming" | "open" | "ended" | "paused" */
export function statusOf(survey, day = istToday()) {
  if (!survey.active) return "paused";
  if (survey.startsOn > day) return "upcoming";
  if (survey.endsOn && day > survey.endsOn) return "ended";
  return "open";
}

export async function questionsFor(surveyIds) {
  if (!surveyIds.length) return new Map();
  const rows = await db
    .select()
    .from(s.surveyQuestions)
    .where(inArray(s.surveyQuestions.surveyId, surveyIds))
    .orderBy(asc(s.surveyQuestions.position));
  const map = new Map();
  for (const q of rows) {
    if (!map.has(q.surveyId)) map.set(q.surveyId, []);
    map.get(q.surveyId).push({ id: q.id, type: q.type, prompt: q.prompt, options: q.options ?? [], required: q.required });
  }
  return map;
}

/** Surveys this person can answer right now (open, and not yet answered in the current period). */
export async function openSurveysFor(userId) {
  const day = istToday();
  const all = (await db.select().from(s.surveys).where(eq(s.surveys.active, true))).filter((sv) => isOpen(sv, day));
  if (!all.length) return [];
  const answered = await db
    .select({ surveyId: s.surveyResponses.surveyId, period: s.surveyResponses.period })
    .from(s.surveyResponses)
    .where(and(eq(s.surveyResponses.userId, userId), inArray(s.surveyResponses.surveyId, all.map((x) => x.id))));
  const done = new Set(answered.map((a) => `${a.surveyId}|${a.period}`));
  const todo = all.filter((sv) => !done.has(`${sv.id}|${periodFor(sv.frequency, day)}`));
  const qs = await questionsFor(todo.map((x) => x.id));
  return todo
    .map((sv) => ({
      id: sv.id,
      title: sv.title,
      intro: sv.intro,
      anonymous: sv.anonymous,
      frequency: sv.frequency,
      endsOn: sv.endsOn,
      questions: qs.get(sv.id) ?? [],
    }))
    .filter((sv) => sv.questions.length);
}
