import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { deleteStorageFile } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import {
  getWheelDisplaySettings,
  setWheelDisplaySettings,
} from "@/lib/wheel-display";
import { getWheelGeoSettings, setWheelGeoSettings } from "@/lib/wheel-geo";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(64).optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  // Depolama yolları yalnızca upload/marker API üzerinden yazılır
  wheelEnabled: z.boolean().optional(),
  spinsPerPlayerPerDay: z.number().int().min(1).max(20).optional(),
  wheelShowPrizeNames: z.boolean().optional(),
  wheelEqualSlices: z.boolean().optional(),
  spinCooldownMinutes: z.number().int().min(0).max(24 * 60).optional(),
  claimWindowMinutes: z.number().int().min(0).max(24 * 60).optional(),
  spinPin: z
    .string()
    .max(5)
    .regex(/^(\d{5})?$/, "5 rakamlı şifre veya boş")
    .optional(),
  claimPin: z
    .string()
    .max(5)
    .regex(/^(\d{5})?$/, "5 rakamlı kasiyer şifresi veya boş")
    .optional(),
  wheelAskName: z.boolean().optional(),
  wheelNameRequired: z.boolean().optional(),
  wheelTitle: z.string().max(80).nullable().optional(),
  wheelWinnersEnabled: z.boolean().optional(),
  wheelWinnersPeriod: z.enum(["DAY", "WEEK", "MONTH"]).optional(),
  wheelDefaultLocale: z.enum(["az", "tr", "en", "ru"]).optional(),
  wheelRequireQrRescan: z.boolean().optional(),
  geoEnabled: z.boolean().optional(),
  geoLat: z.number().min(-90).max(90).nullable().optional(),
  geoLng: z.number().min(-180).max(180).nullable().optional(),
  geoRadiusMeters: z.number().int().min(30).max(5000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const display = await getWheelDisplaySettings(id);
  const geo = await getWheelGeoSettings(id);
  return NextResponse.json({ ...campaign, ...display, ...geo });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const {
    wheelShowPrizeNames,
    wheelEqualSlices,
    spinCooldownMinutes,
    claimWindowMinutes,
    spinPin,
    claimPin,
    wheelAskName,
    wheelNameRequired,
    wheelTitle,
    wheelWinnersEnabled,
    wheelWinnersPeriod,
    wheelDefaultLocale,
    wheelRequireQrRescan,
    geoEnabled,
    geoLat,
    geoLng,
    geoRadiusMeters,
    ...rest
  } = parsed.data;
  const data = { ...rest };
  if (data.slug) {
    data.slug = slugify(data.slug);
    const clash = await prisma.campaign.findFirst({
      where: { slug: data.slug, NOT: { id } },
    });
    if (clash) {
      return NextResponse.json({ error: "Slug kullanımda" }, { status: 409 });
    }
  }

  const merged = {
    ...existing,
    ...data,
  };
  const wheelOn = Boolean(merged.wheelEnabled);
  const wheelTurningOff =
    data.wheelEnabled === false && existing.wheelEnabled === true;

  if (wheelOn) {
    const prizeCount = await prisma.wheelPrize.count({
      where: { campaignId: id, active: true },
    });
    if (prizeCount >= 1) {
      data.status = "PUBLISHED";
    }
  }

  const willBePublished =
    (data.status ?? existing.status) === "PUBLISHED";

  if (willBePublished) {
    const missing: string[] = [];
    if (wheelOn) {
      const prizeCount = await prisma.wheelPrize.count({
        where: { campaignId: id, active: true },
      });
      if (prizeCount < 1) {
        missing.push("şans çarkı hediyeleri (en az 1 aktif dilim)");
      }
    } else if (!merged.mediaPath) {
      missing.push("reklam görseli");
    }
    if (missing.length > 0) {
      if (wheelTurningOff && existing.status === "PUBLISHED") {
        data.status = "DRAFT";
      } else if (data.status === "PUBLISHED" || wheelTurningOff) {
        return NextResponse.json(
          {
            error: `Yayınlamak için eksik: ${missing.join("; ")}.`,
            missing,
          },
          { status: 400 },
        );
      }
    }
  }

  if (
    (data.status ?? existing.status) === "PUBLISHED" &&
    !Boolean(data.wheelEnabled ?? existing.wheelEnabled)
  ) {
    const after = { ...existing, ...data };
    if (!after.mediaPath) {
      data.status = "DRAFT";
    }
  }

  const campaign =
    Object.keys(data).length > 0
      ? await prisma.campaign.update({ where: { id }, data })
      : existing;

  let display = await getWheelDisplaySettings(id);
  if (
    wheelShowPrizeNames !== undefined ||
    wheelEqualSlices !== undefined ||
    spinCooldownMinutes !== undefined ||
    claimWindowMinutes !== undefined ||
    spinPin !== undefined ||
    claimPin !== undefined ||
    wheelAskName !== undefined ||
    wheelNameRequired !== undefined ||
    wheelTitle !== undefined ||
    wheelWinnersEnabled !== undefined ||
    wheelWinnersPeriod !== undefined ||
    wheelDefaultLocale !== undefined ||
    wheelRequireQrRescan !== undefined
  ) {
    display = await setWheelDisplaySettings(id, {
      wheelShowPrizeNames,
      wheelEqualSlices,
      spinCooldownMinutes,
      claimWindowMinutes,
      spinPin,
      claimPin,
      wheelAskName,
      wheelNameRequired,
      wheelTitle: wheelTitle === null ? "" : wheelTitle,
      wheelWinnersEnabled,
      wheelWinnersPeriod,
      wheelDefaultLocale,
      wheelRequireQrRescan,
    });
  }

  let geo = await getWheelGeoSettings(id);
  if (
    geoEnabled !== undefined ||
    geoLat !== undefined ||
    geoLng !== undefined ||
    geoRadiusMeters !== undefined
  ) {
    try {
      geo = await setWheelGeoSettings(id, {
        geoEnabled,
        geoLat,
        geoLng,
        geoRadiusMeters,
      });
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "Konum ayarları kaydedilemedi",
        },
        { status: 400 },
      );
    }
  }

  // Admin’e şifreleri göster (boş olabilir); public API’de asla dönülmez
  return NextResponse.json({
    ...campaign,
    ...display,
    ...geo,
    spinPin: display.spinPin,
    requirePin: display.requirePin,
    claimPin: display.claimPin,
    requireClaimPin: display.requireClaimPin,
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  await deleteStorageFile(existing.targetImagePath);
  await deleteStorageFile(existing.mindPath);
  await deleteStorageFile(existing.mediaPath);
  await deleteStorageFile(existing.posterPath);
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
