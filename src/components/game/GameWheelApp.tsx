"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import GameWheel, { type WheelSlice } from "@/components/game/GameWheel";
import WinShowcase from "@/components/game/WinShowcase";
import EmptyShowcase from "@/components/game/EmptyShowcase";
import {
  SPIN_DURATION_MS,
  playClick,
  playLose,
  playSpinStart,
  playWin,
  startSpinTicks,
  unlockGameAudio,
} from "@/lib/game-sounds";
import {
  checkClientGeo,
  formatCoord,
  type ClientGeoState,
  type GeoFix,
  type PublicLocation,
} from "@/lib/client-geo";
import { distanceMeters } from "@/lib/geo-math";
import { prizeTargetRotation } from "@/lib/wheel-angle";

export type { WheelSlice };

type WinSummary = {
  spinId: string;
  prizeId: string;
  prizeName: string;
  imageUrl: string | null;
  won: boolean;
  claimed: boolean;
  cancelled?: boolean;
  status?: "pending" | "claimed" | "cancelled" | "lost";
  claimedAt: string | null;
  claimedAtLabel: string | null;
  cancelledAt?: string | null;
  cancelledAtLabel?: string | null;
  cancelReason?: string | null;
  claimDeadline?: string | null;
  claimDeadlineLabel?: string | null;
  claimRemainingSeconds?: number;
  spunAt: string;
  spunAtLabel: string;
  locationId?: string | null;
  locationName?: string | null;
};

type SessionData = {
  phone: string;
  spinsLeftToday: number;
  spinsPerPlayerPerDay?: number;
  canSpin: boolean;
  spinCooldownMinutes?: number;
  claimWindowMinutes?: number;
  requirePin?: boolean;
  requireClaimPin?: boolean;
  nextSpinInSeconds?: number;
  blockReason?: "daily" | "cooldown" | null;
  pendingWins: WinSummary[];
  claimedWins?: WinSummary[];
  cancelledWins?: WinSummary[];
  wins: WinSummary[];
  slices: WheelSlice[];
  showPrizeNames?: boolean;
};

type SpinResult = {
  limited?: boolean;
  reason?: "daily" | "cooldown";
  spin?: {
    spinId: string;
    prizeId: string;
    prizeName: string;
    imageUrl: string | null;
    won: boolean;
    spunAt: string;
    spunAtLabel: string;
    claimDeadline?: string | null;
    claimDeadlineLabel?: string | null;
    claimRemainingSeconds?: number;
    claimWindowMinutes?: number;
    locationId?: string | null;
    locationName?: string | null;
  };
  spinsLeftToday?: number;
  canSpin?: boolean;
  nextSpinInSeconds?: number;
  claimWindowMinutes?: number;
  blockReason?: "daily" | "cooldown" | null;
};

