import { prisma } from "@/lib/prisma";
import { formatIstanbul, istanbulDayKey } from "@/lib/day-key";
import {
  buildFeedbackInsights,
  computeFeedbackKpis,
  deltaPct,
  type FeedbackDayBucket,
  type FeedbackDeviceBucket,
  type FeedbackInsight,
  type FeedbackKpis,
  type FeedbackLocationBucket,
  type FeedbackRatingBucket,
  type UnresolvedProblem,
} from "@/lib/feedback-insights";
import { maybeFeedbackAiSummary } from "@/lib/feedback-ai-summary";

export type FeedbackAnalyticsRange = "day" | "week" | "month" | "custom";

function parseDay(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00+03:00`);
  d.setDate(d.getDate() + n);
  return istanbulDayKey(d);
}

function daysInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

function resolveRange(
  range: FeedbackAnalyticsRange,
  fromRaw: string | null,
  toRaw: string | null,
): { from: string; to: string; prevFrom: string; prevTo: string } {
  const today = istanbulDayKey();
  if (range === "custom") {
    const from = parseDay(fromRaw) || addDays(today, -6);
    const to = parseDay(toRaw) || today;
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    const len = daysInclusive(a, b).length;
    const prevTo = addDays(a, -1);
    const prevFrom = addDays(prevTo, -(len - 1));
    return { from: a, to: b, prevFrom, prevTo };
  }
  if (range === "month") {
    const from = `${today.slice(0, 7)}-01`;
    const to = today;
    const prevMonthEnd = addDays(from, -1);
    const prevFrom = `${prevMonthEnd.slice(0, 7)}-01`;
    return { from, to, prevFrom, prevTo: prevMonthEnd };
  }
  if (range === "day") {
    return { from: today, to: today, prevFrom: addDays(today, -1), prevTo: addDays(today, -1) };
  }
  // week
  const to = today;
  const from = addDays(to, -6);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -6);
  return { from, to, prevFrom, prevTo };
}

type EntryLite = {
  id: string;
  type: string;
  rating: number | null;
  message: string;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  locationId: string | null;
  locationName: string | null;
  deviceId: string;
  dayKey: string;
  createdAt: Date;
};

async function loadEntriesInRange(
  feedbackBoxId: string,
  from: string,
  to: string,
): Promise<EntryLite[]> {
  const rows = await prisma.feedbackEntry.findMany({
    where: { feedbackBoxId, dayKey: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    rating: r.rating,
    message: r.message,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    status: r.status,
    locationId: r.locationId,
    locationName: r.locationName,
    deviceId: r.deviceId,
    dayKey: r.dayKey,
    createdAt: r.createdAt,
  }));
}

function buildByDay(from: string, to: string, entries: EntryLite[]): FeedbackDayBucket[] {
  const map = new Map<string, FeedbackDayBucket>();
  for (const d of daysInclusive(from, to)) {
    map.set(d, { day: d, total: 0, suggestions: 0, complaints: 0, resolved: 0, ratingSum: 0, ratingCount: 0 });
  }
  for (const e of entries) {
    const b = map.get(e.dayKey);
    if (!b) continue;
    b.total++;
    if (e.type === "SUGGESTION") b.suggestions++;
    else b.complaints++;
    if (e.status === "RESOLVED") b.resolved++;
    if (e.rating != null) {
      b.ratingSum += e.rating;
      b.ratingCount++;
    }
  }
  return [...map.values()];
}

function buildByRating(entries: EntryLite[]): FeedbackRatingBucket[] {
  const rated = entries.filter((e) => e.rating != null);
  const total = rated.length || 1;
  const out: FeedbackRatingBucket[] = [];
  for (let r = 1; r <= 5; r++) {
    const count = rated.filter((e) => e.rating === r).length;
    out.push({ rating: r, count, share: Math.round((count / total) * 1000) / 10 });
  }
  return out;
}

function buildByLocation(entries: EntryLite[]): FeedbackLocationBucket[] {
  const map = new Map<string, FeedbackLocationBucket & { ratingSum: number; ratingCount: number }>();
  for (const e of entries) {
    const key = e.locationId || e.locationName || "__none__";
    const name = e.locationName?.trim() || "Şubesiz / bilinmiyor";
    const cur =
      map.get(key) ||
      ({
        locationId: e.locationId,
        locationName: name,
        total: 0,
        complaints: 0,
        avgRating: null,
        unresolved: 0,
        ratingSum: 0,
        ratingCount: 0,
      } as FeedbackLocationBucket & { ratingSum: number; ratingCount: number });
    cur.total++;
    if (e.type === "COMPLAINT") cur.complaints++;
    if (e.status !== "RESOLVED") cur.unresolved++;
    if (e.rating != null) {
      cur.ratingSum += e.rating;
      cur.ratingCount++;
    }
    map.set(key, cur);
  }
  return [...map.values()]
    .map((b) => ({
      locationId: b.locationId,
      locationName: b.locationName,
      total: b.total,
      complaints: b.complaints,
      unresolved: b.unresolved,
      avgRating: b.ratingCount > 0 ? Math.round((b.ratingSum / b.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.total - a.total);
}

function buildByDevice(
  entries: EntryLite[],
  labelByDevice: Map<string, string | null>,
): FeedbackDeviceBucket[] {
  const map = new Map<string, FeedbackDeviceBucket & { ratingSum: number; ratingCount: number }>();
  for (const e of entries) {
    const cur =
      map.get(e.deviceId) ||
      ({
        deviceId: e.deviceId,
        label: labelByDevice.get(e.deviceId) ?? null,
        total: 0,
        complaints: 0,
        avgRating: null,
        ratingSum: 0,
        ratingCount: 0,
      } as FeedbackDeviceBucket & { ratingSum: number; ratingCount: number });
    cur.total++;
    if (e.type === "COMPLAINT") cur.complaints++;
    if (e.rating != null) {
      cur.ratingSum += e.rating;
      cur.ratingCount++;
    }
    map.set(e.deviceId, cur);
  }
  return [...map.values()]
    .map((b) => ({
      deviceId: b.deviceId,
      label: b.label,
      total: b.total,
      complaints: b.complaints,
      avgRating: b.ratingCount > 0 ? Math.round((b.ratingSum / b.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.total - a.total);
}

function buildUnresolvedProblems(
  entries: EntryLite[],
  labelByDevice: Map<string, string | null>,
): UnresolvedProblem[] {
  const now = Date.now();
  const open = entries.filter((e) => e.type === "COMPLAINT" && e.status !== "RESOLVED");
  return open
    .map((e) => {
      const ageDays = Math.max(0, Math.floor((now - e.createdAt.getTime()) / 86_400_000));
      const ratingPenalty = e.rating != null ? (6 - e.rating) * 8 : 16;
      const urgencyScore = ageDays * 10 + ratingPenalty + (e.status === "NEW" ? 15 : 0);
      return {
        id: e.id,
        message: e.message,
        rating: e.rating,
        customerName: e.customerName,
        customerPhone: e.customerPhone,
        locationName: e.locationName,
        deviceLabel: labelByDevice.get(e.deviceId) ?? null,
        deviceId: e.deviceId,
        status: e.status,
        createdAtLabel: formatIstanbul(e.createdAt),
        ageDays,
        urgencyScore,
      };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 50);
}

function compareSeries(curr: FeedbackKpis, prev: FeedbackKpis) {
  return {
    totalDeltaPct: deltaPct(curr.total, prev.total),
    complaintRateDelta:
      prev.total > 0 || curr.total > 0
        ? Math.round((curr.complaintRate - prev.complaintRate) * 10) / 10
        : null,
    avgRatingDelta:
      curr.avgRating != null && prev.avgRating != null
        ? Math.round((curr.avgRating - prev.avgRating) * 10) / 10
        : null,
    resolutionRateDelta:
      prev.total > 0 || curr.total > 0
        ? Math.round((curr.resolutionRate - prev.resolutionRate) * 10) / 10
        : null,
  };
}

export type FeedbackAnalyticsPayload = {
  range: FeedbackAnalyticsRange;
  from: string;
  to: string;
  kpis: FeedbackKpis;
  byDay: FeedbackDayBucket[];
  byRating: FeedbackRatingBucket[];
  byLocation: FeedbackLocationBucket[];
  byDevice: FeedbackDeviceBucket[];
  seriesCompare: ReturnType<typeof compareSeries>;
  insights: FeedbackInsight[];
  aiSummary: string | null;
  unresolvedProblems: UnresolvedProblem[];
};

export async function getFeedbackAnalytics(
  feedbackBoxId: string,
  opts: {
    range: FeedbackAnalyticsRange;
    from?: string | null;
    to?: string | null;
    locationId?: string | null;
    deviceId?: string | null;
    rating?: number | null;
    type?: "SUGGESTION" | "COMPLAINT" | null;
  },
): Promise<FeedbackAnalyticsPayload> {
  const { from, to, prevFrom, prevTo } = resolveRange(
    opts.range,
    opts.from ?? null,
    opts.to ?? null,
  );

  const [entriesAllRaw, prevEntriesAllRaw] = await Promise.all([
    loadEntriesInRange(feedbackBoxId, from, to),
    loadEntriesInRange(feedbackBoxId, prevFrom, prevTo),
  ]);

  function applyFilters(rows: EntryLite[]) {
    return rows.filter((e) => {
      if (opts.locationId && e.locationId !== opts.locationId) return false;
      if (opts.deviceId && e.deviceId !== opts.deviceId) return false;
      if (opts.rating && e.rating !== opts.rating) return false;
      if (opts.type && e.type !== opts.type) return false;
      return true;
    });
  }
  const entries = applyFilters(entriesAllRaw);
  const prevEntries = applyFilters(prevEntriesAllRaw);

  const deviceIds = Array.from(new Set(entriesAllRaw.map((e) => e.deviceId)));
  const devices = deviceIds.length
    ? await prisma.feedbackDevice.findMany({
        where: { feedbackBoxId, deviceId: { in: deviceIds } },
      })
    : [];
  const labelByDevice = new Map(devices.map((d) => [d.deviceId, d.label]));

  const kpis = computeFeedbackKpis(entries);
  const prevKpis = computeFeedbackKpis(prevEntries);
  const byDay = buildByDay(from, to, entries);
  const byRating = buildByRating(entries);
  const byLocation = buildByLocation(entries);
  const byDevice = buildByDevice(entries, labelByDevice);
  const unresolvedProblems = buildUnresolvedProblems(entries, labelByDevice);

  const insights = buildFeedbackInsights({
    kpis,
    prevKpis,
    byDay,
    byLocation,
    byDevice,
    unresolvedProblems,
  });

  const aiSummary = await maybeFeedbackAiSummary({
    from,
    to,
    kpis,
    byLocation,
    insights,
  });

  return {
    range: opts.range,
    from,
    to,
    kpis,
    byDay,
    byRating,
    byLocation,
    byDevice,
    seriesCompare: compareSeries(kpis, prevKpis),
    insights,
    aiSummary,
    unresolvedProblems,
  };
}

export function feedbackAnalyticsToCsv(data: FeedbackAnalyticsPayload): string {
  const dayHeader = "gun,toplam,oneri,sikayet,cozulen\n";
  const dayBody = data.byDay
    .map((d) => `${d.day},${d.total},${d.suggestions},${d.complaints},${d.resolved}`)
    .join("\n");
  const ratingHeader = "\n\npuan,adet,pay\n";
  const ratingBody = data.byRating
    .map((r) => `${r.rating},${r.count},${r.share}`)
    .join("\n");
  const locHeader = "\n\nsube,toplam,sikayet,ortalama_puan,cozulmemis\n";
  const locBody = data.byLocation
    .map(
      (l) =>
        `"${l.locationName.replace(/"/g, '""')}",${l.total},${l.complaints},${l.avgRating ?? ""},${l.unresolved}`,
    )
    .join("\n");
  const problemHeader = "\n\nid,mesaj,puan,musteri_adi,musteri_telefon,sube,cihaz,durum,tarih,gun_acik\n";
  const problemBody = data.unresolvedProblems
    .map(
      (p) =>
        `${p.id},"${p.message.replace(/"/g, '""')}",${p.rating ?? ""},"${(p.customerName || "Anonim").replace(/"/g, '""')}","${(p.customerPhone || "").replace(/"/g, '""')}","${(p.locationName || "").replace(/"/g, '""')}","${(p.deviceLabel || p.deviceId).replace(/"/g, '""')}",${p.status},${p.createdAtLabel},${p.ageDays}`,
    )
    .join("\n");
  return dayHeader + dayBody + ratingHeader + ratingBody + locHeader + locBody + problemHeader + problemBody;
}
