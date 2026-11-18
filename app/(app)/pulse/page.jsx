import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { openSurveysFor } from "@/lib/pulse";
import { PulseList } from "./PulseList";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("pulse.title") };
}

export default async function PulsePage() {
  const user = await requireUser();
  const surveys = await openSurveysFor(user.id);
  return <PulseList surveys={surveys} />;
}
