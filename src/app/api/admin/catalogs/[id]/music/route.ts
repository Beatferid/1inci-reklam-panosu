import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCatalogForAdmin, removeCatalogMusic, setCatalogMusic } from "@/lib/catalog";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  assertAllowedAudioMime,
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
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Müzik dosyası gerekli" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Dosya en fazla 15 MB olabilir" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffUploadMime(bytes);
  if (!sniffed || !assertAllowedAudioMime(sniffed)) {
    return NextResponse.json(
      { error: "MP3/M4A/OGG/WAV formatında ses dosyası yükleyin" },
      { status: 400 },
    );
  }

  const saved = await saveUpload(bytes, { folder: "uploads", mime: sniffed });
  await setCatalogMusic(id, saved.relative);

  const updated = await getCatalogForAdmin(id);
  return NextResponse.json(updated, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await removeCatalogMusic(id);
  const updated = await getCatalogForAdmin(id);
  return NextResponse.json(updated);
}
