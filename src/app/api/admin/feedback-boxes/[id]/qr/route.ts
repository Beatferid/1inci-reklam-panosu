import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateFeedbackQrPng, feedbackEntryUrl } from "@/lib/qr";

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

  const url = feedbackEntryUrl(box.slug);
  const format = req.nextUrl.searchParams.get("format") || "png";
  if (format === "json") {
    return NextResponse.json({ url, slug: box.slug });
  }

  const png = await generateFeedbackQrPng(box.slug);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="geri-bildirim-${box.slug}.png"`,
    },
  });
}
