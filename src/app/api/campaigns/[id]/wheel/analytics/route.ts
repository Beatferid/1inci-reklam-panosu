import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyticsToCsv,
  getWheelAnalytics,
  type AnalyticsRange,
} from "@/lib/wheel-analytics";

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

  const rangeParam = req.nextUrl.searchParams.get("range") || "week";
  const range = (
    ["week", "month", "custom"].includes(rangeParam) ? rangeParam : "week"
  ) as AnalyticsRange;
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const locationId = req.nextUrl.searchParams.get("locationId");
  const format = req.nextUrl.searchParams.get("format");

  try {
    const data = await getWheelAnalytics(id, { range, from, to, locationId });
    if (format === "csv") {
      return new NextResponse("\uFEFF" + analyticsToCsv(data), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="wheel-analytics-${data.from}_${data.to}.csv"`,
        },
      });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Analitik yüklenemedi" },
      { status: 500 },
    );
  }
}
