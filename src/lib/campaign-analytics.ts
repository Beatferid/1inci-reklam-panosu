import { prisma } from "@/lib/prisma";

export type CampaignAnalyticsType = "scan" | "target_found" | "play";

const FIELD: Record<CampaignAnalyticsType, "scanCount" | "targetFoundCount" | "playCount"> =
  {
    scan: "scanCount",
    target_found: "targetFoundCount",
    play: "playCount",
  };

/** Kampanya sayaçlarını artır (AR + çark ortak) */
export async function bumpCampaignCounter(
  campaignId: string,
  type: CampaignAnalyticsType,
  meta?: string,
) {
  const counterField = FIELD[type];
  try {
    await prisma.$transaction([
      prisma.analyticsEvent.create({
        data: {
          campaignId,
          type,
          meta: meta ?? null,
        },
      }),
      prisma.campaign.update({
        where: { id: campaignId },
        data: { [counterField]: { increment: 1 } },
      }),
    ]);
  } catch {
    // analitik asla ana akışı bozmasın
  }
}
