import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFeedbackDevices } from "@/lib/feedback-devices";

type Params = { params: Promise<{ id: string }> };

/** Cihaz takibi/raporlama — hangi cihazdan kaç öneri/şikayet gelmiş */
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const devices = await listFeedbackDevices(id);
  return NextResponse.json({ devices });
}
