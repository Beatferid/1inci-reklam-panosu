import { prisma } from "@/lib/prisma";
import { formatIstanbul, formatPhoneDisplay, istanbulDayKey } from "@/lib/wheel";
import { getWheelDisplaySettings } from "@/lib/wheel-display";
import { expireStaleWins } from "@/lib/wheel";
import {
  buildInsights,
  computeKpis,
  deltaPct,
  type AnalyticsKpis,
  type DayBucket,
  type PrizeBucket,
  type SeriesCompare,
  type WheelInsight,
} from "@/lib/wheel-insights";
import { maybeAiSummary } from "@/lib/wheel-ai-summary";

export type AnalyticsRange = "week" | "month" | "custom";

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

function monthKey(day: string) {
  return day.slice(0, 7);
}

function resolveRange(
  range: AnalyticsRange,
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
  // week
  const to = today;
  const from = addDays(to, -6);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -6);
  return { from, to, prevFrom, prevTo };
}

type SpinLite = {
  id: string;
  dayKey: string;
  won: boolean;
  claimedAt: Date | null;
  cancelledAt: string | null;
  prizeId: string;
  phone: string;
  prizeName: string;
  createdAt: Date;
  locationId: string | null;
  locationName: string | null;
};

export type LocationBucket = {
  locationId: string | null;
  locationName: string;
  spins: number;
  wins: number;
  empties: number;
  claimed: number;
  cancelled: number;
  claimRate: number;
};

async function loadSpinsInRange(
  campaignId: string,
  from: string,
  to: string,
): Promise<SpinLite[]> {
  const spins = await prisma.wheelSpin.findMany({
    where: {
      campaignId,
      dayKey: { gte: from, lte: to },
    },
    include: { player: true, prize: true },
    orderBy: { createdAt: "desc" },
  });

  const extras = await prisma.$queryRawUnsafe<
    {
      id: string;
      cancelledAt: string | null;
      locationId: string | null;
      locationName: string | null;
    }[]
  >(
    `SELECT id, cancelledAt, locationId, locationName FROM WheelSpin
     WHERE campaignId = ? AND dayKey >= ? AND dayKey <= ?`,
    campaignId,
    from,
    to,
  );
  const extraById = new Map(extras.map((e) => [e.id, e]));

  return spins.map((s) => {
    const ex = extraById.get(s.id);
    return {
      id: s.id,
      dayKey: s.dayKey,
      won: s.won,
      claimedAt: s.claimedAt,
      cancelledAt: ex?.cancelledAt ?? null,
      prizeId: s.prizeId,
      phone: s.player.phone,
      prizeName: s.prize.name,
      createdAt: s.createdAt,
      locationId: ex?.locationId ?? null,
      locationName: ex?.locationName ?? null,
    };
  });
}

