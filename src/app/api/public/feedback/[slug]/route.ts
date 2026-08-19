import { NextRequest, NextResponse } from "next/server";
import { getFeedbackBoxPublicMeta } from "@/lib/feedback";

type Params = { params: Promise<{ slug: string }> };

/** Öneri & Şikayet kutusu meta — kamerasız, kampanyadan bağımsız */
export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const result = await getFeedbackBoxPublicMeta(slug, deviceId);
  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
