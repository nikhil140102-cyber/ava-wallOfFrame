"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

const AppCtx = createContext(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

export function AppProvider({ data, children }) {
  const [toasts, setToasts] = useState([]);
  const [recognize, setRecognize] = useState({ open: false, prefill: [] });
  const [palette, setPalette] = useState(false);
  const idRef = useRef(0);

  const toast = useCallback((message, opts) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, message, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 7000 : 4000);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j" && data.permissions.includes("recognition.give")) {
        e.preventDefault();
        setRecognize({ open: true, prefill: [] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.permissions]);

  const perms = new Set(data.permissions);
  const value = {
    data,
    can: (p) => perms.has(p),
    toast,
    openRecognize: (prefill = []) => setRecognize({ open: true, prefill }),
    recognize,
    closeRecognize: () => setRecognize({ open: false, prefill: [] }),
    openPalette: () => setPalette(true),
    palette,
    closePalette: () => setPalette(false),
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="hud-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="hud" data-tone={t.tone}>
            <Icon name={t.tone === "error" ? "x" : "check"} size={16} stroke={2.4} />
            <span>{t.message}</span>
            {t.action && (
              <button
                onClick={async () => {
                  setToasts((x) => x.filter((y) => y.id !== t.id));
                  await t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
