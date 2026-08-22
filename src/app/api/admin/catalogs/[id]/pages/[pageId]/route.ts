import { NextRequest, NextResponse } from "next/server";
import {
  assertCatalogAccess,
  requireUser,
} from "@/lib/access";
import { deleteCatalogPage, updateCatalogPage } from "@/lib/catalog";
import {
  MAX_UPLOAD_BYTES,
  assertAllowedImageMime,
  saveUpload,
  sniffUploadMime,
} from "@/lib/storage";

type Params = { params: Promise<{ id: string; pageId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, pageId } = await params;
  const access = await assertCatalogAccess(id, gate.user);
  if (!access.ok) return access.response;

  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Görsel gerekli" }, { status: 400 });
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
          { error: "Sayfa için PNG/JPG/WEBP görsel yükleyin" },
          { status: 400 },
        );
      }
      const saved = await saveUpload(bytes, { folder: "uploads", mime: sniffed });
      const page = await updateCatalogPage(id, pageId, {
        imagePath: saved.relative,
      });
      return NextResponse.json(page);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }
    const page = await updateCatalogPage(id, pageId, {
      linkUrl: body.linkUrl ?? null,
    });
    return NextResponse.json(page);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Güncellenemedi" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, pageId } = await params;
  const access = await assertCatalogAccess(id, gate.user);
  if (!access.ok) return access.response;
  try {
    await deleteCatalogPage(id, pageId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Silinemedi" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
