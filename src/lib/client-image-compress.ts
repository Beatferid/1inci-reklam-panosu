"use client";

import {
  formatMb,
  MAX_UPLOAD_BYTES,
  UPLOAD_TRANSPORT_MAX_BYTES,
} from "@/lib/upload-limits";

export type PrepareImageResult =
  | {
      ok: true;
      file: File;
      compressed: boolean;
      originalBytes: number;
    }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel okunamadı"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/**
 * Tarayıcıda JPEG’e çevirerek hedef boyuta yaklaşır.
 * Vercel gövde sınırına takılmadan büyük katalog görselleri yüklemek için.
 */
export async function compressImageFile(
  file: File,
  opts: { maxBytes: number; maxEdge?: number },
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 2400;
  const img = await loadImage(file);
  let edge = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  edge = Math.min(edge, maxEdge);

  const qualities = [0.88, 0.78, 0.68, 0.58, 0.48, 0.38];
  let best: File | null = null;

  for (let pass = 0; pass < 4; pass++) {
    const scale =
      edge /
      Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1);
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas desteklenmiyor");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const q of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (!blob) continue;
      const out = new File(
        [blob],
        file.name.replace(/\.\w+$/i, "") + ".jpg",
        { type: "image/jpeg", lastModified: Date.now() },
      );
      if (!best || out.size < best.size) best = out;
      if (out.size <= opts.maxBytes) return out;
    }
    edge = Math.round(edge * 0.75);
    if (edge < 800) break;
  }

  if (!best) throw new Error("Sıkıştırma başarısız");
  return best;
}

/**
 * Limit üstüyse uyarır; istek üzerine sıkıştırır.
 * softMax = kullanıcı limiti (varsayılan 10 MB)
 * hardMax = fiili yükleme tavanı (Vercel ~4 MB)
 */
export async function prepareCatalogImage(
  file: File,
  opts?: {
    softMaxBytes?: number;
    hardMaxBytes?: number;
    onStatus?: (msg: string) => void;
  },
): Promise<PrepareImageResult> {
  const softMax = opts?.softMaxBytes ?? MAX_UPLOAD_BYTES;
  const hardMax = opts?.hardMaxBytes ?? UPLOAD_TRANSPORT_MAX_BYTES;
  const originalBytes = file.size;

  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return { ok: false, error: "Yalnızca PNG / JPG / WEBP görsel yükleyin." };
  }

  if (file.size <= hardMax) {
    return { ok: true, file, compressed: false, originalBytes };
  }

  const sizeLabel = `${formatMb(file.size)} MB`;
  const softLabel = `${formatMb(softMax, 0)} MB`;
  const hardLabel = `${formatMb(hardMax, 0)} MB`;

  let message: string;
  if (file.size > softMax) {
    message =
      `«${file.name}» ${sizeLabel} — ayarlanan limit ${softLabel}.\n\n` +
      `Sıkıştırıp yüklemek ister misiniz? (hedef ≤ ${hardLabel})`;
  } else {
    message =
      `«${file.name}» ${sizeLabel}. Canlı sunucu yükleme tavanı ~${hardLabel}.\n\n` +
      `Otomatik sıkıştırılsın mı?`;
  }

  if (!confirm(message)) {
    return { ok: false, cancelled: true };
  }

  opts?.onStatus?.(`Sıkıştırılıyor… (${sizeLabel})`);
  try {
    const compressed = await compressImageFile(file, {
      maxBytes: hardMax,
      maxEdge: 2400,
    });
    if (compressed.size > hardMax) {
      return {
        ok: false,
        error: `Sıkıştırma sonrası hâlâ ${formatMb(compressed.size)} MB. Daha küçük bir görsel deneyin.`,
      };
    }
    opts?.onStatus?.(
      `Sıkıştırıldı: ${sizeLabel} → ${formatMb(compressed.size)} MB`,
    );
    return {
      ok: true,
      file: compressed,
      compressed: true,
      originalBytes,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sıkıştırılamadı",
    };
  }
}
