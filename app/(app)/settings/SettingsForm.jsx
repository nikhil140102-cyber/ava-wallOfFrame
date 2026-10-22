"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { changePassword, setPreferences, updateProfile } from "@/app/actions";
import { useI18n } from "@/components/I18nProvider";
import { LanguagePicker } from "@/components/LanguagePicker";

export function SettingsForm({ profile, theme: initialTheme, emailNotifications, role, allowed }) {
  const { toast } = useApp();
  const { t } = useI18n();
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [email, setEmail] = useState(emailNotifications);
  const [pw, setPw] = useState({ current: "", next: "" });
  const dirty = p.title !== profile.title || p.bio !== profile.bio || p.city !== profile.city;

  function applyTheme(next) {
    setTheme(next);
    // Apply instantly — no reload, no save button.
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    setPreferences({ theme: next });
  }

  return (
    <div>
      <section className="group-block">
        <div className="section-label">{t("settings.profile.heading")}</div>
        <div className="group">
          <label className="group-item">
            <span style={{ width: 90 }} className="secondary">
              {t("settings.profile.title")}
            </span>
            <input className="inline-input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} maxLength={80} />
          </label>
          <label className="group-item">
            <span style={{ width: 90 }} className="secondary">
              {t("settings.profile.city")}
            </span>
            <input className="inline-input" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} maxLength={60} />
          </label>
          <label className="group-item" style={{ alignItems: "flex-start" }}>
            <span style={{ width: 90, paddingTop: 2 }} className="secondary">
              {t("settings.profile.bio")}
            </span>
            <textarea
              className="inline-input"
              rows={3}
              value={p.bio}
              onChange={(e) => setP({ ...p, bio: e.target.value })}
              maxLength={240}
              placeholder={t("settings.profile.bioPlaceholder")}
            />
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          {dirty && (
            <button className="btn btn-plain" onClick={() => setP(profile)}>
              {t("settings.profile.revert")}
            </button>
          )}
          <button
            className="btn btn-filled"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              const r = await updateProfile(p);
              setSaving(false);
              toast(r.ok ? t("settings.profile.saved") : r.error, { tone: r.ok ? "default" : "error" });
            }}
          >
            {t("settings.profile.save")}
          </button>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">{t("settings.appearance.heading")}</div>
        <div className="theme-picker">
          {[
            ["system", t("settings.appearance.system"), "monitor"],
            ["light", t("settings.appearance.light"), "sun"],
            ["dark", t("settings.appearance.dark"), "moon"],
          ].map(([k, label, icon]) => (
            <button key={k} className="theme-option" aria-pressed={theme === k} onClick={() => applyTheme(k)}>
              <span className="theme-swatch" data-swatch={k}>
                <Icon name={icon} size={20} />
              </span>
              {label}
            </button>
          ))}
        </div>
        <p className="group-footer">{t("settings.appearance.hint")}</p>
      </section>

      <section className="group-block">
        <div className="section-label">{t("settings.language.heading")}</div>
        <p className="group-footer" style={{ paddingTop: 0, marginBottom: 10 }}>
          {t("settings.language.hint")}
        </p>
        <LanguagePicker signedIn variant="inline" />
      </section>

      <section className="group-block">
        <div className="section-label">{t("settings.notifications.heading")}</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>{t("settings.notifications.email")}</span>
            <button
              className="switch"
              role="switch"
              aria-checked={email}
              aria-label={t("settings.notifications.emailLabel")}
              onClick={() => {
                setEmail(!email);
                setPreferences({ emailNotifications: !email });
              }}
            />
          </div>
        </div>
        <p className="group-footer">{t("settings.notifications.hint")}</p>
      </section>

      <section className="group-block">
        <div className="section-label">{t("settings.password.heading")}</div>
        <div className="group">
          <label className="group-item">
            <span style={{ width: 120 }} className="secondary">
              {t("settings.password.current")}
            </span>
            <input
              className="inline-input"
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </label>
          <label className="group-item">
            <span style={{ width: 120 }} className="secondary">
              {t("settings.password.new")}
            </span>
            <input
              className="inline-input"
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              placeholder={t("settings.password.hint")}
            />
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <button
            className="btn"
            disabled={!pw.current || pw.next.length < 8}
            onClick={async () => {
              const r = await changePassword(pw.current, pw.next);
              toast(r.ok ? (r.message ?? t("settings.password.saved")) : r.error, { tone: r.ok ? "default" : "error" });
              if (r.ok) setPw({ current: "", next: "" });
            }}
          >
            {t("settings.password.change")}
          </button>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">{t("settings.access.heading")}</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>{t("settings.access.role")}</span>
            <span style={{ color: role.color, fontWeight: 600 }}>{role.name}</span>
          </div>
          {allowed.map((a) => (
            <div key={a} className="group-item">
              <Icon name="check" size={16} stroke={2.4} style={{ color: "var(--green)" }} />
              <span style={{ fontSize: 14 }}>{a}</span>
            </div>
          ))}
        </div>
        <p className="group-footer">{t("settings.access.hint")}</p>
      </section>
    </div>
  );
}
