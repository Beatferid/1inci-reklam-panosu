import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_UPLOAD_BYTES,
  assertAllowedImageMime,
  assertAllowedVideoMime,
  deleteStorageFile,
  saveUpload,
  sniffUploadMime,
} from "@/lib/storage";

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
  const kind = String(form.get("kind") || "");
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

  if (kind === "media") {
    if (!sniffed) {
      return NextResponse.json(
        { error: "PNG/JPG/WEBP görsel veya MP4/WEBM video yükleyin" },
        { status: 400 },
      );
    }
    const isVideo = assertAllowedVideoMime(sniffed);
    const isImage = assertAllowedImageMime(sniffed);
    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: "PNG/JPG/WEBP görsel veya MP4/WEBM video yükleyin" },
        { status: 400 },
      );
    }
    await deleteStorageFile(campaign.mediaPath);
    const saved = await saveUpload(bytes, {
      folder: "uploads",
      mime: sniffed,
    });
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        mediaPath: saved.relative,
        mediaMime: sniffed,
        mediaType: isVideo ? "VIDEO" : "IMAGE",
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Geçersiz kind" }, { status: 400 });
}
