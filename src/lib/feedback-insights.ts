export type FeedbackInsightSeverity = "critical" | "warning" | "info";

export type FeedbackInsight = {
  id: string;
  severity: FeedbackInsightSeverity;
  title: string;
  detail: string;
  action: string;
  score: number;
};

export type FeedbackKpis = {
  total: number;
  suggestions: number;
  complaints: number;
  uniqueDevices: number;
  avgRating: number | null;
  ratedCount: number;
  unratedCount: number;
  resolved: number;
  unresolved: number;
  resolutionRate: number;
  complaintRate: number;
};

export type FeedbackDayBucket = {
  day: string;
  total: number;
  suggestions: number;
  complaints: number;
  resolved: number;
  ratingSum: number;
  ratingCount: number;
};

export type FeedbackRatingBucket = {
  rating: number;
  count: number;
  share: number;
};

export type FeedbackLocationBucket = {
  locationId: string | null;
  locationName: string;
  total: number;
  complaints: number;
  avgRating: number | null;
  unresolved: number;
};

export type FeedbackDeviceBucket = {
  deviceId: string;
  label: string | null;
  total: number;
  complaints: number;
  avgRating: number | null;
};

export type UnresolvedProblem = {
  id: string;
  message: string;
  rating: number | null;
  customerName: string | null;
  customerPhone: string | null;
  locationName: string | null;
  deviceLabel: string | null;
  deviceId: string;
  status: string;
  createdAtLabel: string;
  ageDays: number;
  urgencyScore: number;
};

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function deltaPct(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export function computeFeedbackKpis(rows: {
  type: string;
  rating: number | null;
  status: string;
  deviceId: string;
}[]): FeedbackKpis {
  const total = rows.length;
  const suggestions = rows.filter((r) => r.type === "SUGGESTION").length;
  const complaints = rows.filter((r) => r.type === "COMPLAINT").length;
  const resolved = rows.filter((r) => r.status === "RESOLVED").length;
  const unresolved = total - resolved;
  const uniqueDevices = new Set(rows.map((r) => r.deviceId)).size;
  const rated = rows.filter((r) => r.rating != null);
  const ratingSum = rated.reduce((s, r) => s + (r.rating ?? 0), 0);
  return {
    total,
    suggestions,
    complaints,
    uniqueDevices,
    avgRating: rated.length > 0 ? Math.round((ratingSum / rated.length) * 10) / 10 : null,
    ratedCount: rated.length,
    unratedCount: total - rated.length,
    resolved,
    unresolved,
    resolutionRate: pct(resolved, total),
    complaintRate: pct(complaints, total),
  };
}

export function buildFeedbackInsights(input: {
  kpis: FeedbackKpis;
  prevKpis: FeedbackKpis | null;
  byDay: FeedbackDayBucket[];
  byLocation: FeedbackLocationBucket[];
  byDevice: FeedbackDeviceBucket[];
  unresolvedProblems: UnresolvedProblem[];
}): FeedbackInsight[] {
  const { kpis, prevKpis, byDay, byLocation, byDevice, unresolvedProblems } = input;
  const list: FeedbackInsight[] = [];

  const oldUnresolved = unresolvedProblems.filter((p) => p.ageDays >= 3);
  if (oldUnresolved.length > 0) {
    const oldest = oldUnresolved[0];
    list.push({
      id: "aging-complaints",
      severity: oldUnresolved.some((p) => p.ageDays >= 7) ? "critical" : "warning",
      title: `${oldUnresolved.length} şikayet ${oldUnresolved.some((p) => p.ageDays >= 7) ? "7+" : "3+"} gündür açık`,
      detail: `En eski: "${oldest.message.slice(0, 80)}${oldest.message.length > 80 ? "…" : ""}" (${oldest.ageDays} gün, ${oldest.locationName || "şube yok"}).`,
      action: "Açık şikayetleri gözden geçirin, yanıtlayın ve durumu güncelleyin.",
      score: oldUnresolved.some((p) => p.ageDays >= 7) ? 96 : 82,
    });
  }

  if (kpis.total >= 5 && kpis.complaintRate >= 55) {
    list.push({
      id: "high-complaint-rate",
      severity: kpis.complaintRate >= 75 ? "critical" : "warning",
      title: `Şikayet oranı yüksek (%${kpis.complaintRate})`,
      detail: `${kpis.complaints} şikayet / ${kpis.total} gönderim — önerilerden daha fazla.`,
      action: "En sık tekrar eden şikayet konularını araştırın ve şube personelini bilgilendirin.",
      score: kpis.complaintRate >= 75 ? 90 : 74,
    });
  }

  if (kpis.ratedCount >= 5 && kpis.avgRating != null && kpis.avgRating < 3) {
    list.push({
      id: "low-avg-rating",
      severity: kpis.avgRating < 2.2 ? "critical" : "warning",
      title: `Ortalama puan düşük (${kpis.avgRating.toFixed(1)} / 5)`,
      detail: `Bu dönemde puan verilen ${kpis.ratedCount} gönderimin ortalaması düşük.`,
      action: "Müşteri deneyimini iyileştirecek acil önlemler alın.",
      score: kpis.avgRating < 2.2 ? 92 : 76,
    });
  }

  if (kpis.total >= 5 && kpis.resolutionRate < 40) {
    list.push({
      id: "low-resolution",
      severity: kpis.resolutionRate < 20 ? "critical" : "warning",
      title: `Çözüm oranı düşük (%${kpis.resolutionRate})`,
      detail: `${kpis.resolved} çözüldü / ${kpis.total} gönderim.`,
      action: "Yeni/okundu durumundaki gönderimleri inceleyip sonuçlandırın.",
      score: kpis.resolutionRate < 20 ? 88 : 68,
    });
  }

  const realLocations = byLocation.filter((l) => l.total >= 3);
  if (realLocations.length >= 2) {
    const avgAll =
      realLocations.reduce((s, l) => s + (l.avgRating ?? 0), 0) / realLocations.length;
    const worst = [...realLocations].sort(
      (a, b) => (a.avgRating ?? 5) - (b.avgRating ?? 5),
    )[0];
    if (worst && worst.avgRating != null && worst.avgRating <= avgAll - 0.8) {
      list.push({
        id: `location-underperform-${worst.locationId ?? worst.locationName}`,
        severity: worst.avgRating < 2.5 ? "critical" : "warning",
        title: `${worst.locationName}: diğer şubelerden daha düşük puan (${worst.avgRating.toFixed(1)})`,
        detail: `${worst.complaints} şikayet, ${worst.unresolved} çözülmemiş kayıt.`,
        action: "Bu şubeyi ziyaret edin, personelle görüşün ve kök nedeni araştırın.",
        score: worst.avgRating < 2.5 ? 84 : 66,
      });
    }
  }

  const activeDevices = byDevice.filter((d) => d.total >= 3);
  const flagged = [...activeDevices].sort((a, b) => b.complaints - a.complaints)[0];
  if (flagged && flagged.complaints >= 3 && flagged.complaints === flagged.total) {
    list.push({
      id: `device-repeat-${flagged.deviceId}`,
      severity: "info",
      title: `${flagged.label || `Cihaz ${flagged.deviceId.slice(0, 8)}…`}: sürekli şikayet gönderiyor`,
      detail: `${flagged.complaints} gönderimin tamamı şikayet.`,
      action: "Bu cihazın gönderimlerini tek tek inceleyin — sürekli bir problem ya da yerel bir durumla ilgili olabilir.",
      score: 58,
    });
  }

  if (prevKpis && prevKpis.total >= 5) {
    const d = deltaPct(kpis.total, prevKpis.total);
    if (d != null && Math.abs(d) >= 40) {
      list.push({
        id: "traffic-shift",
        severity: "info",
        title: d > 0 ? `Gönderim sayısı arttı (+%${d})` : `Gönderim sayısı düştü (%${d})`,
        detail: `Önceki dönem ${prevKpis.total} → bu dönem ${kpis.total} gönderim.`,
        action:
          d > 0
            ? "Artan gönderimlere zamanında yanıt vermek için personeli güçlendirin."
            : "QR görünürlüğünü ve şube yerleşimini kontrol edin.",
        score: 50,
      });
    }
    const ratingDelta =
      prevKpis.avgRating != null && kpis.avgRating != null
        ? Math.round((kpis.avgRating - prevKpis.avgRating) * 10) / 10
        : null;
    if (ratingDelta != null && ratingDelta <= -0.5) {
      list.push({
        id: "rating-trend-down",
        severity: ratingDelta <= -1 ? "critical" : "warning",
        title: `Ortalama puan düştü (${ratingDelta})`,
        detail: `Önceki dönem ${prevKpis.avgRating?.toFixed(1)} → bu dönem ${kpis.avgRating?.toFixed(1)}.`,
        action: "Son şikayetleri inceleyip kök nedeni bulun.",
        score: ratingDelta <= -1 ? 89 : 70,
      });
    }
  }

  if (kpis.total === 0) {
    list.push({
      id: "no-data",
      severity: "info",
      title: "Bu dönemde gönderim yok",
      detail: "Seçili tarih aralığında kayıt bulunamadı.",
      action: "Daha geniş tarih aralığı seçin veya QR'ın aktif olduğundan emin olun.",
      score: 20,
    });
  }

  void byDay;
  list.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: FeedbackInsight[] = [];
  for (const i of list) {
    const key = i.id.split("-").slice(0, 2).join("-");
    if (seen.has(key) && i.score < 90) continue;
    seen.add(key);
    out.push(i);
    if (out.length >= 8) break;
  }
  return out;
}

export { pct, deltaPct };
