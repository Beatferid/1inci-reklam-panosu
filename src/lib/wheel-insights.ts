export type InsightSeverity = "critical" | "warning" | "info";

export type WheelInsight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  action: string;
  score: number;
};

export type AnalyticsKpis = {
  spins: number;
  wins: number;
  empties: number;
  claimed: number;
  cancelled: number;
  uniquePhones: number;
  claimRate: number;
  cancelRate: number;
  emptyRate: number;
  winRate: number;
};

export type DayBucket = {
  day: string;
  spins: number;
  wins: number;
  empties: number;
  claimed: number;
  cancelled: number;
};

export type PrizeBucket = {
  prizeId: string;
  name: string;
  isEmpty: boolean;
  active: boolean;
  wins: number;
  claimed: number;
  cancelled: number;
  pending: number;
  claimRate: number;
  share: number;
  totalLimit: number | null;
  remainingTotal: number | null;
  dailyLimit: number | null;
  selectable: boolean;
};

export type SeriesCompare = {
  prevFrom: string;
  prevTo: string;
  spinsDeltaPct: number | null;
  winsDeltaPct: number | null;
  claimRateDelta: number | null;
};

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function deltaPct(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export function buildInsights(input: {
  kpis: AnalyticsKpis;
  prevKpis: AnalyticsKpis | null;
  byDay: DayBucket[];
  byPrize: PrizeBucket[];
  claimWindowMinutes: number;
}): WheelInsight[] {
  const { kpis, prevKpis, byDay, byPrize, claimWindowMinutes } = input;
  const list: WheelInsight[] = [];

  const realPrizes = byPrize.filter((p) => !p.isEmpty);

  for (const p of realPrizes) {
    if (p.dailyLimit === 0 || p.selectable === false) {
      list.push({
        id: `inactive-${p.prizeId}`,
        severity: "warning",
        title: `${p.name}: çarkta seçilmiyor`,
        detail:
          p.dailyLimit === 0
            ? "Günlük kota 0 — dilim havuzda yok."
            : "Stok veya kota nedeniyle dilim seçilemez durumda.",
        action: "Günlük/toplam kotayı açın veya dilimi pasifleştirin.",
        score: 80,
      });
    }

    if (
      p.totalLimit != null &&
      p.remainingTotal != null &&
      p.totalLimit > 0 &&
      p.remainingTotal / p.totalLimit <= 0.2
    ) {
      list.push({
        id: `low-stock-${p.prizeId}`,
        severity: p.remainingTotal === 0 ? "critical" : "warning",
        title: `${p.name}: stok kritik (%${Math.round((p.remainingTotal / p.totalLimit) * 100)} kalan)`,
        detail: `Toplam kota ${p.totalLimit}, kalan ${p.remainingTotal}, dönem kazancı ${p.wins}.`,
        action:
          p.remainingTotal === 0
            ? "Toplam kotayı artırın veya dilimi kapatın."
            : "Toplam kotayı yükseltin; aksi halde yakında boş tur artar.",
        score: p.remainingTotal === 0 ? 95 : 75,
      });
    }

    if (p.wins >= 3 && p.remainingTotal != null && p.remainingTotal > 0) {
      const last3 = byDay.slice(-3);
      const wins3 = last3.reduce((s, d) => s + d.wins, 0);
      const avg = wins3 / Math.max(1, last3.length);
      if (avg > 0) {
        const daysLeft = Math.ceil(p.remainingTotal / avg);
        if (daysLeft <= 5) {
          list.push({
            id: `burn-${p.prizeId}`,
            severity: daysLeft <= 2 ? "critical" : "warning",
            title: `${p.name}: ~${daysLeft} gün içinde bitebilir`,
            detail: `Son günlere göre ortalama ~${avg.toFixed(1)} kazanç/gün.`,
            action: "Kotayı şimdiden artırın veya ağırlığı düşürün.",
            score: daysLeft <= 2 ? 90 : 70,
          });
        }
      }
    }
  }

  if (kpis.wins >= 5 && kpis.cancelRate >= 25) {
    list.push({
      id: "high-cancel",
      severity: kpis.cancelRate >= 40 ? "critical" : "warning",
      title: `İptal oranı yüksek (%${kpis.cancelRate})`,
      detail: `${kpis.cancelled} hediye süre içinde alınmadı / iptal oldu.`,
      action:
        claimWindowMinutes > 0
          ? `Alma süresini (${claimWindowMinutes} dk) uzatın veya kasa teslimini hızlandırın.`
          : "Teslim sürecini sadeleştirin; süre ayarı ekleyin.",
      score: 85,
    });
  }

  if (kpis.wins >= 5 && kpis.claimRate > 0 && kpis.claimRate < 50) {
    list.push({
      id: "low-claim",
      severity: "warning",
      title: `Teslim oranı düşük (%${kpis.claimRate})`,
      detail: `${kpis.claimed} alındı / ${kpis.wins} kazanç.`,
      action: "Sağdaki geri sayımı vurgulayın; kasa bilgilendirmesini güçlendirin.",
      score: 72,
    });
  }

  if (kpis.spins >= 10 && kpis.emptyRate >= 40) {
    list.push({
      id: "high-empty",
      severity: "warning",
      title: `Boş tur oranı yüksek (%${kpis.emptyRate})`,
      detail: `${kpis.empties} boş / ${kpis.spins} çevirme — stok veya ağırlık dengesiz olabilir.`,
      action: "Hediye stoklarını ve şans ağırlıklarını gözden geçirin.",
      score: 68,
    });
  }

  if (prevKpis && prevKpis.spins >= 5) {
    const d = deltaPct(kpis.spins, prevKpis.spins);
    if (d != null && Math.abs(d) >= 40) {
      list.push({
        id: "traffic-shift",
        severity: "info",
        title:
          d > 0
            ? `Çevirme trafiği arttı (+%${d})`
            : `Çevirme trafiği düştü (%${d})`,
        detail: `Önceki dönem ${prevKpis.spins} → bu dönem ${kpis.spins} çevirme.`,
        action:
          d > 0
            ? "Stok ve günlük kotaları artışa göre ayarlayın."
            : "Kampanya görünürlüğünü / QR yerleşimini kontrol edin.",
        score: 55,
      });
    }
  }

  if (kpis.spins === 0) {
    list.push({
      id: "no-data",
      severity: "info",
      title: "Bu dönemde çevirme yok",
      detail: "Seçili tarih aralığında kayıt bulunamadı.",
      action: "Daha geniş aralık seçin veya kampanyanın yayınlandığından emin olun.",
      score: 20,
    });
  }

  list.sort((a, b) => b.score - a.score);
  // Aynı hediye için çok benzer önerileri sınırla
  const seen = new Set<string>();
  const out: WheelInsight[] = [];
  for (const i of list) {
    const key = i.id.split("-").slice(0, 2).join("-");
    if (seen.has(key) && i.score < 90) continue;
    seen.add(key);
    out.push(i);
    if (out.length >= 8) break;
  }
  return out;
}

export function computeKpis(rows: {
  won: boolean;
  claimed: boolean;
  cancelled: boolean;
  phone: string;
}[]): AnalyticsKpis {
  const spins = rows.length;
  const wonAny = rows.filter((r) => r.won).length;
  const empties = rows.filter((r) => !r.won).length;
  const claimed = rows.filter((r) => r.claimed).length;
  const cancelled = rows.filter((r) => r.cancelled).length;
  const uniquePhones = new Set(rows.map((r) => r.phone)).size;
  return {
    spins,
    wins: wonAny,
    empties,
    claimed,
    cancelled,
    uniquePhones,
    claimRate: pct(claimed, wonAny),
    cancelRate: pct(cancelled, wonAny),
    emptyRate: pct(empties, spins),
    winRate: pct(wonAny, spins),
  };
}

export { pct, deltaPct };
