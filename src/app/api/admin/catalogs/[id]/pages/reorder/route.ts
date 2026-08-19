import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { reorderCatalogPages } from "@/lib/catalog";

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  try {
    await reorderCatalogPages(id, parsed.data.orderedIds);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sıralanamadı" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
