import { NextRequest, NextResponse } from "next/server";
import {
  assertCampaignAccess,
  requireUser,
} from "@/lib/access";
import { generateQrPng, campaignEntryUrl } from "@/lib/qr";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertCampaignAccess(id, gate.user);
  if (!access.ok) return access.response;
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
