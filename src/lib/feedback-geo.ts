import { prisma } from "@/lib/prisma";
import { distanceMeters } from "@/lib/geo-math";
import type { PublicLocation } from "@/lib/client-geo";

export type FeedbackLocationRow = {
  id: string;
  feedbackBoxId: string;
  name: string;
  branchName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: boolean;
  sortOrder: number;
};

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function clampCoord(n: unknown, min: number, max: number): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

export function feedbackLocationLabel(loc: {
  name: string;
  branchName?: string | null;
}): string {
  const n = loc.name.trim();
  const b = (loc.branchName || "").trim();
  if (n && b) return `${n} · ${b}`;
  return n || b || "Şöbə";
}

export async function listFeedbackLocations(
  feedbackBoxId: string,
): Promise<FeedbackLocationRow[]> {
  return prisma.feedbackLocation.findMany({
    where: { feedbackBoxId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createFeedbackLocation(
  feedbackBoxId: string,
  input: {
    name: string;
    branchName?: string;
    lat: number;
    lng: number;
    radiusMeters?: number;
  },
): Promise<FeedbackLocationRow> {
  const lat = clampCoord(input.lat, -90, 90);
  const lng = clampCoord(input.lng, -180, 180);
  if (lat == null || lng == null) throw new Error("Geçersiz enlem/boylam.");
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Şube adı gerekli.");
  const branchName = String(input.branchName || "").trim();
  const radiusMeters = clampInt(input.radiusMeters, 30, 5000, 150);
  const max = await prisma.feedbackLocation.aggregate({
    where: { feedbackBoxId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? 0) + 1;
  return prisma.feedbackLocation.create({
    data: {
      feedbackBoxId,
      name,
      branchName,
      lat,
      lng,
      radiusMeters,
      sortOrder,
    },
  });
}

export async function updateFeedbackLocation(
  feedbackBoxId: string,
  locationId: string,
  patch: Partial<{
    name: string;
    branchName: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    active: boolean;
  }>,
): Promise<FeedbackLocationRow> {
  const current = await prisma.feedbackLocation.findFirst({
    where: { id: locationId, feedbackBoxId },
  });
  if (!current) throw new Error("Şube bulunamadı.");
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = String(patch.name).trim();
    if (n) data.name = n;
  }
  if (patch.branchName !== undefined) data.branchName = String(patch.branchName).trim();
  if (patch.lat !== undefined) {
    const v = clampCoord(patch.lat, -90, 90);
    if (v != null) data.lat = v;
  }
  if (patch.lng !== undefined) {
    const v = clampCoord(patch.lng, -180, 180);
    if (v != null) data.lng = v;
  }
  if (patch.radiusMeters !== undefined) {
    data.radiusMeters = clampInt(patch.radiusMeters, 30, 5000, current.radiusMeters);
  }
  if (patch.active !== undefined) data.active = patch.active;

  const updated = await prisma.feedbackLocation.update({
    where: { id: locationId },
    data,
  });

  // Son aktif şube pasife alınırsa konum kilidini otomatik kapat
  const left = await prisma.feedbackLocation.findMany({
    where: { feedbackBoxId },
  });
  if (left.filter((l) => l.active).length === 0) {
    await prisma.feedbackBox.update({
      where: { id: feedbackBoxId },
      data: { geoEnabled: false },
    });
  }
  return updated;
}

export async function deleteFeedbackLocation(
  feedbackBoxId: string,
  locationId: string,
) {
  await prisma.feedbackLocation.deleteMany({
    where: { id: locationId, feedbackBoxId },
  });
  const left = await prisma.feedbackLocation.findMany({
    where: { feedbackBoxId },
  });
  if (left.filter((l) => l.active).length === 0) {
    await prisma.feedbackBox.update({
      where: { id: feedbackBoxId },
      data: { geoEnabled: false },
    });
  }
}

export async function setFeedbackGeoEnabled(
  feedbackBoxId: string,
  enabled: boolean,
) {
  if (enabled) {
    const locs = await prisma.feedbackLocation.findMany({
      where: { feedbackBoxId },
    });
    if (locs.filter((l) => l.active).length === 0) {
      throw new Error("Konum kilidi için en az bir aktif şube ekleyin.");
    }
  }
  await prisma.feedbackBox.update({
    where: { id: feedbackBoxId },
    data: { geoEnabled: enabled },
  });
}

export type FeedbackGeoMatch = {
  location: FeedbackLocationRow;
  distanceMeters: number;
};

export type FeedbackGeoCheckResult =
  | { ok: true; distanceMeters: number; match: FeedbackGeoMatch | null }
  | {
      ok: false;
      error: string;
      status: 403;
      distanceMeters?: number;
      nearest?: FeedbackGeoMatch | null;
    };

/** En yakın aktif şube içinde mi? */
export function assertInsideFeedbackLocations(
  geoEnabled: boolean,
  locations: FeedbackLocationRow[],
  lat: unknown,
  lng: unknown,
): FeedbackGeoCheckResult {
  if (!geoEnabled) return { ok: true, distanceMeters: 0, match: null };
  const active = locations.filter((l) => l.active);
  if (active.length === 0) {
    return {
      ok: false,
      status: 403,
      error: "Şöbə məkanı ayarlanmayıb. Menecerə bildirin.",
    };
  }
  const userLat = clampCoord(lat, -90, 90);
  const userLng = clampCoord(lng, -180, 180);
  if (userLat == null || userLng == null) {
    return {
      ok: false,
      status: 403,
      error: "Məkan lazımdır. Məkan icazəsini açın və şöbədən cəhd edin.",
    };
  }

  let nearest: FeedbackGeoMatch | null = null;
  for (const loc of active) {
    const d = distanceMeters(userLat, userLng, loc.lat, loc.lng);
    if (!nearest || d < nearest.distanceMeters) {
      nearest = { location: loc, distanceMeters: d };
    }
    if (d <= loc.radiusMeters) {
      return {
        ok: true,
        distanceMeters: d,
        match: { location: loc, distanceMeters: d },
      };
    }
  }

  const meters = Math.round(nearest?.distanceMeters ?? 0);
  const label = nearest ? feedbackLocationLabel(nearest.location) : "şöbə";
  return {
    ok: false,
    status: 403,
    nearest,
    distanceMeters: nearest?.distanceMeters,
    error:
      meters >= 1000
        ? `Yalnız şöbədə göndəriş edə bilərsiniz (${label}). Təxminən ${(meters / 1000).toFixed(1)} km uzaqdasınız.`
        : `Yalnız şöbədə göndəriş edə bilərsiniz (${label}). Təxminən ${meters} m uzaqdasınız.`,
  };
}

export function publicFeedbackGeoInfo(
  geoEnabled: boolean,
  locations: FeedbackLocationRow[],
):
  | { geoRequired: false; locations: PublicLocation[] }
  | { geoRequired: true; locations: PublicLocation[] } {
  const active = locations.filter((l) => l.active);
  if (!geoEnabled) {
    return { geoRequired: false, locations: [] };
  }
  return {
    geoRequired: true,
    locations: active.map((l) => ({
      id: l.id,
      name: l.name,
      branchName: l.branchName,
      label: feedbackLocationLabel(l),
      lat: l.lat,
      lng: l.lng,
      radiusMeters: l.radiusMeters,
    })),
  };
}
