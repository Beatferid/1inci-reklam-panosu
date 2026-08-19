import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateQrPng, campaignEntryUrl } from "@/lib/qr";
import { prisma } from "@/lib/prisma";

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

  const wheelEnabled = Boolean(campaign.wheelEnabled);
  const url = campaignEntryUrl(campaign.slug, { wheelEnabled });
  const format = req.nextUrl.searchParams.get("format") || "png";
  if (format === "json") {
    return NextResponse.json({
      url,
      slug: campaign.slug,
      wheelEnabled,
    });
  }

  const png = await generateQrPng(campaign.slug, { wheelEnabled });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="oyun-${campaign.slug}.png"`,
    },
  });
}
