import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getI18n } from "@/lib/i18n/server";
import { Icon } from "./Icon";

// Home → right column: how many badges you've earned out of all badges, with your latest ones.
// Counts the same way as the Badges page: every active badge, plus retired ones you still hold.
export async function MyBadgesCard({ userId }) {
  const { t, fmt } = await getI18n();
  const [all, mine] = await Promise.all([
    db.select({ id: s.badges.id, active: s.badges.active }).from(s.badges),
    db
      .select({ id: s.badges.id, name: s.badges.name, icon: s.badges.icon, color: s.badges.color, at: s.userBadges.awardedAt })
      .from(s.userBadges)
      .innerJoin(s.badges, eq(s.userBadges.badgeId, s.badges.id))
      .where(eq(s.userBadges.userId, userId))
      .orderBy(desc(s.userBadges.awardedAt)),
  ]);
  const mineIds = new Set(mine.map((b) => b.id));
  const total = all.filter((b) => b.active || mineIds.has(b.id)).length;
  const earned = mineIds.size;
  if (!total) return null;
  const latest = [...new Map(mine.map((b) => [b.id, b])).values()].slice(0, 6);

  return (
    <section className="card card-pad my-badges">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 className="headline" style={{ flex: 1 }}>
          {t("home.badges.title")}
        </h2>
        <Link href="/badges" className="caption" style={{ color: "var(--accent)", fontWeight: 600 }}>
          {t("home.top.seeAll")}
        </Link>
      </div>
      <p className="my-badges-count">
        <b className="num">{fmt.num(earned)}</b>
        <span className="num">/ {fmt.num(total)}</span>
      </p>
      <p className="caption" style={{ marginBottom: 10 }}>
        {t("home.badges.earned", { earned: fmt.num(earned), total: fmt.num(total) })}
      </p>
      <div
        className="progress"
        style={{ height: 8 }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={earned}
        aria-label={t("home.badges.earned", { earned: fmt.num(earned), total: fmt.num(total) })}
      >
        <span style={{ width: `${Math.round((earned / total) * 100)}%`, background: "linear-gradient(90deg, #3355E6, #7C3AED)" }} />
      </div>
      {latest.length > 0 ? (
        <div className="my-badges-row">
          {latest.map((b) => (
            <Link key={b.id} href={`/badges#${b.id}`} className="my-badge" title={b.name} aria-label={b.name} style={{ "--b": b.color }}>
              <Icon name={b.icon} size={18} />
            </Link>
          ))}
        </div>
      ) : (
        <Link href="/badges" className="caption" style={{ display: "block", marginTop: 12, color: "var(--accent)" }}>
          {t("home.badges.none")}
        </Link>
      )}
    </section>
  );
}
