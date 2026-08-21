import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { spinWheel } from "@/lib/wheel";
import { clientIpFromRequest } from "@/lib/rate-limit";

type Params = { params: Promise<{ slug: string }> };

const bodySchema = z.object({
  phone: z.string().min(10).max(20),
  deviceId: z.string().min(8).max(64),
  pin: z.string().max(8).optional(),
  fullName: z.string().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Yanlış sorğu" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Telefon və cihaz kimliyi lazımdır" },
      { status: 400 },
    );
  }

  const result = await spinWheel(slug, parsed.data.phone, {
    deviceId: parsed.data.deviceId,
    pin: parsed.data.pin,
    fullName: parsed.data.fullName,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    clientIp: clientIpFromRequest(req),
  });
  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
