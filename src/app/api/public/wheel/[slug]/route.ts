import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prizesToSlices } from "@/lib/wheel";
import {
  getWheelDisplaySettings,
  WheelSettingsUnavailableError,
} from "@/lib/wheel-display";
import {
  getWheelGeoSettings,
  publicGeoInfo,
  WheelGeoUnavailableError,
} from "@/lib/wheel-geo";

type Params = { params: Promise<{ slug: string }> };

/** Kamerasız şans çarxı */
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
    return NextResponse.json({ error: "Kampaniya tapılmadı" }, { status: 404 });
  }

  if (!campaign.wheelEnabled) {
    return NextResponse.json(
      { error: "Bu kampaniyada şans çarxı aktiv deyil" },
      { status: 404 },
    );
  }

  let display;
  let geo;
  try {
    display = await getWheelDisplaySettings(campaign.id);
    geo = await getWheelGeoSettings(campaign.id);
  } catch (err) {
    if (
      err instanceof WheelSettingsUnavailableError ||
      err instanceof WheelGeoUnavailableError
    ) {
      return NextResponse.json(
        {
          error:
            "Oyun ayarları geçici olarak kullanılamıyor. Biraz sonra yeniden deneyin.",
        },
        { status: 503 },
      );
    }
    throw err;
  }

  return NextResponse.json({
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    wheelEnabled: true,
    spinsPerPlayerPerDay: campaign.spinsPerPlayerPerDay,
    wheelShowPrizeNames: display.wheelShowPrizeNames,
    wheelEqualSlices: display.wheelEqualSlices,
    spinCooldownMinutes: display.spinCooldownMinutes,
    claimWindowMinutes: display.claimWindowMinutes,
    requirePin: display.requirePin,
    requireClaimPin: display.requireClaimPin,
    ...publicGeoInfo(geo),
    wheelSlices: prizesToSlices(campaign.prizes, {
      equalSlices: display.wheelEqualSlices,
    }),
  });
}
