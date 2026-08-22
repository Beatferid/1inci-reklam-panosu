import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  deleteFeedbackLocation,
  listFeedbackLocations,
  updateFeedbackLocation,
} from "@/lib/feedback-geo";

type Params = { params: Promise<{ id: string; locId: string }> };

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  branchName: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(30).max(5000).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, locId } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  try {
    const location = await updateFeedbackLocation(id, locId, parsed.data);
    const fresh = await prisma.feedbackBox.findUniqueOrThrow({ where: { id } });
    const locations = await listFeedbackLocations(id);
    return NextResponse.json({
      location,
      geoEnabled: fresh.geoEnabled,
      locations,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Güncellenemedi" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, locId } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await deleteFeedbackLocation(id, locId);
  return NextResponse.json({ ok: true });
}
