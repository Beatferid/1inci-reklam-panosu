import { prisma } from "@/lib/prisma";
import { bumpCampaignCounter } from "@/lib/campaign-analytics";
import { publicMediaUrl } from "@/lib/storage";
import {
  cooldownRemainingMs,
  getWheelDisplaySettings,
  publicWheelSettings,
  WheelSettingsUnavailableError,
  type WheelDisplaySettings,
} from "@/lib/wheel-display";
import {
  assertInsideLocations,
  getWheelGeoSettings,
  locationLabel,
  WheelGeoUnavailableError,
} from "@/lib/wheel-geo";
import {
  checkPinRateLimit,
  clearPinFailures,
  pinRateKey,
  recordPinFailure,
} from "@/lib/rate-limit";
import {
  WHEEL_TZ,
  normalizeDeviceId,
  istanbulDayKey,
  istanbulWeekBounds,
  istanbulMonthBounds,
  formatIstanbul,
} from "@/lib/day-key";

export {
  WHEEL_TZ,
  normalizeDeviceId,
  istanbulDayKey,
  istanbulWeekBounds,
  istanbulMonthBounds,
  formatIstanbul,
};

function settingsUnavailableResult(err: unknown) {
  if (
    err instanceof WheelSettingsUnavailableError ||
    err instanceof WheelGeoUnavailableError
  ) {
    return {
      error: "Oyun ayarları müvəqqəti əlçatan deyil. Bir az sonra yenidən cəhd edin.",
      status: 503 as const,
    };
  }
  throw err;
}

/** Yerel cep: 0XXXXXXXXX (10 hane) */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("994") && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith("90") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (!digits.startsWith("0") && digits.length === 9) {
    digits = `0${digits}`;
  }
  if (!/^0\d{9}$/.test(digits)) return null;
  return digits;
}

export function formatPhoneDisplay(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("994") && digits.length > 10) digits = digits.slice(3);
  if (digits.startsWith("90") && digits.length > 10) digits = digits.slice(2);
  if (!digits.startsWith("0") && digits.length > 0) digits = `0${digits}`;
  digits = digits.slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 8);
  const d = digits.slice(8, 10);
  let out = a;
  if (b) out += ` ${b}`;
  if (c) out += ` ${c}`;
  if (d) out += ` ${d}`;
  return out.trim();
}

export function maskPhone(phone: string): string {
  const d = normalizePhone(phone) || phone.replace(/\D/g, "");
  if (d.length < 10) return phone;
  return `${d.slice(0, 3)} *** ** ${d.slice(8)}`;
}

/** Ad-soyad: boşlukları sadeleştir, max 80 */
export function normalizeFullName(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return s.length ? s : null;
}

function resolvePlayerName(
  display: WheelDisplaySettings,
  raw: string | null | undefined,
): { fullName: string | null } | { error: string; status: 400 } {
  if (!display.wheelAskName) return { fullName: null };
  const fullName = normalizeFullName(raw);
  if (display.wheelNameRequired && (!fullName || fullName.length < 2)) {
    return {
      error: "Ad və soyad yazın (ən az 2 hərf).",
      status: 400,
    };
  }
  return { fullName };
}

let prizeQuotaColsReady = false;
/** Kolonlar Prisma şemasında — Postgres'te PRAGMA yok */
export async function ensurePrizePeriodQuotaColumns() {
  prizeQuotaColsReady = true;
}

export type WheelSlicePublic = {
  id: string;
  name: string;
  color: string;
  isEmpty: boolean;
  slicePercent: number;
  imageUrl: string | null;
};

type PrizeLike = {
  id: string;
  name: string;
  color: string;
  isEmpty: boolean;
  weight: number;
  imagePath?: string | null;
};

export function prizesToSlices(
  prizes: PrizeLike[],
  opts?: { equalSlices?: boolean },
): WheelSlicePublic[] {
  if (prizes.length === 0) return [];
  const equal = opts?.equalSlices ?? true;

  // Eşit dilim: boş (isEmpty) dahil her aktif dilim eşit pay alır — görünür olsun
  if (equal) {
    const equalPct = 100 / prizes.length;
    return prizes.map((p) => ({
      id: p.id,
      name: p.isEmpty ? p.name || "Boş" : p.name,
      color: p.isEmpty ? p.color || "#F5F0E6" : p.color,
      isEmpty: p.isEmpty,
      slicePercent: equalPct,
      imageUrl: publicMediaUrl(p.imagePath) ?? null,
    }));
  }

  // Ağırlık modu: ağırlığa göre; boş dilim de prizeId ile eşleşir
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  const pct = (w: number) =>
    total > 0
      ? (Math.max(0, w) / total) * 100
      : 100 / prizes.length;
  return prizes.map((p) => ({
    id: p.id,
    name: p.isEmpty ? p.name || "Boş" : p.name,
    color: p.isEmpty ? p.color || "#F5F0E6" : p.color,
    isEmpty: p.isEmpty,
    slicePercent: pct(p.weight),
    imageUrl: publicMediaUrl(p.imagePath) ?? null,
  }));
}

