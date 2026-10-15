"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { changePassword, setPreferences, updateProfile } from "@/app/actions";

export function SettingsForm({ profile, theme: initialTheme, emailNotifications, role, allowed }) {
  const { toast } = useApp();
  const [p, setP] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [email, setEmail] = useState(emailNotifications);
  const [pw, setPw] = useState({ current: "", next: "" });
  const dirty = p.title !== profile.title || p.bio !== profile.bio || p.city !== profile.city;

  function applyTheme(t) {
    setTheme(t);
    // Apply instantly — no reload, no save button.
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    setPreferences({ theme: t });
  }

  return (
    <div>
      <section className="group-block">
        <div className="section-label">Profile</div>
        <div className="group">
          <label className="group-item">
            <span style={{ width: 90 }} className="secondary">
              Title
            </span>
            <input className="inline-input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} maxLength={80} />
          </label>
          <label className="group-item">
            <span style={{ width: 90 }} className="secondary">
              City
            </span>
            <input className="inline-input" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} maxLength={60} />
          </label>
          <label className="group-item" style={{ alignItems: "flex-start" }}>
            <span style={{ width: 90, paddingTop: 2 }} className="secondary">
              Bio
            </span>
            <textarea
              className="inline-input"
              rows={3}
              value={p.bio}
              onChange={(e) => setP({ ...p, bio: e.target.value })}
              maxLength={240}
              placeholder="A line or two about you"
            />
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          {dirty && (
            <button className="btn btn-plain" onClick={() => setP(profile)}>
              Revert
            </button>
          )}
          <button
            className="btn btn-filled"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              const r = await updateProfile(p);
              setSaving(false);
              toast(r.ok ? "Profile saved" : r.error, { tone: r.ok ? "default" : "error" });
            }}
          >
            Save Profile
          </button>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Appearance</div>
        <div className="theme-picker">
          {[
            ["system", "Automatic", "monitor"],
            ["light", "Light", "sun"],
            ["dark", "Dark", "moon"],
          ].map(([k, label, icon]) => (
            <button key={k} className="theme-option" aria-pressed={theme === k} onClick={() => applyTheme(k)}>
              <span className="theme-swatch" data-swatch={k}>
                <Icon name={icon} size={20} />
              </span>
              {label}
            </button>
          ))}
        </div>
        <p className="group-footer">Automatic follows your device&apos;s light or dark setting.</p>
      </section>

      <section className="group-block">
        <div className="section-label">Notifications</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>Email me when I&apos;m recognised</span>
            <button
              className="switch"
              role="switch"
              aria-checked={email}
              aria-label="Email notifications"
              onClick={() => {
                setEmail(!email);
                setPreferences({ emailNotifications: !email });
              }}
            />
          </div>
        </div>
        <p className="group-footer">In-app notifications are always on.</p>
      </section>

      <section className="group-block">
        <div className="section-label">Password</div>
        <div className="group">
          <label className="group-item">
            <span style={{ width: 120 }} className="secondary">
              Current
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
              New
            </span>
            <input
              className="inline-input"
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              placeholder="At least 8 characters"
            />
          </label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <button
            className="btn"
            disabled={!pw.current || pw.next.length < 8}
            onClick={async () => {
              const r = await changePassword(pw.current, pw.next);
              toast(r.ok ? (r.message ?? "Saved") : r.error, { tone: r.ok ? "default" : "error" });
              if (r.ok) setPw({ current: "", next: "" });
            }}
          >
            Change Password
          </button>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Your access</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>Role</span>
            <span style={{ color: role.color, fontWeight: 600 }}>{role.name}</span>
          </div>
          {allowed.map((a) => (
            <div key={a} className="group-item">
              <Icon name="check" size={16} stroke={2.4} style={{ color: "var(--green)" }} />
              <span style={{ fontSize: 14 }}>{a}</span>
            </div>
          ))}
        </div>
        <p className="group-footer">Roles are managed by your administrators. Ask HR if you need different access.</p>
      </section>
    </div>
  );
}
