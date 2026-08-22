import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuper } from "@/lib/access";

const createSchema = z.object({
  email: z.string().min(2).max(120),
  name: z.string().max(120).optional(),
  password: z.string().min(6).max(100),
  role: z.enum(["SUPER", "CLIENT"]).default("CLIENT"),
  active: z.boolean().optional(),
});

export async function GET() {
  const gate = await requireSuper();
  if (!gate.ok) return gate.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      _count: {
        select: { campaigns: true, catalogs: true, feedbackBoxes: true },
      },
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const gate = await requireSuper();
  if (!gate.ok) return gate.response;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu kullanıcı adı / e-posta zaten var" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash,
      role: parsed.data.role,
      active: parsed.data.active ?? true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
