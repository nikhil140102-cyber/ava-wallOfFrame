"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useI18n } from "./I18nProvider";

/** Photo grid on a post: 1 large, 2 side by side, 3 as one big + two small, 4 as a 2×2 grid. Tap to view full screen. */
export function PostImages({ images }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setOpen((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setOpen((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, images.length, close]);

  if (!images?.length) return null;
  const single = images.length === 1 ? images[0] : null;
  const ratio = single && single.width && single.height ? Math.max(0.75, Math.min(1.9, single.width / single.height)) : 16 / 10;

  return (
    <>
      <div className="post-photos" data-count={images.length} style={single ? { aspectRatio: ratio } : undefined}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className="post-photo"
            onClick={() => setOpen(i)}
            aria-label={t("photos.open", { n: i + 1, total: images.length })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t("photos.position", { n: open + 1, total: images.length })}
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[open].url}
            alt={t("photos.position", { n: open + 1, total: images.length })}
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-close" onClick={close} aria-label={t("photos.close")}>
            <Icon name="x" size={18} stroke={2.6} />
          </button>
          {images.length > 1 && (
            <>
              <button
                className="lightbox-nav prev"
                aria-label={t("photos.previous")}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((open - 1 + images.length) % images.length);
                }}
              >
                ‹
              </button>
              <button
                className="lightbox-nav next"
                aria-label={t("photos.next")}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((open + 1) % images.length);
                }}
              >
                ›
              </button>
              <span className="lightbox-count">{t("photos.counter", { n: open + 1, total: images.length })}</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
