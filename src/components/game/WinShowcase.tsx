"use client";

type Props = {
  prizeName: string;
  imageUrl: string | null;
  claimLabel?: string | null;
  onPrizes: () => void;
  onClose: () => void;
};

/** Büyük hediye vitrini — kazanınca */
export default function WinShowcase({
  prizeName,
  imageUrl,
  claimLabel,
  onPrizes,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: "rgba(26, 8, 0, 0.6)" }}
        aria-label="Bağla"
        onClick={onClose}
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="gw-rays absolute left-1/2 top-[36%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0 7%, rgba(255,220,80,.4) 7% 11%, transparent 11% 18%, rgba(255,255,255,.22) 18% 20%, transparent 20% 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-[12%] h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,210,60,.65),transparent_68%)]" />
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-full bg-amber-200"
            style={{
              left: `${8 + ((i * 9) % 84)}%`,
              top: `${12 + ((i * 13) % 50)}%`,
              // tek shorthand — Tailwind animate-ping + delay karıştırmayın
              animation: `gw-spark 1.4s ease-out ${i * 0.12}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="gw-win-card relative z-10 mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] w-full max-w-sm overflow-hidden rounded-[1.85rem] p-[3px] shadow-[0_24px_70px_rgba(80,30,0,.5)]">
        <div
          className="absolute inset-0 animate-pulse rounded-[1.85rem]"
          style={{
            background:
              "linear-gradient(135deg, #FFE566, #FF8AD8, #4DB7FF, #7CFF3A, #FFD54F)",
          }}
          aria-hidden
        />
        <div className="relative rounded-[1.7rem] bg-gradient-to-b from-[#FFFDF8] via-[#FFF6D8] to-[#FFE8A0] px-4 pb-4 pt-5">
          <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-[#FFE566] to-[#F0A500] text-lg shadow-md">
            ★
          </div>
          <p className="text-center text-[11px] font-black uppercase tracking-[0.3em] text-[#C4890A]">
            Təbriklər
          </p>
          <h2
            className="mt-1 text-center text-[1.65rem] font-black leading-tight text-[#5C3200]"
            style={{ fontFamily: "var(--display)" }}
          >
            {prizeName}
          </h2>

          <div className="relative mx-auto mt-4 flex h-56 w-56 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,210,60,.7) 0%, transparent 68%)",
                boxShadow:
                  "0 0 50px rgba(255,190,40,.7), 0 0 100px rgba(255,140,0,.35)",
              }}
            />
            <div className="gw-prize-ring absolute inset-2 rounded-full border-[3px] border-[#FFD54F] shadow-[0_0_24px_rgba(255,200,60,.8)]" />
            <div className="relative z-10 flex h-[76%] w-[76%] items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_10px_28px_rgba(90,40,0,.28)] ring-[6px] ring-[#FFF3C4]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={prizeName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-6xl text-[#F0A500]">★</span>
              )}
            </div>
          </div>

          {claimLabel ? (
            <p className="mt-3 text-center text-sm font-bold text-amber-900">
              {claimLabel}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onPrizes}
              className="flex-1 rounded-2xl bg-gradient-to-b from-[#34D399] to-[#059669] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-800/25"
            >
              Aldım — kassir şifrəsi
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#5C3200]/12 px-5 py-3.5 text-sm font-bold text-[#5C3200]"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .gw-win-card {
          animation: gw-pop 0.48s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .gw-rays {
          animation: gw-rays-spin 14s linear infinite;
        }
        .gw-prize-ring {
          animation: gw-pulse-ring 1.4s ease-in-out infinite;
        }
        @keyframes gw-pop {
          0% { transform: translateY(28px) scale(0.86); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes gw-rays-spin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes gw-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes gw-spark {
          0% { transform: scale(0.4); opacity: 0.9; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
