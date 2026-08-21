import { prisma } from "@/lib/prisma";
import { publicMediaUrl } from "@/lib/storage";
import { normalizeLocale, type Locale } from "@/lib/i18n/locales";

export type WinnersPeriod = "DAY" | "WEEK" | "MONTH";

export type WheelDisplaySettings = {
  wheelShowPrizeNames: boolean;
  wheelEqualSlices: boolean;
  spinCooldownMinutes: number;
  claimWindowMinutes: number;
  /** Müşteri giriş / çevirme — market şifresi */
  spinPin: string;
  requirePin: boolean;
  /** Kasiyer Aldım onayı — ayrı şifre; boşsa PIN sorulmaz */
  claimPin: string;
  requireClaimPin: boolean;
  /** Girişte ad-soyad alanı */
  wheelAskName: boolean;
  /** Ad-soyad zorunlu (askName kapalıysa false) */
  wheelNameRequired: boolean;
  wheelTitle: string;
  wheelLogoPath: string | null;
  wheelLogoUrl: string | null;
  wheelWinnersEnabled: boolean;
  wheelWinnersPeriod: WinnersPeriod;
  wheelDefaultLocale: Locale;
  /** true = çevirmeden sonra QR yeniden okutulmalı */
  wheelRequireQrRescan: boolean;
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

export function normalizeWinnersPeriod(raw: unknown): WinnersPeriod {
  const s = String(raw ?? "").toUpperCase();
  if (s === "WEEK" || s === "MONTH") return s;
  return "DAY";
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
        wheelTitle: true,
        wheelLogoPath: true,
        wheelWinnersEnabled: true,
        wheelWinnersPeriod: true,
        wheelDefaultLocale: true,
        wheelRequireQrRescan: true,
      },
    });
    const spinPin = normalizePin(row?.spinPin);
    const claimPin = normalizePin(row?.claimPin);
    const wheelAskName = Boolean(row?.wheelAskName);
    const logoPath = row?.wheelLogoPath ?? null;
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
      wheelTitle: String(row?.wheelTitle || "").trim().slice(0, 80),
      wheelLogoPath: logoPath,
      wheelLogoUrl: publicMediaUrl(logoPath),
      wheelWinnersEnabled: Boolean(row?.wheelWinnersEnabled),
      wheelWinnersPeriod: normalizeWinnersPeriod(row?.wheelWinnersPeriod),
      wheelDefaultLocale: normalizeLocale(row?.wheelDefaultLocale, "az"),
      wheelRequireQrRescan:
        row?.wheelRequireQrRescan === undefined ||
        row?.wheelRequireQrRescan === null
          ? true
          : Boolean(row.wheelRequireQrRescan),
    };
  } catch (err) {
    if (err instanceof WheelSettingsUnavailableError) throw err;
    throw new WheelSettingsUnavailableError();
  }
}

export async function setWheelDisplaySettings(
  campaignId: string,
  patch: Partial<
    Omit<
      WheelDisplaySettings,
      "requirePin" | "requireClaimPin" | "wheelLogoUrl" | "wheelLogoPath"
    > & {
      spinPin?: string | null;
      claimPin?: string | null;
      wheelLogoPath?: string | null;
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
  const wheelWinnersEnabled =
    patch.wheelWinnersEnabled ?? current.wheelWinnersEnabled;
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
    wheelTitle:
      patch.wheelTitle !== undefined
        ? String(patch.wheelTitle || "").trim().slice(0, 80)
        : current.wheelTitle,
    wheelLogoPath:
      patch.wheelLogoPath !== undefined
        ? patch.wheelLogoPath
        : current.wheelLogoPath,
    wheelLogoUrl: null,
    wheelWinnersEnabled,
    wheelWinnersPeriod:
      patch.wheelWinnersPeriod !== undefined
        ? normalizeWinnersPeriod(patch.wheelWinnersPeriod)
        : current.wheelWinnersPeriod,
    wheelDefaultLocale:
      patch.wheelDefaultLocale !== undefined
        ? normalizeLocale(patch.wheelDefaultLocale, "az")
        : current.wheelDefaultLocale,
    wheelRequireQrRescan:
      patch.wheelRequireQrRescan !== undefined
        ? Boolean(patch.wheelRequireQrRescan)
        : current.wheelRequireQrRescan,
  };
  next.wheelLogoUrl = publicMediaUrl(next.wheelLogoPath);
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
      wheelTitle: next.wheelTitle || null,
      wheelLogoPath: next.wheelLogoPath,
      wheelWinnersEnabled: next.wheelWinnersEnabled,
      wheelWinnersPeriod: next.wheelWinnersPeriod,
      wheelDefaultLocale: next.wheelDefaultLocale,
      wheelRequireQrRescan: next.wheelRequireQrRescan,
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
    wheelTitle: settings.wheelTitle,
    wheelLogoUrl: settings.wheelLogoUrl,
    wheelWinnersEnabled: settings.wheelWinnersEnabled,
    wheelWinnersPeriod: settings.wheelWinnersPeriod,
    wheelDefaultLocale: settings.wheelDefaultLocale,
    wheelRequireQrRescan: settings.wheelRequireQrRescan,
  };
}
