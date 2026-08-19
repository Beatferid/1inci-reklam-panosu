"use client";

import { useMemo } from "react";

export type CatalogEffectTheme =
  | "NONE"
  | "NEW_YEAR"
  | "EID"
  | "RAMADAN"
  | "SNOW"
  | "SPRING";

type Particle = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
  symbol: string;
  depth: number;
};

type ThemeConfig = {
  count: number;
  symbols: string[];
  sizeRange: [number, number];
  durationRange: [number, number];
  opacityRange: [number, number];
  driftRange: [number, number];
  filter?: string;
};

const THEME_CONFIG: Record<Exclude<CatalogEffectTheme, "NONE">, ThemeConfig> = {
  NEW_YEAR: {
    count: 28,
    symbols: ["❄", "❄", "❄", "✨", "⭐", "🎆"],
    sizeRange: [10, 22],
    durationRange: [9, 17],
    opacityRange: [0.5, 0.95],
    driftRange: [-40, 40],
  },
  EID: {
    count: 15,
    symbols: ["✨", "🌙", "✨", "⭐"],
    sizeRange: [10, 19],
    durationRange: [12, 20],
    opacityRange: [0.4, 0.88],
    driftRange: [-25, 25],
    filter: "hue-rotate(10deg) saturate(1.4)",
  },
  RAMADAN: {
    count: 12,
    symbols: ["🏮", "🌙", "✨", "⭐"],
    sizeRange: [12, 22],
    durationRange: [13, 22],
    opacityRange: [0.45, 0.9],
    driftRange: [-20, 20],
  },
  SNOW: {
    count: 22,
    symbols: ["❄", "❅", "❆"],
    sizeRange: [8, 19],
    durationRange: [10, 19],
    opacityRange: [0.45, 0.85],
    driftRange: [-30, 30],
  },
  SPRING: {
    count: 20,
    symbols: ["🌸", "🌸", "🍃", "🌸", "🍃", "🦋"],
    sizeRange: [12, 21],
    durationRange: [8, 16],
    opacityRange: [0.6, 0.95],
    driftRange: [-50, 50],
  },
};

function randomBetween([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

function buildParticles(config: ThemeConfig): Particle[] {
  return Array.from({ length: config.count }, (_, i) => {
    const depth = Math.random();
    return {
      id: i,
      left: Math.random() * 100,
      size: randomBetween(config.sizeRange) * (0.6 + depth * 0.7),
      duration: randomBetween(config.durationRange) * (1.4 - depth * 0.5),
      delay: -Math.random() * randomBetween(config.durationRange),
      drift: randomBetween(config.driftRange),
      opacity: randomBetween(config.opacityRange) * (0.5 + depth * 0.6),
      symbol: config.symbols[Math.floor(Math.random() * config.symbols.length)],
      depth,
    };
  });
}

/** Mövsümi/bayram temaları — yalnız üzən hissəciklər (bokeh/ışık yox). */
export default function CatalogEffects({ theme }: { theme: CatalogEffectTheme }) {
  const particles = useMemo(() => {
    if (theme === "NONE") return [];
    return buildParticles(THEME_CONFIG[theme]);
  }, [theme]);

  if (theme === "NONE" || particles.length === 0) return null;

  const config = THEME_CONFIG[theme];

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 select-none will-change-transform"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            opacity: p.opacity,
            filter:
              p.depth < 0.4
                ? `blur(1.5px)${config.filter ? ` ${config.filter}` : ""}`
                : config.filter,
            animation: `catalog-particle-fall ${p.duration}s linear ${p.delay}s infinite`,
            "--particle-drift": `${p.drift}px`,
          } as React.CSSProperties}
        >
          {p.symbol}
        </span>
      ))}
    </div>
  );
}