export type WinStatus = "pending" | "claimed" | "cancelled" | "lost";

export type WinSummary = {
  spinId: string;
  prizeId: string;
  prizeName: string;
  imageUrl: string | null;
  won: boolean;
  claimed: boolean;
  cancelled: boolean;
  status: WinStatus;
  claimedAt: string | null;
  claimedAtLabel: string | null;
  cancelledAt: string | null;
  cancelledAtLabel: string | null;
  /** Süre dolunca oyuncu listesinde gösterilir */
  cancelReason?: string | null;
  claimDeadline: string | null;
  claimDeadlineLabel: string | null;
  claimRemainingSeconds: number;
  spunAt: string;
  spunAtLabel: string;
  locationId?: string | null;
  locationName?: string | null;
};

type SpinRow = {
  id: string;
  prizeId: string;
  won: boolean;
  claimedAt: Date | null;
  cancelledAt?: Date | null;
  claimDeadline?: Date | null;
  createdAt: Date;
  locationId?: string | null;
  locationName?: string | null;
  prize: { name: string; imagePath: string | null };
};

function resolveDeadline(
  s: SpinRow,
  claimWindowMinutes: number,
): Date | null {
  if (!s.won) return null;
  if (s.claimDeadline) return s.claimDeadline;
  if (claimWindowMinutes <= 0) return null;
  return new Date(s.createdAt.getTime() + claimWindowMinutes * 60_000);
}

export function canClaimPendingWin(
  s: Pick<SpinRow, "won" | "claimedAt" | "cancelledAt" | "claimDeadline" | "createdAt">,
  claimWindowMinutes = 0,
  now = Date.now(),
): boolean {
  if (!s.won || s.claimedAt || s.cancelledAt) return false;
  const deadline = s.claimDeadline ??
    (claimWindowMinutes > 0
      ? new Date(s.createdAt.getTime() + claimWindowMinutes * 60_000)
      : null);
  if (!deadline) return true;
  return deadline.getTime() > now;
}

export function mapWin(
  s: SpinRow,
  claimWindowMinutes = 0,
): WinSummary {
  const deadline = resolveDeadline(s, claimWindowMinutes);
  const now = Date.now();
  const claimed = Boolean(s.claimedAt);
  const expired =
    !claimed &&
    !s.cancelledAt &&
    Boolean(deadline) &&
    deadline!.getTime() <= now;
  const cancelled = !claimed && (Boolean(s.cancelledAt) || expired);
  let status: WinStatus = "lost";
  if (s.won) {
    if (claimed) status = "claimed";
    else if (cancelled) status = "cancelled";
    else status = "pending";
  }
  const remaining = deadline
    ? Math.max(0, Math.ceil((deadline.getTime() - now) / 1000))
    : 0;

  return {
    spinId: s.id,
    prizeId: s.prizeId,
    prizeName: s.prize.name,
    imageUrl: publicMediaUrl(s.prize.imagePath) ?? null,
    won: s.won,
    claimed,
    cancelled,
    status,
    claimedAt: s.claimedAt?.toISOString() ?? null,
    claimedAtLabel: s.claimedAt ? formatIstanbul(s.claimedAt) : null,
    cancelledAt: s.cancelledAt?.toISOString() ?? (expired ? new Date().toISOString() : null),
    cancelledAtLabel: s.cancelledAt
      ? formatIstanbul(s.cancelledAt)
      : expired
        ? formatIstanbul(new Date())
        : null,
    cancelReason: cancelled ? "Zamanında alınmadı — iptal" : null,
    claimDeadline: deadline?.toISOString() ?? null,
    claimDeadlineLabel: deadline ? formatIstanbul(deadline) : null,
    claimRemainingSeconds: claimed || cancelled ? 0 : remaining,
    spunAt: s.createdAt.toISOString(),
    spunAtLabel: formatIstanbul(s.createdAt),
    locationId: s.locationId ?? null,
    locationName: s.locationName?.trim() || null,
  };
}

const cooldown = new Map<string, number>();

export function checkCooldown(key: string, ms = 2000): boolean {
  const now = Date.now();
  const prev = cooldown.get(key) ?? 0;
  if (now - prev < ms) return false;
  cooldown.set(key, now);
  return true;
}

function pickWeighted<T extends { weight: number; id: string }>(
  items: T[],
): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0 || items.length === 0) return null;
  let r = Math.random() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}

/** Süresi bitmiş alınmamış hediyeleri iptal et → stok geri döner */
export async function expireStaleWins(
  campaignId: string,
  claimWindowMinutes: number,
  playerId?: string,
) {
  if (claimWindowMinutes <= 0) return;
  const now = new Date();
  const cutoff = new Date(now.getTime() - claimWindowMinutes * 60_000);
  if (playerId) {
    await prisma.wheelSpin.updateMany({
      where: {
        campaignId,
        playerId,
        won: true,
        claimedAt: null,
        cancelledAt: null,
        OR: [
          { claimDeadline: { lt: now } },
          { AND: [{ claimDeadline: null }, { createdAt: { lt: cutoff } }] },
        ],
      },
      data: { cancelledAt: now },
    });
    return;
  }
  await prisma.wheelSpin.updateMany({
    where: {
      campaignId,
      won: true,
      claimedAt: null,
      cancelledAt: null,
      OR: [
        { claimDeadline: { lt: now } },
        { AND: [{ claimDeadline: null }, { createdAt: { lt: cutoff } }] },
      ],
    },
    data: { cancelledAt: now },
  });
}

