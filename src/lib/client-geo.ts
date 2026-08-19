import { distanceMeters } from "@/lib/geo-math";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
};

export type PublicLocation = {
  id: string;
  name: string;
  branchName: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type ClientGeoState =
  | { status: "idle" }
  | { status: "loading"; fix: GeoFix | null }
  | { status: "denied"; message: string; fix: GeoFix | null }
  | { status: "error"; message: string; fix: GeoFix | null }
  | {
      status: "ready";
      fix: GeoFix;
      distanceMeters: number | null;
      inside: boolean;
      matchedLocation: PublicLocation | null;
      nearestLocation: PublicLocation | null;
    };

export function readPosition(opts?: {
  timeoutMs?: number;
}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Bu cihaz məkan (GPS) dəstəkləmir."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: opts?.timeoutMs ?? 20000,
      maximumAge: 0,
    });
  });
}

function toFix(pos: GeolocationPosition): GeoFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy || 0,
    at: Date.now(),
  };
}

export async function checkClientGeo(opts: {
  required: boolean;
  locations?: PublicLocation[];
  previousFix?: GeoFix | null;
}): Promise<ClientGeoState> {
  if (!opts.required) {
    return { status: "idle" };
  }
  const prev = opts.previousFix ?? null;
  const locations = opts.locations || [];
  if (locations.length === 0) {
    return {
      status: "error",
      message:
        "Aktiv filial yoxdur. Admin paneldə aktiv filial əlavə edin.",
      fix: prev,
    };
  }
  try {
    const pos = await readPosition();
    const fix = toFix(pos);
    let matched: PublicLocation | null = null;
    let nearest: PublicLocation | null = null;
    let nearestDist = Infinity;
    let matchDist: number | null = null;

    for (const loc of locations) {
      const d = distanceMeters(fix.lat, fix.lng, loc.lat, loc.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = loc;
      }
      if (d <= loc.radiusMeters && (matchDist == null || d < matchDist)) {
        matchDist = d;
        matched = loc;
      }
    }

    return {
      status: "ready",
      fix,
      distanceMeters: matched
        ? matchDist
        : Number.isFinite(nearestDist)
          ? nearestDist
          : null,
      inside: Boolean(matched),
      matchedLocation: matched,
      nearestLocation: nearest,
    };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? Number((e as GeolocationPositionError).code)
        : 0;
    if (code === 1) {
      return {
        status: "denied",
        message: "Məkan icazəsi bağlıdır. Tənzimləmələrdən açın və yeniləyin.",
        fix: prev,
      };
    }
    return {
      status: "error",
      message: "Məkan alına bilmədi. GPS açıq olduğu halda yenidən cəhd edin.",
      fix: prev,
    };
  }
}

export function formatCoord(n: number): string {
  return n.toFixed(7);
}
