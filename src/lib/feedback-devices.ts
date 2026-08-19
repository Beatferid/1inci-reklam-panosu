import { prisma } from "@/lib/prisma";
import { formatIstanbul } from "@/lib/day-key";
import { mapFeedbackEntry, type FeedbackEntrySummary } from "@/lib/feedback";

export type FeedbackDeviceSummary = {
  id: string;
  deviceId: string;
  label: string | null;
  firstSeenAt: string;
  firstSeenAtLabel: string;
  lastSeenAt: string;
  lastSeenAtLabel: string;
  totalCount: number;
  suggestionCount: number;
  complaintCount: number;
  avgRating: number | null;
};

/**
 * Bir geri bildirim kutusundaki her cihaz için özet istatistik —
 * "hangi cihazdan ne zaman kaç öneri/şikayet gelmiş" raporlamasının temeli.
 */
export async function listFeedbackDevices(
  feedbackBoxId: string,
): Promise<FeedbackDeviceSummary[]> {
  const devices = await prisma.feedbackDevice.findMany({
    where: { feedbackBoxId },
    orderBy: { lastSeenAt: "desc" },
  });
  if (devices.length === 0) return [];

  const deviceIds = devices.map((d) => d.deviceId);
  const grouped = await prisma.feedbackEntry.groupBy({
    by: ["deviceId", "type"],
    where: { feedbackBoxId, deviceId: { in: deviceIds } },
    _count: { _all: true },
    _avg: { rating: true },
  });

  type Stat = {
    total: number;
    suggestion: number;
    complaint: number;
    ratingSum: number;
    ratingCount: number;
  };
  const statsByDevice = new Map<string, Stat>();
  for (const g of grouped) {
    const cur =
      statsByDevice.get(g.deviceId) ??
      ({ total: 0, suggestion: 0, complaint: 0, ratingSum: 0, ratingCount: 0 } as Stat);
    const count = g._count._all;
    cur.total += count;
    if (g.type === "SUGGESTION") cur.suggestion += count;
    else cur.complaint += count;
    if (g._avg.rating != null) {
      cur.ratingSum += g._avg.rating * count;
      cur.ratingCount += count;
    }
    statsByDevice.set(g.deviceId, cur);
  }

  return devices.map((d) => {
    const s = statsByDevice.get(d.deviceId);
    return {
      id: d.id,
      deviceId: d.deviceId,
      label: d.label,
      firstSeenAt: d.firstSeenAt.toISOString(),
      firstSeenAtLabel: formatIstanbul(d.firstSeenAt),
      lastSeenAt: d.lastSeenAt.toISOString(),
      lastSeenAtLabel: formatIstanbul(d.lastSeenAt),
      totalCount: s?.total ?? 0,
      suggestionCount: s?.suggestion ?? 0,
      complaintCount: s?.complaint ?? 0,
      avgRating:
        s && s.ratingCount > 0 ? Math.round((s.ratingSum / s.ratingCount) * 10) / 10 : null,
    };
  });
}

export async function setFeedbackDeviceLabel(
  feedbackBoxId: string,
  deviceRecordId: string,
  label: string | null,
) {
  const trimmed = label?.trim() || null;
  if (trimmed && trimmed.length > 60) {
    throw new Error("Cihaz etiketi en fazla 60 karakter olabilir.");
  }
  const result = await prisma.feedbackDevice.updateMany({
    where: { id: deviceRecordId, feedbackBoxId },
    data: { label: trimmed },
  });
  if (result.count === 0) throw new Error("Cihaz bulunamadı.");
  return prisma.feedbackDevice.findUnique({ where: { id: deviceRecordId } });
}

/** Bir cihazın tüm geçmişi — "hangi cihazdan ne zaman saat kaçta" drill-down */
export async function listEntriesForDevice(
  feedbackBoxId: string,
  deviceId: string,
): Promise<FeedbackEntrySummary[]> {
  const device = await prisma.feedbackDevice.findUnique({
    where: { feedbackBoxId_deviceId: { feedbackBoxId, deviceId } },
  });
  const entries = await prisma.feedbackEntry.findMany({
    where: { feedbackBoxId, deviceId },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => mapFeedbackEntry(e, device?.label ?? null));
}

export async function getFeedbackDeviceByRecordId(
  feedbackBoxId: string,
  deviceRecordId: string,
) {
  return prisma.feedbackDevice.findFirst({
    where: { id: deviceRecordId, feedbackBoxId },
  });
}
