import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { istanbulDayKey, normalizeDeviceId, formatIstanbul } from "@/lib/day-key";
import {
  assertInsideFeedbackLocations,
  feedbackLocationLabel,
  listFeedbackLocations,
  publicFeedbackGeoInfo,
} from "@/lib/feedback-geo";

export type FeedbackTypeValue = "SUGGESTION" | "COMPLAINT";
export type FeedbackStatusValue = "NEW" | "READ" | "RESOLVED";

export type FeedbackBoxPublicMeta = {
  id: string;
  name: string;
  slug: string;
  dailyLimitPerDevice: number;
  remainingToday: number;
  geoRequired: boolean;
  locations: ReturnType<typeof publicFeedbackGeoInfo>["locations"];
};

export async function getFeedbackBoxPublicMeta(
  slug: string,
  deviceId?: string | null,
): Promise<
  { status: 200; data: FeedbackBoxPublicMeta } | { status: 404; error: string }
> {
  const box = await prisma.feedbackBox.findUnique({ where: { slug } });
  if (!box || box.status !== "PUBLISHED") {
    return { status: 404, error: "Təklif və şikayət qutusu tapılmadı." };
  }
  const locations = await listFeedbackLocations(box.id);
  const geoInfo = publicFeedbackGeoInfo(box.geoEnabled, locations);

  let remainingToday = box.dailyLimitPerDevice;
  const normDevice = normalizeDeviceId(deviceId);
  if (normDevice) {
    const dayKey = istanbulDayKey();
    const used = await prisma.feedbackEntry.count({
      where: { feedbackBoxId: box.id, deviceId: normDevice, dayKey },
    });
    remainingToday = Math.max(0, box.dailyLimitPerDevice - used);
  }

  return {
    status: 200,
    data: {
      id: box.id,
      name: box.name,
      slug: box.slug,
      dailyLimitPerDevice: box.dailyLimitPerDevice,
      remainingToday,
      ...geoInfo,
    },
  };
}

export type SubmitFeedbackInput = {
  deviceId?: string | null;
  type: FeedbackTypeValue;
  rating?: number | null;
  message: string;
  customerName?: string | null;
  customerPhone?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export async function submitFeedback(slug: string, input: SubmitFeedbackInput) {
  const box = await prisma.feedbackBox.findUnique({ where: { slug } });
  if (!box || box.status !== "PUBLISHED") {
    return { error: "Təklif və şikayət qutusu tapılmadı.", status: 404 as const };
  }

  const deviceId = normalizeDeviceId(input.deviceId);
  if (!deviceId) {
    return {
      error: "Cihaz kimliyi tapılmadı. Səhifəni yeniləyin.",
      status: 400 as const,
    };
  }

  /** Bal vermək istəyə bağlıdır — göndərilməzsə null saxlanılır */
  let rating: number | null = null;
  if (input.rating != null) {
    const parsed = Math.round(Number(input.rating));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
      return { error: "1-5 arası bir bal seçin və ya bu addımı keçin.", status: 400 as const };
    }
    rating = parsed;
  }

  const message = String(input.message || "").trim();
  if (message.length < 3) {
    return { error: "Lütfən mesajınızı yazın.", status: 400 as const };
  }
  if (message.length > 2000) {
    return { error: "Mesaj çox uzundur (maksimum 2000 simvol).", status: 400 as const };
  }

  /** Ad/telefon istəyə bağlıdır — boşdursa anonim sayılır */
  const customerName = String(input.customerName || "").trim().slice(0, 80) || null;
  const customerPhone = String(input.customerPhone || "").trim().slice(0, 30) || null;

  const type: FeedbackTypeValue = input.type === "COMPLAINT" ? "COMPLAINT" : "SUGGESTION";

  const locations = await listFeedbackLocations(box.id);
  const geoCheck = assertInsideFeedbackLocations(
    box.geoEnabled,
    locations,
    input.lat,
    input.lng,
  );
  if (!geoCheck.ok) {
    return { error: geoCheck.error, status: geoCheck.status };
  }
  const matchedLoc = geoCheck.match?.location ?? null;

  const dayKey = istanbulDayKey();
  const usedToday = await prisma.feedbackEntry.count({
    where: { feedbackBoxId: box.id, deviceId, dayKey },
  });
  if (usedToday >= box.dailyLimitPerDevice) {
    return {
      error: `Bu günlük göndərmə haqqınız (${box.dailyLimitPerDevice}) bitdi. Sabah yenidən cəhd edin.`,
      status: 429 as const,
    };
  }

  const now = new Date();
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.feedbackEntry.create({
      data: {
        feedbackBoxId: box.id,
        type,
        rating,
        message,
        customerName,
        customerPhone,
        locationId: matchedLoc?.id ?? null,
        locationName: matchedLoc ? feedbackLocationLabel(matchedLoc) : null,
        deviceId,
        dayKey,
        lat: typeof input.lat === "number" ? input.lat : null,
        lng: typeof input.lng === "number" ? input.lng : null,
        distanceMeters: geoCheck.ok ? geoCheck.distanceMeters : null,
        createdAt: now,
      },
    });
    await tx.feedbackDevice.upsert({
      where: { feedbackBoxId_deviceId: { feedbackBoxId: box.id, deviceId } },
      create: { feedbackBoxId: box.id, deviceId, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now },
    });
    return created;
  });

  return {
    status: 201 as const,
    data: {
      id: entry.id,
      remainingToday: Math.max(0, box.dailyLimitPerDevice - usedToday - 1),
      createdAtLabel: formatIstanbul(entry.createdAt),
    },
  };
}

