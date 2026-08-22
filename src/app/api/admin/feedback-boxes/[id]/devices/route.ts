import { NextResponse } from "next/server";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { listFeedbackDevices } from "@/lib/feedback-devices";

type Params = { params: Promise<{ id: string }> };

/** Cihaz takibi/raporlama — hangi cihazdan kaç öneri/şikayet gelmiş */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const devices = await listFeedbackDevices(id);
  return NextResponse.json({ devices });
}
