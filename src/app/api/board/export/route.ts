import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBoardPng } from "@/lib/board-layout";
import { ownerWhere, requireUser } from "@/lib/access";

/** Yayınlı + hazır kampanyalardan tek büyük pano PNG. */
export async function GET(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const idsParam = req.nextUrl.searchParams.get("ids");
  const campaigns = await prisma.campaign.findMany({
    where: {
      ...ownerWhere(gate.user),
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
        error: "Pano için yayınlı en az bir kampanya gerekli.",
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
