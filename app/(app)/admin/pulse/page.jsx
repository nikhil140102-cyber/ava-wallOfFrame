import { desc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { istToday, statusOf } from "@/lib/pulse";
import { PulseAdmin } from "./PulseAdmin";

export const metadata = { title: "Pulse Surveys" };
export const dynamic = "force-dynamic";

export default async function PulseAdminPage() {
  await requirePermission("surveys.manage");
  const [rows, counts, qcounts, settings] = await Promise.all([
    db
      .select({ sv: s.surveys, author: s.users.name })
      .from(s.surveys)
      .leftJoin(s.users, eq(s.users.id, s.surveys.createdBy))
      .orderBy(desc(s.surveys.createdAt)),
    db
      .select({ id: s.surveyResponses.surveyId, n: sql`count(*)` })
      .from(s.surveyResponses)
      .groupBy(s.surveyResponses.surveyId),
    db
      .select({ id: s.surveyQuestions.surveyId, n: sql`count(*)` })
      .from(s.surveyQuestions)
      .groupBy(s.surveyQuestions.surveyId),
    getSettings(),
  ]);
  const day = istToday();
  const n = (list, id) => Number(list.find((c) => c.id === id)?.n ?? 0);
  const surveys = rows.map(({ sv, author }) => ({
    id: sv.id,
    title: sv.title,
    frequency: sv.frequency,
    anonymous: sv.anonymous,
    startsOn: sv.startsOn,
    endsOn: sv.endsOn,
    status: statusOf(sv, day),
    author: author ?? "",
    responses: n(counts, sv.id),
    questions: n(qcounts, sv.id),
  }));
  return <PulseAdmin surveys={surveys} today={day} company={settings.companyName} />;
}
