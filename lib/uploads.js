import "server-only";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";

// Post photos are stored in the database (they're resized in the browser first, so they stay small).
// No local disk is needed, which is what makes the app work on Vercel and other serverless hosts.
// Vercel limits a request to 4.5 MB, so uploads are capped at 4 MB.
export const MAX_BYTES = 4 * 1024 * 1024;
export const MAX_PER_POST = 4;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Checks the file's first bytes, so a renamed file can't pretend to be an image. */
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 6).toString() === "GIF87a" || buf.subarray(0, 6).toString() === "GIF89a") return "image/gif";
  return null;
}

export async function saveUpload(file, uploaderId, dims = {}) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Choose a photo to upload.");
  if (file.size > MAX_BYTES) throw new Error("That photo is over 4 MB. Try a smaller one.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new Error("Only JPG, PNG, WebP or GIF photos can be added.");
  const id = crypto.randomUUID();
  const width = Math.max(0, Math.min(20000, Number(dims.width) || 0));
  const height = Math.max(0, Math.min(20000, Number(dims.height) || 0));
  await db
    .insert(s.postImages)
    .values({ id, uploaderId, fileName: `${id}.${EXT[mime]}`, mime, data: buf, width, height, size: buf.length });
  // Tidy up uploads that were never posted (older than a day).
  cleanupOrphans().catch(() => {});
  return { id, url: `/api/uploads/${id}`, width, height };
}

/** Attach the uploader's own unposted photos to a post, in the order given. */
export async function attachImages(postId, ids, uploaderId) {
  const list = [...new Set(ids ?? [])].slice(0, MAX_PER_POST);
  if (!list.length) return;
  const rows = await db
    .select({ id: s.postImages.id })
    .from(s.postImages)
    .where(and(inArray(s.postImages.id, list), eq(s.postImages.uploaderId, uploaderId), isNull(s.postImages.postId)));
  if (rows.length !== list.length) throw new Error("One of the photos couldn't be found — please add it again.");
  for (const [i, id] of list.entries()) await db.update(s.postImages).set({ postId, position: i }).where(eq(s.postImages.id, id));
}

export async function removeImagesFor(postId) {
  await db.delete(s.postImages).where(eq(s.postImages.postId, postId));
}

/** Remove one unposted upload (the × on a thumbnail). */
export async function removeUpload(id, uploaderId) {
  await db.delete(s.postImages).where(and(eq(s.postImages.id, id), eq(s.postImages.uploaderId, uploaderId), isNull(s.postImages.postId)));
}

export async function cleanupOrphans() {
  const cutoff = new Date(Date.now() - 86_400_000);
  await db.delete(s.postImages).where(and(isNull(s.postImages.postId), lt(s.postImages.createdAt, cutoff)));
}
