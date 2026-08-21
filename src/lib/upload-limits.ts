/** Yumuşak / sunucu kabul limiti (kullanıcıya gösterilen) */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Vercel Hobby istek gövdesi ~4.5 MB.
 * Bu değerin üstündeki dosyalar yüklemeden önce sıkıştırılmalı.
 */
export const UPLOAD_TRANSPORT_MAX_BYTES = 4 * 1024 * 1024;

export const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;

export function formatMb(bytes: number, digits = 1): string {
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(digits);
}