type QuotaTx = {
  wheelPrize: {
    findUnique: typeof prisma.wheelPrize.findUnique;
  };
  wheelSpin: {
    count: typeof prisma.wheelSpin.count;
  };
};

/** Aktif stok: kazanıldı + iptal edilmemiş (alınmasa da rezervde) */
async function countReservedWins(
  tx: QuotaTx,
  campaignId: string,
  prizeId: string,
  dayKey?: string,
) {
  return tx.wheelSpin.count({
    where: {
      campaignId,
      prizeId,
      won: true,
      cancelledAt: null,
      ...(dayKey ? { dayKey } : {}),
    },
  });
}

async function countReservedWinsInRange(
  tx: QuotaTx,
  campaignId: string,
  prizeId: string,
  fromDay: string,
  toDay: string,
) {
  return tx.wheelSpin.count({
    where: {
      campaignId,
      prizeId,
      won: true,
      cancelledAt: null,
      dayKey: { gte: fromDay, lte: toDay },
    },
  });
}

export type PeriodLimits = {
  dailyLimit?: number | null;
  weeklyLimit?: number | null;
  monthlyLimit?: number | null;
  totalLimit?: number | null;
};

export async function fetchPrizePeriodLimits(
  tx: QuotaTx,
  prizeId: string,
): Promise<PeriodLimits> {
  const r = await tx.wheelPrize.findUnique({
    where: { id: prizeId },
    select: {
      dailyLimit: true,
      weeklyLimit: true,
      monthlyLimit: true,
      totalLimit: true,
    },
  });
  return {
    dailyLimit: r?.dailyLimit ?? null,
    weeklyLimit: r?.weeklyLimit ?? null,
    monthlyLimit: r?.monthlyLimit ?? null,
    totalLimit: r?.totalLimit ?? null,
  };
}

export async function setPrizePeriodLimits(
  prizeId: string,
  patch: Partial<PeriodLimits>,
) {
  await ensurePrizePeriodQuotaColumns();
  const cur = await fetchPrizePeriodLimits(prisma, prizeId);
  const next = {
    dailyLimit:
      patch.dailyLimit !== undefined ? patch.dailyLimit : cur.dailyLimit,
    weeklyLimit:
      patch.weeklyLimit !== undefined ? patch.weeklyLimit : cur.weeklyLimit,
    monthlyLimit:
      patch.monthlyLimit !== undefined ? patch.monthlyLimit : cur.monthlyLimit,
    totalLimit:
      patch.totalLimit !== undefined ? patch.totalLimit : cur.totalLimit,
  };
  await prisma.wheelPrize.update({
    where: { id: prizeId },
    data: {
      dailyLimit: next.dailyLimit,
      weeklyLimit: next.weeklyLimit,
      monthlyLimit: next.monthlyLimit,
      totalLimit: next.totalLimit,
    },
  });
}

/** true = kota dolu, dilim seçilmesin */
async function isPrizePeriodQuotaFull(
  tx: QuotaTx,
  campaignId: string,
  prizeId: string,
  limits: PeriodLimits,
  dayKey: string,
  week: { from: string; to: string },
  month: { from: string; to: string },
): Promise<boolean> {
  if (limits.dailyLimit != null) {
    const c = await countReservedWins(tx, campaignId, prizeId, dayKey);
    if (c >= limits.dailyLimit) return true;
  }
  if (limits.weeklyLimit != null) {
    const c = await countReservedWinsInRange(
      tx,
      campaignId,
      prizeId,
      week.from,
      week.to,
    );
    if (c >= limits.weeklyLimit) return true;
  }
  if (limits.monthlyLimit != null) {
    const c = await countReservedWinsInRange(
      tx,
      campaignId,
      prizeId,
      month.from,
      month.to,
    );
    if (c >= limits.monthlyLimit) return true;
  }
  if (limits.totalLimit != null) {
    const c = await countReservedWins(tx, campaignId, prizeId);
    if (c >= limits.totalLimit) return true;
  }
  return false;
}

/** Eşzamanlı yarış sonrası: kota aşıldı mı (strict >) */
async function isPrizePeriodQuotaOver(
  tx: QuotaTx,
  campaignId: string,
  prizeId: string,
  limits: PeriodLimits,
  dayKey: string,
  week: { from: string; to: string },
  month: { from: string; to: string },
): Promise<boolean> {
  if (limits.dailyLimit != null) {
    const c = await countReservedWins(tx, campaignId, prizeId, dayKey);
    if (c > limits.dailyLimit) return true;
  }
  if (limits.weeklyLimit != null) {
    const c = await countReservedWinsInRange(
      tx,
      campaignId,
      prizeId,
      week.from,
      week.to,
    );
    if (c > limits.weeklyLimit) return true;
  }
  if (limits.monthlyLimit != null) {
    const c = await countReservedWinsInRange(
      tx,
      campaignId,
      prizeId,
      month.from,
      month.to,
    );
    if (c > limits.monthlyLimit) return true;
  }
  if (limits.totalLimit != null) {
    const c = await countReservedWins(tx, campaignId, prizeId);
    if (c > limits.totalLimit) return true;
  }
  return false;
}

