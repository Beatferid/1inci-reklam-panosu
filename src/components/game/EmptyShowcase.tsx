"use client";

type Props = {
  prizeName?: string | null;
  onClose: () => void;
};

/** Boş dilim — yumuşak, animasyonlu bildirim */
export default function EmptyShowcase({ prizeName, onClose }: Props) {
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

      <div className="gw-empty-card relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-sm overflow-hidden rounded-[1.85rem] p-[2px] shadow-[0_24px_60px_rgba(20,30,50,.45)]">
        <div
          className="absolute inset-0 rounded-[1.85rem]"
          style={{
            background:
              "linear-gradient(135deg, #B8C5D6, #8FA3B8, #D4DCE6, #9BB0C4)",
          }}
          aria-hidden
        />
        <div className="relative rounded-[1.7rem] bg-gradient-to-b from-[#F7FAFD] via-[#EEF3F8] to-[#DDE6F0] px-4 pb-4 pt-6">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
            <div
              className="gw-empty-ring absolute inset-0 rounded-full border-2 border-dashed border-slate-400/50"
              aria-hidden
            />
            <div className="gw-empty-bubble relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-b from-white to-slate-200 shadow-[0_10px_28px_rgba(60,80,110,.22)] ring-4 ring-white/80">
              <svg
                className="gw-empty-face h-14 w-14 text-slate-400"
                viewBox="0 0 64 64"
                fill="none"
                aria-hidden
              >
                <rect
                  x="12"
                  y="22"
                  width="40"
                  height="30"
                  rx="6"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="5 4"
                />
                <path
                  d="M12 30h40"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M32 22v30"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.5"
                />
                <circle cx="32" cy="14" r="5" stroke="currentColor" strokeWidth="3" />
              </svg>
              <span className="mt-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                boş
              </span>
            </div>
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
            Bu turda hədiyyə çıxmadı. Yenidən şans üçün panodakı QR kodu oxudun.
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
        .gw-empty-bubble {
          animation: gw-empty-bob 2.4s ease-in-out infinite;
        }
        .gw-empty-ring {
          animation: gw-empty-spin 10s linear infinite;
        }
        .gw-empty-face {
          animation: gw-empty-soft 2.8s ease-in-out infinite;
        }
        @keyframes gw-empty-pop {
          0% { transform: translateY(32px) scale(0.88); opacity: 0; }
          60% { transform: translateY(-4px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes gw-empty-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes gw-empty-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes gw-empty-soft {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes gw-empty-float {
          0% { transform: translateY(0) scale(0.7); opacity: 0; }
          20% { opacity: 0.7; }
          80% { opacity: 0.35; }
          100% { transform: translateY(-48px) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
