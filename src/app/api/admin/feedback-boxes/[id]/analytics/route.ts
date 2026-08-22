import { NextRequest, NextResponse } from "next/server";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  feedbackAnalyticsToCsv,
  getFeedbackAnalytics,
  type FeedbackAnalyticsRange,
} from "@/lib/feedback-analytics";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const rangeParam = sp.get("range") || "week";
  const range = (
    ["day", "week", "month", "custom"].includes(rangeParam) ? rangeParam : "week"
  ) as FeedbackAnalyticsRange;
  const from = sp.get("from");
  const to = sp.get("to");
  const locationId = sp.get("locationId");
  const deviceId = sp.get("deviceId");
  const ratingParam = sp.get("rating");
  const typeParam = sp.get("type");
  const format = sp.get("format");

  try {
    const data = await getFeedbackAnalytics(id, {
      range,
      from,
      to,
      locationId,
      deviceId,
      rating: ratingParam ? Number(ratingParam) : null,
      type: typeParam === "SUGGESTION" || typeParam === "COMPLAINT" ? typeParam : null,
    });
    if (format === "csv") {
      return new NextResponse("\uFEFF" + feedbackAnalyticsToCsv(data), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="geri-bildirim-analiz-${data.from}_${data.to}.csv"`,
        },
      });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Analitik yüklenemedi" }, { status: 500 });
  }
}
