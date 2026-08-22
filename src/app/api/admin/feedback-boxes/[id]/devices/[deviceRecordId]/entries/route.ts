import { NextResponse } from "next/server";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  getFeedbackDeviceByRecordId,
  listEntriesForDevice,
} from "@/lib/feedback-devices";

type Params = { params: Promise<{ id: string; deviceRecordId: string }> };

/** Bir cihazın tüm geçmişi — tarih+saat, tip, mesaj (drill-down raporu) */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, deviceRecordId } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const device = await getFeedbackDeviceByRecordId(id, deviceRecordId);
  if (!device) {
    return NextResponse.json({ error: "Cihaz bulunamadı" }, { status: 404 });
  }
  const entries = await listEntriesForDevice(id, device.deviceId);
  return NextResponse.json({ device, entries });
}
