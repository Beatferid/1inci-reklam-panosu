import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { ownerWhere, requireUser } from "@/lib/access";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
});

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const boxes = await prisma.feedbackBox.findMany({
    where: ownerWhere(gate.user),
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { entries: true, locations: true, devices: true } },
    },
  });
  return NextResponse.json(boxes);
}

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  let slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) slug = `geri-bildirim-${Date.now()}`;

  const existing = await prisma.feedbackBox.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const box = await prisma.feedbackBox.create({
    data: {
      name: parsed.data.name,
      slug,
      ownerId: gate.user.id,
    },
  });

  return NextResponse.json(box, { status: 201 });
}
