import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FeedbackBoxEditor from "@/components/admin/FeedbackBoxEditor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FeedbackBoxDetailPage({ params }: Props) {
  const { id } = await params;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) notFound();

  return (
    <FeedbackBoxEditor
      initial={{
        id: box.id,
        name: box.name,
        slug: box.slug,
        status: box.status,
        geoEnabled: box.geoEnabled,
        dailyLimitPerDevice: box.dailyLimitPerDevice,
      }}
    />
  );
}