function buildByLocation(spins: SpinLite[]): LocationBucket[] {
  const map = new Map<string, LocationBucket>();
  for (const s of spins) {
    const key = s.locationId || s.locationName || "__none__";
    const name = s.locationName?.trim() || "Konumsuz / bilinmiyor";
    const cur = map.get(key) || {
      locationId: s.locationId,
      locationName: name,
      spins: 0,
      wins: 0,
      empties: 0,
      claimed: 0,
      cancelled: 0,
      claimRate: 0,
    };
    cur.spins++;
    if (s.won) cur.wins++;
    else cur.empties++;
    if (s.cancelledAt) cur.cancelled++;
    else if (s.claimedAt) cur.claimed++;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((b) => ({
      ...b,
      claimRate:
        b.wins > 0 ? Math.round((b.claimed / b.wins) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.spins - a.spins);
}

function toRowFlags(s: SpinLite) {
  const cancelled = Boolean(s.cancelledAt);
  const claimed = Boolean(s.claimedAt) && !cancelled;
  return {
    won: s.won,
    claimed,
    cancelled,
    phone: s.phone,
  };
}

function buildByDay(from: string, to: string, spins: SpinLite[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const d of daysInclusive(from, to)) {
    map.set(d, {
      day: d,
      spins: 0,
      wins: 0,
      empties: 0,
      claimed: 0,
      cancelled: 0,
    });
  }
  for (const s of spins) {
    const b = map.get(s.dayKey);
    if (!b) continue;
    b.spins++;
    if (s.won) b.wins++;
    else b.empties++;
    if (s.cancelledAt) b.cancelled++;
    else if (s.claimedAt) b.claimed++;
  }
  return [...map.values()];
}

function buildByMonth(byDay: DayBucket[]) {
  const map = new Map<
    string,
    {
      month: string;
      spins: number;
      wins: number;
      empties: number;
      claimed: number;
      cancelled: number;
    }
  >();
  for (const d of byDay) {
    const m = monthKey(d.day);
    const cur = map.get(m) || {
      month: m,
      spins: 0,
      wins: 0,
      empties: 0,
      claimed: 0,
      cancelled: 0,
    };
    cur.spins += d.spins;
    cur.wins += d.wins;
    cur.empties += d.empties;
    cur.claimed += d.claimed;
    cur.cancelled += d.cancelled;
    map.set(m, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

async function buildByPrize(
  campaignId: string,
  spins: SpinLite[],
): Promise<PrizeBucket[]> {
  const prizes = await prisma.wheelPrize.findMany({
    where: { campaignId },
    orderBy: { sortOrder: "asc" },
  });

  const reserved = await prisma.$queryRawUnsafe<
    { prizeId: string; c: number }[]
  >(
    `SELECT prizeId, COUNT(*) as c FROM WheelSpin
     WHERE campaignId = ? AND won = 1 AND cancelledAt IS NULL
     GROUP BY prizeId`,
    campaignId,
  );
  const reservedMap = new Map(reserved.map((r) => [r.prizeId, Number(r.c)]));

  const totalWinsInRange = spins.filter((s) => s.won).length || 1;

  return prizes.map((p) => {
    const rows = spins.filter((s) => s.prizeId === p.id);
    const wins = rows.filter((s) => s.won).length;
    const claimed = rows.filter((s) => s.won && s.claimedAt && !s.cancelledAt).length;
    const cancelled = rows.filter((s) => s.won && s.cancelledAt).length;
    const pending = rows.filter(
      (s) => s.won && !s.claimedAt && !s.cancelledAt,
    ).length;
    const reservedCount = reservedMap.get(p.id) ?? 0;
    const remainingTotal =
      p.isEmpty || p.totalLimit == null
        ? null
        : Math.max(0, p.totalLimit - reservedCount);
    const selectable =
      p.active &&
      !p.isEmpty &&
      (p.dailyLimit == null || p.dailyLimit > 0) &&
      (remainingTotal === null || remainingTotal > 0);

    return {
      prizeId: p.id,
      name: p.name,
      isEmpty: p.isEmpty,
      active: p.active,
      wins,
      claimed,
      cancelled,
      pending,
      claimRate: wins > 0 ? Math.round((claimed / wins) * 1000) / 10 : 0,
      share: Math.round((wins / totalWinsInRange) * 1000) / 10,
      totalLimit: p.totalLimit,
      remainingTotal,
      dailyLimit: p.dailyLimit,
      selectable,
    };
  });
}

function compareSeries(
  curr: AnalyticsKpis,
  prev: AnalyticsKpis,
  prevFrom: string,
  prevTo: string,
): SeriesCompare {
  return {
    prevFrom,
    prevTo,
    spinsDeltaPct: deltaPct(curr.spins, prev.spins),
    winsDeltaPct: deltaPct(curr.wins, prev.wins),
    claimRateDelta:
      prev.spins > 0 || curr.spins > 0
        ? Math.round((curr.claimRate - prev.claimRate) * 10) / 10
        : null,
  };
}

export type WheelAnalyticsPayload = {
  range: AnalyticsRange;
  from: string;
  to: string;
  kpis: AnalyticsKpis;
  byDay: DayBucket[];
  byMonth: ReturnType<typeof buildByMonth>;
  byPrize: PrizeBucket[];
  byLocation: LocationBucket[];
  seriesCompare: SeriesCompare;
  insights: WheelInsight[];
  aiSummary: string | null;
  recentSpins: {
    id: string;
    phone: string;
    prizeName: string;
    status: string;
    spunAtLabel: string;
    won: boolean;
    locationName: string | null;
  }[];
};

export async function getWheelAnalytics(
  campaignId: string,
  opts: {
    range: AnalyticsRange;
    from?: string | null;
    to?: string | null;
    locationId?: string | null;
  },
): Promise<WheelAnalyticsPayload> {
  const { from, to, prevFrom, prevTo } = resolveRange(
    opts.range,
    opts.from ?? null,
    opts.to ?? null,
  );

  const display = await getWheelDisplaySettings(campaignId);
  await expireStaleWins(campaignId, display.claimWindowMinutes);

  const [spinsAll, prevSpinsAll] = await Promise.all([
    loadSpinsInRange(campaignId, from, to),
    loadSpinsInRange(campaignId, prevFrom, prevTo),
  ]);

  // apply optional location filter (by locationId)
  const locFilter = opts.locationId ?? null;
  const spins = locFilter
    ? spinsAll.filter((s) => s.locationId === locFilter)
    : spinsAll;
  const prevSpins = locFilter
    ? prevSpinsAll.filter((s) => s.locationId === locFilter)
    : prevSpinsAll;

  const kpis = computeKpis(spins.map(toRowFlags));
  const prevKpis = computeKpis(prevSpins.map(toRowFlags));
  const byDay = buildByDay(from, to, spins);
  const byMonth = buildByMonth(byDay);
  const byPrize = await buildByPrize(campaignId, spins);
  const byLocation = buildByLocation(spins);
  const insights = buildInsights({
    kpis,
    prevKpis,
    byDay,
    byPrize,
    claimWindowMinutes: display.claimWindowMinutes,
  });

  const aiSummary = await maybeAiSummary({
    from,
    to,
    kpis,
    byPrize,
    insights,
  });

  const recentSpins = spins.slice(0, 200).map((s) => {
    const cancelled = Boolean(s.cancelledAt);
    const claimed = Boolean(s.claimedAt) && !cancelled;
    const status = !s.won
      ? "bos"
      : claimed
        ? "alindi"
        : cancelled
          ? "iptal"
          : "bekliyor";
    return {
      id: s.id,
      phone: formatPhoneDisplay(s.phone),
      prizeName: s.prizeName,
      status,
      spunAtLabel: formatIstanbul(s.createdAt),
      won: s.won,
      locationName: s.locationName,
    };
  });

  return {
    range: opts.range,
    from,
    to,
    kpis,
    byDay,
    byMonth,
    byPrize,
    byLocation,
    seriesCompare: compareSeries(kpis, prevKpis, prevFrom, prevTo),
    insights,
    aiSummary,
    recentSpins,
  };
}

export function analyticsToCsv(data: WheelAnalyticsPayload): string {
  const dayHeader = "gun,cevirme,kazanc,bos,teslim,iptal\n";
  const dayBody = data.byDay
    .map(
      (d) =>
        `${d.day},${d.spins},${d.wins},${d.empties},${d.claimed},${d.cancelled}`,
    )
    .join("\n");
  const locHeader =
    "\n\nfilial,cevirme,kazanc,bos,teslim,iptal,teslim_orani\n";
  const locBody = data.byLocation
    .map(
      (l) =>
        `"${l.locationName.replace(/"/g, '""')}",${l.spins},${l.wins},${l.empties},${l.claimed},${l.cancelled},${l.claimRate}`,
    )
    .join("\n");
  const prizeHeader =
    "\n\nhediye,bos_mu,kazanc,teslim,iptal,bekleyen,teslim_orani,pay\n";
  const prizeBody = data.byPrize
    .map(
      (p) =>
        `"${p.name.replace(/"/g, '""')}",${p.isEmpty ? "evet" : "hayir"},${p.wins},${p.claimed},${p.cancelled},${p.pending},${p.claimRate},${p.share}`,
    )
    .join("\n");
  const detailHeader =
    "\n\ntelefon,hediye,durum,cevirme_saati,filial,kazandi\n";
  const detailBody = data.recentSpins
    .map(
      (s) =>
        `${s.phone},"${s.prizeName.replace(/"/g, '""')}",${s.status},${s.spunAtLabel},"${(s.locationName || "").replace(/"/g, '""')}",${s.won ? "evet" : "hayir"}`,
    )
    .join("\n");
  return (
    dayHeader +
    dayBody +
    locHeader +
    locBody +
    prizeHeader +
    prizeBody +
    detailHeader +
    detailBody
  );
}
