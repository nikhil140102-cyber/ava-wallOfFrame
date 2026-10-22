"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useApp } from "./shell/AppContext";
import { useI18n } from "./I18nProvider";

/** First-week checklist. Each step completes itself from real activity; people can hide it any time. */
export function GettingStarted({ steps }) {
  const { data, openRecognize } = useApp();
  const { t } = useI18n();
  const storageKey = `wof-onboarding-hidden-${data.me.id}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [storageKey]);

  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;

  return (
    <section className="card card-pad onboarding" aria-label={t("home.gettingStarted.label")}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2 className="headline">{t("home.gettingStarted.title")}</h2>
          <p className="caption">{t("home.gettingStarted.progress", { done, total: steps.length })}</p>
        </div>
        <button
          className="btn btn-plain btn-sm"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, "1");
            } catch {}
            setHidden(true);
          }}
        >
          {t("home.gettingStarted.hide")}
        </button>
      </div>
      <div className="progress" style={{ margin: "12px 0 6px" }}>
        <span style={{ width: `${(done / steps.length) * 100}%`, background: "var(--green)" }} />
      </div>
      <ol className="steps">
        {steps.map((s, i) => {
          const body = (
            <>
              <span className="step-check" data-done={s.done || undefined}>
                {s.done ? <Icon name="check" size={13} stroke={3} /> : i + 1}
              </span>
              <span style={{ flex: 1 }}>{s.label}</span>
              {!s.done && <Icon name="chevronRight" size={14} className="chev" />}
            </>
          );
          return (
            <li key={s.key} data-done={s.done || undefined}>
              {s.done ? (
                <span className="step-row">{body}</span>
              ) : s.action === "recognize" ? (
                <button className="step-row" onClick={() => openRecognize()}>
                  {body}
                </button>
              ) : (
                <Link className="step-row" href={s.href ?? "/home"}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
