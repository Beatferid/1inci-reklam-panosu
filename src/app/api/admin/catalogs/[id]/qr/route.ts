import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCatalogQrPng, catalogEntryUrl } from "@/lib/qr";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
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
