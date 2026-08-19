import { prisma } from "@/lib/prisma";

export type WheelDisplaySettings = {
  wheelShowPrizeNames: boolean;
  wheelEqualSlices: boolean;
  spinCooldownMinutes: number;
  claimWindowMinutes: number;
  /** Müşteri giriş / çevirme — market şifresi */
  spinPin: string;
  requirePin: boolean;
  /** Kasiyer Aldım onayı — ayrı şifre */
  claimPin: string;
  requireClaimPin: boolean;
};

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function normalizePin(raw: unknown): string {
  const s = String(raw ?? "").replace(/\D/g, "").slice(0, 5);
  return s.length === 5 ? s : "";
}

export class WheelSettingsUnavailableError extends Error {
  constructor(message = "Çark ayarları okunamadı.") {
    super(message);
    this.name = "WheelSettingsUnavailableError";
  }
}

let claimPinEnsured = false;

async function ensureClaimPinColumn() {
  if (claimPinEnsured) return;
  try {
    const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info(Campaign)`,
    );
    const has = cols.some((c) => c.name === "claimPin");
    if (!has) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE Campaign ADD COLUMN claimPin TEXT NOT NULL DEFAULT ''`,
      );
    }
  } catch {
    // ignore
  }
  claimPinEnsured = true;
}

/** SQLite kolonları — Prisma client yenilenmese bile çalışır */
export async function getWheelDisplaySettings(
  campaignId: string,
): Promise<WheelDisplaySettings> {
  await ensureClaimPinColumn();
  try {
    const rows = await prisma.$queryRawUnsafe<
      {
        wheelShowPrizeNames: number | boolean;
        wheelEqualSlices: number | boolean;
        spinCooldownMinutes: number | null;
        claimWindowMinutes: number | null;
        spinPin: string | null;
        claimPin: string | null;
      }[]
    >(
      `SELECT wheelShowPrizeNames, wheelEqualSlices, spinCooldownMinutes, claimWindowMinutes, spinPin, claimPin FROM Campaign WHERE id = ?`,
      campaignId,
    );
    const row = rows[0];
    const spinPin = normalizePin(row?.spinPin);
    const claimPin = normalizePin(row?.claimPin);
    return {
      wheelShowPrizeNames: Boolean(row?.wheelShowPrizeNames),
      wheelEqualSlices:
        row?.wheelEqualSlices === undefined || row?.wheelEqualSlices === null
          ? true
          : Boolean(row.wheelEqualSlices),
      spinCooldownMinutes: clampInt(row?.spinCooldownMinutes, 0, 24 * 60, 0),
      claimWindowMinutes: clampInt(row?.claimWindowMinutes, 0, 24 * 60, 30),
      spinPin,
      requirePin: spinPin.length === 5,
      claimPin,
      requireClaimPin: claimPin.length === 5,
    };
  } catch (err) {
    if (err instanceof WheelSettingsUnavailableError) throw err;
    throw new WheelSettingsUnavailableError();
  }
}

export async function setWheelDisplaySettings(
  campaignId: string,
  patch: Partial<
    Omit<WheelDisplaySettings, "requirePin" | "requireClaimPin"> & {
      spinPin?: string | null;
      claimPin?: string | null;
    }
  >,
): Promise<WheelDisplaySettings> {
  await ensureClaimPinColumn();
  const current = await getWheelDisplaySettings(campaignId);
  const nextSpinPin =
    patch.spinPin === undefined
      ? current.spinPin
      : normalizePin(patch.spinPin ?? "");
  const nextClaimPin =
    patch.claimPin === undefined
      ? current.claimPin
      : normalizePin(patch.claimPin ?? "");
  const next: WheelDisplaySettings = {
    wheelShowPrizeNames:
      patch.wheelShowPrizeNames ?? current.wheelShowPrizeNames,
    wheelEqualSlices: patch.wheelEqualSlices ?? current.wheelEqualSlices,
    spinCooldownMinutes:
      patch.spinCooldownMinutes ?? current.spinCooldownMinutes,
    claimWindowMinutes: patch.claimWindowMinutes ?? current.claimWindowMinutes,
    spinPin: nextSpinPin,
    requirePin: nextSpinPin.length === 5,
    claimPin: nextClaimPin,
    requireClaimPin: nextClaimPin.length === 5,
  };
  await prisma.$executeRawUnsafe(
    `UPDATE Campaign SET wheelShowPrizeNames = ?, wheelEqualSlices = ?, spinCooldownMinutes = ?, claimWindowMinutes = ?, spinPin = ?, claimPin = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    next.wheelShowPrizeNames ? 1 : 0,
    next.wheelEqualSlices ? 1 : 0,
    next.spinCooldownMinutes,
    next.claimWindowMinutes,
    next.spinPin,
    next.claimPin,
    campaignId,
  );
  return next;
}

export function cooldownRemainingMs(
  lastSpinAt: Date | null | undefined,
  minutes: number,
): number {
  if (!minutes || minutes <= 0 || !lastSpinAt) return 0;
  const wait = minutes * 60 * 1000;
  return Math.max(0, wait - (Date.now() - lastSpinAt.getTime()));
}

export function formatCooldownLabel(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s} san`;
  if (s === 0) return `${m} dəq`;
  return `${m} dəq ${s} san`;
}

export function publicWheelSettings(settings: WheelDisplaySettings) {
  return {
    wheelShowPrizeNames: settings.wheelShowPrizeNames,
    wheelEqualSlices: settings.wheelEqualSlices,
    spinCooldownMinutes: settings.spinCooldownMinutes,
    claimWindowMinutes: settings.claimWindowMinutes,
    requirePin: settings.requirePin,
    requireClaimPin: settings.requireClaimPin,
  };
}
