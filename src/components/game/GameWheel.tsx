"use client";

export type WheelSlice = {
  id: string;
  name: string;
  color: string;
  isEmpty: boolean;
  slicePercent: number;
  imageUrl?: string | null;
};

const FALLBACK = [
  "#FF6B35",
  "#2EC4B6",
  "#E9C46A",
  "#E63946",
  "#F4A261",
  "#457B9D",
  "#BC6C25",
  "#06D6A0",
];

type Props = {
  slices: WheelSlice[];
  rotation: number;
  spinning: boolean;
  size?: number;
  durationMs?: number;
  /** true = hediye adı, false = sadece dilim numarası */
  showPrizeNames?: boolean;
  onSpin?: () => void;
  disabled?: boolean;
};

function shortName(name: string, sweep: number) {
  const max = sweep >= 60 ? 12 : sweep >= 40 ? 9 : sweep >= 28 ? 7 : 5;
  const t = name.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Açı sistemi (prizeAngle ile aynı):
 * - 0° = üst (ok / 12 yönü)
 * - saat yönü (+)
 * - conic-gradient from 0deg
 */
export default function GameWheel({
  slices,
  rotation,
  spinning,
  size = 300,
  durationMs = 7200,
  showPrizeNames = false,
  onSpin,
  disabled = false,
}: Props) {
  const canTap = Boolean(onSpin) && !disabled && !spinning;

  let acc = 0;
  const stops: string[] = [];
  const segments: {
    id: string;
    start: number;
    mid: number;
    sweep: number;
    label: string;
    index: number;
    isEmpty?: boolean;
  }[] = [];

  slices.forEach((s, i) => {
    const sweep = (Math.max(0.5, s.slicePercent) / 100) * 360;
    const start = acc;
    const mid = start + sweep / 2;
    acc += sweep;
    const color = s.color?.startsWith("#")
      ? s.color
      : FALLBACK[i % FALLBACK.length];
    // Boş dilim də digərləri kimi öz rəngi ilə göstərilsin — ayrıca ağ fon yoxdur
    stops.push(`${color} ${start}deg ${start + sweep}deg`);
    const index = i + 1;
    const nameLabel = shortName(s.name || (s.isEmpty ? "Boş" : `#${index}`), sweep);
    segments.push({
      id: s.id,
      start,
      mid,
      sweep,
      // Rəqəm rejimində boş dilim də digərləri kimi nömrə göstərir;
      // ad rejimində "Boş" (və ya admin-in yazdığı ad) görünür.
      label: showPrizeNames ? nameLabel : String(index),
      index,
      isEmpty: s.isEmpty,
    });
  });

  const conic =
    stops.length > 0
      ? `conic-gradient(from 0deg, ${stops.join(", ")})`
      : "conic-gradient(#ccc, #999)";

  const rim = Math.max(12, size * 0.055);
  const hub = size * 0.26;
  const bulbN = 16;
  /** % — merkezden yarıçap (px değil; aksi halde etiketler çark dışına kaçar) */
  const labelRPct = showPrizeNames ? 34 : 30;

  return (
    <div
      className="relative mx-auto select-none"
      style={{ width: size, height: size + size * 0.12 }}
    >
      {/* Tek net ok — uç dilimin ortasına bakar (12 yönü) */}
      <div
        className="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2"
        style={{ top: -2 }}
        aria-hidden
      >
        <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
          <path
            d="M18 44 L2 8 Q18 14 34 8 Z"
            fill="#FFC107"
            stroke="#FFFDE7"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M18 10 L18 38" stroke="#FFF8DC" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      <div
        className="absolute left-0 top-0 rounded-full"
        style={{
          width: size,
          height: size,
          padding: rim,
          background:
            "radial-gradient(circle at 30% 24%, #FFFDF2 0%, #FFE9A3 24%, #FFC94C 54%, #B46B00 100%)",
          border: "1px solid rgba(255,255,255,.7)",
          boxShadow: spinning
            ? "0 0 30px rgba(255,200,60,.7), 0 16px 36px rgba(70,38,0,.42), inset 0 2px 10px rgba(255,255,255,.65)"
            : "0 0 20px rgba(255,200,60,.45), 0 14px 32px rgba(70,38,0,.35), inset 0 2px 10px rgba(255,255,255,.58)",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{
            padding: 4,
            background: "linear-gradient(145deg, #FFF8E1 0%, #FFD67A 100%)",
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden rounded-full"
            style={{
              background: conic,
              transform: `rotate(${Number.isFinite(rotation) ? rotation : 0}deg)`,
              transition: spinning
                ? `transform ${durationMs}ms cubic-bezier(0.08, 0.85, 0.12, 1)`
                : "transform 0ms linear",
              boxShadow: "inset 0 0 26px rgba(0,0,0,.18)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,.08) 100%)",
              }}
            />
            {/* Dilim sınırları — merkezden dışa */}
            {segments.map((seg) => (
              <span
                key={`edge-${seg.id}`}
                className="pointer-events-none absolute left-1/2 top-1/2"
                style={{
                  width: 1.6,
                  height: "50%",
                  marginLeft: -0.55,
                  background: "rgba(255,255,255,0.42)",
                  transformOrigin: "50% 0%",
                  transform: `rotate(${seg.start + 180}deg)`,
                }}
              />
            ))}

            {/* Etiket: hər dilim eyni qaydada — ad rejimi / nömrə rejimi */}
            {segments.map((seg) => {
              if (seg.sweep < 8) return null;
              const rad = ((seg.mid - 90) * Math.PI) / 180;
              const x = 50 + labelRPct * Math.cos(rad);
              const y = 50 + labelRPct * Math.sin(rad);
              const fontSize = showPrizeNames
                ? seg.sweep >= 50
                  ? size * 0.042
                  : seg.sweep >= 35
                    ? size * 0.036
                    : size * 0.03
                : seg.sweep >= 40
                  ? size * 0.06
                  : size * 0.05;

              return (
                <span
                  key={`lbl-${seg.id}`}
                  className="pointer-events-none absolute z-[2] font-extrabold"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(${seg.mid}deg)`,
                    fontSize,
                    lineHeight: 1.05,
                    width: showPrizeNames
                      ? Math.max(size * 0.18, 72)
                      : size * 0.14,
                    maxWidth: showPrizeNames ? size * 0.24 : size * 0.16,
                    textAlign: "center",
                    textShadow: "0 1px 2px rgba(0,0,0,.75), 0 0 8px rgba(0,0,0,.35)",
                    letterSpacing: showPrizeNames ? "-0.02em" : "0.04em",
                    wordBreak: "break-word",
                    fontWeight: 800,
                    color: "#ffffff",
                    WebkitTextStroke: "0.35px rgba(0,0,0,.25)",
                  }}
                >
                  {seg.label}
                </span>
              );
            })}
          </div>

          {/* Sabit seçim çizgisi — okun tam altında, dönmez */}
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2"
            style={{
              width: 3,
              height: "22%",
              borderRadius: 2,
              background:
                "linear-gradient(180deg, #FFF3C4 0%, #FFC107 42%, rgba(255,193,7,0) 100%)",
              boxShadow: "0 0 12px rgba(255,200,60,.85)",
            }}
            aria-hidden
          />
        </div>

        {Array.from({ length: bulbN }).map((_, i) => {
          const a = (i / bulbN) * Math.PI * 2 - Math.PI / 2;
          const rr = 50 - ((rim * 0.42) / size) * 100;
          const x = 50 + rr * Math.cos(a);
          const y = 50 + rr * Math.sin(a);
          const colors = [
            "#7CFF3A",
            "#FF4D6D",
            "#4DB7FF",
            "#FF8AD8",
            "#FFE566",
          ];
          const c = colors[i % colors.length];
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: size * 0.032,
                height: size * 0.032,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle at 35% 30%, #fff 0%, ${c} 70%)`,
                boxShadow: `0 0 ${size * 0.025}px ${c}`,
                animation: spinning
                  ? `gw-bulb ${0.28 + (i % 3) * 0.08}s ease-in-out ${(i % 6) * 0.05}s infinite`
                  : `gw-bulb-idle ${1.6 + (i % 4) * 0.2}s ease-in-out ${(i % 6) * 0.05}s infinite`,
              }}
            />
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canTap}
        onClick={() => onSpin?.()}
        className="absolute z-30 flex flex-col items-center justify-center rounded-full font-black uppercase disabled:opacity-65"
        style={{
          width: hub,
          height: hub,
          left: (size - hub) / 2,
          top: (size - hub) / 2,
          background:
            "radial-gradient(circle at 35% 28%, #FFFDE7 0%, #FFD54F 38%, #F0A500 72%, #C77D0A 100%)",
          border: "4px solid #FFF6D0",
          color: "#5C3200",
          letterSpacing: "0.04em",
          boxShadow: canTap
            ? "0 0 22px rgba(255,200,60,.6), 0 10px 18px rgba(80,40,0,.35), inset 0 2px 6px rgba(255,255,255,.7)"
            : "0 7px 16px rgba(80,40,0,.3), inset 0 2px 5px rgba(255,255,255,.55)",
        }}
        aria-label="Çarxı fırlat"
      >
        <span style={{ fontSize: size * 0.065, lineHeight: 1 }}>
          {spinning ? "…" : "★"}
        </span>
        <span style={{ marginTop: 1, fontSize: size * 0.038 }}>
          {spinning ? "" : "Çevir"}
        </span>
      </button>

      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: size - 4,
          width: size * 0.46,
          height: size * 0.1,
          background:
            "linear-gradient(180deg, #FFE7A8 0%, #E8A317 52%, #8A5A00 100%)",
          borderRadius: "4px 4px 14px 14px",
          boxShadow:
            "0 8px 18px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.45)",
        }}
      />

      <style>{`
        @keyframes gw-bulb {
          0%, 100% { opacity: 1; filter: brightness(1.35); }
          50% { opacity: 0.45; filter: brightness(0.85); }
        }
        @keyframes gw-bulb-idle {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
