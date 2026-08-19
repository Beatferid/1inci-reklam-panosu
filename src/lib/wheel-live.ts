import { prisma } from "@/lib/prisma";

/** Dilim varsa çarkı aç ve kampanyayı yayınla — QR /oyun çalışsın */
export async function goLiveWithWheel(campaignId: string) {
  const prizeCount = await prisma.wheelPrize.count({
    where: { campaignId, active: true },
  });
  if (prizeCount < 1) return false;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { wheelEnabled: true, status: "PUBLISHED" },
  });
  return true;
}
