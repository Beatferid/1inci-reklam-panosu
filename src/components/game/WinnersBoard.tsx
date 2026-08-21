"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

export type PublicWinner = {
  id: string;
  displayName: string;
  prizeName: string;
  prizeImageUrl: string | null;
  spunAtLabel: string;
  claimed: boolean;
};

type Props = {
  slug: string;
  enabled: boolean;
  periodLabel: string;
  rangeLabel?: string;
};

export default function WinnersBoard({
  slug,
  enabled,
  periodLabel,
  rangeLabel,
}: Props) {
  const { t } = useLocale();
  const [winners, setWinners] = useState<PublicWinner[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBusy(false);
      setWinners([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setBusy(true);
      try {
        const res = await fetch(`/api/public/wheel/${slug}/winners`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || t("connectionError"));
          return;
        }
        setWinners(data.winners || []);
        setError(null);
      } catch {
        if (!cancelled) setError(t("connectionError"));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slug, enabled, t]);

  if (!enabled) {
    return (
      <div className="rounded-3xl bg-white/50 px-4 py-8 text-center text-sm text-[#5C3200]/55 ring-1 ring-[#E8C547]/30">
        {t("winnersOff")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p
          className="text-lg font-black tracking-wide text-[#5C3200]"
          style={{ fontFamily: "var(--display)" }}
        >
          {t("winnersTitle")}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8860B]">
          {periodLabel}
          {rangeLabel ? ` · ${rangeLabel}` : ""}
        </p>
      </div>

      {busy && winners.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#5C3200]/50">
          {t("loading")}
        </p>
      ) : null}
      {error ? (
        <p className="text-center text-sm text-red-600">{error}</p>
      ) : null}

      {winners.length === 0 && !busy ? (
        <div className="rounded-3xl border border-dashed border-[#E8C547]/50 bg-[#FFF8EC]/80 px-4 py-10 text-center text-sm text-[#5C3200]/55">
          {t("winnersEmpty")}
        </div>
      ) : (
        <ul className="max-h-[55dvh] space-y-2 overflow-y-auto pr-0.5">
          {winners.map((w, i) => (
            <li
              key={w.id}
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFFDF6] to-[#FFF1D0] px-3 py-2.5 shadow-sm ring-1 ring-[#E8C547]/35"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#FFE082] to-[#F0A500] text-xs font-black text-[#5C3200]">
                {i + 1}
              </span>
              {w.prizeImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.prizeImageUrl}
                  alt=""
                  className="h-11 w-11 rounded-xl object-cover ring-1 ring-[#E8C547]/40"
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF3C4] text-lg">
                  ★
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#5C3200]">
                  {w.displayName}
                </p>
                <p className="truncate text-xs font-semibold text-[#B8860B]">
                  {w.prizeName}
                </p>
                <p className="text-[10px] text-[#5C3200]/45">{w.spunAtLabel}</p>
              </div>
              {w.claimed ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {t("claimed")}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  {t("waiting")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
