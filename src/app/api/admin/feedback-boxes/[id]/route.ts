import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { slugify } from "@/lib/utils";
import { setFeedbackGeoEnabled } from "@/lib/feedback-geo";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(64).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  geoEnabled: z.boolean().optional(),
  dailyLimitPerDevice: z.number().int().min(1).max(50).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(box);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const existing = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const { geoEnabled, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (data.slug) {
    data.slug = slugify(data.slug as string);
    const clash = await prisma.feedbackBox.findFirst({
      where: { slug: data.slug as string, NOT: { id } },
    });
    if (clash) {
      return NextResponse.json({ error: "Slug kullanımda" }, { status: 409 });
    }
  }

  if (geoEnabled !== undefined) {
    try {
      await setFeedbackGeoEnabled(id, geoEnabled);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Konum ayarı kaydedilemedi" },
        { status: 400 },
      );
    }
  }

  const box =
    Object.keys(data).length > 0
      ? await prisma.feedbackBox.update({ where: { id }, data })
      : await prisma.feedbackBox.findUniqueOrThrow({ where: { id } });

  return NextResponse.json(box);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const existing = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await prisma.feedbackBox.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
