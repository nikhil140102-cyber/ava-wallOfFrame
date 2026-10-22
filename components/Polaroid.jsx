"use client";

import { Icon } from "./Icon";

// Shared polaroid pieces for the Memory Wall and the "On this day" card.

const first = (n) => n.split(" ")[0];
const fmt = (ms, opts) => new Date(ms).toLocaleDateString("en-IN", opts);

/** Small, stable "random" number per item so each polaroid hangs at its own angle. */
function wobble(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 900) / 100 - 4.5) * 0.85; // about −4° … +4°
}

export function Peg() {
  return (
    <span className="peg" aria-hidden="true">
      <i />
    </span>
  );
}

export function Art({ item, big = false }) {
  if (item.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.photo.url} alt="" loading="lazy" />;
  }
  const c = item.color;
  return (
    <div className={`art art-${item.kind}`} style={{ "--c": c }}>
      {item.emoji ? (
        <span className="art-emoji">{item.emoji}</span>
      ) : item.kind === "level" ? (
        <span className="art-level">
          <Icon name="trophy" size={big ? 34 : 24} />
          <b>{item.levelName}</b>
        </span>
      ) : item.kind === "appreciation" ? (
        <span className="art-quote">
          <q>{item.detail}</q>
        </span>
      ) : (
        <span className="art-medal">
          <Icon name={item.icon} size={big ? 44 : 30} />
        </span>
      )}
      {item.kind === "badge" && <span className="art-tag">{item.title.replace("Earned ", "")}</span>}
    </div>
  );
}

export function Polaroid({ item, showName, onOpen }) {
  return (
    <button
      className="polaroid"
      style={{ "--tilt": `${wobble(item.id)}deg` }}
      onClick={onOpen}
      aria-label={`${item.title}, ${fmt(item.at, { day: "numeric", month: "long" })}`}
    >
      <Peg />
      <span className="pol-photo">
        <Art item={item} />
        {item.morePhotos > 0 && <span className="pol-more">+{item.morePhotos}</span>}
        <span className="pol-kind" style={{ background: item.color }}>
          <Icon name={item.icon} size={11} stroke={2.4} />
        </span>
      </span>
      <span className="pol-cap">
        <span className="pol-title">{showName ? `${first(item.userName)} · ${item.title}` : item.title}</span>
        <span className="pol-date">
          {fmt(item.at, { day: "numeric", month: "short" })}
          {item.private ? " · only you" : ""}
        </span>
      </span>
    </button>
  );
}
