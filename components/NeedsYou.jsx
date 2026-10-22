import Link from "next/link";
import { Icon } from "./Icon";
import { getI18n } from "@/lib/i18n/server";

/** Role-aware to-do card on Home: only shows what this person can act on right now. */
export async function NeedsYou({ tasks }) {
  if (!tasks.length) return null;
  const { t } = await getI18n();
  return (
    <section className="card card-pad" aria-label={t("home.needsYou.label")}>
      <h2 className="headline" style={{ marginBottom: 6 }}>
        {t("home.needsYou.title")}
      </h2>
      {tasks.map((task) => (
        <Link key={task.key} href={task.href} className="rail-row task-row">
          <span className="task-icon" style={{ color: task.tint, background: `color-mix(in srgb, ${task.tint} 13%, transparent)` }}>
            <Icon name={task.icon} size={17} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{task.title}</b>
            <span className="caption">{task.detail}</span>
          </span>
          <span className="task-cta">{task.cta}</span>
        </Link>
      ))}
    </section>
  );
}
