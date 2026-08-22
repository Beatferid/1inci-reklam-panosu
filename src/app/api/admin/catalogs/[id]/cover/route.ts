import { NextRequest, NextResponse } from "next/server";
import {
  assertCatalogAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  getCatalogForAdmin,
  removeCatalogCover,
  setCatalogCover,
} from "@/lib/catalog";
import {
  MAX_UPLOAD_BYTES,
  assertAllowedImageMime,
  saveUpload,
  sniffUploadMime,
} from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertCatalogAccess(id, gate.user);
  if (!access.ok) return access.response;
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Kapak görseli gerekli" }, { status: 400 });
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
      { error: "Kapak için PNG/JPG/WEBP görsel yükleyin" },
      { status: 400 },
    );
  }

  const saved = await saveUpload(bytes, { folder: "uploads", mime: sniffed });
  await setCatalogCover(id, saved.relative);

  const updated = await getCatalogForAdmin(id);
  return NextResponse.json(updated, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertCatalogAccess(id, gate.user);
  if (!access.ok) return access.response;
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await removeCatalogCover(id);
  const updated = await getCatalogForAdmin(id);
  return NextResponse.json(updated);
}
