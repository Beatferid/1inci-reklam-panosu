import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bumpCampaignCounter } from "@/lib/campaign-analytics";

const schema = z.object({
  slug: z.string().min(1),
  type: z.enum(["scan", "target_found", "play"]),
  meta: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (!campaign || campaign.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Yok" }, { status: 404 });
  }

  await bumpCampaignCounter(
    campaign.id,
    parsed.data.type,
    parsed.data.meta,
  );

  return NextResponse.json({ ok: true });
}