async function countDeviceSpinsToday(
  campaignId: string,
  deviceId: string,
  dayKey: string,
) {
  return prisma.wheelSpin.count({
    where: { campaignId, deviceId, dayKey },
  });
}

async function findDevicePhoneToday(
  campaignId: string,
  deviceId: string,
  dayKey: string,
): Promise<string | null> {
  const row = await prisma.wheelSpin.findFirst({
    where: { campaignId, deviceId, dayKey },
    orderBy: { createdAt: "asc" },
    include: { player: true },
  });
  return row?.player.phone ?? null;
}

async function assertSinglePhonePerDeviceToday(
  campaignId: string,
  deviceId: string,
  phone: string,
  dayKey: string,
): Promise<{ error: string; status: 403 } | null> {
  const lockedPhone = await findDevicePhoneToday(campaignId, deviceId, dayKey);
  if (lockedPhone && lockedPhone !== phone) {
    const lockedDisplay = formatPhoneDisplay(lockedPhone);
    return {
      error:
        `Bu cihazda bu gün ${lockedDisplay} nömrəsi ilə oyun istifadə olunub. Eyni gün ərzində eyni cihaz üçün yalnız bir telefon nömrəsi keçərlidir; sabah avtomatik sıfırlanır.`,
      status: 403,
    };
  }
  return null;
}

type AuthOpts = {
  deviceId?: string | null;
  pin?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** PIN rate-limit için istemci IP (deviceId değil) */
  clientIp?: string | null;
  fullName?: string | null;
};

function checkPin(
  display: WheelDisplaySettings,
  pinRaw: string | null | undefined,
  slug: string,
  clientIp?: string | null,
) {
  if (!display.requirePin) return null;
  const rateKey = pinRateKey(slug, (clientIp || "unknown").slice(0, 64));
  const limited = checkPinRateLimit(rateKey);
  if (!limited.ok) {
    return {
      error: `Çox səhv şifrə. ${limited.retryAfterSec ?? 60} saniyə sonra yenidən cəhd edin.`,
      status: 429 as const,
    };
  }
  const pin = String(pinRaw ?? "").replace(/\D/g, "");
  if (pin !== display.spinPin) {
    recordPinFailure(rateKey);
    return {
      error: "Şifrə yanlışdır.",
      status: 401 as const,
    };
  }
  clearPinFailures(rateKey);
  return null;
}

/** Aldım / kasa teslimi — kasiyer PIN (claimPin), market spinPin'den ayrı */
function checkClaimPin(
  display: WheelDisplaySettings,
  pinRaw: string | null | undefined,
  slug: string,
  clientIp?: string | null,
) {
  if (!display.claimPin || display.claimPin.length !== 5) {
    return {
      error:
        "Kassir şifrəsi təyin edilməyib. Admin paneldə ayrı 5 rəqəmli kassir şifrəsi yazın.",
      status: 400 as const,
    };
  }
  const rateKey = pinRateKey(`claim:${slug}`, (clientIp || "unknown").slice(0, 64));
  const limited = checkPinRateLimit(rateKey);
  if (!limited.ok) {
    return {
      error: `Çox səhv şifrə. ${limited.retryAfterSec ?? 60} saniyə sonra yenidən cəhd edin.`,
      status: 429 as const,
    };
  }
  const pin = String(pinRaw ?? "").replace(/\D/g, "");
  if (pin.length !== 5 || pin !== display.claimPin) {
    recordPinFailure(rateKey);
    return {
      error: "Kassir şifrəsi yanlışdır.",
      status: 401 as const,
    };
  }
  clearPinFailures(rateKey);
  return null;
}

