"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "./Icon";
import { discardImage, uploadImage } from "@/app/actions";

export const MAX_PHOTOS = 4;
const MAX_SIDE = 1800;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Shrinks big photos in the browser so uploads are quick. GIFs are left alone so they keep animating. */
async function prepare(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("That file doesn't look like a photo.");
  const { width, height } = bmp;
  if (file.type === "image/gif" || (Math.max(width, height) <= MAX_SIDE && file.size < 1.5 * 1024 * 1024)) {
    bmp.close?.();
    return { blob: file, width, height };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.86));
  return { blob, width: w, height: h };
}

/**
 * Add up to four photos. Value is a list of { id, url, width, height } for uploaded photos.
 * Parent components can call ref.addFiles(files) — used for paste and drag-and-drop on the whole sheet.
 */
export const ImagePicker = forwardRef(function ImagePicker({ value, onChange, onError, compact = false, max = MAX_PHOTOS }, ref) {
  const input = useRef(null);
  const [busy, setBusy] = useState(0);
  const latest = useRef(value);
  latest.current = value;

  async function addFiles(list) {
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const room = max - latest.current.length - busy;
    if (room <= 0) return onError?.(max === 1 ? "One photo per moment." : `You can add up to ${max} photos.`);
    if (files.length > room) onError?.(`Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} — added the first ${room}.`);
    for (const f of files.slice(0, room)) {
      if (!TYPES.includes(f.type)) {
        onError?.("Only JPG, PNG, WebP or GIF photos can be added.");
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const { blob, width, height } = await prepare(f);
        const fd = new FormData();
        fd.append("file", blob, f.name);
        fd.append("width", String(width));
        fd.append("height", String(height));
        const r = await uploadImage(fd);
        if (!r.ok) onError?.(r.error);
        else onChange([...latest.current, r.data]);
      } catch (e) {
        onError?.(e.message || "That photo couldn't be added.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  useImperativeHandle(ref, () => ({ addFiles, open: () => input.current?.click() }));

  function remove(img) {
    onChange(latest.current.filter((x) => x.id !== img.id));
    discardImage(img.id);
  }

  function move(i, dir) {
    const next = [...latest.current];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const full = value.length + busy >= max;

  return (
    <div className="photo-picker" data-compact={compact || undefined}>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        multiple={max > 1}
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {value.map((img, i) => (
        <div key={img.id} className="photo-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={`Photo ${i + 1}`} />
          <button type="button" className="photo-remove" onClick={() => remove(img)} aria-label={`Remove photo ${i + 1}`}>
            <Icon name="x" size={12} stroke={2.8} />
          </button>
          {value.length > 1 && (
            <span className="photo-order">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}>
                ‹
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move photo ${i + 1} later`}>
                ›
              </button>
            </span>
          )}
        </div>
      ))}
      {Array.from({ length: busy }, (_, i) => (
        <div key={`b${i}`} className="photo-thumb photo-loading" aria-label="Uploading photo">
          <span className="spinner" />
        </div>
      ))}
      {!full && (
        <button type="button" className="photo-add" onClick={() => input.current?.click()}>
          <Icon name="image" size={20} />
          <span>{value.length ? "Add more" : max === 1 ? "Add photo" : "Add photos"}</span>
        </button>
      )}
    </div>
  );
});
