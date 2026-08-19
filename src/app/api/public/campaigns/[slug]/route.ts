import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicMediaUrl } from "@/lib/storage";
import { prizesToSlices } from "@/lib/wheel";
import { getWheelDisplaySettings } from "@/lib/wheel-display";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      prizes: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!campaign || campaign.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
  }

  if (!campaign.mediaPath) {
    return NextResponse.json(
      { error: "Kampanya görseli eksik" },
      { status: 404 },
    );
  }

  const display = await getWheelDisplaySettings(campaign.id);

  return NextResponse.json({
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    mediaType: campaign.mediaType,
    mediaUrl: publicMediaUrl(campaign.mediaPath),
    wheelEnabled: campaign.wheelEnabled,
    spinsPerPlayerPerDay: campaign.spinsPerPlayerPerDay,
    wheelShowPrizeNames: display.wheelShowPrizeNames,
    wheelEqualSlices: display.wheelEqualSlices,
    spinCooldownMinutes: display.spinCooldownMinutes,
    claimWindowMinutes: display.claimWindowMinutes,
    requirePin: display.requirePin,
    wheelSlices: campaign.wheelEnabled
      ? prizesToSlices(campaign.prizes, {
          equalSlices: display.wheelEqualSlices,
        })
      : [],
  });
}
