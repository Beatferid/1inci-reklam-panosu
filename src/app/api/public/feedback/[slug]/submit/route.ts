import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitFeedback } from "@/lib/feedback";

const submitSchema = z.object({
  deviceId: z.string().min(4).max(128).optional(),
  type: z.enum(["SUGGESTION", "COMPLAINT"]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z.string().min(1).max(2000),
  customerName: z.string().max(80).nullable().optional(),
  customerPhone: z.string().max(30).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Yanlış məlumat" }, { status: 400 });
  }

  const result = await submitFeedback(slug, parsed.data);
  if (result.status !== 201) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 201 });
}
