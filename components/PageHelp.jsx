"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { HELP } from "@/lib/help";

/** A small "?" in the page header that explains the page in plain words. */
export function PageHelp({ topic }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const help = HELP[topic];

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!help) return null;
  return (
    <div className="page-help" ref={ref}>
      <button className="help-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="How this page works">
        ?
      </button>
      {open && (
        <div className="popover help-pop" role="dialog" aria-label={help.title}>
          <b>{help.title}</b>
          <ul>
            {help.points.map((p) => (
              <li key={p}>
                <Icon name="check" size={14} stroke={2.4} style={{ color: "var(--accent)", marginTop: 3 }} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
