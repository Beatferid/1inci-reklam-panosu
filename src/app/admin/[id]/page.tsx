import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicMediaUrl } from "@/lib/storage";
import { campaignGameUrl, campaignPublicUrl } from "@/lib/qr";
import { getWheelDisplaySettings } from "@/lib/wheel-display";
import { getWheelGeoSettings } from "@/lib/wheel-geo";
import CampaignEditor from "@/components/admin/CampaignEditor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const display = await getWheelDisplaySettings(id);
  const geo = await getWheelGeoSettings(id);

  return (
    <CampaignEditor
      initial={{ ...campaign, ...display, ...geo }}
      targetImageUrl={publicMediaUrl(campaign.targetImagePath)}
      mediaUrl={publicMediaUrl(campaign.mediaPath)}
      arUrl={campaignPublicUrl(campaign.slug)}
      gameUrl={
        campaign.wheelEnabled ? campaignGameUrl(campaign.slug) : undefined
      }
    />
  );
}