export type FeedbackEntrySummary = {
  id: string;
  type: FeedbackTypeValue;
  rating: number | null;
  message: string;
  customerName: string | null;
  customerPhone: string | null;
  locationId: string | null;
  locationName: string | null;
  deviceId: string;
  deviceLabel: string | null;
  status: FeedbackStatusValue;
  createdAt: string;
  createdAtLabel: string;
};

type EntryRow = {
  id: string;
  type: string;
  rating: number | null;
  message: string;
  customerName: string | null;
  customerPhone: string | null;
  locationId: string | null;
  locationName: string | null;
  deviceId: string;
  status: string;
  createdAt: Date;
};

export function mapFeedbackEntry(
  r: EntryRow,
  deviceLabel: string | null = null,
): FeedbackEntrySummary {
  return {
    id: r.id,
    type: r.type as FeedbackTypeValue,
    rating: r.rating,
    message: r.message,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    locationId: r.locationId,
    locationName: r.locationName,
    deviceId: r.deviceId,
    deviceLabel,
    status: r.status as FeedbackStatusValue,
    createdAt: r.createdAt.toISOString(),
    createdAtLabel: formatIstanbul(r.createdAt),
  };
}

export type ListFeedbackEntriesFilters = {
  type?: FeedbackTypeValue;
  status?: FeedbackStatusValue;
  locationId?: string;
  deviceId?: string;
  rating?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

function buildFeedbackEntriesWhere(
  feedbackBoxId: string,
  filters: ListFeedbackEntriesFilters,
): Prisma.FeedbackEntryWhereInput {
  const where: Prisma.FeedbackEntryWhereInput = { feedbackBoxId };
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.deviceId) where.deviceId = filters.deviceId;
  if (filters.rating) where.rating = filters.rating;
  if (filters.from || filters.to) {
    where.dayKey = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  return where;
}

async function attachDeviceLabels(
  feedbackBoxId: string,
  rows: { deviceId: string }[],
): Promise<Map<string, string | null>> {
  const deviceIds = Array.from(new Set(rows.map((r) => r.deviceId)));
  const devices = deviceIds.length
    ? await prisma.feedbackDevice.findMany({
        where: { feedbackBoxId, deviceId: { in: deviceIds } },
      })
    : [];
  return new Map(devices.map((d) => [d.deviceId, d.label]));
}

export async function listFeedbackEntries(
  feedbackBoxId: string,
  filters: ListFeedbackEntriesFilters = {},
): Promise<{
  entries: FeedbackEntrySummary[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const where = buildFeedbackEntriesWhere(feedbackBoxId, filters);

  const [rows, total] = await Promise.all([
    prisma.feedbackEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.feedbackEntry.count({ where }),
  ]);

  const labelByDevice = await attachDeviceLabels(feedbackBoxId, rows);

  return {
    entries: rows.map((r) => mapFeedbackEntry(r, labelByDevice.get(r.deviceId) ?? null)),
    total,
    page,
    pageSize,
  };
}

/** Filtrelere uyan tüm gönderimleri (sayfalama olmadan) CSV export için getirir */
export async function listAllFeedbackEntries(
  feedbackBoxId: string,
  filters: Omit<ListFeedbackEntriesFilters, "page" | "pageSize"> = {},
): Promise<FeedbackEntrySummary[]> {
  const where = buildFeedbackEntriesWhere(feedbackBoxId, filters);
  const rows = await prisma.feedbackEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const labelByDevice = await attachDeviceLabels(feedbackBoxId, rows);
  return rows.map((r) => mapFeedbackEntry(r, labelByDevice.get(r.deviceId) ?? null));
}

const TYPE_LABEL_TR: Record<FeedbackTypeValue, string> = {
  SUGGESTION: "Öneri",
  COMPLAINT: "Şikayet",
};
const STATUS_LABEL_TR: Record<FeedbackStatusValue, string> = {
  NEW: "Yeni",
  READ: "Okundu",
  RESOLVED: "Çözüldü",
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function feedbackEntriesToCsv(entries: FeedbackEntrySummary[]): string {
  const header =
    "tarih,tip,puan,mesaj,musteri_adi,musteri_telefon,sube,cihaz,durum\n";
  const body = entries
    .map((e) =>
      [
        e.createdAtLabel,
        TYPE_LABEL_TR[e.type],
        e.rating ?? "",
        csvEscape(e.message),
        csvEscape(e.customerName || "Anonim"),
        csvEscape(e.customerPhone || ""),
        csvEscape(e.locationName || ""),
        csvEscape(e.deviceLabel || e.deviceId),
        STATUS_LABEL_TR[e.status],
      ].join(","),
    )
    .join("\n");
  return header + body;
}

export async function updateFeedbackEntryStatus(
  feedbackBoxId: string,
  entryId: string,
  status: FeedbackStatusValue,
) {
  const result = await prisma.feedbackEntry.updateMany({
    where: { id: entryId, feedbackBoxId },
    data: { status },
  });
  if (result.count === 0) throw new Error("Gönderi bulunamadı.");
  const entry = await prisma.feedbackEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Gönderi bulunamadı.");
  const device = await prisma.feedbackDevice.findUnique({
    where: { feedbackBoxId_deviceId: { feedbackBoxId, deviceId: entry.deviceId } },
  });
  return mapFeedbackEntry(entry, device?.label ?? null);
}
