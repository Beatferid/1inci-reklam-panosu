import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getFeedbackDeviceByRecordId,
  listEntriesForDevice,
} from "@/lib/feedback-devices";

type Params = { params: Promise<{ id: string; deviceRecordId: string }> };

/** Bir cihazın tüm geçmişi — tarih+saat, tip, mesaj (drill-down raporu) */
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id, deviceRecordId } = await params;
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
