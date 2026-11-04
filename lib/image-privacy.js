// Removes hidden metadata from uploaded photos: GPS location, camera serial numbers, dates, editing history.
// Works on the raw bytes (no image library needed). Only the JPEG rotation flag is kept, so phone
// photos still show the right way up.

/* ----------------------------------------------------------------- JPEG */

function readOrientation(app1) {
  // app1 = segment payload starting with "Exif\0\0"
  try {
    if (app1.toString("latin1", 0, 6) !== "Exif\0\0") return 0;
    const t = app1.subarray(6);
    const le = t.toString("latin1", 0, 2) === "II";
    const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
    const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
    const ifd = u32(4);
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (u16(e) === 0x0112) {
        const v = u16(e + 8);
        return v >= 1 && v <= 8 ? v : 0;
      }
    }
  } catch {}
  return 0;
}

/** A tiny EXIF block holding only the rotation. */
function orientationApp1(orientation) {
  const tiff = Buffer.alloc(26);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // IFD0 offset
  tiff.writeUInt16BE(1, 8); // one entry
  tiff.writeUInt16BE(0x0112, 10); // Orientation
  tiff.writeUInt16BE(3, 12); // SHORT
  tiff.writeUInt32BE(1, 14); // count
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt32BE(0, 22); // no next IFD
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)]; // SOI
  let i = 2;
  let orientation = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // not a marker where we expect one → leave the file as it was
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      // Start of image data: everything from here on is the picture itself.
      if (orientation > 1) out.splice(1, 0, orientationApp1(orientation));
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return buf;
    const seg = buf.subarray(i, i + 2 + len);
    const payload = buf.subarray(i + 4, i + 2 + len);
    // APP1 (EXIF/XMP), APP3–APP13 (camera maker / Photoshop data), APP15, COM (comments) → dropped.
    // Kept: APP0 (JFIF), APP2 (colour profile), APP14 (Adobe colour info) and all image tables.
    const drop = marker === 0xe1 || (marker >= 0xe3 && marker <= 0xed) || marker === 0xef || marker === 0xfe;
    if (marker === 0xe1 && !orientation) orientation = readOrientation(payload);
    if (!drop) out.push(seg);
    i += 2 + len;
  }
  return buf;
}

/* ----------------------------------------------------------------- PNG */

const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function stripPng(buf) {
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) return buf;
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

/* ----------------------------------------------------------------- WebP */

function stripWebp(buf) {
  const chunks = [];
  let i = 12;
  let changed = false;
  while (i + 8 <= buf.length) {
    const type = buf.toString("latin1", i, i + 4);
    const len = buf.readUInt32LE(i + 4);
    const end = i + 8 + len + (len % 2);
    if (end > buf.length + 1) return buf;
    if (type === "EXIF" || type === "XMP ") changed = true;
    else chunks.push(Buffer.from(buf.subarray(i, Math.min(end, buf.length))));
    i = end;
  }
  if (!changed) return buf;
  for (const c of chunks) {
    // VP8X header: clear the "has EXIF" (bit 3) and "has XMP" (bit 2) flags.
    if (c.toString("latin1", 0, 4) === "VP8X") c[8] &= ~0x0c;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(body.length + 4, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, body]);
}

/** Returns the photo without its hidden metadata. Never throws: if anything looks odd, the original is returned. */
export function stripImageMetadata(buf, mime) {
  try {
    if (mime === "image/jpeg") return stripJpeg(buf);
    if (mime === "image/png") return stripPng(buf);
    if (mime === "image/webp") return stripWebp(buf);
  } catch {}
  return buf;
}
