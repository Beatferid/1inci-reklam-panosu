/** Şans ağırlığı önerileri — oranlar birbirine göre hesaplanır */

export type ChancePreset = {
  id: string;
  label: string;
  weight: number;
  hint: string;
  /** Öneri boş dilim için mi */
  forEmpty?: boolean;
};

export const CHANCE_PRESETS: ChancePreset[] = [
  {
    id: "empty",
    label: "Boş / sık",
    weight: 40,
    hint: "Kaybet / tekrar dene — çarkın büyük kısmı",
    forEmpty: true,
  },
  {
    id: "common",
    label: "Sık",
    weight: 25,
    hint: "Küçük hediye veya teşvik ürünü",
  },
  {
    id: "normal",
    label: "Normal",
    weight: 12,
    hint: "Orta değerli hediye",
  },
  {
    id: "rare",
    label: "Nadir",
    weight: 5,
    hint: "Değerli hediye — daha az çıkar",
  },
  {
    id: "jackpot",
    label: "Jackpot",
    weight: 1,
    hint: "Büyük ödül — çok nadir",
  },
];

export const SLICE_COLORS = [
  "#E63946",
  "#2A9D8F",
  "#E9C46A",
  "#457B9D",
  "#F4A261",
  "#9B5DE5",
  "#00BBF9",
  "#F15BB5",
  "#00F5D4",
  "#FEE440",
];

export function pickNextSliceColor(used: string[]): string {
  const lower = new Set(used.map((c) => c.toLowerCase()));
  const free = SLICE_COLORS.find((c) => !lower.has(c.toLowerCase()));
  return free || SLICE_COLORS[used.length % SLICE_COLORS.length]!;
}

export function chancePercent(weight: number, totalWeight: number): number {
  if (totalWeight <= 0 || weight <= 0) return 0;
  return (weight / totalWeight) * 100;
}

export type PrizeHintInput = {
  name: string;
  weight: number;
  isEmpty: boolean;
  active: boolean;
  dailyLimit: number | null;
  weeklyLimit?: number | null;
  monthlyLimit?: number | null;
  totalLimit: number | null;
};

/** Yerel “AI destekli” mantık önerileri — API gerekmez */
export function buildSliceCoachTips(
  prizes: PrizeHintInput[],
  draft?: { weight: number; isEmpty: boolean; name: string },
): string[] {
  const tips: string[] = [];
  const active = prizes.filter((p) => p.active);
  const empties = active.filter((p) => p.isEmpty);
  const reals = active.filter((p) => !p.isEmpty);
  const totalW = active.reduce((s, p) => s + Math.max(0, p.weight), 0);

  if (active.length === 0) {
    tips.push(
      "İlk dilimi ekleyin. Dengeli çark için 1 boş + 2–4 hediye önerilir.",
    );
  }
  if (active.length > 0 && empties.length === 0) {
    tips.push(
      "Boş dilim yok: her çevirmede biri kazanır. Bütçe için «Boş / Tekrar dene» ekleyin.",
    );
  }
  if (reals.length === 1 && empties.length === 0) {
    tips.push("Tek hediye varsa şans %100 olur — boş dilim veya ikinci ödül ekleyin.");
  }
  if (totalW > 0) {
    for (const p of reals) {
      const pct = chancePercent(p.weight, totalW);
      if (pct >= 55) {
        tips.push(
          `«${p.name}» yaklaşık %${pct.toFixed(0)} — çok sık çıkar. Nadir yapmak için ağırlığı düşürün.`,
        );
      }
      if (pct > 0 && pct < 2 && p.weight > 0) {
        tips.push(
          `«${p.name}» ~%${pct.toFixed(1)} — neredeyse hiç çıkmaz. Jackpot için uygun; yoksa ağırlığı artırın.`,
        );
      }
    }
  }
  if (
    reals.some(
      (p) =>
        p.dailyLimit == null &&
        p.weeklyLimit == null &&
        p.monthlyLimit == null &&
        p.totalLimit == null,
    )
  ) {
    tips.push(
      "Kotasız hediye sınırsız dağıtılır. Stok varsa günlük / haftalık / aylık veya toplam kota girin.",
    );
  }
  if (draft) {
    const simTotal = totalW + Math.max(0, draft.weight);
    const pct = chancePercent(draft.weight, simTotal || draft.weight);
    if (draft.isEmpty) {
      tips.push(
        `Bu boş dilim eklenince yaklaşık %${pct.toFixed(0)} oranında «kaybet» çıkar.`,
      );
    } else if (draft.name.trim()) {
      tips.push(
        `«${draft.name.trim()}» eklenince tahmini şans ~%${pct.toFixed(0)} (mevcut dilimlere göre).`,
      );
    }
  }
  if (tips.length === 0) {
    tips.push(
      "Dengeli görünüm: boş dilim ağırlığı yüksek, jackpot düşük tutun. «Dilimleri eşit göster» sadece görünümdür; şans ağırlığa bağlıdır.",
    );
  }
  return tips.slice(0, 4);
}
