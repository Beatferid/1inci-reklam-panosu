import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteCampaignLocation,
  getWheelGeoSettings,
  updateCampaignLocation,
} from "@/lib/wheel-geo";

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
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id, locId } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  try {
    const location = await updateCampaignLocation(id, locId, parsed.data);
    const geo = await getWheelGeoSettings(id);
    return NextResponse.json({
      location,
      geoEnabled: geo.geoEnabled,
      locations: geo.locations,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Güncellenemedi" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id, locId } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await deleteCampaignLocation(id, locId);
  return NextResponse.json({ ok: true });
}
