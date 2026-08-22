import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCatalogs, createCatalog } from "@/lib/catalog";
import { ownerWhere, requireUser } from "@/lib/access";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
});

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const filter = ownerWhere(gate.user);
  const catalogs = await listCatalogs(
    "ownerId" in filter ? { ownerId: filter.ownerId } : {},
  );
  return NextResponse.json(catalogs);
}

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const catalog = await createCatalog({
    ...parsed.data,
    ownerId: gate.user.id,
  });
  return NextResponse.json(catalog, { status: 201 });
}
