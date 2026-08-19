import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  deleteCatalog,
  getCatalogForAdmin,
  updateCatalog,
} from "@/lib/catalog";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(64).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  coverTitle: z.string().max(160).nullable().optional(),
  theme: z.enum(["NONE", "NEW_YEAR", "EID", "RAMADAN", "SNOW", "SPRING"]).optional(),
  flipStyle: z.enum(["CURL", "SLIDE", "FADE", "ZOOM", "FLIP_H"]).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const catalog = await getCatalogForAdmin(id);
  if (!catalog) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(catalog);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await getCatalogForAdmin(id);
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  try {
    await updateCatalog(id, parsed.data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Güncellenemedi" },
      { status: 400 },
    );
  }

  const updated = await getCatalogForAdmin(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await getCatalogForAdmin(id);
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  await deleteCatalog(id);
  return NextResponse.json({ ok: true });
}
