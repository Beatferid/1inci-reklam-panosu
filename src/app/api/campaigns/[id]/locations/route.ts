import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createCampaignLocation,
  getWheelGeoSettings,
  listCampaignLocations,
  setGeoEnabled,
} from "@/lib/wheel-geo";

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
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const geo = await getWheelGeoSettings(id);
  return NextResponse.json({
    geoEnabled: geo.geoEnabled,
    locations: geo.locations,
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
  if (typeof body?.geoEnabled === "boolean" && body.name === undefined) {
    const t = toggleSchema.safeParse(body);
    if (!t.success) {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }
    try {
      await setGeoEnabled(id, t.data.geoEnabled);
      const locations = await listCampaignLocations(id);
      return NextResponse.json({
        geoEnabled: t.data.geoEnabled,
        locations,
      });
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
      { error: "Konum adı, enlem ve boylam gerekli" },
      { status: 400 },
    );
  }
  try {
    const loc = await createCampaignLocation(id, parsed.data);
    const geo = await getWheelGeoSettings(id);
    return NextResponse.json({ location: loc, geoEnabled: geo.geoEnabled });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eklenemedi" },
      { status: 400 },
    );
  }
}
