"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, LevelPill } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RecognizeButton } from "@/components/RecognizeButton";
import { useApp } from "@/components/shell/AppContext";
import { nudge } from "@/app/actions";
import { timeAgo } from "@/lib/format";

export function TeamTable({ rows, canNudge, canAward }) {
  const { toast } = useApp();
  const [nudged, setNudged] = useState(new Set());

  if (!rows.length) {
    return (
      <div className="card empty">
        <span className="empty-icon">
          <Icon name="users" size={26} />
        </span>
        <h3>No direct reports</h3>
        <p>When HR sets you as someone&apos;s manager, they&apos;ll appear here.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Level</th>
            <th style={{ textAlign: "right" }}>Given</th>
            <th style={{ textAlign: "right" }}>Received</th>
            <th>Last recognised</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/people/${r.id}`} className="row" style={{ gap: 10 }}>
                  <Avatar name={r.name} size={32} />
                  <span>
                    <b style={{ fontSize: 14 }}>{r.name}</b>
                    <span className="caption" style={{ display: "block" }}>
                      {r.title}
                    </span>
                  </span>
                  {r.newJoiner && <span className="tag tag-teal">New</span>}
                </Link>
              </td>
              <td>
                <LevelPill name={r.level.name} color={r.level.color} size="sm" />
              </td>
              <td
                className="num"
                style={{ textAlign: "right", color: r.quiet ? "var(--orange)" : undefined, fontWeight: r.quiet ? 600 : 400 }}
              >
                {r.given}
              </td>
              <td className="num" style={{ textAlign: "right" }}>
                {r.received}
              </td>
              <td className="caption">
                {r.lastRecognised ? timeAgo(r.lastRecognised) : <span style={{ color: "var(--orange)" }}>Never</span>}
              </td>
              <td>
                <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                  {canNudge && r.quiet && (
                    <button
                      className="btn btn-sm"
                      disabled={nudged.has(r.id)}
                      onClick={async () => {
                        const res = await nudge(r.id);
                        if (res.ok) setNudged(new Set(nudged).add(r.id));
                        toast(res.ok ? (res.message ?? "Nudged") : res.error, { tone: res.ok ? "default" : "error" });
                      }}
                    >
                      <Icon name="hand" size={14} /> {nudged.has(r.id) ? "Nudged" : "Nudge"}
                    </button>
                  )}
                  {canAward && (
                    <Link href={`/people/${r.id}`} className="btn btn-sm">
                      <Icon name="award" size={14} /> Badge
                    </Link>
                  )}
                  <RecognizeButton to={r.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
