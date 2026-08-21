"use client";

import {
  LOCALES,
  LOCALE_SHORT,
  type Locale,
  useLocale,
} from "@/components/i18n/LocaleProvider";

type Props = {
  compact?: boolean;
  className?: string;
};

export default function LanguageSwitcher({
  compact = false,
  className = "",
}: Props) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role="group"
      aria-label={t("language")}
    >
      {!compact ? (
        <span className="mr-1 hidden text-[11px] font-semibold uppercase tracking-wider text-muted sm:inline">
          {t("language")}
        </span>
      ) : null}
      <div className="inline-flex rounded-full bg-black/5 p-0.5 ring-1 ring-black/10">
        {LOCALES.map((code) => {
          const active = locale === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code as Locale)}
              className={`min-w-[2.1rem] rounded-full px-2 py-1 text-[11px] font-bold tracking-wide transition ${
                active
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
              aria-pressed={active}
            >
              {LOCALE_SHORT[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
