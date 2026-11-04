"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword, logout } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import styles from "../login/login.module.css";

export function ChangePasswordForm({ name, email, required }) {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const type = show ? "text" : "password";

  function submit(e) {
    e.preventDefault();
    setError(null);
    if (form.next !== form.confirm) return setError(t("security.mismatch"));
    start(async () => {
      const r = await changePassword(form.current, form.next);
      if (!r.ok) return setError(r.error);
      router.replace("/home");
      router.refresh();
    });
  }

  return (
    <main className={styles.single}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <h1 className="large-title">{t("security.title")}</h1>
          <p className="secondary">{required ? t("security.intro") : t("security.introWeak")}</p>
          <p className="footnote secondary" style={{ marginTop: 6 }}>
            {name} · {email}
          </p>
        </div>
        <form onSubmit={submit} className={styles.form}>
          {/* Lets password managers save the new password against the right account. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <div className={styles.fields}>
            <input
              type={type}
              autoComplete="current-password"
              placeholder={t("security.current")}
              aria-label={t("security.current")}
              title={t("security.currentHint")}
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
            />
            <input
              type={type}
              autoComplete="new-password"
              placeholder={t("security.new")}
              aria-label={t("security.new")}
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              minLength={10}
              maxLength={128}
              required
            />
            <input
              type={type}
              autoComplete="new-password"
              placeholder={t("security.confirm")}
              aria-label={t("security.confirm")}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </div>
          <label className="footnote secondary" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {t("security.show")}
          </label>
          <p className="footnote secondary">{t("security.rules")}</p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-filled btn-lg" disabled={pending} style={{ width: "100%" }}>
            {pending ? t("security.saving") : t("security.submit")}
          </button>
        </form>
        <form action={logout} style={{ textAlign: "center", marginTop: 16 }}>
          <button type="submit" className="btn btn-plain">
            {t("security.signOut")}
          </button>
        </form>
      </section>
    </main>
  );
}
