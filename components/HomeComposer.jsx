"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { useApp } from "./shell/AppContext";
import { discardImage, postAnnouncement } from "@/app/actions";
import { ImagePicker } from "./ImagePicker";

export function HomeComposer() {
  const { data, can, openRecognize, toast } = useApp();
  const [mode, setMode] = useState("idle");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [photos, setPhotos] = useState([]);
  const first = data.me.name.split(" ")[0];

  if (mode === "announce") {
    return (
      <div className="card card-pad stack" style={{ gap: 12 }}>
        <div className="row">
          <Avatar name={data.me.name} size={36} />
          <b style={{ flex: 1 }}>New announcement</b>
          <button
            className="btn btn-plain btn-sm"
            onClick={() => {
              photos.forEach((x) => discardImage(x.id));
              setPhotos([]);
              setMode("idle");
            }}
          >
            Cancel
          </button>
        </div>
        <textarea
          className="field"
          rows={4}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share news with everyone at the company…"
          maxLength={800}
        />
        <ImagePicker value={photos} onChange={setPhotos} onError={(m) => toast(m, { tone: "error" })} compact />
        <div className="row">
          <span className="caption" style={{ flex: 1 }}>
            Announcements appear in everyone&apos;s feed.
          </span>
          <button
            className="btn btn-filled"
            disabled={text.trim().length < 3 || pending}
            onClick={async () => {
              setPending(true);
              const r = await postAnnouncement(
                text,
                photos.map((x) => x.id)
              );
              setPending(false);
              if (!r.ok) return toast(r.error, { tone: "error" });
              setText("");
              setPhotos([]);
              setMode("idle");
              toast("Announcement posted");
            }}
          >
            Post
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="row">
        <Avatar name={data.me.name} size={40} />
        {can("recognition.give") ? (
          <button className="composer-prompt" onClick={() => openRecognize()}>
            Who helped you this week, {first}?
          </button>
        ) : (
          <span className="secondary">Your role can view the feed but not post.</span>
        )}
      </div>
      <div className="row" style={{ marginTop: 12, paddingLeft: 52, gap: 8, flexWrap: "wrap" }}>
        {can("recognition.give") && (
          <button className="chip" onClick={() => openRecognize()}>
            <Icon name="sparkles" size={15} style={{ color: "var(--accent)" }} /> Appreciation
          </button>
        )}
        {can("feed.announce") && (
          <button className="chip" onClick={() => setMode("announce")}>
            <Icon name="megaphone" size={15} style={{ color: "var(--orange)" }} /> Announcement
          </button>
        )}
        <span className="caption" style={{ marginLeft: "auto", alignSelf: "center" }}>
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">J</kbd> to recognize from anywhere
        </span>
      </div>
    </div>
  );
}
