import sharp from "sharp";
import { generateQrPng } from "@/lib/qr";

/**
 * Baskı hücresi: ortada kampanya QR (kamera takibi yok).
 */
export async function generateMarkerPng(
  slug: string,
  size = 1400,
  opts?: { wheelEnabled?: boolean },
) {
  const qrBuf = await generateQrPng(slug, opts);
  const pad = Math.round(size * 0.12);
  const qrSize = size - pad * 2;
  const qr = await sharp(qrBuf).resize(qrSize, qrSize).png().toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: qr, left: pad, top: pad }])
    .png()
    .toBuffer();
}
