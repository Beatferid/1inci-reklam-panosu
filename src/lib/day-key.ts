/**
 * Paylaşılan tarih/cihaz yardımcıları — hem şans çarkı (wheel.ts) hem de
 * Öneri & Şikayet kutusu (feedback.ts) tarafından kullanılır.
 */

export const APP_TZ = "Europe/Istanbul";
/** @deprecated use APP_TZ */
export const WHEEL_TZ = APP_TZ;

/** Anonim cihaz kimliğini normalize eder (localStorage'dan gelir) */
export function normalizeDeviceId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return s.length >= 8 ? s : null;
}

export function istanbulDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** İstanbul takvim günü için UTC öğlen anı (TZ kayması olmasın) */
function istanbulCalendarNoon(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

/** Hafta: Pazartesi–Pazar (İstanbul) */
export function istanbulWeekBounds(date = new Date()): {
  from: string;
  to: string;
} {
  const day = istanbulDayKey(date);
  const noon = istanbulCalendarNoon(day);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
  }).format(noon);
  const monOffset: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const back = monOffset[wd] ?? 0;
  const monday = new Date(noon);
  monday.setUTCDate(monday.getUTCDate() - back);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { from: istanbulDayKey(monday), to: istanbulDayKey(sunday) };
}

/** Ay: 1 … ayın son günü (İstanbul) */
export function istanbulMonthBounds(date = new Date()): {
  from: string;
  to: string;
} {
  const day = istanbulDayKey(date);
  const [y, m] = day.split("-").map(Number);
  const yy = y ?? 1970;
  const mm = m ?? 1;
  const from = `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const to = `${yy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function formatIstanbul(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: APP_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