export async function getWheelSession(
  slug: string,
  phoneRaw: string,
  opts: AuthOpts = {},
) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return {
      error: "Düzgün telefon nömrəsi daxil edin (məs. 0XX XXX XX XX).",
      status: 400 as const,
    };
  }

  const deviceId = normalizeDeviceId(opts.deviceId);
  if (!deviceId) {
    return {
      error: "Cihaz kimliyi tapılmadı. Səhifəni yeniləyin.",
      status: 400 as const,
    };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      prizes: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!campaign || !campaign.wheelEnabled) {
    return { error: "Çarx bu kampaniyada aktiv deyil.", status: 404 as const };
  }

  let display: WheelDisplaySettings;
  let geo: Awaited<ReturnType<typeof getWheelGeoSettings>>;
  try {
    display = await getWheelDisplaySettings(campaign.id);
    geo = await getWheelGeoSettings(campaign.id);
  } catch (err) {
    return settingsUnavailableResult(err);
  }
  const pinErr = checkPin(display, opts.pin, slug, opts.clientIp);
  if (pinErr) return pinErr;

  const nameResolved = resolvePlayerName(display, opts.fullName);
  if ("error" in nameResolved) return nameResolved;
  const fullName = nameResolved.fullName;

  const geoCheck = assertInsideLocations(
    geo.geoEnabled,
    geo.locations,
    opts.lat,
    opts.lng,
  );
  if (!geoCheck.ok) {
    return { error: geoCheck.error, status: geoCheck.status };
  }

  const dayKey = istanbulDayKey();
  const singlePhoneLock = await assertSinglePhonePerDeviceToday(
    campaign.id,
    deviceId,
    phone,
    dayKey,
  );
  if (singlePhoneLock) {
    return singlePhoneLock;
  }

  // Stale kazanımları (claim süresi dolmuş) session'da da temizle —
  // aksi halde kota dolu kalır ve yeni ödül dağıtılamaz.
  await expireStaleWins(campaign.id, display.claimWindowMinutes);

  let player = await prisma.wheelPlayer.findUnique({
    where: {
      campaignId_phone: { campaignId: campaign.id, phone },
    },
  });

  if (display.wheelAskName) {
    player = await prisma.wheelPlayer.upsert({
      where: {
        campaignId_phone: { campaignId: campaign.id, phone },
      },
      create: {
        campaignId: campaign.id,
        phone,
        fullName,
      },
      update:
        fullName != null
          ? { fullName }
          : player?.fullName
            ? {}
            : { fullName: null },
    });
  }

  const phoneSpins = player
    ? await prisma.wheelSpin.count({
        where: { campaignId: campaign.id, playerId: player.id, dayKey },
      })
    : 0;
  const deviceSpins = await countDeviceSpinsToday(
    campaign.id,
    deviceId,
    dayKey,
  );
  const usedToday = Math.max(phoneSpins, deviceSpins);
  const spinsLeftToday = Math.max(
    0,
    campaign.spinsPerPlayerPerDay - usedToday,
  );

  const winsRaw = player
    ? await prisma.wheelSpin.findMany({
        where: { campaignId: campaign.id, playerId: player.id },
        include: { prize: true },
        orderBy: { createdAt: "desc" },
        take: 40,
      })
    : [];

  const enriched: SpinRow[] = winsRaw.map((s) => ({
    ...s,
    cancelledAt: s.cancelledAt ?? null,
    claimDeadline: s.claimDeadline ?? null,
    locationId: s.locationId ?? null,
    locationName: s.locationName?.trim() || null,
  }));

  const wins = enriched.map((w) => mapWin(w, display.claimWindowMinutes));
  const pendingWins = wins.filter((w) => w.status === "pending");
  const claimedWins = wins.filter((w) => w.status === "claimed");
  const cancelledWins = wins.filter((w) => w.status === "cancelled");
  const lastRealWin = wins.find((w) => w.won && w.status !== "cancelled") ?? null;

  // Cooldown yalnız bugünkü çevirmelerden — yeni günde haklar taze başlar
  const lastSpinTodayAt =
    winsRaw.find((w) => w.dayKey === dayKey)?.createdAt ?? null;
  const cooldownMs = cooldownRemainingMs(
    lastSpinTodayAt,
    display.spinCooldownMinutes,
  );
  const canSpin =
    spinsLeftToday > 0 &&
    cooldownMs <= 0 &&
    campaign.prizes.length > 0;

  const pub = publicWheelSettings(display);

  // Giriş sayacı: telefon başına günde 1 (yenilemeler şişirmesin)
  const sessionMeta = `wheel_session:${dayKey}:${phone}`;
  const alreadySession = await prisma.analyticsEvent.findFirst({
    where: {
      campaignId: campaign.id,
      type: "target_found",
      meta: sessionMeta,
    },
  });
  if (!alreadySession) {
    void bumpCampaignCounter(campaign.id, "target_found", sessionMeta);
  }

  return {
    status: 200 as const,
    data: {
      phone,
      phoneDisplay: formatPhoneDisplay(phone),
      fullName: player?.fullName ?? fullName ?? null,
      askName: display.wheelAskName,
      nameRequired: display.wheelNameRequired,
      spinsPerPlayerPerDay: campaign.spinsPerPlayerPerDay,
      spinsUsedToday: usedToday,
      spinsLeftToday,
      canSpin,
      spinCooldownMinutes: display.spinCooldownMinutes,
      claimWindowMinutes: display.claimWindowMinutes,
      requirePin: display.requirePin,
      requireClaimPin: display.requireClaimPin,
      nextSpinInSeconds: Math.ceil(cooldownMs / 1000),
      blockReason:
        spinsLeftToday <= 0
          ? ("daily" as const)
          : cooldownMs > 0
            ? ("cooldown" as const)
            : null,
      lastRealWin,
      pendingWins,
      claimedWins,
      cancelledWins,
      wins,
      showPrizeNames: pub.wheelShowPrizeNames,
      equalSlices: pub.wheelEqualSlices,
      locationId: geoCheck.match?.location.id ?? null,
      locationName: geoCheck.match
        ? locationLabel(geoCheck.match.location)
        : null,
      slices: prizesToSlices(campaign.prizes, {
        equalSlices: display.wheelEqualSlices,
      }),
    },
  };
}

