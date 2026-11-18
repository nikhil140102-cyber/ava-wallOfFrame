"use client";

import { useI18n } from "@/components/I18nProvider";

export const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

// One survey question, answered with the control that suits its type.
export function PulseQuestion({ q, value, onChange, index }) {
  const { t } = useI18n();
  const id = `q-${q.id}`;
  return (
    <fieldset className="pulse-q">
      <legend id={id}>
        <span className="pulse-q-num">{index + 1}</span>
        <span dir="auto">{q.prompt}</span>
        {!q.required && <span className="caption"> · {t("pulse.optional")}</span>}
      </legend>

      {q.type === "mood" && (
        <div className="pulse-row" role="radiogroup" aria-labelledby={id}>
          {MOODS.map((m, i) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={value === i + 1}
              aria-label={t(`pulse.mood${i + 1}`)}
              title={t(`pulse.mood${i + 1}`)}
              className="pulse-mood"
              onClick={() => onChange(i + 1)}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {q.type === "scale" && (
        <div className="pulse-scale">
          <div className="pulse-row" role="radiogroup" aria-labelledby={id}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n} / 5`}
                className="pulse-star"
                data-on={value >= n || undefined}
                onClick={() => onChange(n)}
              >
                ★
              </button>
            ))}
          </div>
          <div className="pulse-ends">
            <span dir="auto">{q.options?.[0] || t("pulse.scaleLow")}</span>
            <span dir="auto">{q.options?.[1] || t("pulse.scaleHigh")}</span>
          </div>
        </div>
      )}

      {q.type === "nps" && (
        <div className="pulse-scale">
          <div className="pulse-row pulse-nps" role="radiogroup" aria-labelledby={id}>
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" role="radio" aria-checked={value === n} className="pulse-num" onClick={() => onChange(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="pulse-ends">
            <span dir="auto">{q.options?.[0] || t("pulse.npsLow")}</span>
            <span dir="auto">{q.options?.[1] || t("pulse.npsHigh")}</span>
          </div>
        </div>
      )}

      {q.type === "yesno" && (
        <div className="pulse-row" role="radiogroup" aria-labelledby={id}>
          {["yes", "no"].map((v) => (
            <button key={v} type="button" role="radio" aria-checked={value === v} className="pulse-pill" onClick={() => onChange(v)}>
              {t(`pulse.${v}`)}
            </button>
          ))}
        </div>
      )}

      {q.type === "choice" && (
        <div className="pulse-row pulse-wrap" role="radiogroup" aria-labelledby={id}>
          {q.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={value === o} className="pulse-pill" onClick={() => onChange(o)}>
              <span dir="auto">{o}</span>
            </button>
          ))}
        </div>
      )}

      {q.type === "multi" && (
        <>
          <div className="pulse-row pulse-wrap" role="group" aria-labelledby={id}>
            {q.options.map((o) => {
              const on = Array.isArray(value) && value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className="pulse-pill"
                  onClick={() => onChange(on ? value.filter((x) => x !== o) : [...(value ?? []), o])}
                >
                  <span dir="auto">{o}</span>
                </button>
              );
            })}
          </div>
          <p className="caption">{t("pulse.pickAny")}</p>
        </>
      )}

      {q.type === "text" && (
        <textarea
          className="field"
          rows={3}
          maxLength={1000}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("pulse.textPlaceholder")}
          aria-labelledby={id}
          dir="auto"
        />
      )}
    </fieldset>
  );
}