function formatWait(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r} san`;
  if (r === 0) return `${m} dəq`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatIsoIstanbul(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return null;
  }
}

function winDateLabel(w: WinSummary): string {
  if (w.status === "claimed" || w.claimed) {
    return (
      w.claimedAtLabel ||
      formatIsoIstanbul(w.claimedAt) ||
      w.spunAtLabel ||
      formatIsoIstanbul(w.spunAt) ||
      "—"
    );
  }
  if (w.status === "cancelled" || w.cancelled) {
    return (
      w.cancelledAtLabel ||
      formatIsoIstanbul(w.cancelledAt) ||
      w.spunAtLabel ||
      formatIsoIstanbul(w.spunAt) ||
      "—"
    );
  }
  return w.spunAtLabel || formatIsoIstanbul(w.spunAt) || "—";
}

function WinMeta({ w }: { w: WinSummary }) {
  const date = winDateLabel(w);
  const filial = w.locationName?.trim() || "—";
  return (
    <div
      data-win-meta="1"
      className="mt-1.5 rounded-lg bg-[#FFF1D6]/90 px-2 py-1.5 text-[11px] leading-snug text-[#5C3200]/80 ring-1 ring-[#E8C547]/35"
    >
      <p>
        <span className="font-bold text-[#5C3200]/55">Filial:</span> {filial}
      </p>
      <p className="mt-0.5">
        <span className="font-bold text-[#5C3200]/55">Tarix / saat:</span>{" "}
        {date}
      </p>
    </div>
  );
}

function normalizeWin(w: WinSummary): WinSummary {
  const spunAtLabel =
    w.spunAtLabel || formatIsoIstanbul(w.spunAt) || w.spunAt || "";
  const claimedAtLabel =
    w.claimedAtLabel || formatIsoIstanbul(w.claimedAt) || null;
  const cancelledAtLabel =
    w.cancelledAtLabel || formatIsoIstanbul(w.cancelledAt) || null;
  return {
    ...w,
    spunAtLabel,
    claimedAtLabel,
    cancelledAtLabel,
    locationName: w.locationName?.trim() || null,
  };
}

function normalizeWins(list: WinSummary[] | undefined): WinSummary[] {
  return (list || []).map(normalizeWin);
}

const PHONE_KEY = "ar-wheel-phone";
const DEVICE_KEY = "ar-wheel-device";

function spinLockKey(slug: string) {
  return `ar-wheel-spun-visit:${slug}`;
}

/** Yenilemede kilit kalsın; QR ile yeni açılışta (navigate) kilit açılsın */
function readSpinLocked(slug: string): boolean {
  try {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === "reload";
    if (!isReload) {
      sessionStorage.removeItem(spinLockKey(slug));
      return false;
    }
    return sessionStorage.getItem(spinLockKey(slug)) === "1";
  } catch {
    return false;
  }
}

function markSpinLocked(slug: string) {
  try {
    sessionStorage.setItem(spinLockKey(slug), "1");
  } catch {
    // ignore
  }
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `d${Date.now().toString(36)}fallback`;
  }
}

function formatPhoneMask(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("994") && digits.length > 10) digits = digits.slice(3);
  if (digits.startsWith("90") && digits.length > 10) digits = digits.slice(2);
  if (digits.length > 0 && !digits.startsWith("0")) digits = `0${digits}`;
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

/** Dilim ortasını üstteki oka getiren hedef açı (GameWheel: 0° = üst, saat yönü) */
function prizeAngle(slices: WheelSlice[], prizeId: string) {
  return prizeTargetRotation(slices, prizeId);
}

function LightConfetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${4 + ((i * 5) % 92)}%`,
        delay: `${(i % 6) * 0.05}s`,
        color: ["#FFD54F", "#FF6B35", "#2EC4B6", "#FF8AD8", "#fff"][i % 5],
        size: 6 + (i % 4) * 2,
      })),
    [],
  );
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 8px ${p.color}`,
            animation: `gw-confetti 1.5s ease-out ${p.delay} forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes gw-confetti {
          0% { transform: translateY(-8%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(520deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

type Props = {
  slug: string;
  campaignName: string;
  slices: WheelSlice[];
  showPrizeNames?: boolean;
  requirePin?: boolean;
  requireClaimPin?: boolean;
  claimWindowMinutes?: number;
  geoRequired?: boolean;
  locations?: PublicLocation[];
};

export default function GameWheelApp({
  slug,
  campaignName,
  slices: initialSlices,
  showPrizeNames: initialShowNames = false,
  requirePin: initialRequirePin = false,
  requireClaimPin: initialRequireClaimPin = false,
  claimWindowMinutes: initialClaimWindow = 30,
  geoRequired = false,
  locations = [],
}: Props) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [busy, setBusy] = useState(false);
  const [claimingSpinIds, setClaimingSpinIds] = useState<Set<string>>(new Set());
  const [claimPrompt, setClaimPrompt] = useState<{
    spinId: string;
    prizeName: string;
  } | null>(null);
  const [claimPin, setClaimPin] = useState("");
  const [claimPinError, setClaimPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult["spin"] | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [tab, setTab] = useState<"wheel" | "prizes">("wheel");
  const [geo, setGeo] = useState<ClientGeoState>(
    geoRequired ? { status: "loading", fix: null } : { status: "idle" },
  );
  const [qrSpinLocked, setQrSpinLocked] = useState(() =>
    typeof window !== "undefined" ? readSpinLocked(slug) : false,
  );
  const stopTicksRef = useRef<(() => void) | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastFixRef = useRef<GeoFix | null>(null);

  const slices = session?.slices?.length ? session.slices : initialSlices;
  const showPrizeNames = Boolean(session?.showPrizeNames ?? initialShowNames);
  const requirePin = Boolean(session?.requirePin ?? initialRequirePin);
  const requireClaimPin = Boolean(
    session?.requireClaimPin ?? initialRequireClaimPin,
  );
  const claimWindowMinutes =
    session?.claimWindowMinutes ?? initialClaimWindow;

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    setPin("");
    setQrSpinLocked(readSpinLocked(slug));
    try {
      localStorage.removeItem("ar-wheel-pin");
      const saved = localStorage.getItem(PHONE_KEY);
      if (saved) setPhone(formatPhoneMask(saved));
    } catch {
      // ignore
    }
    return () => {
      stopTicksRef.current?.();
    };
  }, [slug]);

  // Auto-refresh session: schedule a single refresh at Istanbul midnight
  // and also poll every 6 hours as a fallback (tab sleep/hibernation safety).
  useEffect(() => {
    const phone = session?.phone;
    if (!phone) return;
    let cancelled = false;
    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    async function doRefresh() {
      try {
        const res = await fetch(`/api/public/wheel/${slug}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            deviceId: deviceId || getOrCreateDeviceId(),
            pin: pin.replace(/\D/g, "").slice(0, 5) || undefined,
            lat: coordsRef.current?.lat,
            lng: coordsRef.current?.lng,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as SessionData;
        if (cancelled) return;
        setSession((prev) => {
          if (!prev) return data;
          return {
            ...prev,
            ...data,
            pendingWins: data.pendingWins || [],
            claimedWins: data.claimedWins || [],
            cancelledWins: data.cancelledWins || [],
          };
        });
      } catch {
        // ignore
      }
    }

    // helper: compute ms until next Istanbul midnight
    function msUntilIstanbulMidnight(): number {
      try {
        const now = new Date();
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Istanbul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        const parts = fmt.formatToParts(now).reduce((acc: any, p) => {
          if (p.type !== "literal") acc[p.type] = Number(p.value);
          return acc;
        }, {});
        const yI = parts.year;
        const mI = parts.month;
        const dI = parts.day;
        // UTC components now
        const yU = now.getUTCFullYear();
        const mU = now.getUTCMonth() + 1;
        const dU = now.getUTCDate();
        const hU = now.getUTCHours();
        const minU = now.getUTCMinutes();
        const sU = now.getUTCSeconds();

        const istanbulAsUtcNow = Date.UTC(yI, mI - 1, dI, parts.hour, parts.minute, parts.second);
        const utcNowParts = Date.UTC(yU, mU - 1, dU, hU, minU, sU);
        const offsetMs = istanbulAsUtcNow - utcNowParts; // positive if Istanbul ahead of UTC

        // Istanbul next midnight (local) as UTC ms:
        const nextMidUtc = Date.UTC(yI, mI - 1, dI + 1, 0, 0, 0) - offsetMs;
        const diff = nextMidUtc - now.getTime();
        // if negative (shouldn't be) fallback to 1 minute
        return diff > 0 ? diff : 60_000;
      } catch {
        return 60_000;
      }
    }

    // schedule immediate timeout for Istanbul midnight
    const ms = msUntilIstanbulMidnight();
    timeoutId = window.setTimeout(() => void doRefresh(), ms);

    // fallback poll every 6 hours
    intervalId = window.setInterval(() => void doRefresh(), 6 * 60 * 60 * 1000);

    return () => {
      cancelled = true;
      if (intervalId != null) window.clearInterval(intervalId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phone, deviceId, slug]);

  async function refreshGeo(): Promise<ClientGeoState> {
    if (!geoRequired) {
      const idle = { status: "idle" as const };
      setGeo(idle);
      coordsRef.current = null;
      return idle;
    }
    setGeo({ status: "loading", fix: lastFixRef.current });
    const next = await checkClientGeo({
      required: true,
      locations,
      previousFix: lastFixRef.current,
    });
    setGeo(next);
    if (next.status === "ready") {
      lastFixRef.current = next.fix;
      if (next.inside) {
        coordsRef.current = { lat: next.fix.lat, lng: next.fix.lng };
      } else {
        coordsRef.current = null;
      }
    } else if (next.status === "denied" || next.status === "error") {
      if (next.fix) lastFixRef.current = next.fix;
      coordsRef.current = null;
    }
    return next;
  }

  const locationsKey = locations.map((l) => l.id).join(",");
  useEffect(() => {
    void refreshGeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoRequired, locationsKey]);

  const shownFix: GeoFix | null =
    geo.status === "ready"
      ? geo.fix
      : geo.status === "loading" ||
          geo.status === "denied" ||
          geo.status === "error"
        ? geo.fix
        : lastFixRef.current;

  const filialRows = useMemo(() => {
    if (!shownFix || locations.length === 0) {
      return locations.map((l) => ({
        ...l,
        dist: null as number | null,
      }));
    }
    return locations
      .map((l) => ({
        ...l,
        dist: distanceMeters(shownFix.lat, shownFix.lng, l.lat, l.lng),
      }))
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  }, [locations, shownFix]);

  const geoBlocked =
    geoRequired &&
    (locations.length === 0 ||
      geo.status === "loading" ||
      geo.status === "denied" ||
      geo.status === "error" ||
      (geo.status === "ready" && !geo.inside));

  const cooldownActive = Boolean(
    session && (session.nextSpinInSeconds ?? 0) > 0,
  );

  useEffect(() => {
    if (!cooldownActive) return;
    const id = window.setInterval(() => {
      setSession((s) => {
        if (!s?.nextSpinInSeconds || s.nextSpinInSeconds <= 0) return s;
        const next = Math.max(0, s.nextSpinInSeconds - 1);
        return {
          ...s,
          nextSpinInSeconds: next,
          canSpin: next <= 0 && s.spinsLeftToday > 0,
          blockReason:
            s.spinsLeftToday <= 0
              ? "daily"
              : next > 0
                ? "cooldown"
                : null,
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownActive]);

  useEffect(() => {
    if (!session?.pendingWins?.length) return;
    const id = window.setInterval(() => {
      setSession((s) => {
        if (!s) return s;
        const tickWin = (w: WinSummary): WinSummary => {
          if (
            w.claimed ||
            w.cancelled ||
            w.status === "claimed" ||
            w.status === "cancelled" ||
            claimingSpinIds.has(w.spinId)
          ) {
            return w;
          }
          const remaining = Math.max(0, w.claimRemainingSeconds ?? 0);
          const nextRemaining = Math.max(0, remaining - 1);
          if (remaining > 0 && nextRemaining <= 0) {
            return {
              ...w,
              status: "cancelled",
              cancelled: true,
              claimed: false,
              claimRemainingSeconds: 0,
              cancelledAtLabel: "Vaxtında götürülmədi — ləğv edildi",
              cancelReason: "Vaxtında götürülmədi — ləğv edildi",
            };
          }
          return { ...w, claimRemainingSeconds: nextRemaining };
        };
        const wins = s.wins.map(tickWin);
        return {
          ...s,
          wins,
          pendingWins: wins.filter((w) => w.status === "pending"),
          cancelledWins: wins.filter((w) => w.status === "cancelled"),
          claimedWins: wins.filter((w) => w.status === "claimed"),
        };
      });
      setResult((r) => {
        if (!r?.won || r.claimRemainingSeconds == null) return r;
        return {
          ...r,
          claimRemainingSeconds: Math.max(0, r.claimRemainingSeconds - 1),
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [session?.pendingWins?.length, claimingSpinIds]);

  async function startSession(e: FormEvent) {
    e.preventDefault();
    unlockGameAudio();
    playClick();
    if (geoRequired) {
      const g = await refreshGeo();
      if (g.status !== "ready") {
        setError(
          g.status === "denied" || g.status === "error"
            ? g.message
            : "Məkan lazımdır. İcazəni açın və marketdən cəhd edin.",
        );
        return;
      }
      if (!g.inside) {
        const m = g.distanceMeters != null ? Math.round(g.distanceMeters) : null;
        setError(
          m != null
            ? `Yalnız marketdə oynaya bilərsiniz (~${m} m uzaqdasınız).`
            : "Yalnız marketdə oynaya bilərsiniz.",
        );
        return;
      }
    }
    const dev = deviceId || getOrCreateDeviceId();
    setDeviceId(dev);
    if (requirePin && pin.replace(/\D/g, "").length !== 5) {
      setError("5 rəqəmli market şifrəsini daxil edin.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/public/wheel/${slug}/session`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          deviceId: dev,
          pin: pin.replace(/\D/g, "").slice(0, 5) || undefined,
          lat: coordsRef.current?.lat,
          lng: coordsRef.current?.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sessiya açıla bilmədi");
        return;
      }
      try {
        localStorage.setItem(PHONE_KEY, phone);
      } catch {
        // ignore
      }
      const sess = data as SessionData;
      const wins = normalizeWins(sess.wins);
      const pendingWins = normalizeWins(sess.pendingWins);
      const claimedWins = normalizeWins(sess.claimedWins);
      const cancelledWins = normalizeWins(sess.cancelledWins);
      setSession({
        ...sess,
        wins,
        pendingWins: pendingWins.length
          ? pendingWins
          : wins.filter((w) => w.status === "pending"),
        claimedWins: claimedWins.length
          ? claimedWins
          : wins.filter((w) => w.status === "claimed"),
        cancelledWins: cancelledWins.length
          ? cancelledWins
          : wins.filter((w) => w.status === "cancelled"),
      });
      if (pendingWins.length > 0 && !sess.canSpin) {
        setTab("prizes");
      }
    } catch {
      setError("Bağlantı xətası");
    } finally {
      setBusy(false);
    }
  }

  async function doSpin() {
    if (spinning || busy || !session?.canSpin || qrSpinLocked) return;
    // await öncesi kilit — çift tıklamada paralel spin engeli
    setBusy(true);
    setError(null);
    unlockGameAudio();
    if (geoRequired) {
      const g = await refreshGeo();
      if (g.status !== "ready" || !g.inside) {
        setError(
          g.status === "denied" || g.status === "error"
            ? g.message
            : "Yalnız marketdə oynaya bilərsiniz.",
        );
        setBusy(false);
        return;
      }
    }
    setShowConfetti(false);
    setShowWinModal(false);
    setShowEmptyModal(false);
    setResult(null);

    try {
      const res = await fetch(`/api/public/wheel/${slug}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: session.phone,
          deviceId: deviceId || getOrCreateDeviceId(),
          pin: pin.replace(/\D/g, "").slice(0, 5) || undefined,
          lat: coordsRef.current?.lat,
          lng: coordsRef.current?.lng,
        }),
      });
      const data = (await res.json()) as SpinResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "Çarx fırladıla bilmədi");
        setBusy(false);
        return;
      }

      if (data.limited) {
        setSession((s) =>
          s
            ? {
                ...s,
                canSpin: false,
                spinsLeftToday:
                  data.reason === "daily"
                    ? 0
                    : (data.spinsLeftToday ?? s.spinsLeftToday),
                nextSpinInSeconds: data.nextSpinInSeconds ?? 0,
                blockReason: data.reason ?? "daily",
              }
            : s,
        );
        setBusy(false);
        return;
      }

      if (!data.spin) {
        setError("Nəticə alınmadı");
        setBusy(false);
        return;
      }

      const spinPayload = data.spin;
      const target = prizeAngle(slices, spinPayload.prizeId);
      // 7–9 tur + yavaşlama — daha heyecanlı
      const turns = 7 + Math.floor(Math.random() * 3);
      const extra = 360 * turns;
      playSpinStart();
      stopTicksRef.current?.();
      stopTicksRef.current = startSpinTicks(SPIN_DURATION_MS);
      setSpinning(true);
      setRotation((r) => {
        const base = Number.isFinite(r) ? r : 0;
        const delta = (((target - (base % 360)) + 360) % 360);
        return base + extra + delta;
      });

      window.setTimeout(() => {
        stopTicksRef.current?.();
        stopTicksRef.current = null;
        setSpinning(false);
        setResult(spinPayload);
        markSpinLocked(slug);
        setQrSpinLocked(true);
        // ses: ctx zaten jestte unlock edildi; resume çağırma
        try {
          if (spinPayload.won) playWin();
          else playLose();
        } catch {
          // ignore
        }
        if (spinPayload.won) {
          setShowConfetti(true);
          window.requestAnimationFrame(() => setShowWinModal(true));
        } else {
          window.requestAnimationFrame(() => setShowEmptyModal(true));
        }
        setSession((s) => {
          if (!s) return s;
          const spinsLeft =
            data.spinsLeftToday ?? Math.max(0, s.spinsLeftToday - 1);
          const nextSec = data.nextSpinInSeconds ?? 0;
          const base = {
            ...s,
            canSpin: false, // bu ziyarette tekrar yok — QR gerekir
            spinsLeftToday: spinsLeft,
            nextSpinInSeconds: nextSec,
            blockReason: data.blockReason ?? null,
          };
          if (!spinPayload.won) return base;
          const winRow: WinSummary = {
            spinId: spinPayload.spinId,
            prizeId: spinPayload.prizeId,
            prizeName: spinPayload.prizeName,
            imageUrl: spinPayload.imageUrl,
            won: true,
            claimed: false,
            cancelled: false,
            status: "pending",
            claimedAt: null,
            claimedAtLabel: null,
            claimDeadline: spinPayload.claimDeadline ?? null,
            claimDeadlineLabel: spinPayload.claimDeadlineLabel ?? null,
            claimRemainingSeconds: spinPayload.claimRemainingSeconds ?? 0,
            spunAt: spinPayload.spunAt,
            spunAtLabel: spinPayload.spunAtLabel,
            locationId: spinPayload.locationId ?? null,
            locationName: spinPayload.locationName ?? null,
          };
          return {
            ...base,
            claimWindowMinutes:
              data.claimWindowMinutes ?? s.claimWindowMinutes,
            pendingWins: [winRow, ...s.pendingWins],
            claimedWins: s.claimedWins || [],
            wins: [winRow, ...s.wins],
          };
        });
        setBusy(false);
        if (spinPayload.won) setTab("prizes");
      }, SPIN_DURATION_MS + 80);
    } catch {
      stopTicksRef.current?.();
      stopTicksRef.current = null;
      setError("Bağlantı xətası");
      setBusy(false);
    }
  }

  function openClaimPrompt(w: WinSummary) {
    if (!session) {
      setError("Əvvəlcə telefon ilə daxil olun.");
      return;
    }
    if (claimingSpinIds.has(w.spinId)) {
      setError("Bu hədiyyə artıq təsdiqlənir…");
      return;
    }
    // Spin bitişinde busy kısa süre true kalabilir — PIN modalını engelleme
    if (busy) setBusy(false);
    // ASLA window.confirm kullanma — her zaman kassir PIN modalı
    setShowWinModal(false);
    setShowEmptyModal(false);
    setShowConfetti(false);
    setTab("prizes");
    setError(null);
    setClaimPinError(null);
    setClaimPin("");
    setClaimPrompt({ spinId: w.spinId, prizeName: w.prizeName });
  }

  function closeClaimPrompt() {
    if (busy) return;
    setClaimPrompt(null);
    setClaimPin("");
    setClaimPinError(null);
  }

  async function submitClaim(spinId: string, pinOverride?: string) {
    if (!session || claimingSpinIds.has(spinId)) return;
    const pinToSend = String(pinOverride ?? claimPin ?? "")
      .replace(/\D/g, "")
      .slice(0, 5);
    if (pinToSend.length !== 5) {
      setClaimPinError("5 rəqəmli kassir şifrəsini daxil edin.");
      return;
    }
    setClaimingSpinIds((prev) => {
      const next = new Set(prev);
      next.add(spinId);
      return next;
    });
    setBusy(true);
    setError(null);
    setClaimPinError(null);
    try {
      const res = await fetch(`/api/public/wheel/${slug}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: session.phone,
          spinId,
          deviceId: deviceId || getOrCreateDeviceId(),
          pin: pinToSend || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimPinError(data.error || "Təslim qeydi uğursuz oldu");
        if (res.status === 410) {
          setClaimPrompt(null);
          setSession((s) => {
            if (!s) return s;
            const wins = s.wins.map((w) =>
              w.spinId === spinId
                ? {
                    ...w,
                    status: "cancelled" as const,
                    cancelled: true,
                    claimRemainingSeconds: 0,
                    cancelReason: "Vaxtında götürülmədi — ləğv edildi",
                    cancelledAtLabel: "Vaxtında götürülmədi — ləğv edildi",
                  }
                : w,
            );
            return {
              ...s,
              wins,
              pendingWins: wins.filter((w) => w.status === "pending"),
              cancelledWins: wins.filter((w) => w.status === "cancelled"),
            };
          });
        }
        return;
      }
      const raw = (data.win || data) as WinSummary;
      const claimedAt = raw.claimedAt || new Date().toISOString();
      const win: WinSummary = {
        ...raw,
        claimed: true,
        status: "claimed",
        cancelled: false,
        claimRemainingSeconds: 0,
        claimedAt,
        claimedAtLabel:
          raw.claimedAtLabel ||
          formatIsoIstanbul(claimedAt) ||
          claimedAt,
        spunAt: raw.spunAt,
        spunAtLabel: raw.spunAtLabel || formatIsoIstanbul(raw.spunAt) || "",
        locationName: raw.locationName ?? null,
      };
      setSession((s) => {
        if (!s) return s;
        const nextWins = (s.wins || []).map((w) =>
          w.spinId === spinId
            ? {
                ...w,
                ...win,
                claimed: true,
                cancelled: false,
                status: "claimed" as const,
                claimRemainingSeconds: 0,
                cancelReason: null,
                cancelledAtLabel: null,
                locationName: win.locationName || w.locationName || null,
                spunAt: win.spunAt || w.spunAt,
                spunAtLabel:
                  win.spunAtLabel ||
                  w.spunAtLabel ||
                  formatIsoIstanbul(win.spunAt || w.spunAt) ||
                  "",
                claimedAtLabel:
                  win.claimedAtLabel ||
                  formatIsoIstanbul(win.claimedAt) ||
                  w.claimedAtLabel,
              }
            : w,
        );
        return {
          ...s,
          wins: nextWins,
          pendingWins: nextWins.filter((w) => w.status === "pending"),
          claimedWins: nextWins.filter((w) => w.status === "claimed"),
          cancelledWins: nextWins.filter((w) => w.status === "cancelled"),
        };
      });
      setClaimPrompt(null);
      setClaimPin("");
      setTab("prizes");
      setShowConfetti(false);
      setShowWinModal(false);
      setResult(null);
    } catch {
      setClaimPinError("Bağlantı xətası");
    } finally {
      setClaimingSpinIds((prev) => {
        const next = new Set(prev);
        next.delete(spinId);
        return next;
      });
      setBusy(false);
    }
  }

  const claimedWins =
    session?.claimedWins ||
    (session?.wins || []).filter((w) => w.status === "claimed");
  const cancelledWins =
    session?.cancelledWins ||
    (session?.wins || []).filter((w) => w.status === "cancelled");
  const pendingPrimary = session?.pendingWins?.[0] ?? null;

  const winClaimLabel =
    result?.won && claimWindowMinutes > 0
      ? (result.claimRemainingSeconds ?? 0) > 0
        ? `${formatWait(result.claimRemainingSeconds ?? 0)} içində kassadan alın`
        : "Kassadan alın"
      : null;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden text-[#3d2914]">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(165deg, #FFF9EE 0%, #FFE7B0 38%, #FFD078 72%, #F0B85A 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[50%]"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at 50% -15%, rgba(255,255,255,.85), transparent 60%), radial-gradient(circle at 20% 30%, rgba(255,200,80,.35), transparent 40%), radial-gradient(circle at 85% 20%, rgba(255,140,180,.2), transparent 35%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[26%] left-0 h-[42%] w-[16%] rounded-r-3xl opacity-40"
        aria-hidden
        style={{
          background:
            "linear-gradient(90deg, #FF8A3D, #FFB347 65%, transparent)",
          boxShadow: "0 0 40px rgba(255,140,60,.35)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[26%] right-0 h-[42%] w-[16%] rounded-l-3xl opacity-40"
        aria-hidden
        style={{
          background:
            "linear-gradient(270deg, #2EC4B6, #7DE8DC 65%, transparent)",
          boxShadow: "0 0 40px rgba(46,196,182,.3)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-2 left-2 h-16 w-[4.5rem] rounded-xl opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 30% 40%, #FF4D6D 0 28%, transparent 29%), radial-gradient(circle at 70% 45%, #E63946 0 26%, transparent 27%), linear-gradient(180deg, #D4A574, #8B6914)",
          boxShadow: "0 4px 16px rgba(80,40,0,.25)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-2 right-2 h-16 w-[4.5rem] rounded-xl opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 35% 40%, #8BC34A 0 30%, transparent 31%), radial-gradient(circle at 68% 50%, #558B2F 0 28%, transparent 29%), linear-gradient(180deg, #D4A574, #8B6914)",
          boxShadow: "0 4px 16px rgba(80,40,0,.25)",
        }}
      />

      <LightConfetti active={showConfetti && Boolean(result?.won)} />

      {showWinModal && result?.won ? (
        <WinShowcase
          prizeName={result.prizeName}
          imageUrl={result.imageUrl}
          claimLabel={winClaimLabel}
          onPrizes={() => {
            playClick();
            const pending =
              session?.pendingWins?.find((w) => w.spinId === result.spinId) ||
              session?.pendingWins?.[0] ||
              null;
            if (pending) {
              openClaimPrompt(pending);
              return;
            }
            setShowWinModal(false);
            setTab("prizes");
          }}
          onClose={() => {
            playClick();
            setShowWinModal(false);
          }}
        />
      ) : null}

      {showEmptyModal && result && !result.won ? (
        <EmptyShowcase
          prizeName={result.prizeName}
          onClose={() => {
            playClick();
            setShowEmptyModal(false);
          }}
        />
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.85rem,env(safe-area-inset-top))]">
        <header className="mb-3 text-center">
          <h1
            className="text-[1.75rem] leading-tight tracking-tight text-[#5C3200] drop-shadow-[0_1px_0_rgba(255,255,255,.6)]"
            style={{ fontFamily: "var(--display)" }}
          >
            {campaignName}
          </h1>
        </header>

        {pendingPrimary && !showWinModal ? (
          <button
            type="button"
            onClick={() => {
              playClick();
              setTab("prizes");
            }}
            className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FF9A4D] via-[#FF7A2E] to-[#F05A28] px-3 py-2.5 text-left text-white shadow-[0_8px_24px_rgba(240,90,40,.4)]"
          >
            {pendingPrimary.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingPrimary.imageUrl}
                alt=""
                className="h-11 w-11 rounded-xl object-cover ring-2 ring-white/50"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-xl">
                ★
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              {pendingPrimary.prizeName}
            </span>
            <span className="shrink-0 rounded-xl bg-white/25 px-2.5 py-1 text-lg font-black tabular-nums shadow-inner">
              {formatWait(pendingPrimary.claimRemainingSeconds ?? 0)}
            </span>
          </button>
        ) : null}

        <main className="flex flex-1 flex-col rounded-[1.85rem] bg-white/80 p-4 shadow-[0_20px_50px_rgba(90,50,0,.18),inset_0_1px_0_rgba(255,255,255,.8)] ring-1 ring-[#FFD54F]/55 backdrop-blur-[1px]">
          {!session ? (
            <form
              onSubmit={startSession}
              className="flex flex-1 flex-col justify-center space-y-3.5 py-2"
            >
              <GameWheel
                slices={slices}
                rotation={0}
                spinning={false}
                size={220}
                showPrizeNames={showPrizeNames}
                disabled
              />
              {geoRequired ? (
                <div className="rounded-2xl bg-[#FFF1D6] px-3 py-2.5 text-xs font-semibold text-[#5C3200]">
                  <div className="text-center">
                    {geo.status === "loading" ? (
                      <p>GPS oxunur…</p>
                    ) : geo.status === "ready" && geo.inside ? (
                      <p className="text-emerald-800">
                        {geo.matchedLocation?.label || "Market"} ✓
                      </p>
                    ) : geo.status === "ready" && !geo.inside ? (
                      <p className="text-amber-900">
                        Marketə gəlin
                        {geo.nearestLocation
                          ? ` · ${geo.nearestLocation.label}`
                          : ""}
                        {geo.distanceMeters != null
                          ? ` (~${Math.round(geo.distanceMeters)} m)`
                          : ""}
                      </p>
                    ) : geo.status === "denied" || geo.status === "error" ? (
                      <p className="text-red-700">{geo.message}</p>
                    ) : (
                      <p>Məkan lazımdır</p>
                    )}
                  </div>

                  <div className="mt-2 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-[#E8C547]/40">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5C3200]/55">
                      Məkan məlumatı
                    </p>
                    {shownFix ? (
                      <div className="space-y-1 font-mono text-[13px] font-bold tabular-nums text-[#3d2914]">
                        <p>
                          <span className="font-sans text-[11px] font-semibold text-[#5C3200]/65">
                            En:{" "}
                          </span>
                          {formatCoord(shownFix.lat)}
                        </p>
                        <p>
                          <span className="font-sans text-[11px] font-semibold text-[#5C3200]/65">
                            Uzunluq:{" "}
                          </span>
                          {formatCoord(shownFix.lng)}
                        </p>
                        <p className="font-sans text-[10px] font-medium text-[#5C3200]/55">
                          Dəqiqlik: ~{Math.round(shownFix.accuracy)} m
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium text-[#5C3200]/50">
                        {geo.status === "loading"
                          ? "Koordinatlar alınır…"
                          : "Hələ məkan yoxdur — Yenilə"}
                      </p>
                    )}

                    {geo.status === "ready" && geo.nearestLocation ? (
                      <p className="mt-2 rounded-lg bg-[#FFF1D6] px-2 py-1.5 font-sans text-[11px] font-bold text-[#5C3200]">
                        Ən yaxın filial: {geo.nearestLocation.label}
                        {geo.distanceMeters != null
                          ? ` · ~${Math.round(geo.distanceMeters)} m`
                          : ""}
                        {geo.inside ? " · içində" : ""}
                      </p>
                    ) : null}

                    {geoRequired && locations.length === 0 ? (
                      <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-800">
                        Aktiv filial yoxdur — admin paneldə pasif şöbələri aktiv
                        edin və ya yeni filial əlavə edin.
                      </p>
                    ) : null}

                    {filialRows.length > 0 ? (
                      <div className="mt-2 border-t border-[#E8C547]/35 pt-2">
                        <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-wider text-[#5C3200]/55">
                          Filiallar ({filialRows.length})
                        </p>
                        <ul className="max-h-28 space-y-1 overflow-y-auto">
                          {filialRows.map((f) => {
                            const inside =
                              shownFix != null &&
                              f.dist != null &&
                              f.dist <= f.radiusMeters;
                            const isNearest =
                              geo.status === "ready" &&
                              geo.nearestLocation?.id === f.id;
                            return (
                              <li
                                key={f.id}
                                className={`flex items-start justify-between gap-2 rounded-lg px-2 py-1 font-sans text-[11px] ${
                                  inside
                                    ? "bg-emerald-50 text-emerald-900"
                                    : isNearest
                                      ? "bg-amber-50 text-amber-950"
                                      : "text-[#5C3200]/75"
                                }`}
                              >
                                <span className="min-w-0 truncate font-semibold">
                                  {f.label}
                                  {inside ? " ✓" : isNearest ? " ←" : ""}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] opacity-80">
                                  {f.dist != null
                                    ? `~${Math.round(f.dist)} m`
                                    : `±${f.radiusMeters} m`}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 border-t border-[#E8C547]/35 pt-2 font-sans text-[10px] text-[#5C3200]/45">
                        Aktiv filial yoxdur
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={geo.status === "loading"}
                    onClick={() => void refreshGeo()}
                    className="mt-2 w-full rounded-xl bg-[#5C3200] py-2.5 text-[12px] font-bold text-[#FFF6D6] disabled:opacity-60"
                  >
                    {geo.status === "loading" ? "GPS oxunur…" : "Məkanı yenilə"}
                  </button>
                </div>
              ) : null}
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold text-[#5C3200]/75">
                  Telefon nömrəsi
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                  inputMode="tel"
                  placeholder="0XX XXX XX XX"
                  required
                  className="w-full rounded-2xl border-0 bg-[#FFF8EC] px-4 py-3.5 text-base tracking-wide text-[#3d2914] shadow-inner outline-none ring-1 ring-[#E8C547]/50 focus:ring-2 focus:ring-[#F0A500]"
                />
              </label>
              {requirePin ? (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold text-[#5C3200]/75">
                    Market şifrəsi
                  </span>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 5))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={5}
                    placeholder="•••••"
                    required
                    className="w-full rounded-2xl border-0 bg-[#FFF8EC] px-4 py-3.5 text-center text-lg tracking-[0.45em] text-[#3d2914] shadow-inner outline-none ring-1 ring-[#E8C547]/50 focus:ring-2 focus:ring-[#F0A500]"
                  />
                </label>
              ) : null}
              {error ? (
                <p className="text-center text-sm text-red-600">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={busy || geoBlocked}
                className="w-full rounded-2xl bg-gradient-to-b from-[#FFD54F] to-[#F0A500] px-4 py-3.5 text-base font-black text-[#5C3200] shadow-md disabled:opacity-60"
              >
                {busy ? "…" : geoBlocked ? "Marketə gəlin" : "Başla"}
              </button>
            </form>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF1D6]/80 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTab("wheel");
                    setResult(null);
                    setShowConfetti(false);
                  }}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${
                    tab === "wheel"
                      ? "bg-white text-[#5C3200] shadow-sm"
                      : "text-[#5C3200]/55"
                  }`}
                >
                  Çarx
                </button>
                <button
                  type="button"
                  onClick={() => setTab("prizes")}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${
                    tab === "prizes"
                      ? "bg-white text-[#5C3200] shadow-sm"
                      : "text-[#5C3200]/55"
                  }`}
                >
                  Hədiyyələr
                  {session.pendingWins.length > 0
                    ? ` · ${session.pendingWins.length}`
                    : ""}
                </button>
              </div>
              {tab === "prizes" ? (
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#5C3200]/35">
                  Kassir PIN · filial · tarix
                </p>
              ) : null}

              {tab === "wheel" ? (
                <div className="flex flex-1 flex-col items-center">
                  <div className="relative flex w-full flex-col items-center">
                    <GameWheel
                      slices={slices}
                      rotation={rotation}
                      spinning={spinning}
                      size={308}
                      durationMs={SPIN_DURATION_MS}
                      showPrizeNames={showPrizeNames}
                      onSpin={() => void doSpin()}
                      disabled={
                        busy ||
                        !session.canSpin ||
                        qrSpinLocked ||
                        geoBlocked
                      }
                    />
                  </div>

                  {result && !spinning ? (
                    <p className="mt-2 text-center text-sm font-black text-[#5C3200]">
                      {result.won
                        ? `Nəticə: ${result.prizeName}`
                        : "Nəticə: Bu dəfə boş"}
                    </p>
                  ) : null}

                  {qrSpinLocked && !spinning ? (
                    <div className="mt-2 w-full rounded-2xl bg-[#5C3200] px-3 py-3 text-center text-xs font-semibold text-[#FFF6D6]">
                      Yenidən fırlatmaq üçün panodakı{" "}
                      <span className="underline">QR kodu</span> yenidən oxudun
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 rounded-full bg-[#FFF1D6] px-3.5 py-1.5 text-xs font-semibold text-[#5C3200]/80">
                      <span>
                        Haqq: {session.spinsLeftToday}
                        {session.spinsPerPlayerPerDay != null
                          ? `/${session.spinsPerPlayerPerDay}`
                          : ""}
                      </span>
                      {!session.canSpin && !spinning ? (
                        <>
                          <span className="text-[#5C3200]/30">·</span>
                          <span className="text-[#C45C12]">
                            {session.blockReason === "cooldown" ||
                            (session.nextSpinInSeconds ?? 0) > 0
                              ? formatWait(session.nextSpinInSeconds ?? 0)
                              : "Bitdi"}
                          </span>
                        </>
                      ) : null}
                    </div>
                  )}

                  {result?.won && !spinning && !showWinModal ? (
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setShowWinModal(true);
                      }}
                      className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFF3C4] to-[#FFE082] p-3 text-left shadow-md ring-1 ring-[#FFD54F]"
                    >
                      {result.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.imageUrl}
                          alt=""
                          className="h-14 w-14 rounded-xl object-cover ring-2 ring-white"
                        />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFD54F] text-2xl">
                          ★
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-wider text-[#C4890A]">
                          Qazandınız
                        </span>
                        <span className="block truncate text-sm font-black text-[#5C3200]">
                          {result.prizeName}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-[#5C3200]/60">
                        Bax →
                      </span>
                    </button>
                  ) : null}

                  {error ? (
                    <p className="mt-2 text-center text-sm text-red-600">{error}</p>
                  ) : null}
                </div>
              ) : (
                <div className="max-h-[62dvh] space-y-3 overflow-y-auto">
                  {session.pendingWins.length === 0 &&
                  claimedWins.length === 0 &&
                  cancelledWins.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[#5C3200]/50">
                      Hələ hədiyyə yoxdur
                    </p>
                  ) : null}

                  {session.pendingWins.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5C3200]/45">
                        Gözləyən
                      </p>
                      <ul className="space-y-2">
                        {session.pendingWins.map((w) => (
                          <li
                            key={w.spinId}
                            className="rounded-2xl bg-[#E8FFF4] p-3 ring-1 ring-emerald-300/40"
                          >
                            <div className="flex items-center gap-3">
                              {w.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={w.imageUrl}
                                  alt=""
                                  className="h-16 w-16 rounded-2xl object-cover shadow-md ring-2 ring-emerald-300/50"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#FFE566] to-[#F0A500] text-2xl shadow-md">
                                  ★
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold">
                                  {w.prizeName}
                                </p>
                                <WinMeta w={w} />
                                {(w.claimRemainingSeconds ?? 0) > 0 ? (
                                  <p className="text-xs font-semibold text-amber-800">
                                    {formatWait(w.claimRemainingSeconds ?? 0)}{" "}
                                    içində alın
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                disabled={claimingSpinIds.has(w.spinId)}
                                onClick={() => {
                                  playClick();
                                  openClaimPrompt(w);
                                }}
                                className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                              >
                                Aldım
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {claimedWins.length > 0 ? (
                    <div className="border-t border-[#5C3200]/10 pt-3">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5C3200]/45">
                        Alınanlar
                      </p>
                      <ul className="space-y-1.5 text-xs text-[#5C3200]/70">
                        {claimedWins.slice(0, 8).map((w) => (
                          <li
                            key={w.spinId}
                            className="rounded-xl bg-white/70 px-3 py-2"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="truncate font-semibold text-[#5C3200]/85">
                                {w.prizeName}
                              </span>
                              <span className="shrink-0 font-semibold text-emerald-700">
                                Alındı
                              </span>
                            </div>
                            <WinMeta w={w} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {cancelledWins.length > 0 ? (
                    <div className="border-t border-[#5C3200]/10 pt-3">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5C3200]/45">
                        Ləğv olunanlar
                      </p>
                      <ul className="space-y-1.5 text-xs">
                        {cancelledWins.slice(0, 8).map((w) => (
                          <li
                            key={w.spinId}
                            className="rounded-xl bg-red-50/80 px-3 py-2 ring-1 ring-red-200/60"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="truncate font-semibold text-[#5C3200]/75">
                                {w.prizeName}
                              </span>
                              <span className="shrink-0 font-bold text-red-700">
                                Ləğv edilib
                              </span>
                            </div>
                            <WinMeta w={w} />
                            <p className="mt-0.5 text-[11px] text-red-800/80">
                              {w.cancelReason ||
                                "Vaxtında götürülmədi — ləğv edildi"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {claimPrompt ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-4 sm:items-center">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-pin-title"
            className="w-full max-w-sm rounded-3xl bg-[#FFF8EC] p-5 shadow-2xl ring-1 ring-[#E8C547]/40"
            onSubmit={(e) => {
              e.preventDefault();
              void submitClaim(claimPrompt.spinId, claimPin);
            }}
          >
            <h2
              id="claim-pin-title"
              className="text-lg font-black text-[#5C3200]"
              style={{ fontFamily: "var(--display)" }}
            >
              Kassir şifrəsi
            </h2>
            <p className="mt-1 text-sm text-[#5C3200]/70">
              <span className="font-semibold text-[#5C3200]">
                {claimPrompt.prizeName}
              </span>{" "}
              kassada təslim — market şifrəsindən fərqli olan kassir şifrəsini
              yazın.
            </p>
            {!requireClaimPin ? (
              <p className="mt-2 rounded-xl bg-amber-100/80 px-3 py-2 text-[11px] font-medium text-amber-900">
                Admin paneldə çarx ayarlarından ayrı 5 rəqəmli{" "}
                <strong>kassir şifrəsi</strong> təyin edin; əks halda təslim
                alınmayacaq.
              </p>
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="mb-1.5 block font-semibold text-[#5C3200]/75">
                Kassir şifrəsi *
              </span>
              <input
                type="password"
                value={claimPin}
                onChange={(e) =>
                  setClaimPin(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                maxLength={5}
                placeholder="•••••"
                required
                className="w-full rounded-2xl border-0 bg-white px-4 py-3.5 text-center text-lg tracking-[0.45em] text-[#3d2914] shadow-inner outline-none ring-1 ring-[#E8C547]/50 focus:ring-2 focus:ring-[#F0A500]"
              />
            </label>
            {claimPinError ? (
              <p className="mt-2 text-center text-sm text-red-600">
                {claimPinError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={closeClaimPrompt}
                className="rounded-2xl bg-white px-3 py-3 text-sm font-bold text-[#5C3200]/70 ring-1 ring-[#5C3200]/15 disabled:opacity-60"
              >
                Ləğv et
              </button>
              <button
                type="submit"
                disabled={busy || claimPin.replace(/\D/g, "").length !== 5}
                className="rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? "…" : "Təsdiq · Aldım"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
