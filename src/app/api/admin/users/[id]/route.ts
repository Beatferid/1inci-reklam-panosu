import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuper } from "@/lib/access";

const patchSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(["SUPER", "CLIENT"]).optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireSuper();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  if (
    target.role === "SUPER" &&
    (parsed.data.role === "CLIENT" || parsed.data.active === false)
  ) {
    const superCount = await prisma.user.count({
      where: { role: "SUPER", active: true },
    });
    if (superCount <= 1) {
      return NextResponse.json(
        { error: "Son aktif süper admin değiştirilemez" },
        { status: 400 },
      );
    }
  }

  const data: {
    name?: string | null;
    role?: "SUPER" | "CLIENT";
    active?: boolean;
    passwordHash?: string;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireSuper();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  if (id === gate.user.id) {
    return NextResponse.json(
      { error: "Kendi hesabınızı silemezsiniz" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (target.role === "SUPER") {
    const superCount = await prisma.user.count({
      where: { role: "SUPER", active: true },
    });
    if (superCount <= 1) {
      return NextResponse.json(
        { error: "Son süper admin silinemez" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction([
    prisma.campaign.updateMany({
      where: { ownerId: id },
      data: { ownerId: gate.user.id },
    }),
    prisma.catalog.updateMany({
      where: { ownerId: id },
      data: { ownerId: gate.user.id },
    }),
    prisma.feedbackBox.updateMany({
      where: { ownerId: id },
      data: { ownerId: gate.user.id },
    }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
