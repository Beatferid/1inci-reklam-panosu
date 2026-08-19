import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  feedbackEntriesToCsv,
  listAllFeedbackEntries,
  listFeedbackEntries,
} from "@/lib/feedback";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const status = sp.get("status");
  const filters = {
    type: type === "SUGGESTION" || type === "COMPLAINT" ? type : undefined,
    status:
      status === "NEW" || status === "READ" || status === "RESOLVED"
        ? status
        : undefined,
    locationId: sp.get("locationId") || undefined,
    deviceId: sp.get("deviceId") || undefined,
    rating: sp.get("rating") ? Number(sp.get("rating")) : undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  } as const;

  if (sp.get("format") === "csv") {
    const entries = await listAllFeedbackEntries(id, filters);
    return new NextResponse("\uFEFF" + feedbackEntriesToCsv(entries), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gonderimler-${box.slug}.csv"`,
      },
    });
  }

  const result = await listFeedbackEntries(id, {
    ...filters,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  });
  return NextResponse.json(result);
}
