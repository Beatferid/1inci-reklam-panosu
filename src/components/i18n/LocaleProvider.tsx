"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_SHORT,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
  type Locale,
} from "@/lib/i18n/locales";
import { tAdmin, type AdminKey } from "@/lib/i18n/admin";
import { tWheel, type WheelKey } from "@/lib/i18n/wheel";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: AdminKey | WheelKey) => string;
  mode: "admin" | "wheel";
};

const LocaleContext = createContext<Ctx | null>(null);

type Props = {
  children: ReactNode;
  storageKey: string;
  mode: "admin" | "wheel";
  defaultLocale?: Locale;
};

export function LocaleProvider({
  children,
  storageKey,
  mode,
  defaultLocale = "az",
}: Props) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale(storageKey, defaultLocale));
    setReady(true);
  }, [storageKey, defaultLocale]);

  useEffect(() => {
    if (!ready) return;
    writeStoredLocale(storageKey, locale);
  }, [locale, ready, storageKey]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(normalizeLocale(l, defaultLocale));
  }, [defaultLocale]);

  const t = useCallback(
    (key: AdminKey | WheelKey) =>
      mode === "admin"
        ? tAdmin(locale, key as AdminKey)
        : tWheel(locale, key as WheelKey),
    [locale, mode],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, mode }),
    [locale, setLocale, t, mode],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useLocaleOptional() {
  return useContext(LocaleContext);
}

export {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_SHORT,
  type Locale,
};
