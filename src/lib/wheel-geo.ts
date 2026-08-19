import { prisma } from "@/lib/prisma";
import { distanceMeters } from "@/lib/geo-math";
import { nanoid } from "nanoid";

export { distanceMeters };

export type CampaignLocation = {
  id: string;
  campaignId: string;
  name: string;
  branchName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: boolean;
  sortOrder: number;
};

export type WheelGeoSettings = {
  geoEnabled: boolean;
  /** @deprecated legacy single point — migrated into locations */
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusMeters: number;
  locations: CampaignLocation[];
};

export class WheelGeoUnavailableError extends Error {
  constructor(message = "Konum ayarları okunamadı.") {
    super(message);
    this.name = "WheelGeoUnavailableError";
  }
}

let ensured = false;

async function ensureGeoSchema() {
  if (ensured) return;
  async function columnExists(table: string, col: string) {
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `PRAGMA table_info('${table}')`,
      );
      return rows.some((r) => r && (r.name === col || r.NAME === col));
    } catch {
      return false;
    }
  }

  const campaignCols: [string, string][] = [
    ["Campaign", "geoEnabled"],
    ["Campaign", "geoLat"],
    ["Campaign", "geoLng"],
    ["Campaign", "geoRadiusMeters"],
  ];
  const spinCols: [string, string][] = [
    ["WheelSpin", "locationId"],
    ["WheelSpin", "locationName"],
  ];
  const locationCols: [string, string][] = [
    ["CampaignLocation", "branchName"],
    ["CampaignLocation", "active"],
    ["CampaignLocation", "sortOrder"],
    ["CampaignLocation", "createdAt"],
    ["CampaignLocation", "updatedAt"],
  ];

  for (const [table, col] of [...campaignCols, ...spinCols, ...locationCols]) {
    if (await columnExists(table, col)) continue;
    const sql = table === "Campaign"
      ? col === "geoEnabled"
        ? `ALTER TABLE Campaign ADD COLUMN geoEnabled INTEGER NOT NULL DEFAULT 0`
        : col === "geoLat"
          ? `ALTER TABLE Campaign ADD COLUMN geoLat REAL`
          : col === "geoLng"
            ? `ALTER TABLE Campaign ADD COLUMN geoLng REAL`
            : `ALTER TABLE Campaign ADD COLUMN geoRadiusMeters INTEGER NOT NULL DEFAULT 150`
      : table === "WheelSpin"
        ? col === "locationId"
          ? `ALTER TABLE WheelSpin ADD COLUMN locationId TEXT`
          : `ALTER TABLE WheelSpin ADD COLUMN locationName TEXT`
        : col === "branchName"
          ? `ALTER TABLE CampaignLocation ADD COLUMN branchName TEXT NOT NULL DEFAULT ''`
          : col === "active"
            ? `ALTER TABLE CampaignLocation ADD COLUMN active INTEGER NOT NULL DEFAULT 1`
            : col === "sortOrder"
              ? `ALTER TABLE CampaignLocation ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0`
              : col === "createdAt"
                ? `ALTER TABLE CampaignLocation ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
                : `ALTER TABLE CampaignLocation ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`;
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // ignore if another process created it concurrently
    }
  }
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS CampaignLocation (
        id TEXT PRIMARY KEY NOT NULL,
        campaignId TEXT NOT NULL,
        name TEXT NOT NULL,
        branchName TEXT NOT NULL DEFAULT '',
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        radiusMeters INTEGER NOT NULL DEFAULT 150,
        active INTEGER NOT NULL DEFAULT 1,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES Campaign(id) ON DELETE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS CampaignLocation_campaignId_idx ON CampaignLocation(campaignId)`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE CampaignLocation SET updatedAt = COALESCE(updatedAt, createdAt, CURRENT_TIMESTAMP) WHERE updatedAt IS NULL`,
    );
  } catch {
    // ignore
  }
  ensured = true;
}

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

function mapLoc(row: {
  id: string;
  campaignId: string;
  name: string;
  branchName: string | null;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: number | boolean;
  sortOrder: number;
}): CampaignLocation {
  return {
    id: row.id,
    campaignId: row.campaignId,
    name: String(row.name || "").trim() || "Market",
    branchName: String(row.branchName || "").trim(),
    lat: Number(row.lat),
    lng: Number(row.lng),
    radiusMeters: clampInt(row.radiusMeters, 30, 5000, 150),
    active: row.active === true || Number(row.active) === 1,
    sortOrder: Number(row.sortOrder) || 0,
  };
}

export function locationLabel(loc: {
  name: string;
  branchName?: string | null;
}): string {
  const n = loc.name.trim();
  const b = (loc.branchName || "").trim();
  if (n && b) return `${n} · ${b}`;
  return n || b || "Market";
}

async function listLocationsRaw(
  campaignId: string,
): Promise<CampaignLocation[]> {
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      campaignId: string;
      name: string;
      branchName: string | null;
      lat: number;
      lng: number;
      radiusMeters: number;
      active: number | boolean;
      sortOrder: number;
    }[]
  >(
    `SELECT id, campaignId, name, branchName, lat, lng, radiusMeters, active, sortOrder
     FROM CampaignLocation WHERE campaignId = ?
     ORDER BY sortOrder ASC, createdAt ASC`,
    campaignId,
  );
  return rows.map(mapLoc);
}

/** Eski tek konum → CampaignLocation satırı */
async function migrateLegacyIfNeeded(campaignId: string) {
  const existing = await listLocationsRaw(campaignId);
  if (existing.length > 0) return;
  const rows = await prisma.$queryRawUnsafe<
    {
      geoLat: number | null;
      geoLng: number | null;
      geoRadiusMeters: number | null;
      name: string;
    }[]
  >(
    `SELECT geoLat, geoLng, geoRadiusMeters, name FROM Campaign WHERE id = ?`,
    campaignId,
  );
  const row = rows[0];
  const lat = clampCoord(row?.geoLat, -90, 90);
  const lng = clampCoord(row?.geoLng, -180, 180);
  if (lat == null || lng == null) return;
  const id = nanoid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO CampaignLocation (id, campaignId, name, branchName, lat, lng, radiusMeters, active, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    id,
    campaignId,
    row?.name || "Market",
    "Merkez",
    lat,
    lng,
    clampInt(row?.geoRadiusMeters, 30, 5000, 150),
  );
}

export async function getWheelGeoSettings(
  campaignId: string,
): Promise<WheelGeoSettings> {
  await ensureGeoSchema();
  try {
    await migrateLegacyIfNeeded(campaignId);
    const rows = await prisma.$queryRawUnsafe<
      {
        geoEnabled: number | boolean | null;
        geoLat: number | null;
        geoLng: number | null;
        geoRadiusMeters: number | null;
      }[]
    >(
      `SELECT geoEnabled, geoLat, geoLng, geoRadiusMeters FROM Campaign WHERE id = ?`,
      campaignId,
    );
    const row = rows[0];
    const locations = await listLocationsRaw(campaignId);
    return {
      geoEnabled:
        row?.geoEnabled === true || Number(row?.geoEnabled) === 1,
      geoLat: clampCoord(row?.geoLat, -90, 90),
      geoLng: clampCoord(row?.geoLng, -180, 180),
      geoRadiusMeters: clampInt(row?.geoRadiusMeters, 30, 5000, 150),
      locations,
    };
  } catch (err) {
    if (err instanceof WheelGeoUnavailableError) throw err;
    throw new WheelGeoUnavailableError();
  }
}

export async function setGeoEnabled(campaignId: string, enabled: boolean) {
  await ensureGeoSchema();
  if (enabled) {
    const locs = await listLocationsRaw(campaignId);
    if (locs.filter((l) => l.active).length === 0) {
      throw new Error("Konum kilidi için en az bir aktif market konumu ekleyin.");
    }
  }
  await prisma.$executeRawUnsafe(
    `UPDATE Campaign SET geoEnabled = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    enabled ? 1 : 0,
    campaignId,
  );
}

