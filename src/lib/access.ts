import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export function isSuper(user: { role?: string | null } | null | undefined) {
  return user?.role === "SUPER";
}

/** Liste sorguları: SUPER hepsini, CLIENT yalnız kendi kayıtlarını görür */
export function ownerWhere(
  user: AppUser,
): { ownerId: string } | Record<string, never> {
  if (isSuper(user)) return {};
  return { ownerId: user.id };
}

export async function requireUser(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Yetkisiz" }, { status: 401 }),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Hesap bulunamadı veya pasif" },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    },
  };
}

export async function requireSuper(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; response: NextResponse }
> {
  const gate = await requireUser();
  if (!gate.ok) return gate;
  if (!isSuper(gate.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Yalnız süper admin" },
        { status: 403 },
      ),
    };
  }
  return gate;
}

export async function assertCampaignAccess(campaignId: string, user: AppUser) {
  const row = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { ownerId: true },
  });
  if (!row) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Bulunamadı" }, { status: 404 }),
    };
  }
  if (!isSuper(user) && row.ownerId !== user.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Yetkisiz" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function assertCatalogAccess(catalogId: string, user: AppUser) {
  const row = await prisma.catalog.findUnique({
    where: { id: catalogId },
    select: { ownerId: true },
  });
  if (!row) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Bulunamadı" }, { status: 404 }),
    };
  }
  if (!isSuper(user) && row.ownerId !== user.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Yetkisiz" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function assertFeedbackBoxAccess(boxId: string, user: AppUser) {
  const row = await prisma.feedbackBox.findUnique({
    where: { id: boxId },
    select: { ownerId: true },
  });
  if (!row) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Bulunamadı" }, { status: 404 }),
    };
  }
  if (!isSuper(user) && row.ownerId !== user.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Yetkisiz" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function getAppUser(): Promise<AppUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!dbUser || !dbUser.active) return null;
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

export function sessionRole(session: Session | null): UserRole | null {
  const role = (session?.user as { role?: UserRole } | undefined)?.role;
  return role === "SUPER" || role === "CLIENT" ? role : null;
}
