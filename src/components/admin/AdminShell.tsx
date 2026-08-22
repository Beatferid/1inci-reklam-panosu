"use client";

import Link from "next/link";
import { LocaleProvider, useLocale } from "@/components/i18n/LocaleProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { ADMIN_LOCALE_KEY } from "@/lib/i18n/locales";

function AdminNav({
  email,
  role,
  signOutAction,
}: {
  email?: string | null;
  role?: string | null;
  signOutAction: () => Promise<void>;
}) {
  const { t } = useLocale();
  const isSuper = role === "SUPER";

  return (
    <header className="border-b border-line/80 bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin"
            className="text-lg"
            style={{ fontFamily: "var(--display)" }}
          >
            {t("brand")}
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-md border border-line bg-white px-3 py-1.5 font-medium text-ink shadow-sm hover:bg-bg-deep/40"
            >
              {t("navCampaigns")}
            </Link>
            <Link
              href="/admin/new"
              className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
            >
              {t("navNew")}
            </Link>
            <Link
              href="/admin/geri-bildirim"
              className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
            >
              {t("navFeedback")}
            </Link>
            <Link
              href="/admin/katalog"
              className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
            >
              {t("navCatalog")}
            </Link>
            {isSuper ? (
              <Link
                href="/admin/kullanicilar"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100"
              >
                Kullanıcılar
              </Link>
            ) : null}
            <Link
              href="/admin/hesap"
              className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
            >
              {t("navPassword")}
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <LanguageSwitcher compact />
          <span className="hidden text-muted sm:inline">
            {email}
            {isSuper ? " · süper" : " · müşteri"}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 hover:bg-white"
            >
              {t("logout")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export default function AdminShell({
  children,
  email,
  role,
  signOutAction,
}: {
  children: React.ReactNode;
  email?: string | null;
  role?: string | null;
  signOutAction: () => Promise<void>;
}) {
  return (
    <LocaleProvider
      storageKey={ADMIN_LOCALE_KEY}
      mode="admin"
      defaultLocale="az"
    >
      <div className="min-h-screen">
        <AdminNav email={email} role={role} signOutAction={signOutAction} />
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </LocaleProvider>
  );
}
