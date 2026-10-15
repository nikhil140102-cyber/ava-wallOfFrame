"use client";

import { useActionState, useRef } from "react";
import { login } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import styles from "./login.module.css";

const DEMO = [
  { name: "Nikhil Rana", email: "nikhil@avadhesh.co", role: "Super Admin", color: "#DC2626", note: "Everything, incl. roles & settings" },
  { name: "Priya Sharma", email: "priya@avadhesh.co", role: "HR Admin", color: "#7C3AED", note: "Users, rewards, moderation, analytics" },
  { name: "Syed Amjad", email: "syed@avadhesh.co", role: "Manager", color: "#0891B2", note: "Team view, nudges, award badges" },
  { name: "Meera Iyer", email: "meera@avadhesh.co", role: "Team Lead", color: "#D97706", note: "Custom role: team view, no nudges" },
  { name: "Kannha Salooja", email: "kannha@avadhesh.co", role: "Employee", color: "#6B7280", note: "Recognise, comment, redeem" },
];

export function LoginForm({ demo }) {
  const [state, action, pending] = useActionState(login, null);
  const formRef = useRef(null);
  const emailRef = useRef(null);
  const passRef = useRef(null);

  function quick(email) {
    emailRef.current.value = email;
    passRef.current.value = "avazone123";
    formRef.current.requestSubmit();
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className="brand-mark" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 12 }}>
            W
          </span>
          <h1 className="large-title">Wall of Frames</h1>
          <p className="secondary">Recognise great work at AvadheshCo.</p>
        </div>

        <form ref={formRef} action={action} className={styles.form}>
          <div className={styles.fields}>
            <input
              ref={emailRef}
              name="email"
              type="email"
              placeholder="Work email"
              autoComplete="username"
              required
              aria-label="Work email"
            />
            <input
              ref={passRef}
              name="password"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              aria-label="Password"
            />
          </div>
          {state && !state.ok && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}
          <button className="btn btn-filled btn-lg" disabled={pending} style={{ width: "100%" }}>
            {pending ? "Signing in…" : "Sign In"}
          </button>
          <p className="footnote" style={{ textAlign: "center" }}>
            Forgot your password? Ask HR to reset it.
          </p>
        </form>

        {demo && (
          <section className={styles.demo} aria-label="Demo accounts">
            <div className="section-label" style={{ padding: "0 4px 8px" }}>
              Demo accounts · one tap to sign in
            </div>
            <div className="group">
              {DEMO.map((d) => (
                <button key={d.email} type="button" className="group-item indent" onClick={() => quick(d.email)} disabled={pending}>
                  <Avatar name={d.name} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <b style={{ fontSize: 14 }}>{d.name}</b>
                      <span className="tag" style={{ background: `color-mix(in srgb, ${d.color} 14%, transparent)`, color: d.color }}>
                        {d.role}
                      </span>
                    </span>
                    <span className="caption">{d.note}</span>
                  </span>
                  <Icon name="chevronRight" size={16} className="chev" />
                </button>
              ))}
            </div>
            <p className="group-footer">All demo passwords are “avazone123”.</p>
          </section>
        )}
      </div>
    </main>
  );
}
