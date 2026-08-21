"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";

type Props = {
  prizeName?: string | null;
  requireQrRescan?: boolean;
  onClose: () => void;
};

/** Boş dilim — yumuşak, animasyonlu bildirim */
export default function EmptyShowcase({
  prizeName,
  requireQrRescan = true,
  onClose,
}: Props) {
  const { t } = useLocale();
  const label =
    prizeName && prizeName.trim() && !/^bo[sş]/i.test(prizeName)
      ? prizeName
      : "Bu dəfə boş";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(20, 28, 40, 0.55)" }}
        aria-label="Bağla"
        onClick={onClose}
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-x-0 top-[18%] h-48 bg-[radial-gradient(ellipse_at_center,rgba(148,180,220,.35),transparent_70%)]" />
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-slate-300/70"
            style={{
              left: `${6 + ((i * 8) % 88)}%`,
              top: `${18 + ((i * 11) % 55)}%`,
              width: 6 + (i % 3) * 3,
              height: 6 + (i % 3) * 3,
              animation: `gw-empty-float ${2.2 + (i % 4) * 0.35}s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
        <div className="gw-empty-card rounded-[1.75rem] bg-gradient-to-b from-slate-50 to-slate-100 p-5 shadow-2xl ring-1 ring-slate-200">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-200/80 text-3xl text-slate-500 shadow-inner">
            ○
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-slate-300"
                style={{
                  animation: `gw-empty-dot 1.2s ease-in-out ${i * 0.12}s infinite`,
                }}
              />
            ))}
          </div>

          <p className="mt-4 text-center text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
            Nəticə
          </p>
          <h2
            className="mt-1 text-center text-[1.55rem] font-black leading-tight text-slate-700"
            style={{ fontFamily: "var(--display)" }}
          >
            {label}
          </h2>
          <p className="mx-auto mt-2 max-w-[16rem] text-center text-sm font-semibold leading-snug text-slate-500">
            {requireQrRescan
              ? t("qrRescanMsg")
              : "Bu turda hədiyyə çıxmadı. Haqqınız varsa yenidən çevirə bilərsiniz."}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl bg-gradient-to-b from-slate-600 to-slate-800 py-3.5 text-sm font-black text-white shadow-lg shadow-slate-900/20"
          >
            Anladım
          </button>
        </div>
      </div>

      <style>{`
        .gw-empty-card {
          animation: gw-empty-pop 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes gw-empty-pop {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gw-empty-float {
          0%, 100% { transform: translateY(0); opacity: 0.45; }
          50% { transform: translateY(-10px); opacity: 0.85; }
        }
        @keyframes gw-empty-dot {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.35); }
        }
      `}</style>
    </div>
  );
}
