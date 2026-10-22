"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { awardBadge } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";

export function AwardBadgeButton({ userId, name, badges }) {
  const { toast } = useApp();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const first = name.split(" ")[0];
  const groups = [...new Set(badges.map((b) => b.category))];

  return (
    <>
      <button
        className="btn"
        onClick={() => setOpen(true)}
        disabled={!badges.length}
        title={badges.length ? undefined : t("profile.award.hasAll")}
      >
        <Icon name="award" size={15} /> {t("profile.award.button")}
      </button>
      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="award-title">
            <div className="sheet-head">
              <button className="btn btn-plain" onClick={() => setOpen(false)}>
                {t("profile.award.cancel")}
              </button>
              <h2 id="award-title">{t("profile.award.title", { name: first })}</h2>
              <button
                className="btn btn-plain"
                style={{ fontWeight: 700 }}
                disabled={!badge || pending}
                onClick={async () => {
                  setPending(true);
                  const r = await awardBadge(userId, badge, message);
                  setPending(false);
                  if (!r.ok) return toast(r.error, { tone: "error" });
                  setOpen(false);
                  toast(t("profile.award.toast", { name: first }));
                }}
              >
                {t("profile.award.submit")}
              </button>
            </div>
            <div className="sheet-body stack" style={{ gap: 18 }}>
              {groups.map((g) => (
                <div key={g}>
                  <div className="rec-label">{g}</div>
                  <div className="rec-badges">
                    {badges
                      .filter((b) => b.category === g)
                      .map((b) => (
                        <button key={b.id} className="rec-badge" aria-pressed={badge === b.id} onClick={() => setBadge(b.id)}>
                          <span style={{ background: `color-mix(in srgb, ${b.color} 14%, transparent)`, color: b.color }}>
                            <Icon name={b.icon} size={18} />
                          </span>
                          {b.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
              <div>
                <label className="rec-label" htmlFor="award-msg">
                  {t("profile.award.why")}{" "}
                  <span className="tertiary" style={{ fontWeight: 400 }}>
                    {t("profile.award.whyHint")}
                  </span>
                </label>
                <textarea
                  id="award-msg"
                  className="field"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={300}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
