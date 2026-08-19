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

  // Eski QR /ar ise bile çark açıksa oyuna git (yayın taslak olsa da)
  if (campaign?.wheelEnabled) {
    redirect(`/oyun/${slug}`);
  }

  return <ArViewerClient slug={slug} />;
}
