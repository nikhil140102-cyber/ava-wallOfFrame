"use client";

import { useEffect, useState } from "react";

const SHORTCUTS = [
  [["⌘", "K"], "Search people, pages and actions"],
  [["⌘", "J"], "Recognize someone"],
  [["⌘", "↵"], "Send in the Recognize sheet"],
  [["Esc"], "Close any sheet or menu"],
  [["?"], "Show this list"],
];

/** Press "?" anywhere (outside a text field) to see keyboard shortcuts. */
export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (e.key === "?" && !typing) setOpen((o) => !o);
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="sheet" style={{ width: "min(420px, calc(100vw - 32px))" }} role="dialog" aria-modal="true" aria-labelledby="kb-title">
        <div className="sheet-body">
          <h2 id="kb-title" className="title-3" style={{ textAlign: "center", marginBottom: 14 }}>
            Keyboard shortcuts
          </h2>
          <div className="group" style={{ boxShadow: "none", background: "var(--fill-2)" }}>
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="group-item">
                <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
                <span className="row" style={{ gap: 4 }}>
                  {keys.map((k) => (
                    <kbd key={k} className="kbd" style={{ fontSize: 13, padding: "2px 8px" }}>
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="caption" style={{ textAlign: "center", marginTop: 12 }}>
            On Windows, use Ctrl instead of ⌘.
          </p>
        </div>
      </div>
    </>
  );
}
