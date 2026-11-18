import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { openSurveysFor } from "@/lib/pulse";
import { Icon } from "./Icon";

// Home → right column: shown only when a pulse survey is waiting for you.
export async function PulseCard({ userId }) {
  const surveys = await openSurveysFor(userId);
  if (!surveys.length) return null;
  const { t } = await getI18n();
  const sv = surveys[0];
  return (
    <section className="card card-pad pulse-home">
      <div className="row" style={{ gap: 10, marginBottom: 8 }}>
        <span className="pulse-icon">
          <Icon name="heart" size={18} />
        </span>
        <span className="pulse-home-label">{t("pulse.homeLabel")}</span>
        {surveys.length > 1 && <span className="tag tag-accent">+{surveys.length - 1}</span>}
      </div>
      <h2 className="headline" dir="auto">
        {sv.title}
      </h2>
      <p className="caption" style={{ marginTop: 2 }}>
        {t("pulse.questions", { count: sv.questions.length })} · {sv.anonymous ? t("pulse.anonymous") : t("pulse.named")}
      </p>
      <Link href={`/pulse#${sv.id}`} className="btn btn-filled btn-sm" style={{ marginTop: 12 }}>
        {t("pulse.answerNow")} <Icon name="chevronRight" size={14} />
      </Link>
    </section>
  );
}
