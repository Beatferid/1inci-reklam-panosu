"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GameWheelApp, { type WheelSlice } from "@/components/game/GameWheelApp";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { WHEEL_LOCALE_KEY, normalizeLocale, type Locale } from "@/lib/i18n/locales";
import type { PublicLocation } from "@/lib/client-geo";

type Meta = {
  name: string;
  slug: string;
  wheelShowPrizeNames?: boolean;
  requirePin?: boolean;
  requireClaimPin?: boolean;
  claimWindowMinutes?: number;
  wheelAskName?: boolean;
  wheelNameRequired?: boolean;
  wheelTitle?: string;
  wheelLogoUrl?: string | null;
  wheelWinnersEnabled?: boolean;
  wheelWinnersPeriod?: "DAY" | "WEEK" | "MONTH";
  wheelDefaultLocale?: Locale;
  wheelSlices: WheelSlice[];
  geoRequired?: boolean;
  locations?: PublicLocation[];
};

export default function GameWheelClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const fromAdmin = searchParams.get("from") === "admin";
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let firstLoad = true;

    async function loadMeta() {
      try {
        const q = fromAdmin ? "?from=admin" : "";
        const res = await fetch(`/api/public/wheel/${slug}${q}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (firstLoad) {
            const msg = String(data.error || "");
            if (res.status === 404 && /tapılmadı|tapilmadi/i.test(msg)) {
              setError(
                "Kampaniya yayınlanmayıb və ya çarx bağlıdır. Admin paneldə «Yayınla» basın.",
              );
            } else {
              setError(msg || "Oyun tapılmadı");
            }
          }
          return;
        }
        setMeta((prev) => {
          const next = data as Meta;
          if (prev && JSON.stringify(prev) === JSON.stringify(next)) {
            return prev;
          }
          return next;
        });
        setError(null);
        if (firstLoad && !fromAdmin && typeof sessionStorage !== "undefined") {
          const key = `ar-scan:${slug}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void fetch("/api/analytics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, type: "scan", meta: "wheel_open" }),
            }).catch(() => null);
          }
        }
      } catch {
        if (firstLoad && !cancelled) setError("Bağlantı xətası");
      } finally {
        firstLoad = false;
      }
    }

    void loadMeta();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMeta();
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slug, fromAdmin]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#fff4e0] px-6 text-center">
        <p className="text-sm font-medium text-[#5c3b00]">{error}</p>
        {fromAdmin ? (
          <Link href="/admin" className="text-sm font-bold text-[#8B5A00] underline">
            Adminə qayıt
          </Link>
        ) : null}
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fff4e0] text-sm text-[#5c3b00]/70">
        Oyun hazırlanır…
      </div>
    );
  }

  const defaultLocale = normalizeLocale(meta.wheelDefaultLocale, "az");

  return (
    <LocaleProvider
      storageKey={`${WHEEL_LOCALE_KEY}:${slug}`}
      mode="wheel"
      defaultLocale={defaultLocale}
    >
      {fromAdmin ? (
        <div className="fixed left-3 top-3 z-[90]">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-full bg-[#5C3200] px-3.5 py-2 text-xs font-bold text-[#FFF6D6] shadow-lg ring-2 ring-white/40"
          >
            ← Admin panel
          </Link>
        </div>
      ) : null}
      <GameWheelApp
        slug={meta.slug}
        campaignName={meta.name}
        slices={meta.wheelSlices || []}
        showPrizeNames={meta.wheelShowPrizeNames}
        requirePin={meta.requirePin}
        requireClaimPin={meta.requireClaimPin}
        claimWindowMinutes={meta.claimWindowMinutes}
        askName={meta.wheelAskName}
        nameRequired={meta.wheelNameRequired}
        wheelTitle={meta.wheelTitle}
        wheelLogoUrl={meta.wheelLogoUrl}
        winnersEnabled={Boolean(meta.wheelWinnersEnabled)}
        winnersPeriod={meta.wheelWinnersPeriod}
        geoRequired={Boolean(meta.geoRequired)}
        locations={meta.locations || []}
      />
    </LocaleProvider>
  );
}
