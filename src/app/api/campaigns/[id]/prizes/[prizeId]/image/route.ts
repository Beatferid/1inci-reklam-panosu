import { NextRequest, NextResponse } from "next/server";
import {
  assertCampaignAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  MAX_UPLOAD_BYTES,
  assertAllowedImageMime,
  deleteStorageFile,
  publicMediaUrl,
  saveUpload,
  sniffUploadMime,
} from "@/lib/storage";

type Params = { params: Promise<{ id: string; prizeId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, prizeId } = await params;
  const access = await assertCampaignAccess(id, gate.user);
  if (!access.ok) return access.response;
  const prize = await prisma.wheelPrize.findFirst({
    where: { id: prizeId, campaignId: id },
  });
  if (!prize) {
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

  await deleteStorageFile(prize.imagePath);
  const saved = await saveUpload(bytes, {
    folder: "uploads",
    mime: sniffed,
  });
  const updated = await prisma.wheelPrize.update({
    where: { id: prizeId },
    data: { imagePath: saved.relative },
  });

  return NextResponse.json({
    ...updated,
    imageUrl: publicMediaUrl(updated.imagePath),
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, prizeId } = await params;
  const access = await assertCampaignAccess(id, gate.user);
  if (!access.ok) return access.response;
  const prize = await prisma.wheelPrize.findFirst({
    where: { id: prizeId, campaignId: id },
  });
  if (!prize) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await deleteStorageFile(prize.imagePath);
  const updated = await prisma.wheelPrize.update({
    where: { id: prizeId },
    data: { imagePath: null },
  });
  return NextResponse.json({ ...updated, imageUrl: null });
}
