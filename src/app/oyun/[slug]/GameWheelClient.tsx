"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GameWheelApp, { type WheelSlice } from "@/components/game/GameWheelApp";
import type { PublicLocation } from "@/lib/client-geo";

type Meta = {
  name: string;
  slug: string;
  wheelShowPrizeNames?: boolean;
  requirePin?: boolean;
  requireClaimPin?: boolean;
  claimWindowMinutes?: number;
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
          // Yalnızca ilk yüklemede hata ekranı göster — arka plandaki
          // yenilemede geçici bir hata tüm oyunu kilitlemesin.
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
          // Referans değişmeden gereksiz render/animasyon kesintisi olmasın
          if (prev && JSON.stringify(prev) === JSON.stringify(next)) {
            return prev;
          }
          return next;
        });
        setError(null);
        // QR açılış: ziyaret başına 1 (admin test sayılmasın)
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
        if (!cancelled && firstLoad) {
          setError(
            "Bağlantı xətası / server tapılmadı. tunnel.bat açıqdır? QR ünvanını yeniləyin.",
          );
        }
      } finally {
        firstLoad = false;
      }
    }

    void loadMeta();
    // Admin ayarları (konum kilidi, dilimler, PIN vs.) değiştirdiğinde açık
    // olan oyun sekmesi elle yenilemeden güncel duruma otomatik geçsin.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMeta();
    }, 15000);
    function onVisible() {
      if (document.visibilityState === "visible") void loadMeta();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, fromAdmin]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#fff4e0] px-6 text-center">
        <div>
          <p className="text-lg font-bold text-[#5c3b00]">Oyun açıla bilmədi</p>
          <p className="mt-2 text-sm text-[#5c3b00]/70">{error}</p>
        </div>
        {fromAdmin ? (
          <Link
            href="/admin"
            className="rounded-xl bg-[#5C3200] px-4 py-2.5 text-sm font-bold text-[#FFF6D6]"
          >
            ← Admin panel
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

  return (
    <>
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
        geoRequired={Boolean(meta.geoRequired)}
        locations={meta.locations || []}
      />
    </>
  );
}
