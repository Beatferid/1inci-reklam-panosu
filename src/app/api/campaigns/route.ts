import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { ownerWhere, requireUser } from "@/lib/access";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
  notes: z.string().max(2000).optional(),
  ownerId: z.string().optional(),
});

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const campaigns = await prisma.campaign.findMany({
    where: ownerWhere(gate.user),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, email: true, name: true } },
    },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  let slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) slug = `kampanya-${Date.now()}`;

  const existing = await prisma.campaign.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  let ownerId = gate.user.id;
  if (parsed.data.ownerId && gate.user.role === "SUPER") {
    const owner = await prisma.user.findUnique({
      where: { id: parsed.data.ownerId },
      select: { id: true, active: true },
    });
    if (!owner?.active) {
      return NextResponse.json(
        { error: "Atanan kullanıcı bulunamadı" },
        { status: 400 },
      );
    }
    ownerId = owner.id;
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      slug,
      notes: parsed.data.notes,
      ownerId,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
