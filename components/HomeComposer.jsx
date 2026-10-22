"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { useApp } from "./shell/AppContext";
import { discardImage, postAnnouncement } from "@/app/actions";
import { ImagePicker } from "./ImagePicker";
import { useI18n } from "./I18nProvider";

export function HomeComposer() {
  const { data, can, openRecognize, toast } = useApp();
  const { t, rich } = useI18n();
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
          <b style={{ flex: 1 }}>{t("composer.announce.title")}</b>
          <button
            className="btn btn-plain btn-sm"
            onClick={() => {
              photos.forEach((x) => discardImage(x.id));
              setPhotos([]);
              setMode("idle");
            }}
          >
            {t("composer.cancel")}
          </button>
        </div>
        <textarea
          className="field"
          rows={4}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("composer.announce.placeholder")}
          maxLength={800}
        />
        <ImagePicker value={photos} onChange={setPhotos} onError={(m) => toast(m, { tone: "error" })} compact />
        <div className="row">
          <span className="caption" style={{ flex: 1 }}>
            {t("composer.announce.help")}
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
              toast(t("composer.announce.posted"));
            }}
          >
            {t("composer.announce.post")}
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
            {t("composer.prompt", { name: first })}
          </button>
        ) : (
          <span className="secondary">{t("composer.viewOnly")}</span>
        )}
      </div>
      <div className="row" style={{ marginTop: 12, paddingLeft: 52, gap: 8, flexWrap: "wrap" }}>
        {can("recognition.give") && (
          <button className="chip" onClick={() => openRecognize()}>
            <Icon name="sparkles" size={15} style={{ color: "var(--accent)" }} /> {t("composer.chip.appreciation")}
          </button>
        )}
        {can("feed.announce") && (
          <button className="chip" onClick={() => setMode("announce")}>
            <Icon name="megaphone" size={15} style={{ color: "var(--orange)" }} /> {t("composer.chip.announcement")}
          </button>
        )}
        <span className="caption" style={{ marginLeft: "auto", alignSelf: "center" }}>
          {rich(t("composer.shortcut"), {
            keys: (
              <>
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">J</kbd>
              </>
            ),
          })}
        </span>
      </div>
    </div>
  );
}