export async function listCampaignLocations(
  campaignId: string,
): Promise<CampaignLocation[]> {
  await ensureGeoSchema();
  await migrateLegacyIfNeeded(campaignId);
  return listLocationsRaw(campaignId);
}

export async function createCampaignLocation(
  campaignId: string,
  input: {
    name: string;
    branchName?: string;
    lat: number;
    lng: number;
    radiusMeters?: number;
  },
): Promise<CampaignLocation> {
  await ensureGeoSchema();
  const lat = clampCoord(input.lat, -90, 90);
  const lng = clampCoord(input.lng, -180, 180);
  if (lat == null || lng == null) throw new Error("Geçersiz enlem/boylam.");
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Konum / market adı gerekli.");
  const branchName = String(input.branchName || "").trim();
  const radiusMeters = clampInt(input.radiusMeters, 30, 5000, 150);
  const maxSort = await prisma.$queryRawUnsafe<{ m: number | null }[]>(
    `SELECT MAX(sortOrder) as m FROM CampaignLocation WHERE campaignId = ?`,
    campaignId,
  );
  const sortOrder = (Number(maxSort[0]?.m) || 0) + 1;
  const id = nanoid();
  await prisma.$executeRawUnsafe(
    `INSERT INTO CampaignLocation (id, campaignId, name, branchName, lat, lng, radiusMeters, active, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    id,
    campaignId,
    name,
    branchName,
    lat,
    lng,
    radiusMeters,
    sortOrder,
  );
  const rows = await prisma.$queryRawUnsafe<Parameters<typeof mapLoc>[0][]>(
    `SELECT * FROM CampaignLocation WHERE id = ?`,
    id,
  );
  return mapLoc(rows[0]!);
}

export async function updateCampaignLocation(
  campaignId: string,
  locationId: string,
  patch: Partial<{
    name: string;
    branchName: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    active: boolean;
  }>,
): Promise<CampaignLocation> {
  await ensureGeoSchema();
  const current = (await listLocationsRaw(campaignId)).find(
    (l) => l.id === locationId,
  );
  if (!current) throw new Error("Konum bulunamadı.");
  const next = {
    name:
      patch.name !== undefined
        ? String(patch.name).trim() || current.name
        : current.name,
    branchName:
      patch.branchName !== undefined
        ? String(patch.branchName).trim()
        : current.branchName,
    lat:
      patch.lat !== undefined
        ? (clampCoord(patch.lat, -90, 90) ?? current.lat)
        : current.lat,
    lng:
      patch.lng !== undefined
        ? (clampCoord(patch.lng, -180, 180) ?? current.lng)
        : current.lng,
    radiusMeters: clampInt(
      patch.radiusMeters ?? current.radiusMeters,
      30,
      5000,
      150,
    ),
    active: patch.active ?? current.active,
  };
  await prisma.$executeRawUnsafe(
    `UPDATE CampaignLocation SET name = ?, branchName = ?, lat = ?, lng = ?, radiusMeters = ?, active = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND campaignId = ?`,
    next.name,
    next.branchName,
    next.lat,
    next.lng,
    next.radiusMeters,
    next.active ? 1 : 0,
    locationId,
    campaignId,
  );
  // Son aktif konum pasife alınırsa konum kilidini kapat (delete ile aynı)
  const left = await listLocationsRaw(campaignId);
  if (left.filter((l) => l.active).length === 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE Campaign SET geoEnabled = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      campaignId,
    );
  }
  return { ...current, ...next };
}

export async function deleteCampaignLocation(
  campaignId: string,
  locationId: string,
) {
  await ensureGeoSchema();
  await prisma.$executeRawUnsafe(
    `DELETE FROM CampaignLocation WHERE id = ? AND campaignId = ?`,
    locationId,
    campaignId,
  );
  const left = await listLocationsRaw(campaignId);
  if (left.filter((l) => l.active).length === 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE Campaign SET geoEnabled = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      campaignId,
    );
  }
}

export type GeoMatch = {
  location: CampaignLocation;
  distanceMeters: number;
};

export type GeoCheckResult =
  | { ok: true; distanceMeters: number; match: GeoMatch | null }
  | {
      ok: false;
      error: string;
      status: 403;
      distanceMeters?: number;
      nearest?: GeoMatch | null;
    };

/** En yakın aktif konum içinde mi? */
export function assertInsideLocations(
  geoEnabled: boolean,
  locations: CampaignLocation[],
  lat: unknown,
  lng: unknown,
): GeoCheckResult {
  if (!geoEnabled) return { ok: true, distanceMeters: 0, match: null };
  const active = locations.filter((l) => l.active);
  if (active.length === 0) {
    return {
      ok: false,
      status: 403,
      error: "Market məkanı ayarlanmayıb. Menecerə bildirin.",
    };
  }
  const userLat = clampCoord(lat, -90, 90);
  const userLng = clampCoord(lng, -180, 180);
  if (userLat == null || userLng == null) {
    return {
      ok: false,
      status: 403,
      error: "Məkan lazımdır. Məkan icazəsini açın və marketdən cəhd edin.",
    };
  }

  let nearest: GeoMatch | null = null;
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
  const label = nearest ? locationLabel(nearest.location) : "market";
  return {
    ok: false,
    status: 403,
    nearest,
    distanceMeters: nearest?.distanceMeters,
    error:
      meters >= 1000
        ? `Yalnız marketdə oynaya bilərsiniz (${label}). Təxminən ${(meters / 1000).toFixed(1)} km uzaqdasınız.`
        : `Yalnız marketdə oynaya bilərsiniz (${label}). Təxminən ${meters} m uzaqdasınız.`,
  };
}

/** @deprecated compat — use assertInsideLocations */
export function assertInsideGeo(
  geo: WheelGeoSettings,
  lat: unknown,
  lng: unknown,
): GeoCheckResult {
  return assertInsideLocations(geo.geoEnabled, geo.locations, lat, lng);
}

export function publicGeoInfo(geo: WheelGeoSettings) {
  const active = geo.locations.filter((l) => l.active);
  if (!geo.geoEnabled) {
    return {
      geoRequired: false as const,
      locations: [] as {
        id: string;
        name: string;
        branchName: string;
        label: string;
        lat: number;
        lng: number;
        radiusMeters: number;
      }[],
    };
  }
  // geoEnabled açık ama aktif şube yok → kilidi kapatma; oyunu engelle
  return {
    geoRequired: true as const,
    locations: active.map((l) => ({
      id: l.id,
      name: l.name,
      branchName: l.branchName,
      label: locationLabel(l),
      lat: l.lat,
      lng: l.lng,
      radiusMeters: l.radiusMeters,
    })),
  };
}

/** Eski PATCH uyumluluğu: tek nokta kaydı → konum oluştur/güncelle */
export async function setWheelGeoSettings(
  campaignId: string,
  patch: Partial<{
    geoEnabled: boolean;
    geoLat: number | null;
    geoLng: number | null;
    geoRadiusMeters: number;
  }>,
): Promise<WheelGeoSettings> {
  await ensureGeoSchema();
  if (patch.geoEnabled !== undefined) {
    await setGeoEnabled(campaignId, patch.geoEnabled);
  }
  if (patch.geoLat != null && patch.geoLng != null) {
    const locs = await listLocationsRaw(campaignId);
    if (locs.length === 0) {
      await createCampaignLocation(campaignId, {
        name: "Market",
        branchName: "Merkez",
        lat: patch.geoLat,
        lng: patch.geoLng,
        radiusMeters: patch.geoRadiusMeters,
      });
    } else if (
      patch.geoLat !== undefined ||
      patch.geoLng !== undefined ||
      patch.geoRadiusMeters !== undefined
    ) {
      const first = locs[0]!;
      await updateCampaignLocation(campaignId, first.id, {
        lat: patch.geoLat ?? first.lat,
        lng: patch.geoLng ?? first.lng,
        radiusMeters: patch.geoRadiusMeters ?? first.radiusMeters,
      });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE Campaign SET geoLat = ?, geoLng = ?, geoRadiusMeters = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      patch.geoLat,
      patch.geoLng,
      clampInt(patch.geoRadiusMeters, 30, 5000, 150),
      campaignId,
    );
  }
  return getWheelGeoSettings(campaignId);
}
