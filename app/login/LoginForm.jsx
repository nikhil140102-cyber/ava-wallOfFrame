"use client";

import { useActionState, useRef } from "react";
import { login } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import styles from "./login.module.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/components/I18nProvider";

const DEMO_PASSWORD = "avazone123";

const DEMO = [
  { name: "Nikhil Rana", email: "nikhil@avadhesh.co", role: "superAdmin", color: "#DC2626" },
  { name: "Priya Sharma", email: "priya@avadhesh.co", role: "hrAdmin", color: "#7C3AED" },
  { name: "Syed Amjad", email: "syed@avadhesh.co", role: "manager", color: "#0891B2" },
  { name: "Meera Iyer", email: "meera@avadhesh.co", role: "teamLead", color: "#D97706" },
  { name: "Kannha Salooja", email: "kannha@avadhesh.co", role: "employee", color: "#6B7280" },
];

const FRAMES = [
  { e: "🏅", c: "#3355E6", cap: "badge" },
  { e: "🎂", c: "#DB2777", cap: "birthday" },
  { e: "⛰️", c: "#7C3AED", cap: "offsite" },
  { e: "🎓", c: "#0D9488", cap: "skill" },
];

export function LoginForm({ demo }) {
  const [state, action, pending] = useActionState(login, null);
  const { t } = useI18n();
  const formRef = useRef(null);
  const emailRef = useRef(null);
  const passRef = useRef(null);

  function quick(email) {
    emailRef.current.value = email;
    passRef.current.value = DEMO_PASSWORD;
    formRef.current.requestSubmit();
  }

  return (
    <main className={styles.wrap}>
      <section className={styles.art}>
        <div className={styles.artBrand}>
          <span className="brand-mark" style={{ width: 36, height: 36, fontSize: 18, borderRadius: 9 }}>
            W
          </span>
          <span style={{ flex: 1 }}>Wall of Frames</span>
          <LanguagePicker signedIn={false} />
          <ThemeToggle signedIn={false} />
        </div>
        <h2 className={styles.artTitle}>{t("login.artTitle")}</h2>
        <p className={styles.artText}>{t("login.artText")}</p>
        <div className={styles.line} aria-hidden="true">
          <svg viewBox="0 0 1000 60" preserveAspectRatio="none">
            <path d="M0 14 Q 500 54 1000 14" />
          </svg>
          {FRAMES.map((f, i) => (
            <div
              key={f.cap}
              className={`polaroid ${styles.pol}`}
              style={{ "--tilt": `${[-4, 3, -2, 4][i]}deg`, "--drop": `${[8, 20, 20, 8][i]}px` }}
            >
              <span className="peg">
                <i />
              </span>
              <span className="pol-photo">
                <span className="art" style={{ "--c": f.c }}>
                  <span className="art-emoji">{f.e}</span>
                </span>
              </span>
              <span className="pol-cap">
                <span className="pol-title">{t(`login.frames.${f.cap}`)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <h1 className="large-title">{t("login.heading")}</h1>
          <p className="secondary">{t("login.sub", { company: "AvadheshCo" })}</p>
        </div>

        <form ref={formRef} action={action} className={styles.form}>
          <div className={styles.fields}>
            <input
              ref={emailRef}
              name="email"
              type="email"
              placeholder={t("login.email")}
              autoComplete="username"
              required
              aria-label={t("login.email")}
            />
            <input
              ref={passRef}
              name="password"
              type="password"
              placeholder={t("login.password")}
              autoComplete="current-password"
              required
              aria-label={t("login.password")}
            />
          </div>
          {state && !state.ok && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}
          <button type="submit" className="btn btn-filled btn-lg" disabled={pending} style={{ width: "100%" }}>
            {pending ? t("login.submitting") : t("login.submit")}
          </button>
          <p className="footnote" style={{ textAlign: "center" }}>
            {t("login.forgot")}
          </p>
        </form>

        {demo && (
          <section className={styles.demo} aria-label={t("login.demo.label")}>
            <div className="section-label" style={{ padding: "0 4px 8px" }}>
              {t("login.demo.heading")}
            </div>
            <div className="group">
              {DEMO.map((d) => (
                <button key={d.email} type="button" className="group-item indent" onClick={() => quick(d.email)} disabled={pending}>
                  <Avatar name={d.name} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <b style={{ fontSize: 14 }}>{d.name}</b>
                      <span className="tag" style={{ background: `color-mix(in srgb, ${d.color} 14%, transparent)`, color: d.color }}>
                        {t(`login.role.${d.role}`)}
                      </span>
                    </span>
                    <span className="caption">{t(`login.note.${d.role}`)}</span>
                  </span>
                  <Icon name="chevronRight" size={16} className="chev" />
                </button>
              ))}
            </div>
            <p className="group-footer">{t("login.demo.passwords", { password: DEMO_PASSWORD })}</p>
          </section>
        )}
      </div>
    </main>
  );
}