export async function spinWheel(
  slug: string,
  phoneRaw: string,
  opts: AuthOpts = {},
) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return {
      error: "Düzgün telefon nömrəsi daxil edin (məs. 0XX XXX XX XX).",
      status: 400 as const,
    };
  }

  const deviceId = normalizeDeviceId(opts.deviceId);
  if (!deviceId) {
    return {
      error: "Cihaz kimliyi tapılmadı. Səhifəni yeniləyin.",
      status: 400 as const,
    };
  }

  if (!checkCooldown(`spin:${slug}:${deviceId}`)) {
    return { error: "Çox tez. Bir saniyə gözləyin.", status: 429 as const };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      prizes: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!campaign || !campaign.wheelEnabled) {
    return { error: "Çarx bu kampaniyada aktiv deyil.", status: 404 as const };
  }

  if (campaign.prizes.length === 0) {
    return { error: "Hədiyyələr hələ təyin edilməyib.", status: 400 as const };
  }

  let display: WheelDisplaySettings;
  let geo: Awaited<ReturnType<typeof getWheelGeoSettings>>;
  try {
    display = await getWheelDisplaySettings(campaign.id);
    geo = await getWheelGeoSettings(campaign.id);
  } catch (err) {
    return settingsUnavailableResult(err);
  }
  const pinErr = checkPin(display, opts.pin, slug, opts.clientIp);
  if (pinErr) return pinErr;

  const nameResolved = resolvePlayerName(display, opts.fullName);
  if ("error" in nameResolved) return nameResolved;
  const fullName = nameResolved.fullName;

  const geoCheck = assertInsideLocations(
    geo.geoEnabled,
    geo.locations,
    opts.lat,
    opts.lng,
  );
  if (!geoCheck.ok) {
    return { error: geoCheck.error, status: geoCheck.status };
  }
  const matchedLoc = geoCheck.match?.location ?? null;
  const matchedLocName = matchedLoc ? locationLabel(matchedLoc) : null;

  await ensurePrizePeriodQuotaColumns();
  const dayKey = istanbulDayKey();
  const weekBounds = istanbulWeekBounds();
  const monthBounds = istanbulMonthBounds();
  const singlePhoneLock = await assertSinglePhonePerDeviceToday(
    campaign.id,
    deviceId,
    phone,
    dayKey,
  );
  if (singlePhoneLock) {
    return singlePhoneLock;
  }

  // Süresi dolmuş rezervleri serbest bırak (stok geri gelsin)
  await expireStaleWins(campaign.id, display.claimWindowMinutes);

  type SpinTxResult =
    | {
        limited: true;
        reason: "daily" | "cooldown";
        lastRealWin: ReturnType<typeof mapWin> | null;
        spinsLeftToday: number;
        nextSpinInSeconds: number;
        spinCooldownMinutes: number;
      }
    | {
        limited: false;
        spin: Record<string, unknown>;
        spinsLeftToday: number;
        canSpin: boolean;
        nextSpinInSeconds: number;
        spinCooldownMinutes: number;
        claimWindowMinutes: number;
        blockReason: "daily" | "cooldown" | null;
      };

  let result: SpinTxResult;
  try {
    result = await prisma.$transaction(async (tx) => {
    const player = await tx.wheelPlayer.upsert({
      where: {
        campaignId_phone: { campaignId: campaign.id, phone },
      },
      create: {
        campaignId: campaign.id,
        phone,
        ...(display.wheelAskName ? { fullName } : {}),
      },
      update:
        display.wheelAskName && fullName != null ? { fullName } : {},
    });

    const phoneSpins = await tx.wheelSpin.count({
      where: { campaignId: campaign.id, playerId: player.id, dayKey },
    });
    const deviceSpins = await tx.wheelSpin.count({
      where: { campaignId: campaign.id, deviceId, dayKey },
    });
    const todaySpins = Math.max(phoneSpins, deviceSpins);

    if (todaySpins >= campaign.spinsPerPlayerPerDay) {
      const lastWin = await tx.wheelSpin.findFirst({
        where: { campaignId: campaign.id, playerId: player.id, won: true },
        include: { prize: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        limited: true as const,
        reason: "daily" as const,
        lastRealWin: lastWin
          ? mapWin(lastWin as SpinRow, display.claimWindowMinutes)
          : null,
        spinsLeftToday: 0,
        nextSpinInSeconds: 0,
        spinCooldownMinutes: display.spinCooldownMinutes,
      };
    }

    // Cooldown yalnız bugünkü dayKey — yarın haklar 0'dan başlar
    const lastSpinToday = await tx.wheelSpin.findFirst({
      where: { campaignId: campaign.id, playerId: player.id, dayKey },
      orderBy: { createdAt: "desc" },
    });
    const cooldownMs = cooldownRemainingMs(
      lastSpinToday?.createdAt,
      display.spinCooldownMinutes,
    );
    if (cooldownMs > 0) {
      return {
        limited: true as const,
        reason: "cooldown" as const,
        lastRealWin: null,
        spinsLeftToday: Math.max(
          0,
          campaign.spinsPerPlayerPerDay - todaySpins,
        ),
        nextSpinInSeconds: Math.ceil(cooldownMs / 1000),
        spinCooldownMinutes: display.spinCooldownMinutes,
      };
    }

    const emptyPrize =
      campaign.prizes.find((p) => p.isEmpty && p.active) ||
      campaign.prizes.find((p) => p.isEmpty) ||
      null;

    const pool: typeof campaign.prizes = [];
    for (const prize of campaign.prizes) {
      if (prize.isEmpty) {
        pool.push(prize);
        continue;
      }
      const limits = await fetchPrizePeriodLimits(tx, prize.id);
      const full = await isPrizePeriodQuotaFull(
        tx,
        campaign.id,
        prize.id,
        limits,
        dayKey,
        weekBounds,
        monthBounds,
      );
      if (full) continue;
      pool.push(prize);
    }

    // Ağırlık/kota havuzu boşsa yalnızca boş dilim; gerçek ödüle düşme
    let chosen = pickWeighted(pool) || emptyPrize;
    if (!chosen) {
      throw new Error("NO_PRIZE_AVAILABLE");
    }

    if (!chosen.isEmpty) {
      const limits = await fetchPrizePeriodLimits(tx, chosen.id);
      const full = await isPrizePeriodQuotaFull(
        tx,
        campaign.id,
        chosen.id,
        limits,
        dayKey,
        weekBounds,
        monthBounds,
      );
      if (full) {
        if (!emptyPrize) {
          throw new Error("NO_PRIZE_AVAILABLE");
        }
        chosen = emptyPrize;
      }
    }

    let won = !chosen.isEmpty;
    const claimDeadline =
      won && display.claimWindowMinutes > 0
        ? new Date(Date.now() + display.claimWindowMinutes * 60_000)
        : null;

    // deviceId + filial atomik yazılsın (yarış koşulunda hak kaçırmasın)
    let spin = await tx.wheelSpin.create({
      data: {
        campaignId: campaign.id,
        playerId: player.id,
        prizeId: chosen.id,
        won,
        dayKey,
        deviceId,
        locationId: matchedLoc?.id ?? null,
        locationName: matchedLocName,
        claimDeadline,
      },
      include: { prize: true },
    });

    // Eşzamanlı: günlük hak aşıldıysa bu çevirmeyi geri al
    const phoneAfter = await tx.wheelSpin.count({
      where: { campaignId: campaign.id, playerId: player.id, dayKey },
    });
    const deviceAfter = await tx.wheelSpin.count({
      where: { campaignId: campaign.id, deviceId, dayKey },
    });
    if (Math.max(phoneAfter, deviceAfter) > campaign.spinsPerPlayerPerDay) {
      await tx.wheelSpin.delete({ where: { id: spin.id } });
      return {
        limited: true as const,
        reason: "daily" as const,
        lastRealWin: null,
        spinsLeftToday: 0,
        nextSpinInSeconds: 0,
        spinCooldownMinutes: display.spinCooldownMinutes,
      };
    }

    // Eşzamanlı yarış: hediye kotası aşıldıysa boş dilime çevir
    if (won) {
      const limitsAfter = await fetchPrizePeriodLimits(tx, chosen.id);
      const over = await isPrizePeriodQuotaOver(
        tx,
        campaign.id,
        chosen.id,
        limitsAfter,
        dayKey,
        weekBounds,
        monthBounds,
      );
      if (over) {
        won = false;
        if (emptyPrize) {
          spin = await tx.wheelSpin.update({
            where: { id: spin.id },
            data: {
              prizeId: emptyPrize.id,
              won: false,
              claimDeadline: null,
            },
            include: { prize: true },
          });
          chosen = emptyPrize;
        } else {
          // Kota aşımı: iptal sayacı şişmesin diye cancelledAt yazma
          spin = await tx.wheelSpin.update({
            where: { id: spin.id },
            data: {
              won: false,
              claimDeadline: null,
            },
            include: { prize: true },
          });
        }
      }
    }

    const spinsLeftToday = Math.max(
      0,
      campaign.spinsPerPlayerPerDay - Math.max(phoneAfter, deviceAfter),
    );
    const nextCd = display.spinCooldownMinutes * 60;
    const winSummary = mapWin(
      {
        ...spin,
        cancelledAt: null,
        claimDeadline,
      },
      display.claimWindowMinutes,
    );

    return {
      limited: false as const,
      spin: {
        spinId: spin.id,
        prizeId: spin.prize.id,
        prizeName: won
          ? spin.prize.name
          : spin.prize.isEmpty
            ? spin.prize.name
            : "Boş",
        color: spin.prize.color,
        imageUrl: won ? publicMediaUrl(spin.prize.imagePath) ?? null : null,
        isEmpty: !won,
        won,
        spunAt: spin.createdAt.toISOString(),
        spunAtLabel: formatIstanbul(spin.createdAt),
        claimDeadline: winSummary.claimDeadline,
        claimDeadlineLabel: winSummary.claimDeadlineLabel,
        claimRemainingSeconds: winSummary.claimRemainingSeconds,
        claimWindowMinutes: display.claimWindowMinutes,
        locationId: matchedLoc?.id ?? null,
        locationName: matchedLocName,
      },
      spinsLeftToday,
      canSpin: spinsLeftToday > 0 && nextCd <= 0,
      nextSpinInSeconds: spinsLeftToday > 0 ? nextCd : 0,
      spinCooldownMinutes: display.spinCooldownMinutes,
      claimWindowMinutes: display.claimWindowMinutes,
      blockReason:
        spinsLeftToday <= 0
          ? ("daily" as const)
          : nextCd > 0
            ? ("cooldown" as const)
            : null,
    };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_PRIZE_AVAILABLE") {
      return {
        error: "Hazırda verilə biləcək hədiyyə qalmayıb. Sonra yenidən cəhd edin.",
        status: 409 as const,
      };
    }
    throw err;
  }

  // Yalnız gerçek çevirmede say (daily/cooldown engeli play şişirmesin)
  if (!("limited" in result) || !result.limited) {
    void bumpCampaignCounter(campaign.id, "play", "wheel_spin");
  }

  return { status: 200 as const, data: result };
}

export async function claimPrize(
  slug: string,
  phoneRaw: string,
  spinId: string,
  opts: AuthOpts = {},
) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return {
      error: "Düzgün telefon nömrəsi daxil edin (məs. 0XX XXX XX XX).",
      status: 400 as const,
    };
  }

  if (!checkCooldown(`claim:${slug}:${phone}:${spinId}`, 1500)) {
    return { error: "Çox tez. Bir saniyə gözləyin.", status: 429 as const };
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign || !campaign.wheelEnabled) {
    return { error: "Kampaniya tapılmadı.", status: 404 as const };
  }

  let display: WheelDisplaySettings;
  try {
    display = await getWheelDisplaySettings(campaign.id);
  } catch (err) {
    return settingsUnavailableResult(err);
  }

  // Aldım: kasiyer market PIN zorunlu (giriş PIN ayarından bağımsız)
  const pinErr = checkClaimPin(display, opts.pin, slug, opts.clientIp);
  if (pinErr) return pinErr;

  const player = await prisma.wheelPlayer.findUnique({
    where: {
      campaignId_phone: { campaignId: campaign.id, phone },
    },
  });
  if (!player) {
    return { error: "Qeyd tapılmadı.", status: 404 as const };
  }

  const result = await prisma.$transaction(async (tx) => {
    const spin = await tx.wheelSpin.findFirst({
      where: {
        id: spinId,
        campaignId: campaign.id,
        playerId: player.id,
        won: true,
      },
      include: { prize: true },
    });

    if (!spin) {
      return { status: 404 as const, error: "Hədiyyə qeydi tapılmadı." };
    }

    const row: SpinRow = {
      ...spin,
      cancelledAt: spin.cancelledAt ?? null,
      claimDeadline: spin.claimDeadline ?? null,
    };

    if (spin.claimedAt) {
      return {
        status: 200 as const,
        data: {
          alreadyClaimed: true as const,
          win: mapWin(row, display.claimWindowMinutes),
        },
      };
    }

    if (row.cancelledAt) {
      return {
        status: 410 as const,
        error: "Vaxtında götürülmədi — ləğv edildi.",
      };
    }

    const now = Date.now();
    const canClaim = canClaimPendingWin(row, display.claimWindowMinutes, now);
    if (!canClaim) {
      await tx.wheelSpin.updateMany({
        where: {
          id: spin.id,
          claimedAt: null,
          cancelledAt: null,
        },
        data: { cancelledAt: new Date() },
      });
      return {
        status: 410 as const,
        error: "Vaxtında götürülmədi — ləğv edildi.",
      };
    }

    const claimedAt = new Date();
    const claimed = await tx.wheelSpin.updateMany({
      where: {
        id: spin.id,
        claimedAt: null,
        cancelledAt: null,
        won: true,
      },
      data: { claimedAt, cancelledAt: null },
    });

    if (claimed.count === 0) {
      const again = await tx.wheelSpin.findUnique({
        where: { id: spin.id },
        include: { prize: true },
      });
      if (again?.claimedAt) {
        return {
          status: 200 as const,
          data: {
            alreadyClaimed: true as const,
            win: mapWin(
              {
                ...again,
                cancelledAt: null,
                claimDeadline: row.claimDeadline,
              },
              display.claimWindowMinutes,
            ),
          },
        };
      }
      return {
        status: 409 as const,
        error: "Hədiyyə statusu dəyişdi. Səhifəni yeniləyib yenidən cəhd edin.",
      };
    }

    const updated = await tx.wheelSpin.findUniqueOrThrow({
      where: { id: spin.id },
      include: { prize: true },
    });

    return {
      status: 200 as const,
      data: {
        alreadyClaimed: false as const,
        win: mapWin(
          { ...updated, cancelledAt: null, claimDeadline: row.claimDeadline },
          display.claimWindowMinutes,
        ),
      },
    };
  });

  if (result.status !== 200) {
    return {
      status: result.status,
      error: result.error,
    };
  }

  return result;
}
