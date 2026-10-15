import Link from "next/link";
import { Icon } from "./Icon";

/** Role-aware to-do card on Home: only shows what this person can act on right now. */
export function NeedsYou({ tasks }) {
  if (!tasks.length) return null;
  return (
    <section className="card card-pad" aria-label="Needs your attention">
      <h2 className="headline" style={{ marginBottom: 6 }}>
        Needs you
      </h2>
      {tasks.map((t) => (
        <Link key={t.key} href={t.href} className="rail-row task-row">
          <span className="task-icon" style={{ color: t.tint, background: `color-mix(in srgb, ${t.tint} 13%, transparent)` }}>
            <Icon name={t.icon} size={17} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{t.title}</b>
            <span className="caption">{t.detail}</span>
          </span>
          <span className="task-cta">{t.cta}</span>
        </Link>
      ))}
    </section>
  );
}
