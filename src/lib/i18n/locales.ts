export const LOCALES = ["az", "tr", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  az: "Azərbaycan",
  tr: "Türkçe",
  en: "English",
  ru: "Русский",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  az: "AZ",
  tr: "TR",
  en: "EN",
  ru: "RU",
};

export function normalizeLocale(raw: unknown, fallback: Locale = "az"): Locale {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "az" || s === "tr" || s === "en" || s === "ru") return s;
  return fallback;
}

export function readStoredLocale(key: string, fallback: Locale = "az"): Locale {
  if (typeof window === "undefined") return fallback;
  try {
    return normalizeLocale(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredLocale(key: string, locale: Locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, locale);
  } catch {
    /* ignore */
  }
}

export const ADMIN_LOCALE_KEY = "ar-admin-locale";
export const WHEEL_LOCALE_KEY = "ar-wheel-locale";
