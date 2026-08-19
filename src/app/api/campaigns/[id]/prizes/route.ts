import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensurePrizePeriodQuotaColumns,
  fetchPrizePeriodLimits,
  prizesToSlices,
  setPrizePeriodLimits,
} from "@/lib/wheel";
import { validateQuotaChain } from "@/lib/wheel-quota-validate";
import { publicMediaUrl } from "@/lib/storage";
import { goLiveWithWheel } from "@/lib/wheel-live";

type Params = { params: Promise<{ id: string }> };

const prizeSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
  color: z.string().min(4).max(20).optional(),
  weight: z.number().int().min(0).max(10000).optional(),
  dailyLimit: z.number().int().min(0).nullable().optional(),
  weeklyLimit: z.number().int().min(0).nullable().optional(),
  monthlyLimit: z.number().int().min(0).nullable().optional(),
  totalLimit: z.number().int().min(0).nullable().optional(),
  isEmpty: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  await ensurePrizePeriodQuotaColumns();
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const prizes = await prisma.wheelPrize.findMany({
    where: { campaignId: id },
    orderBy: { sortOrder: "asc" },
  });
  const withLimits = await Promise.all(
    prizes.map(async (p) => {
      const limits = await fetchPrizePeriodLimits(prisma, p.id);
      return {
        ...p,
        ...limits,
        imageUrl: publicMediaUrl(p.imagePath),
      };
    }),
  );
  return NextResponse.json({
    prizes: withLimits,
    slices: prizesToSlices(withLimits.filter((p) => p.active)),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = prizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  await ensurePrizePeriodQuotaColumns();
  const chain = validateQuotaChain({
    dailyLimit: parsed.data.dailyLimit ?? null,
    weeklyLimit: parsed.data.weeklyLimit ?? null,
    monthlyLimit: parsed.data.monthlyLimit ?? null,
    totalLimit: parsed.data.totalLimit ?? null,
  });
  if (!chain.ok) {
    return NextResponse.json({ error: chain.error }, { status: 400 });
  }
  const count = await prisma.wheelPrize.count({ where: { campaignId: id } });
  const prize = await prisma.wheelPrize.create({
    data: {
      campaignId: id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? "#0f6b5c",
      weight: parsed.data.weight ?? 1,
      dailyLimit: parsed.data.dailyLimit ?? null,
      weeklyLimit: parsed.data.weeklyLimit ?? null,
      monthlyLimit: parsed.data.monthlyLimit ?? null,
      totalLimit: parsed.data.totalLimit ?? null,
      isEmpty: parsed.data.isEmpty ?? false,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? count,
    },
  });
  await setPrizePeriodLimits(prize.id, {
    dailyLimit: parsed.data.dailyLimit ?? null,
    weeklyLimit: parsed.data.weeklyLimit ?? null,
    monthlyLimit: parsed.data.monthlyLimit ?? null,
    totalLimit: parsed.data.totalLimit ?? null,
  });
  const limits = await fetchPrizePeriodLimits(prisma, prize.id);
  await goLiveWithWheel(id);
  return NextResponse.json({
    ...prize,
    ...limits,
    imageUrl: publicMediaUrl(prize.imagePath),
  });
}
