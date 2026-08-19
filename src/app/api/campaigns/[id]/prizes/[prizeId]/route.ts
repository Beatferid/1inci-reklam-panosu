import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensurePrizePeriodQuotaColumns,
  fetchPrizePeriodLimits,
  setPrizePeriodLimits,
} from "@/lib/wheel";
import { validateQuotaChain } from "@/lib/wheel-quota-validate";

type Params = { params: Promise<{ id: string; prizeId: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
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

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  await ensurePrizePeriodQuotaColumns();
  const { id, prizeId } = await params;
  const existing = await prisma.wheelPrize.findFirst({
    where: { id: prizeId, campaignId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  if (parsed.data.totalLimit != null) {
    const wins = await prisma.wheelSpin.count({
      where: { prizeId, won: true, cancelledAt: null },
    });
    if (parsed.data.totalLimit < wins) {
      return NextResponse.json(
        {
          error: `Toplam kota, aktif rezerv/alınmış adetten (${wins}) küçük olamaz.`,
        },
        { status: 400 },
      );
    }
  }

  const {
    dailyLimit,
    weeklyLimit,
    monthlyLimit,
    totalLimit,
    ...rest
  } = parsed.data;

  const curLimits = await fetchPrizePeriodLimits(prisma, prizeId);
  const chain = validateQuotaChain({
    dailyLimit: dailyLimit !== undefined ? dailyLimit : curLimits.dailyLimit,
    weeklyLimit:
      weeklyLimit !== undefined ? weeklyLimit : curLimits.weeklyLimit,
    monthlyLimit:
      monthlyLimit !== undefined ? monthlyLimit : curLimits.monthlyLimit,
    totalLimit: totalLimit !== undefined ? totalLimit : curLimits.totalLimit,
  });
  if (!chain.ok) {
    return NextResponse.json({ error: chain.error }, { status: 400 });
  }

  const prize =
    Object.keys(rest).length > 0
      ? await prisma.wheelPrize.update({
          where: { id: prizeId },
          data: rest,
        })
      : existing;

  if (
    dailyLimit !== undefined ||
    weeklyLimit !== undefined ||
    monthlyLimit !== undefined ||
    totalLimit !== undefined
  ) {
    await setPrizePeriodLimits(prizeId, {
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      totalLimit,
    });
  }

  const limits = await fetchPrizePeriodLimits(prisma, prizeId);
  return NextResponse.json({ ...prize, ...limits });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id, prizeId } = await params;
  const existing = await prisma.wheelPrize.findFirst({
    where: { id: prizeId, campaignId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const spinCount = await prisma.wheelSpin.count({ where: { prizeId } });
  if (spinCount > 0) {
    const prize = await prisma.wheelPrize.update({
      where: { id: prizeId },
      data: { active: false },
    });
    return NextResponse.json({
      prize,
      note: "Kayıtlı çevirmeler var; hediye pasife alındı.",
    });
  }

  const { deleteStorageFile } = await import("@/lib/storage");
  await deleteStorageFile(existing.imagePath);
  await prisma.wheelPrize.delete({ where: { id: prizeId } });
  return NextResponse.json({ ok: true });
}
