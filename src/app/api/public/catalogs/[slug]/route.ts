import { NextResponse } from "next/server";
import { getCatalogPublicMeta } from "@/lib/catalog";

type Params = { params: Promise<{ slug: string }> };

/** Dijital katalog meta — kamerasız, kampanyadan bağımsız, QR ile açılır */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const result = await getCatalogPublicMeta(slug);
  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
