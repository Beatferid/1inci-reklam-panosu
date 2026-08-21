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
  /** Girişte ad-soyad alanı */
  wheelAskName: boolean;
  /** Ad-soyad zorunlu (askName kapalıysa false) */
  wheelNameRequired: boolean;
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

/** Kampanya çark görünüm ayarları */
export async function getWheelDisplaySettings(
  campaignId: string,
): Promise<WheelDisplaySettings> {
  try {
    const row = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        wheelShowPrizeNames: true,
        wheelEqualSlices: true,
        spinCooldownMinutes: true,
        claimWindowMinutes: true,
        spinPin: true,
        claimPin: true,
        wheelAskName: true,
        wheelNameRequired: true,
      },
    });
    const spinPin = normalizePin(row?.spinPin);
    const claimPin = normalizePin(row?.claimPin);
    const wheelAskName = Boolean(row?.wheelAskName);
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
      wheelAskName,
      wheelNameRequired: wheelAskName && Boolean(row?.wheelNameRequired),
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
  const current = await getWheelDisplaySettings(campaignId);
  const nextSpinPin =
    patch.spinPin === undefined
      ? current.spinPin
      : normalizePin(patch.spinPin ?? "");
  const nextClaimPin =
    patch.claimPin === undefined
      ? current.claimPin
      : normalizePin(patch.claimPin ?? "");
  const wheelAskName = patch.wheelAskName ?? current.wheelAskName;
  const wheelNameRequired =
    wheelAskName &&
    (patch.wheelNameRequired !== undefined
      ? Boolean(patch.wheelNameRequired)
      : current.wheelNameRequired);
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
    wheelAskName,
    wheelNameRequired,
  };
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      wheelShowPrizeNames: next.wheelShowPrizeNames,
      wheelEqualSlices: next.wheelEqualSlices,
      spinCooldownMinutes: next.spinCooldownMinutes,
      claimWindowMinutes: next.claimWindowMinutes,
      spinPin: next.spinPin,
      claimPin: next.claimPin,
      wheelAskName: next.wheelAskName,
      wheelNameRequired: next.wheelNameRequired,
    },
  });
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
    wheelAskName: settings.wheelAskName,
    wheelNameRequired: settings.wheelNameRequired,
  };
}
