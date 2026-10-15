"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { saveSettings, saveValue } from "@/app/actions";
import { PageHelp } from "@/components/PageHelp";

export function CompanySettings({ settings, values }) {
  const { toast, can } = useApp();
  const [f, setF] = useState({ companyName: settings.companyName, allowSelf: settings.allowSelf });
  const base = { companyName: settings.companyName, allowSelf: settings.allowSelf };
  const [newValue, setNewValue] = useState({ name: "", description: "" });
  const dirty = JSON.stringify(f) !== JSON.stringify(base);

  return (
    <main className="page page-narrow">
      <header className="page-head">
        <div>
          <h1 className="large-title">Company Settings</h1>
          <p>How recognition works across {settings.companyName}.</p>
        </div>
        <PageHelp topic="admin-settings" />
      </header>

      <section className="group-block">
        <div className="section-label">Company</div>
        <div className="group">
          <label className="group-item">
            <span style={{ width: 150 }}>Company name</span>
            <input className="inline-input" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Points</div>
        <div className="group">
          {can("points.manage") ? (
            <Link href="/admin/points" className="group-item">
              <Icon name="sparkles" size={18} style={{ color: "var(--orange)" }} />
              <span style={{ flex: 1 }}>
                Points Rules
                <span className="caption" style={{ display: "block" }}>
                  {settings.appreciationPoints} per appreciation · {settings.monthlyBudget} monthly budget · birthday, anniversary and
                  welcome bonuses
                </span>
              </span>
              <Icon name="chevronRight" size={16} className="tertiary" />
            </Link>
          ) : (
            <div className="group-item">
              <Icon name="lock" size={16} className="tertiary" />
              <span style={{ flex: 1 }}>
                {settings.appreciationPoints} points per appreciation · {settings.monthlyBudget} monthly budget
                <span className="caption" style={{ display: "block" }}>
                  Point amounts are decided by the Super Admin.
                </span>
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Recognition</div>
        <div className="group">
          <div className="group-item">
            <span style={{ flex: 1 }}>
              Allow self-recognition
              <span className="caption" style={{ display: "block" }}>
                Most companies leave this off
              </span>
            </span>
            <button
              className="switch"
              role="switch"
              aria-checked={f.allowSelf}
              aria-label="Allow self-recognition"
              onClick={() => setF({ ...f, allowSelf: !f.allowSelf })}
            />
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          {dirty && (
            <button className="btn btn-plain" onClick={() => setF(base)}>
              Revert
            </button>
          )}
          <button
            className="btn btn-filled"
            disabled={!dirty}
            onClick={async () => {
              const r = await saveSettings(f);
              toast(r.ok ? "Settings saved" : r.error, { tone: r.ok ? "default" : "error" });
            }}
          >
            Save Changes
          </button>
        </div>
      </section>

      <section className="group-block">
        <div className="section-label">Company values</div>
        <div className="group">
          {values.map((v) => (
            <div key={v.id} className="group-item" style={{ opacity: v.active ? 1 : 0.55 }}>
              <span style={{ flex: 1 }}>
                {v.name}
                <span className="caption" style={{ display: "block" }}>
                  {v.description || "No description"}
                </span>
              </span>
              <button
                className="switch switch-sm"
                role="switch"
                aria-checked={v.active}
                aria-label={`${v.name} active`}
                onClick={async () => {
                  const r = await saveValue({ ...v, active: !v.active });
                  toast(r.ok ? (v.active ? `“${v.name}” hidden from new appreciations` : `“${v.name}” is active again`) : r.error, {
                    tone: r.ok ? "default" : "error",
                  });
                }}
              />
            </div>
          ))}
          <div className="group-item">
            <Icon name="plus" size={16} style={{ color: "var(--accent)" }} />
            <input
              className="inline-input"
              placeholder="New value"
              value={newValue.name}
              onChange={(e) => setNewValue({ ...newValue, name: e.target.value })}
              style={{ maxWidth: 180 }}
            />
            <input
              className="inline-input"
              placeholder="What it means (optional)"
              value={newValue.description}
              onChange={(e) => setNewValue({ ...newValue, description: e.target.value })}
            />
            <button
              className="btn btn-sm btn-tinted"
              disabled={newValue.name.trim().length < 2}
              onClick={async () => {
                const r = await saveValue({ ...newValue, active: true });
                if (!r.ok) return toast(r.error, { tone: "error" });
                setNewValue({ name: "", description: "" });
                toast("Value added");
              }}
            >
              Add
            </button>
          </div>
        </div>
        <p className="group-footer">Switching a value off keeps it on past posts but removes it from the Recognize sheet.</p>
      </section>
    </main>
  );
}
