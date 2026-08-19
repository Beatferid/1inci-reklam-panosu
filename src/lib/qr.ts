import QRCode from "qrcode";
import { getPublicAppUrl } from "@/lib/tunnel";

function appBase() {
  return getPublicAppUrl();
}

export function campaignGameUrl(slug: string) {
  return `${appBase()}/oyun/${slug}`;
}

export function campaignPublicUrl(slug: string) {
  return `${appBase()}/ar/${slug}`;
}

/** Müşteri QR: çark açıksa direkt oyun, değilse reklam görseli */
export function campaignEntryUrl(
  slug: string,
  opts?: { wheelEnabled?: boolean },
) {
  if (opts?.wheelEnabled) return campaignGameUrl(slug);
  return campaignPublicUrl(slug);
}

export async function generateQrPng(
  slug: string,
  opts?: { wheelEnabled?: boolean },
) {
  const url = campaignEntryUrl(slug, opts);
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0a0a0a",
      light: "#ffffff",
    },
  });
}

export async function generateQrDataUrl(
  slug: string,
  opts?: { wheelEnabled?: boolean },
) {
  const url = campaignEntryUrl(slug, opts);
  return QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

/** Öneri & Şikayet kutusu — kampanyalardan bağımsız kendi QR'ı */
export function feedbackEntryUrl(slug: string) {
  return `${appBase()}/geri-bildirim/${slug}`;
}

export async function generateFeedbackQrPng(slug: string) {
  const url = feedbackEntryUrl(slug);
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0a0a0a",
      light: "#ffffff",
    },
  });
}

export async function generateFeedbackQrDataUrl(slug: string) {
  const url = feedbackEntryUrl(slug);
  return QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

/** Dijital katalog — kampanyalardan bağımsız kendi QR'ı */
export function catalogEntryUrl(slug: string) {
  return `${appBase()}/katalog/${slug}`;
}

export async function generateCatalogQrPng(slug: string) {
  const url = catalogEntryUrl(slug);
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0a0a0a",
      light: "#ffffff",
    },
  });
}

export async function generateCatalogQrDataUrl(slug: string) {
  const url = catalogEntryUrl(slug);
  return QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
