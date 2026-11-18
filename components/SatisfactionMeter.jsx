// Happy / neutral / unhappy split, as one stacked bar with counts underneath.
// Used on the Pulse results page and the company satisfaction report (admin pages, English only).

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

export function SatisfactionBar({ happy, neutral, unhappy, total, thin = false }) {
  return (
    <div className={`sat-bar${thin ? " sat-bar-thin" : ""}`} role="img" aria-label={`${pct(happy, total)}% happy, ${pct(neutral, total)}% neutral, ${pct(unhappy, total)}% unhappy`}>
      {happy > 0 && <span className="sat-happy" style={{ flexGrow: happy }} />}
      {neutral > 0 && <span className="sat-neutral" style={{ flexGrow: neutral }} />}
      {unhappy > 0 && <span className="sat-unhappy" style={{ flexGrow: unhappy }} />}
    </div>
  );
}

export function SatisfactionMeter({ happy, neutral, unhappy, total, unit = "people", title = "Satisfaction", note, className = "" }) {
  const items = [
    ["happy", "😄", "Happy", happy],
    ["neutral", "😐", "Neutral", neutral],
    ["unhappy", "😞", "Not happy", unhappy],
  ];
  return (
    <section className={`card card-pad sat-card ${className}`}>
      <div className="sat-head">
        <div>
          <span className="caption">{title}</span>
          <div className="sat-big">
            <b className="num">{pct(happy, total)}%</b>
            <span>
              happy · {happy} of {total} {unit}
            </span>
          </div>
        </div>
      </div>
      <SatisfactionBar happy={happy} neutral={neutral} unhappy={unhappy} total={total} />
      <div className="sat-legend">
        {items.map(([key, emoji, label, n]) => (
          <div key={key} className={`sat-item sat-item-${key}`}>
            <span className="sat-emoji" aria-hidden="true">
              {emoji}
            </span>
            <div>
              <b className="num">{n}</b> <span className="caption">({pct(n, total)}%)</span>
              <span className="caption" style={{ display: "block" }}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
      {note && <p className="caption sat-note">{note}</p>}
    </section>
  );
}

export const SAT_RULE = "Happy = 4–5 faces or stars (9–10 on a 0–10 scale) · Neutral = 3 (7–8) · Not happy = 1–2 (0–6).";
