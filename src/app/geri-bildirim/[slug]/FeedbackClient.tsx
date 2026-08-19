"use client";

import { useEffect, useState } from "react";
import FeedbackForm from "@/components/feedback/FeedbackForm";
import type { PublicLocation } from "@/lib/client-geo";
import { getOrCreateFeedbackDeviceId } from "@/components/feedback/device-id";

type Meta = {
  id: string;
  name: string;
  slug: string;
  dailyLimitPerDevice: number;
  remainingToday: number;
  geoRequired?: boolean;
  locations?: PublicLocation[];
};

export default function FeedbackClient({ slug }: { slug: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let firstLoad = true;
    const deviceId = getOrCreateFeedbackDeviceId();

    async function loadMeta() {
      try {
        const res = await fetch(
          `/api/public/feedback/${slug}?deviceId=${encodeURIComponent(deviceId)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (firstLoad) {
            setError(String(data.error || "Form tapılmadı"));
          }
          return;
        }
        setMeta((prev) => {
          const next = data as Meta;
          if (prev && JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
        setError(null);
      } catch {
        if (!cancelled && firstLoad) {
          setError("Bağlantı xətası / server tapılmadı. Səhifəni yeniləyin.");
        }
      } finally {
        firstLoad = false;
      }
    }

    void loadMeta();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMeta();
    }, 20000);
    function onVisible() {
      if (document.visibilityState === "visible") void loadMeta();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#fff4e0] px-6 text-center">
        <p className="text-lg font-bold text-[#5c3b00]">Form açıla bilmədi</p>
        <p className="text-sm text-[#5c3b00]/70">{error}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fff4e0] text-sm text-[#5c3b00]/70">
        Form hazırlanır…
      </div>
    );
  }

  return (
    <FeedbackForm
      slug={meta.slug}
      boxName={meta.name}
      dailyLimitPerDevice={meta.dailyLimitPerDevice}
      remainingToday={meta.remainingToday}
      geoRequired={Boolean(meta.geoRequired)}
      locations={meta.locations || []}
    />
  );
}
