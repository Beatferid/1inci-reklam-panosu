import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_UPLOAD_BYTES,
  assertAllowedImageMime,
  deleteStorageFile,
  publicMediaUrl,
  saveUpload,
  sniffUploadMime,
} from "@/lib/storage";
import {
  getWheelDisplaySettings,
  setWheelDisplaySettings,
} from "@/lib/wheel-display";

type Params = { params: Promise<{ id: string }> };

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

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Dosya en fazla 10 MB olabilir" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffUploadMime(bytes);
  if (!sniffed || !assertAllowedImageMime(sniffed)) {
    return NextResponse.json(
      { error: "PNG/JPG/WebP görsel yükleyin" },
      { status: 400 },
    );
  }

  const current = await getWheelDisplaySettings(id);
  await deleteStorageFile(current.wheelLogoPath);
  const saved = await saveUpload(bytes, { folder: "uploads", mime: sniffed });
  const display = await setWheelDisplaySettings(id, {
    wheelLogoPath: saved.relative,
  });

  return NextResponse.json({
    ...display,
    wheelLogoUrl: publicMediaUrl(display.wheelLogoPath),
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const current = await getWheelDisplaySettings(id);
  await deleteStorageFile(current.wheelLogoPath);
  const display = await setWheelDisplaySettings(id, { wheelLogoPath: null });
  return NextResponse.json(display);
}
