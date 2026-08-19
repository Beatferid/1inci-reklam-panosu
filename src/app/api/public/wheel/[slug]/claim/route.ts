import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claimPrize } from "@/lib/wheel";
import { clientIpFromRequest } from "@/lib/rate-limit";

type Params = { params: Promise<{ slug: string }> };

const bodySchema = z.object({
  phone: z.string().min(10).max(20),
  spinId: z.string().min(1),
  deviceId: z.string().min(8).max(64).optional(),
  pin: z.string().max(8).optional(),
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
    return NextResponse.json({ error: "Telefon və spinId lazımdır" }, { status: 400 });
  }

  const result = await claimPrize(slug, parsed.data.phone, parsed.data.spinId, {
    deviceId: parsed.data.deviceId,
    pin: parsed.data.pin,
    clientIp: clientIpFromRequest(req),
  });
  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
