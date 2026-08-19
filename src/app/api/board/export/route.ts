import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBoardPng } from "@/lib/board-layout";

/** Yayınlı + derlenmiş kampanyalardan tek büyük pano PNG. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "PUBLISHED",
      ...(idsParam
        ? { id: { in: idsParam.split(",").filter(Boolean) } }
        : {}),
    },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, id: true, wheelEnabled: true },
  });

  if (campaigns.length === 0) {
    return NextResponse.json(
      {
        error:
          "Pano için yayınlı en az bir kampanya gerekli.",
      },
      { status: 400 },
    );
  }

  const png = await generateBoardPng(
    campaigns.map((c) => ({
      slug: c.slug,
      name: c.name,
      wheelEnabled: Boolean(c.wheelEnabled),
    })),
  );

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-pano-${campaigns.length}hucre.png"`,
    },
  });
}
