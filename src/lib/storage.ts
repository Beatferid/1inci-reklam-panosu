import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { del, put } from "@vercel/blob";
import { publicMediaUrl } from "@/lib/media-url";

export { publicMediaUrl };

const ROOT = path.join(process.cwd(), "storage");
const UPLOADS = path.join(ROOT, "uploads");
const TARGETS = path.join(ROOT, "targets");
const ROOT_RESOLVED = path.resolve(ROOT);

export async function ensureStorageDirs() {
  await mkdir(UPLOADS, { recursive: true });
  await mkdir(TARGETS, { recursive: true });
}

function extFromMime(mime: string, fallback: string) {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "application/octet-stream": ".mind",
  };
  return map[mime] ?? fallback;
}

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);
}

export async function saveUpload(
  file: File | Buffer,
  opts: { folder: "uploads" | "targets"; mime: string; preferredExt?: string },
) {
  const ext =
    opts.preferredExt ??
    extFromMime(opts.mime, opts.folder === "targets" ? ".mind" : ".bin");
  const filename = `${nanoid(12)}${ext}`;
  const relative = `${opts.folder}/${filename}`;

  const buffer =
    file instanceof Buffer
      ? file
      : Buffer.from(await (file as File).arrayBuffer());

  if (blobEnabled()) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const storeId = process.env.BLOB_STORE_ID;
    try {
      const blob = await put(relative, buffer, {
        access: "public",
        addRandomSuffix: false,
        ...(token ? { token } : {}),
        ...(storeId ? { storeId } : {}),
      });
      return { absolute: blob.url, relative: blob.url, filename };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Dosya Vercel’de kaydedilemedi. BLOB_READ_WRITE_TOKEN Production’da olmalı. (${msg})`,
      );
    }
  }

  await ensureStorageDirs();
  const dir = opts.folder === "targets" ? TARGETS : UPLOADS;
  const absolute = path.join(dir, filename);
  await writeFile(absolute, buffer);
  return { absolute, relative, filename };
}

/** Resolve a storage-relative path; throws if it escapes ROOT. */
export function resolveStoragePath(relative: string) {
  if (!relative || typeof relative !== "string") {
    throw new Error("Geçersiz depolama yolu");
  }
  if (/^https?:\/\//i.test(relative)) {
    throw new Error("Uzak URL yerel yola çevrilemez");
  }
  const normalized = relative.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    path.isAbsolute(normalized) ||
    normalized.split("/").some((seg) => seg === ".." || seg === "")
  ) {
    throw new Error("Geçersiz depolama yolu");
  }
  if (
    !normalized.startsWith("uploads/") &&
    !normalized.startsWith("targets/")
  ) {
    throw new Error("Geçersiz depolama yolu");
  }

  const resolved = path.resolve(ROOT, normalized);
  const prefix = ROOT_RESOLVED.endsWith(path.sep)
    ? ROOT_RESOLVED
    : ROOT_RESOLVED + path.sep;
  if (resolved !== ROOT_RESOLVED && !resolved.startsWith(prefix)) {
    throw new Error("Geçersiz depolama yolu");
  }
  return resolved;
}

export async function readStorageFile(relative: string) {
  if (/^https?:\/\//i.test(relative)) {
    const res = await fetch(relative);
    if (!res.ok) throw new Error("Dosya yok");
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(resolveStoragePath(relative));
}

export async function deleteStorageFile(relative: string | null | undefined) {
  if (!relative) return;
  try {
    if (/^https?:\/\//i.test(relative) && process.env.BLOB_READ_WRITE_TOKEN) {
      await del(relative, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return;
    }
    await unlink(resolveStoragePath(relative));
  } catch {
    // ignore missing / invalid
  }
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm"]);
const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);

/** Sniff magic bytes; returns canonical mime or null. */
export function sniffUploadMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    const subtype = buf.toString("ascii", 8, 12);
    if (/^(M4A|M4B)/.test(subtype)) return "audio/mp4";
    return "video/mp4";
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return "video/webm";
  }
  // MP3: ID3 etiketi ya da çıplak MPEG frame sync
  if (buf.length >= 3 && buf.toString("ascii", 0, 3) === "ID3") {
    return "audio/mpeg";
  }
  if (
    buf.length >= 2 &&
    buf[0] === 0xff &&
    (buf[1] & 0xe0) === 0xe0 &&
    (buf[1] & 0x06) !== 0x00
  ) {
    return "audio/mpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "audio/wav";
  }
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }
  return null;
}

export function assertAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.has(mime);
}

export function assertAllowedVideoMime(mime: string): boolean {
  return ALLOWED_VIDEO_MIME.has(mime);
}

export function assertAllowedAudioMime(mime: string): boolean {
  return ALLOWED_AUDIO_MIME.has(mime);
}
