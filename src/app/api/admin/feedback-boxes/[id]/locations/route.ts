import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  createFeedbackLocation,
  listFeedbackLocations,
  setFeedbackGeoEnabled,
} from "@/lib/feedback-geo";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().min(2).max(120),
  branchName: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(30).max(5000).optional(),
});

const toggleSchema = z.object({
  geoEnabled: z.boolean(),
});

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
  const locations = await listFeedbackLocations(id);
  return NextResponse.json({ geoEnabled: box.geoEnabled, locations });
}

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.geoEnabled === "boolean" && body.name === undefined) {
    const t = toggleSchema.safeParse(body);
    if (!t.success) {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }
    try {
      await setFeedbackGeoEnabled(id, t.data.geoEnabled);
      const locations = await listFeedbackLocations(id);
      return NextResponse.json({ geoEnabled: t.data.geoEnabled, locations });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Kaydedilemedi" },
        { status: 400 },
      );
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Şube adı, enlem ve boylam gerekli" },
      { status: 400 },
    );
  }
  try {
    const loc = await createFeedbackLocation(id, parsed.data);
    const fresh = await prisma.feedbackBox.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ location: loc, geoEnabled: fresh.geoEnabled });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eklenemedi" },
      { status: 400 },
    );
  }
}
