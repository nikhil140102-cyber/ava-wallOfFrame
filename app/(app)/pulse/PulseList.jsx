"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { useI18n } from "@/components/I18nProvider";
import { PulseQuestion } from "@/components/PulseQuestion";
import { submitSurvey } from "@/app/actions";

function SurveyForm({ sv, onDone }) {
  const { toast } = useApp();
  const { t } = useI18n();
  const [answers, setAnswers] = useState({});
  const [pending, start] = useTransition();
  const missing = sv.questions.filter((q) => {
    const v = answers[q.id];
    return q.required && (v === undefined || v === "" || (Array.isArray(v) && !v.length));
  }).length;

  return (
    <section className="card card-pad pulse-card" id={sv.id}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
        <span className="pulse-icon">
          <Icon name="heart" size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="title-2" dir="auto">
            {sv.title}
          </h2>
          {sv.intro && (
            <p className="secondary" dir="auto" style={{ marginTop: 4 }}>
              {sv.intro}
            </p>
          )}
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <span className={`tag ${sv.anonymous ? "tag-green" : "tag-orange"}`}>
              <Icon name={sv.anonymous ? "eyeOff" : "eye"} size={12} /> {sv.anonymous ? t("pulse.anonymous") : t("pulse.named")}
            </span>
            <span className="tag tag-accent">{t(`pulse.freq.${sv.frequency}`)}</span>
            <span className="tag">{t("pulse.questions", { count: sv.questions.length })}</span>
          </div>
        </div>
      </div>
      <div className="pulse-qs">
        {sv.questions.map((q, i) => (
          <PulseQuestion key={q.id} q={q} index={i} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
        ))}
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
        {missing > 0 && <span className="caption">{t("pulse.left", { count: missing })}</span>}
        <button
          className="btn btn-filled"
          disabled={pending || missing > 0}
          onClick={() =>
            start(async () => {
              const r = await submitSurvey(sv.id, answers);
              if (!r.ok) return toast(r.error, { tone: "error" });
              toast(t("pulse.thanks"));
              onDone();
            })
          }
        >
          <Icon name="send" size={16} /> {t("pulse.submit")}
        </button>
      </div>
    </section>
  );
}

export function PulseList({ surveys }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <main className="page pulse-wide">
      <header className="page-head">
        <div>
          <h1 className="large-title">{t("pulse.title")}</h1>
          <p>{t("pulse.subtitle")}</p>
        </div>
      </header>
      {surveys.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="check" size={26} />
          </span>
          <h3>{t("pulse.allDone")}</h3>
          <p>{t("pulse.allDoneHint")}</p>
          <Link href="/home" className="btn btn-gray" style={{ marginTop: 12 }}>
            {t("pulse.backHome")}
          </Link>
        </div>
      ) : (
        <div className="stack">
          {surveys.map((sv) => (
            <SurveyForm key={sv.id} sv={sv} onDone={() => router.refresh()} />
          ))}
        </div>
      )}
    </main>
  );
}
