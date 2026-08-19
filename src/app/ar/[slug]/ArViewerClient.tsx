"use client";

import CampaignMediaView from "@/components/campaign/CampaignMediaView";

export default function ArViewerClient({ slug }: { slug: string }) {
  return <CampaignMediaView slug={slug} />;
}
