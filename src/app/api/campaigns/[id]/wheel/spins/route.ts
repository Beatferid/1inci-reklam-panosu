import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensurePrizePeriodQuotaColumns,
  expireStaleWins,
  fetchPrizePeriodLimits,
  formatIstanbul,
  formatPhoneDisplay,
  istanbulDayKey,
  istanbulMonthBounds,
  istanbulWeekBounds,
} from "@/lib/wheel";
import { getWheelDisplaySettings } from "@/lib/wheel-display";
import { publicMediaUrl } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const day = req.nextUrl.searchParams.get("day") || istanbulDayKey();
  const locationId = req.nextUrl.searchParams.get("locationId");
  const format = req.nextUrl.searchParams.get("format");
  const filter = req.nextUrl.searchParams.get("filter"); // pending | all

  await ensurePrizePeriodQuotaColumns();
  const display = await getWheelDisplaySettings(id);
  await expireStaleWins(id, display.claimWindowMinutes);
  const week = istanbulWeekBounds();
  const month = istanbulMonthBounds();

  const spins = await prisma.wheelSpin.findMany({
    where: {
      campaignId: id,
      dayKey: day,
      ...(filter === "pending"
        ? { won: true, claimedAt: null }
        : {}),
      ...(locationId ? { locationId } : {}),
    },
    include: {
      player: true,
      prize: true,
    },
    orderBy: { createdAt: "desc" },
    take: format === "csv" ? 10000 : 500,
  });

  const prizes = await prisma.wheelPrize.findMany({
    where: { campaignId: id },
    orderBy: { sortOrder: "asc" },
  });

  const reservedWhere = {
    campaignId: id,
    won: true as const,
    cancelledAt: null,
  };
  const [todayGrouped, weekGrouped, monthGrouped, totalGrouped] =
    await Promise.all([
      prisma.wheelSpin.groupBy({
        by: ["prizeId"],
        where: { ...reservedWhere, dayKey: day },
        _count: { _all: true },
      }),
      prisma.wheelSpin.groupBy({
        by: ["prizeId"],
        where: {
          ...reservedWhere,
          dayKey: { gte: week.from, lte: week.to },
        },
        _count: { _all: true },
      }),
      prisma.wheelSpin.groupBy({
        by: ["prizeId"],
        where: {
          ...reservedWhere,
          dayKey: { gte: month.from, lte: month.to },
        },
        _count: { _all: true },
      }),
      prisma.wheelSpin.groupBy({
        by: ["prizeId"],
        where: reservedWhere,
        _count: { _all: true },
      }),
    ]);
  const todayByPrize = new Map(
    todayGrouped.map((g) => [g.prizeId, g._count._all]),
  );
  const weekByPrize = new Map(
    weekGrouped.map((g) => [g.prizeId, g._count._all]),
  );
  const monthByPrize = new Map(
    monthGrouped.map((g) => [g.prizeId, g._count._all]),
  );
  const totalByPrize = new Map(
    totalGrouped.map((g) => [g.prizeId, g._count._all]),
  );

  const prizeLimits = await Promise.all(
    prizes.map(async (p) => ({
      id: p.id,
      limits: await fetchPrizePeriodLimits(prisma, p.id),
    })),
  );
  const limitsByPrize = new Map(prizeLimits.map((x) => [x.id, x.limits]));

  const stock = prizes.map((p) => {
    const lim = limitsByPrize.get(p.id);
    const weeklyLimit = lim?.weeklyLimit ?? null;
    const monthlyLimit = lim?.monthlyLimit ?? null;
    const dailyLimit = lim?.dailyLimit ?? p.dailyLimit;
    const totalLimit = lim?.totalLimit ?? p.totalLimit;
    const todayWins = p.isEmpty ? 0 : (todayByPrize.get(p.id) ?? 0);
    const weekWins = p.isEmpty ? 0 : (weekByPrize.get(p.id) ?? 0);
    const monthWins = p.isEmpty ? 0 : (monthByPrize.get(p.id) ?? 0);
    const totalWins = p.isEmpty ? 0 : (totalByPrize.get(p.id) ?? 0);
    const remainingDaily =
      p.isEmpty || dailyLimit == null
        ? null
        : Math.max(0, dailyLimit - todayWins);
    const remainingWeekly =
      p.isEmpty || weeklyLimit == null
        ? null
        : Math.max(0, weeklyLimit - weekWins);
    const remainingMonthly =
      p.isEmpty || monthlyLimit == null
        ? null
        : Math.max(0, monthlyLimit - monthWins);
    const remainingTotal =
      p.isEmpty || totalLimit == null
        ? null
        : Math.max(0, totalLimit - totalWins);
    const selectable =
      p.active &&
      !p.isEmpty &&
      (remainingDaily === null || remainingDaily > 0) &&
      (remainingWeekly === null || remainingWeekly > 0) &&
      (remainingMonthly === null || remainingMonthly > 0) &&
      (remainingTotal === null || remainingTotal > 0);
    return {
      prizeId: p.id,
      name: p.name,
      isEmpty: p.isEmpty,
      active: p.active,
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      totalLimit,
      todayWins,
      weekWins,
      monthWins,
      totalWins,
      remaining: remainingDaily,
      remainingWeekly,
      remainingMonthly,
      remainingTotal,
      weekFrom: week.from,
      weekTo: week.to,
      monthFrom: month.from,
      monthTo: month.to,
      selectable,
    };
  });

  const now = Date.now();
  const rows = spins
    .map((s) => {
      const deadline = s.claimDeadline
        ? s.claimDeadline.getTime()
        : display.claimWindowMinutes > 0
          ? s.createdAt.getTime() + display.claimWindowMinutes * 60_000
          : null;
      const timedOut =
        s.won &&
        !s.claimedAt &&
        !s.cancelledAt &&
        deadline != null &&
        deadline <= now;
      const cancelled = Boolean(s.cancelledAt) || timedOut;
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
        phone: formatPhoneDisplay(s.player.phone),
        phoneRaw: s.player.phone,
        locationId: s.locationId ?? null,
        locationName: s.locationName ?? null,
        prizeName: s.prize.name,
        prizeImageUrl: publicMediaUrl(s.prize.imagePath),
        won: s.won,
        claimed,
        cancelled,
        status,
        claimedAt: s.claimedAt?.toISOString() ?? null,
        claimedAtLabel: s.claimedAt ? formatIstanbul(s.claimedAt) : null,
        cancelledAt: s.cancelledAt?.toISOString() ?? null,
        cancelledAtLabel: cancelled
          ? "Zamanında alınmadı — iptal"
          : null,
        dayKey: s.dayKey,
        spunAt: s.createdAt.toISOString(),
        spunAtLabel: formatIstanbul(s.createdAt),
      };
    })
    .filter((r) => (filter === "pending" ? r.status === "bekliyor" : true));

  if (format === "csv") {
    const bom = "\uFEFF";
    const header =
      "telefon,hediye,kazandi,cevirme_saati,cevirme_iso,teslim,teslim_saati,filial_id,filial_adi,gun\n";
    const body = rows
      .map((r) => {
        const teslim = r.status;
        const teslimSaati = r.claimedAtLabel || r.cancelledAtLabel || "";
        return `${r.phoneRaw},"${r.prizeName.replace(/"/g, '""')}",${r.won ? "evet" : "hayir"},${r.spunAtLabel},${r.spunAt},${teslim},${teslimSaati},${r.locationId ?? ""},"${(r.locationName || "").replace(/"/g, '""')}",${r.dayKey}`;
      })
      .join("\n");
    return new NextResponse(bom + header + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wheel-${day}.csv"`,
      },
    });
  }

  return NextResponse.json({ day, spins: rows, stock });
}
