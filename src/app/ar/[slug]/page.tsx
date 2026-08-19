import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ArViewerClient from "./ArViewerClient";

type Props = { params: Promise<{ slug: string }> };

export default async function ArPage({ params }: Props) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: { wheelEnabled: true, status: true },
  });

  // Çarx açıqsa görsel səhifəsi yüklənməsin — birbaşa oyun
  if (campaign?.status === "PUBLISHED" && campaign.wheelEnabled) {
    redirect(`/oyun/${slug}`);
  }

  return <ArViewerClient slug={slug} />;
}
