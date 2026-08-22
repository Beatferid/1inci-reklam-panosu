import { NextRequest, NextResponse } from "next/server";
import {
  assertCatalogAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { generateCatalogQrPng, catalogEntryUrl } from "@/lib/qr";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const access = await assertCatalogAccess(id, gate.user);
  if (!access.ok) return access.response;
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const url = catalogEntryUrl(catalog.slug);
  const format = req.nextUrl.searchParams.get("format") || "png";
  if (format === "json") {
    return NextResponse.json({ url, slug: catalog.slug });
  }

  const png = await generateCatalogQrPng(catalog.slug);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="katalog-${catalog.slug}.png"`,
    },
  });
}
