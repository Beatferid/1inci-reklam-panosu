import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertFeedbackBoxAccess,
  requireUser,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { updateFeedbackEntryStatus } from "@/lib/feedback";

type Params = { params: Promise<{ id: string; entryId: string }> };

const patchSchema = z.object({
  status: z.enum(["NEW", "READ", "RESOLVED"]),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, entryId } = await params;
  const access = await assertFeedbackBoxAccess(id, gate.user);
  if (!access.ok) return access.response;
  const box = await prisma.feedbackBox.findUnique({ where: { id } });
  if (!box) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  try {
    const entry = await updateFeedbackEntryStatus(id, entryId, parsed.data.status);
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Güncellenemedi" },
      { status: 400 },
    );
  }
}
