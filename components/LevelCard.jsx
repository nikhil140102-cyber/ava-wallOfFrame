"use client";

import Link from "next/link";
import { useApp } from "./shell/AppContext";
import { Icon } from "./Icon";
import { useI18n } from "./I18nProvider";

/** Activity-ring style level card: progress to the next level, balance and giving budget. */
export function LevelCard() {
  const { data } = useApp();
  const { t, fmt } = useI18n();
  const { level, balance, budget } = data;
  const r = 34;
  const c = 2 * Math.PI * r;
  const left = Math.max(0, budget.monthly - budget.used);
  return (
    <section className="card card-pad level-card">
      <div className="row" style={{ gap: 16, alignItems: "center" }}>
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
          <circle cx="42" cy="42" r={r} fill="none" stroke="var(--fill)" strokeWidth="9" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={level.color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (level.nextName ? level.progress : 1))}
            transform="rotate(-90 42 42)"
            style={{ transition: "stroke-dashoffset 0.8s var(--ease)" }}
          />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="caption">{t("level.yourLevel")}</div>
          <div className="title-2" style={{ color: level.color }}>
            {level.name}
          </div>
          <div className="caption">
            {level.nextName ? t("level.toNext", { points: fmt.num(level.toNext), level: level.nextName }) : t("level.topReached")}
          </div>
        </div>
      </div>
      <div className="level-stats">
        <Link href="/rewards">
          <span className="caption">{t("level.balance")}</span>
          <b className="num">{fmt.num(balance)}</b>
          <span className="caption">{t("level.pointsToSpend")}</span>
        </Link>
        <div>
          <span className="caption">{t("level.leftToGive")}</span>
          <b className="num">{left}</b>
          <span className="caption">{t("level.ofThisMonth", { total: budget.monthly })}</span>
        </div>
      </div>
      <Link
        href="/rewards"
        className="row caption"
        style={{ marginTop: 12, color: "var(--accent)", fontWeight: 600, fontSize: 13, gap: 4 }}
      >
        {t("level.browseRewards")} <Icon name="chevronRight" size={13} stroke={2.4} />
      </Link>
    </section>
  );
}
