"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import WheelAnalyticsPanel from "@/components/admin/WheelAnalyticsPanel";
import LocationEditor from "@/components/admin/LocationEditor";
import {
  CHANCE_PRESETS,
  SLICE_COLORS,
  buildSliceCoachTips,
  chancePercent,
  pickNextSliceColor,
} from "@/lib/wheel-chance-presets";

type Prize = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  weight: number;
  dailyLimit: number | null;
  weeklyLimit: number | null;
  monthlyLimit: number | null;
  totalLimit: number | null;
  isEmpty: boolean;
  active: boolean;
  sortOrder: number;
  imagePath?: string | null;
  imageUrl?: string | null;
};

type QuotaField =
  | "dailyLimit"
  | "weeklyLimit"
  | "monthlyLimit"
  | "totalLimit";

type StockRow = {
  prizeId: string;
  name: string;
  isEmpty: boolean;
  active?: boolean;
  dailyLimit: number | null;
  weeklyLimit?: number | null;
  monthlyLimit?: number | null;
  totalLimit?: number | null;
  todayWins: number;
  weekWins?: number;
  monthWins?: number;
  totalWins?: number;
  remaining: number | null;
  remainingWeekly?: number | null;
  remainingMonthly?: number | null;
  remainingTotal?: number | null;
  selectable?: boolean;
};

type SpinRow = {
  id: string;
  phone: string;
  phoneRaw?: string;
  fullName?: string | null;
  prizeName: string;
  won: boolean;
  claimed: boolean;
  cancelled?: boolean;
  claimedAtLabel: string | null;
  spunAtLabel: string;
  dayKey: string;
  locationId?: string | null;
  locationName?: string | null;
};

type Props = {
  campaignId: string;
  wheelEnabled: boolean;
  spinsPerPlayerPerDay: number;
  wheelShowPrizeNames?: boolean;
  wheelEqualSlices?: boolean;
  spinCooldownMinutes?: number;
  claimWindowMinutes?: number;
  spinPin?: string;
  claimPin?: string;
  wheelAskName?: boolean;
  wheelNameRequired?: boolean;
  onCampaignChange: (patch: {
    wheelEnabled?: boolean;
    spinsPerPlayerPerDay?: number;
    wheelShowPrizeNames?: boolean;
    wheelEqualSlices?: boolean;
    spinCooldownMinutes?: number;
    claimWindowMinutes?: number;
    spinPin?: string;
    claimPin?: string;
    wheelAskName?: boolean;
    wheelNameRequired?: boolean;
  }) => Promise<
    | void
    | {
        spinPin?: string;
        claimPin?: string;
        requireClaimPin?: boolean;
      }
  >;
};

export default function WheelEditor({
  campaignId,
  wheelEnabled,
  spinsPerPlayerPerDay,
  wheelShowPrizeNames = false,
  wheelEqualSlices = true,
  spinCooldownMinutes = 0,
  claimWindowMinutes = 30,
  spinPin = "",
  claimPin = "",
  wheelAskName = false,
  wheelNameRequired = false,
  onCampaignChange,
}: Props) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [enabled, setEnabled] = useState(wheelEnabled);
  const [spinsDay, setSpinsDay] = useState(spinsPerPlayerPerDay);
  const [showNames, setShowNames] = useState(wheelShowPrizeNames);
  const [equalSlices, setEqualSlices] = useState(wheelEqualSlices);
  const [cooldownMin, setCooldownMin] = useState(spinCooldownMinutes);
  const [claimWindow, setClaimWindow] = useState(claimWindowMinutes);
  const [pin, setPin] = useState(spinPin);
  const [cashierPin, setCashierPin] = useState(claimPin);
  const [askName, setAskName] = useState(wheelAskName);
  const [nameRequired, setNameRequired] = useState(wheelNameRequired);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(10);
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [weeklyLimit, setWeeklyLimit] = useState<string>("");
  const [monthlyLimit, setMonthlyLimit] = useState<string>("");
  const [totalLimit, setTotalLimit] = useState<string>("");
  const [isEmpty, setIsEmpty] = useState(false);
  const [color, setColor] = useState(SLICE_COLORS[0]!);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [spins, setSpins] = useState<SpinRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [day, setDay] = useState("");
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [reportTab, setReportTab] = useState<"spins" | "analytics">("spins");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [locationId, setLocationId] = useState<string | null>(null);

  const loadPrizes = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/prizes`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        (data && typeof data.error === "string" && data.error) ||
          "Dilimler yüklenemedi.",
      );
      return;
    }
    const data = await res.json();
    setPrizes(data.prizes || []);
  }, [campaignId]);

  const loadSpins = useCallback(async () => {
    const params = new URLSearchParams();
    if (day) params.set("day", day);
    if (filter === "pending") params.set("filter", "pending");
    if (locationId) params.set("locationId", locationId);
    const q = params.toString() ? `?${params}` : "";
    const res = await fetch(`/api/campaigns/${campaignId}/wheel/spins${q}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        (data && typeof data.error === "string" && data.error) ||
          "Çevirme listesi yüklenemedi.",
      );
      return;
    }
    const data = await res.json();
    setSpins(data.spins || []);
    setStock(data.stock || []);
    if (!day && data.day) setDay(data.day);
  }, [campaignId, day, filter, locationId]);

  useEffect(() => {
    setEnabled(wheelEnabled);
    setSpinsDay(spinsPerPlayerPerDay);
    setShowNames(wheelShowPrizeNames);
    setEqualSlices(wheelEqualSlices);
    setCooldownMin(spinCooldownMinutes);
    setClaimWindow(claimWindowMinutes);
    setPin(spinPin);
    setCashierPin(claimPin);
    setAskName(wheelAskName);
    setNameRequired(wheelNameRequired);
  }, [
    wheelEnabled,
    spinsPerPlayerPerDay,
    wheelShowPrizeNames,
    wheelEqualSlices,
    spinCooldownMinutes,
    claimWindowMinutes,
    spinPin,
    claimPin,
    wheelAskName,
    wheelNameRequired,
  ]);

  useEffect(() => {
    void loadPrizes();
  }, [loadPrizes]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/locations`);
        if (!res.ok) return;
        const json = await res.json();
        const locs = (json.locations || []).map((l: any) => ({
          id: l.id,
          name: l.branchName || l.name,
        }));
        setLocations(locs);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    if (enabled) void loadSpins();
  }, [enabled, loadSpins]);

  const totalWeight = useMemo(
    () => prizes.filter((p) => p.active).reduce((s, p) => s + p.weight, 0),
    [prizes],
  );

  const activeEmptyCount = useMemo(
    () => prizes.filter((p) => p.isEmpty && p.active).length,
    [prizes],
  );
  const totalEmptyCount = useMemo(
    () => prizes.filter((p) => p.isEmpty).length,
    [prizes],
  );

  const draftChancePct = useMemo(() => {
    const w = Math.max(0, weight);
    const sim = totalWeight + w;
    return chancePercent(w, sim || w);
  }, [weight, totalWeight]);

  const coachTips = useMemo(
    () =>
      buildSliceCoachTips(prizes, {
        weight,
        isEmpty,
        name,
      }),
    [prizes, weight, isEmpty, name],
  );

  const stockById = useMemo(() => {
    const map = new Map<string, StockRow>();
    for (const s of stock) map.set(s.prizeId, s);
    return map;
  }, [stock]);

  const quotaTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const timers = quotaTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  function syncStockLimits(prizeId: string, patch: Partial<Record<QuotaField, number | null>>) {
    setStock((prev) =>
      prev.map((s) => {
        if (s.prizeId !== prizeId) return s;
        const daily =
          patch.dailyLimit !== undefined ? patch.dailyLimit : s.dailyLimit;
        const weekly =
          patch.weeklyLimit !== undefined
            ? patch.weeklyLimit
            : (s.weeklyLimit ?? null);
        const monthly =
          patch.monthlyLimit !== undefined
            ? patch.monthlyLimit
            : (s.monthlyLimit ?? null);
        const total =
          patch.totalLimit !== undefined ? patch.totalLimit : s.totalLimit;
        const remaining =
          s.isEmpty || daily == null
            ? null
            : Math.max(0, daily - s.todayWins);
        const remainingWeekly =
          s.isEmpty || weekly == null
            ? null
            : Math.max(0, weekly - (s.weekWins ?? 0));
        const remainingMonthly =
          s.isEmpty || monthly == null
            ? null
            : Math.max(0, monthly - (s.monthWins ?? 0));
        const remainingTotal =
          s.isEmpty || total == null
            ? null
            : Math.max(0, total - (s.totalWins ?? 0));
        const selectable =
          Boolean(s.active) &&
          !s.isEmpty &&
          (remaining === null || remaining > 0) &&
          (remainingWeekly === null || remainingWeekly > 0) &&
          (remainingMonthly === null || remainingMonthly > 0) &&
          (remainingTotal === null || remainingTotal > 0);
        return {
          ...s,
          dailyLimit: daily,
          weeklyLimit: weekly,
          monthlyLimit: monthly,
          totalLimit: total,
          remaining,
          remainingWeekly,
          remainingMonthly,
          remainingTotal,
          selectable,
        };
      }),
    );
  }

  function applyQuotaLocal(
    prizeId: string,
    field: QuotaField,
    next: number | null,
  ) {
    setPrizes((prev) =>
      prev.map((p) => (p.id === prizeId ? { ...p, [field]: next } : p)),
    );
    syncStockLimits(prizeId, { [field]: next });
  }

  function persistQuotaDebounced(
    prizeId: string,
    field: QuotaField,
    next: number | null,
  ) {
    const key = `${prizeId}:${field}`;
    const prev = quotaTimers.current.get(key);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      quotaTimers.current.delete(key);
      void (async () => {
        const res = await fetch(
          `/api/campaigns/${campaignId}/prizes/${prizeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: next }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Kota güncellenemedi");
          void loadPrizes();
          void loadSpins();
        }
      })();
    }, 280);
    quotaTimers.current.set(key, t);
  }

  function setQuota(prizeId: string, field: QuotaField, next: number | null) {
    applyQuotaLocal(prizeId, field, next);
    persistQuotaDebounced(prizeId, field, next);
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cleanPin = pin.replace(/\D/g, "").slice(0, 5);
      const cleanClaimPin = cashierPin.replace(/\D/g, "").slice(0, 5);
      if (cleanPin && cleanPin.length !== 5) {
        setError("Market şifresi boş bırakın veya tam 5 rakam girin.");
        setBusy(false);
        return;
      }
      if (enabled && cleanClaimPin.length !== 5) {
        setError(
          "Uyarı: kasiyer şifresi yok — çark yine açılır, Aldım kassada çalışmaz. 5 rakam yazıp tekrar kaydedin.",
        );
      }
      if (cleanClaimPin && cleanClaimPin.length !== 5) {
        setError("Kasiyer şifresi boş bırakın veya tam 5 rakam girin.");
        setBusy(false);
        return;
      }
      if (
        cleanPin.length === 5 &&
        cleanClaimPin.length === 5 &&
        cleanPin === cleanClaimPin
      ) {
        setError("Kasiyer şifresi market şifresinden farklı olmalıdır.");
        setBusy(false);
        return;
      }
      const wasEnabled = wheelEnabled;
      const saved = await onCampaignChange({
        wheelEnabled: enabled,
        spinsPerPlayerPerDay: spinsDay,
        wheelShowPrizeNames: showNames,
        wheelEqualSlices: equalSlices,
        spinCooldownMinutes: cooldownMin,
        claimWindowMinutes: claimWindow,
        spinPin: cleanPin,
        claimPin: cleanClaimPin,
        wheelAskName: askName,
        wheelNameRequired: askName ? nameRequired : false,
      });
      const savedClaim =
        saved && typeof saved === "object" && "claimPin" in saved
          ? String((saved as { claimPin?: string }).claimPin || "")
          : cleanClaimPin;
      const claimOk = savedClaim.replace(/\D/g, "").length === 5;
      if (wasEnabled !== enabled) {
        setMessage(
          enabled
            ? `Çark açıldı. Kasiyer PIN ${claimOk ? "kayıtlı ✓" : "EKSİK ✗"}. QR artık /oyun — «QR yeniden derle».`
            : "Çark kapatıldı. QR görsel sayfasına dönmeli — üstte «QR yeniden derle» yapın.",
        );
      } else {
        setMessage(
          claimOk
            ? "Çark ayarları kaydedildi. Kasiyer PIN kayıtlı ✓ — Aldım’da sorulacak."
            : "Kaydedildi ama kasiyer PIN yok — Aldım çalışmaz. 5 rakam yazıp tekrar kaydedin.",
        );
      }
    } catch {
      setError("Ayarlar kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function addPrize(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/prizes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || (isEmpty ? "Boş / Tekrar dene" : "Hediye"),
        weight,
        color,
        isEmpty,
        dailyLimit: dailyLimit === "" ? null : Number(dailyLimit),
        weeklyLimit: weeklyLimit === "" ? null : Number(weeklyLimit),
        monthlyLimit: monthlyLimit === "" ? null : Number(monthlyLimit),
        totalLimit: totalLimit === "" ? null : Number(totalLimit),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(
        (data && typeof data.error === "string" && data.error) ||
          "Dilim eklenemedi. Sayfayı yenileyip tekrar deneyin.",
      );
      return;
    }
    const wasEmpty = isEmpty;
    setName("");
    setDailyLimit("");
    setWeeklyLimit("");
    setMonthlyLimit("");
    setTotalLimit("");
    setIsEmpty(false);
    setWeight(12);
    setColor(pickNextSliceColor([...prizes.map((p) => p.color), color]));
    setMessage(
      wasEmpty
        ? "Boş dilim eklendi. Görsel zorunlu değil."
        : "Dilim eklendi. İsim, renk ve şansı karttan düzenleyebilirsiniz; görsel isteğe bağlı.",
    );
    try {
      await onCampaignChange({ wheelEnabled: true });
      setEnabled(true);
    } catch {
      // API zaten çarkı açıp yayınlıyor olabilir
    }
    void loadPrizes();
  }

  function applyChancePreset(presetId: string) {
    const preset = CHANCE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setWeight(preset.weight);
    if (preset.forEmpty) {
      setIsEmpty(true);
      if (!name.trim()) setName("Boş / Tekrar dene");
    } else if (isEmpty && name === "Boş / Tekrar dene") {
      setIsEmpty(false);
      setName("");
    }
  }

  async function patchPrize(
    id: string,
    body: Partial<Prize>,
    opts?: { refreshSpins?: boolean },
  ) {
    // Kota alanları: anında UI + debounce kayıt (full reload yok)
    const quotaKeys: QuotaField[] = [
      "dailyLimit",
      "weeklyLimit",
      "monthlyLimit",
      "totalLimit",
    ];
    const hasQuota = quotaKeys.some((k) => k in body);
    if (hasQuota) {
      for (const k of quotaKeys) {
        if (k in body) setQuota(id, k, body[k] ?? null);
      }
      return;
    }

    // Ağırlık / aktif vb. — yerel güncelle, spins listesini gereksiz çekme
    setPrizes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...body } : p)),
    );
    if ("active" in body) {
      setStock((prev) =>
        prev.map((s) =>
          s.prizeId === id ? { ...s, active: body.active } : s,
        ),
      );
    }

    const res = await fetch(`/api/campaigns/${campaignId}/prizes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Güncellenemedi");
      void loadPrizes();
      if (opts?.refreshSpins) void loadSpins();
      return;
    }
    if (opts?.refreshSpins) void loadSpins();
  }

  async function uploadPrizeImage(prizeId: string, file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `/api/campaigns/${campaignId}/prizes/${prizeId}/image`,
      { method: "POST", body: form },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Görsel yüklenemedi");
      return;
    }
    setMessage("Hediye görseli yüklendi.");
    void loadPrizes();
  }

  function adjustQuota(prizeId: string, field: QuotaField, delta: number) {
    const st = stockById.get(prizeId);
    const floor =
      field === "totalLimit"
        ? (st?.totalWins ?? 0)
        : field === "weeklyLimit"
          ? (st?.weekWins ?? 0)
          : field === "monthlyLimit"
            ? (st?.monthWins ?? 0)
            : (st?.todayWins ?? 0);

    let nextValue: number | null = null;
    setPrizes((prev) => {
      const prize = prev.find((p) => p.id === prizeId);
      if (!prize) return prev;
      const current = prize[field];
      let next: number;
      if (current == null) {
        next = delta > 0 ? Math.max(floor + 1, 10) : Math.max(floor, 10);
      } else {
        next = current + delta;
      }
      if (next < floor) next = floor;
      if (next < 0) next = 0;
      nextValue = next;
      return prev.map((p) =>
        p.id === prizeId ? { ...p, [field]: next } : p,
      );
    });
    if (nextValue == null) return;
    syncStockLimits(prizeId, { [field]: nextValue });
    persistQuotaDebounced(prizeId, field, nextValue);
  }

  function QuotaCard({
    title,
    hint,
    field,
    prizeId,
    value,
    used,
    left,
    disabled,
  }: {
    title: string;
    hint: string;
    field: QuotaField;
    prizeId: string;
    value: number | null;
    used: number;
    left: number | null;
    disabled?: boolean;
  }) {
    if (disabled) return null;
    return (
      <div className="rounded-lg border border-line bg-bg-deep/40 p-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium text-ink">{title}</p>
            <p className="text-[10px] text-muted">{hint}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded border border-line bg-white text-sm"
              onClick={() => adjustQuota(prizeId, field, -1)}
            >
              −
            </button>
            <input
              type="number"
              min={0}
              className="h-7 w-14 rounded border border-line px-1 text-center text-sm"
              value={value ?? ""}
              placeholder="∞"
              onChange={(e) =>
                void patchPrize(prizeId, {
                  [field]:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded border border-line bg-white text-sm"
              onClick={() => adjustQuota(prizeId, field, 1)}
            >
              +
            </button>
            <button
              type="button"
              className="text-[10px] text-muted underline"
              onClick={() => void patchPrize(prizeId, { [field]: null })}
            >
              ∞
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center text-xs">
          <div>
            <p className="text-muted">Kota</p>
            <p className="font-semibold">{value == null ? "∞" : value}</p>
          </div>
          <div>
            <p className="text-muted">Kullanılan</p>
            <p className="font-semibold">{used}</p>
          </div>
          <div>
            <p className="text-muted">Kalan</p>
            <p
              className={`font-semibold ${
                left === 0 ? "text-danger" : "text-accent"
              }`}
            >
              {left == null ? "∞" : left}
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function removePrize(id: string) {
    if (!confirm("Bu dilim silinsin / pasife alınsın mı?")) return;
    await fetch(`/api/campaigns/${campaignId}/prizes/${id}`, {
      method: "DELETE",
    });
    void loadPrizes();
    void loadSpins();
  }

  return (
    <div className="space-y-4 rounded-xl border border-line bg-card p-5">
      <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
        2) Şans çarkı
      </h2>
      <p className="text-xs text-muted">
        Müşteri QR ile /oyun sayfasında çarkı çevirir. Kazanınca kasada
        &quot;Hediyelerim → Aldım&quot; ile teslim onaylanır. Hediye görseli
        isteğe bağlıdır.
      </p>

      <form onSubmit={saveSettings} className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Şans çarkını aç
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Kişi başı günlük çevirme hakkı
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={spinsDay}
              onChange={(e) => setSpinsDay(Number(e.target.value) || 1)}
              className="w-28 rounded-md border border-line bg-white px-3 py-2"
            />
            <span className="mt-1 block text-xs text-muted">
              Aynı telefonda numara değiştirilerek yeni hak alınamaz.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Çevirmeler arası bekleme (dakika)
            </span>
            <input
              type="number"
              min={0}
              max={1440}
              value={cooldownMin}
              onChange={(e) =>
                setCooldownMin(Math.max(0, Number(e.target.value) || 0))
              }
              className="w-28 rounded-md border border-line bg-white px-3 py-2"
            />
            <span className="mt-1 block text-xs text-muted">
              Örn. 30 = 30 dakikada bir. 0 = bekleme yok.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Hediye alma süresi (dakika)
            </span>
            <input
              type="number"
              min={0}
              max={1440}
              value={claimWindow}
              onChange={(e) =>
                setClaimWindow(Math.max(0, Number(e.target.value) || 0))
              }
              className="w-28 rounded-md border border-line bg-white px-3 py-2"
            />
            <span className="mt-1 block text-xs text-muted">
              Örn. 10 = 10 dk içinde kassadan alın. Süre dolarsa: Zamanında
              alınmadı — iptal. 0 = süre yok.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Market şifresi (5 rakam, isteğe bağlı)
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="Boş = şifre istemez"
              className="w-36 rounded-md border border-line bg-white px-3 py-2 tracking-[0.3em]"
            />
            <span className="mt-1 block text-xs text-muted">
              Doluysa müşteri telefon + market şifresi ile giriş / çevirme yapar.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Kasiyer şifresi (5 rakam) — Aldım onayı
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={cashierPin}
              onChange={(e) =>
                setCashierPin(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="Kassada Aldım için"
              className="w-36 rounded-md border border-line bg-white px-3 py-2 tracking-[0.3em]"
            />
            <span className="mt-1 block text-xs text-muted">
              Market şifresinden ayrı olmalı. Müşteri Aldım derken kasiyer bu
              şifreyi girer. Çark açıkken zorunlu — kaydetmeden telefon testi
              yapmayın.
            </span>
            {claimPin && claimPin.length === 5 ? (
              <span className="mt-1 block text-xs font-semibold text-emerald-700">
                Sunucuda kasiyer PIN kayıtlı ✓
              </span>
            ) : (
              <span className="mt-1 block text-xs font-semibold text-amber-800">
                Sunucuda kasiyer PIN yok — Aldım PIN sormadan / teslim
                etmeden kalır. 5 rakam yazıp «Kaydet».
              </span>
            )}
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
          />
          <span>
            Çarkta hediye adlarını göster
            <span className="mt-0.5 block text-xs text-muted">
              Kapalıysa dilimlerde sadece numara görünür.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={equalSlices}
            onChange={(e) => setEqualSlices(e.target.checked)}
          />
          <span>
            Dilimleri eşit göster
            <span className="mt-0.5 block text-xs text-muted">
              Açıkken her dilim (boş dilim dahil) eşit görünür; kazanma şansı
              yine ağırlığa göre hesaplanır.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={askName}
            onChange={(e) => {
              const on = e.target.checked;
              setAskName(on);
              if (!on) setNameRequired(false);
            }}
          />
          <span>
            Ad soyad sor (aktif)
            <span className="mt-0.5 block text-xs text-muted">
              Açıkken telefon numarasının altında ad-soyad alanı görünür.
            </span>
          </span>
        </label>
        <label
          className={`flex items-start gap-2 text-sm ${askName ? "" : "opacity-50"}`}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={nameRequired}
            disabled={!askName}
            onChange={(e) => setNameRequired(e.target.checked)}
          />
          <span>
            Ad soyad zorunlu
            <span className="mt-0.5 block text-xs text-muted">
              Kapalıysa (serbest) boş bırakılabilir; açıkken en az 2 karakter
              gerekir.
            </span>
          </span>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-line px-3 py-2 text-sm hover:bg-white disabled:opacity-60"
        >
          Ayarları kaydet
        </button>
      </form>

      <LocationEditor campaignId={campaignId} />

      {enabled ? (
        <>
          <div className="rounded-xl border border-line bg-gradient-to-br from-[#FFF9F0] to-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Yeni dilim ekle</p>
                <p className="mt-0.5 text-xs text-muted">
                  Ad, renk ve şans önerisi seçin → ekleyin → karttan düzenleyin.
                </p>
              </div>
              <span
                className="inline-flex h-9 w-9 shrink-0 rounded-full border-2 border-white shadow"
                style={{ background: color }}
                title="Önizleme rengi"
              />
            </div>

            <div className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">
                Öneri asistanı
              </p>
              <ul className="space-y-1 text-xs text-amber-950/90">
                {coachTips.map((t) => (
                  <li key={t} className="flex gap-1.5">
                    <span className="mt-0.5 text-amber-600">▸</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={addPrize} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted">Dilim / hediye adı</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isEmpty ? "örn. Boş / Tekrar dene" : "örn. Red Bull 250ml"
                    }
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
                  />
                </label>

                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-sm text-muted">Şans aralığı (önerilen)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CHANCE_PRESETS.map((preset) => {
                      const active =
                        weight === preset.weight &&
                        Boolean(isEmpty) === Boolean(preset.forEmpty);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyChancePreset(preset.id)}
                          title={preset.hint}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            active
                              ? "border-ink bg-ink text-white"
                              : "border-line bg-white text-ink hover:border-ink/40"
                          }`}
                        >
                          {preset.label}
                          <span className="ml-1 opacity-70">·{preset.weight}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Ağırlık</span>
                      <input
                        type="number"
                        min={0}
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value) || 0)}
                        className="w-24 rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <p className="pb-2 text-sm font-semibold text-accent">
                      ≈ %{draftChancePct.toFixed(1)} çıkış
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Yüksek ağırlık = daha sık. Örn. 40 + 10 + 1 → ~%78 / %20 / %2.
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-lg border border-line bg-white/70 p-3">
                  <p className="mb-2 text-sm font-medium">Kota süreleri</p>
                  <p className="mb-2 text-[11px] text-muted">
                    Boş = sınırsız. Hepsi birlikte çalışır: gün / hafta (Pzt–Paz)
                    / ay / toplam — hangisi önce dolarsa dilim seçilmez.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-xs">
                      <span className="mb-1 block text-muted">Günlük</span>
                      <input
                        type="number"
                        min={0}
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(e.target.value)}
                        placeholder="örn. 5"
                        disabled={isEmpty}
                        className="w-full rounded-lg border border-line bg-white px-2 py-2 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block text-muted">Haftalık</span>
                      <input
                        type="number"
                        min={0}
                        value={weeklyLimit}
                        onChange={(e) => setWeeklyLimit(e.target.value)}
                        placeholder="örn. 25"
                        disabled={isEmpty}
                        className="w-full rounded-lg border border-line bg-white px-2 py-2 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block text-muted">Aylık</span>
                      <input
                        type="number"
                        min={0}
                        value={monthlyLimit}
                        onChange={(e) => setMonthlyLimit(e.target.value)}
                        placeholder="örn. 80"
                        disabled={isEmpty}
                        className="w-full rounded-lg border border-line bg-white px-2 py-2 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block text-muted">Toplam</span>
                      <input
                        type="number"
                        min={0}
                        value={totalLimit}
                        onChange={(e) => setTotalLimit(e.target.value)}
                        placeholder="örn. 100"
                        disabled={isEmpty}
                        className="w-full rounded-lg border border-line bg-white px-2 py-2 text-sm disabled:opacity-50"
                      />
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <p className="mb-1.5 text-sm text-muted">Dilim rengi</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {SLICE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Renk ${c}`}
                        onClick={() => setColor(c)}
                        className={`h-8 w-8 rounded-full border-2 transition ${
                          color.toLowerCase() === c.toLowerCase()
                            ? "border-ink scale-110"
                            : "border-white shadow ring-1 ring-black/10"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Özel
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-line bg-white"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-line bg-white/80 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={isEmpty}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setIsEmpty(on);
                    if (on) {
                      setWeight(40);
                      if (!name.trim()) setName("Boş / Tekrar dene");
                      setDailyLimit("");
                      setWeeklyLimit("");
                      setMonthlyLimit("");
                      setTotalLimit("");
                    }
                  }}
                />
                <span>
                  Boş dilim (kaybet / tekrar dene)
                  <span className="mt-0.5 block text-xs text-muted">
                    Stok tutmaz; günlük hak yine harcanır. Bütçe için önerilir.
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                Dilim ekle
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Dilimler &amp; stok takibi</p>
            <p className="text-xs text-muted">
              Karttan <strong>ad / renk / şans</strong> ve{" "}
              <strong>günlük · haftalık · aylık · toplam</strong> kotayı
              düzenleyin. Kalan 0 → çarkta seçilmez. Görsel isteğe bağlıdır.
            </p>
            {prizes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-white/50 px-3 py-4 text-sm text-muted">
                Henüz dilim yok. Yukarıdan önerilen şansı seçip &quot;Dilim
                ekle&quot;ye basın.
              </p>
            ) : null}
            {prizes.length > 0 && activeEmptyCount === 0 ? (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
                ⚠️ Aktiv boş dilim yoxdur
                {totalEmptyCount > 0
                  ? " (var amma Pasif) — çarxda görünmür və"
                  : " —"}{" "}
                hər fırlatma mütləq hədiyyə qazandıracaq (stok riski). Aşağıda
                boş dilimi «Aktif» edin və ya yeni boş dilim əlavə edin.
              </p>
            ) : null}
            {prizes.length > 0 ? (
              <ul className="space-y-3">
                {prizes.map((p, idx) => {
                  const pct =
                    totalWeight > 0 && p.active
                      ? ((p.weight / totalWeight) * 100).toFixed(1)
                      : "0";
                  const st = stockById.get(p.id);
                  const dailyKota = p.dailyLimit;
                  const weeklyKota = p.weeklyLimit;
                  const monthlyKota = p.monthlyLimit;
                  const totalKota = p.totalLimit;
                  const dayWon = st?.todayWins ?? 0;
                  const weekWon = st?.weekWins ?? 0;
                  const monthWon = st?.monthWins ?? 0;
                  const allWon = st?.totalWins ?? 0;
                  const dayLeft =
                    dailyKota == null ? null : Math.max(0, dailyKota - dayWon);
                  const weekLeft =
                    weeklyKota == null
                      ? null
                      : Math.max(0, weeklyKota - weekWon);
                  const monthLeft =
                    monthlyKota == null
                      ? null
                      : Math.max(0, monthlyKota - monthWon);
                  const totalLeft =
                    totalKota == null ? null : Math.max(0, totalKota - allWon);
                  const depleted =
                    !p.isEmpty &&
                    ((dayLeft === 0 && dailyKota != null) ||
                      (weekLeft === 0 && weeklyKota != null) ||
                      (monthLeft === 0 && monthlyKota != null) ||
                      (totalLeft === 0 && totalKota != null));
                  const isEditing = editingId === p.id;
                  return (
                    <li
                      key={p.id}
                      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                        depleted
                          ? "border-danger/40 opacity-90"
                          : "border-line"
                      }`}
                    >
                      <div
                        className="h-1.5 w-full"
                        style={{ background: p.color }}
                      />
                      <div className="flex flex-wrap items-start gap-3 p-3">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                            style={{ background: p.color }}
                            title={`Dilim #${idx + 1}`}
                          >
                            {idx + 1}
                          </div>
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-16 w-16 rounded-lg border border-line object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-line text-center text-[10px] text-muted"
                              style={{ background: `${p.color}22` }}
                            >
                              {p.isEmpty ? "Boş" : "Görsel yok"}
                            </div>
                          )}
                          {!p.isEmpty ? (
                            <label className="cursor-pointer rounded-md border border-line bg-white px-2 py-1 text-center text-[11px] font-medium text-ink hover:bg-bg-deep/30">
                              {p.imageUrl ? "Görsel değiştir" : "Görsel +"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void uploadPrizeImage(p.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{p.name}</span>
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                              ≈ %{pct}
                            </span>
                            {p.isEmpty ? (
                              <span className="rounded-full bg-bg-deep px-2 py-0.5 text-xs text-muted">
                                Boş / kaybet
                              </span>
                            ) : null}
                            {depleted ? (
                              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                                Stok bitti
                              </span>
                            ) : null}
                            {!p.active ? (
                              <span className="rounded-full bg-bg-deep px-2 py-0.5 text-xs text-muted">
                                Pasif
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="ml-auto text-xs font-medium text-accent underline"
                              onClick={() =>
                                setEditingId(isEditing ? null : p.id)
                              }
                            >
                              {isEditing ? "Kapat" : "Düzenle"}
                            </button>
                          </div>

                          {isEditing ? (
                            <div className="space-y-2 rounded-lg border border-line bg-bg-deep/30 p-2.5">
                              <label className="block text-xs">
                                <span className="mb-1 block text-muted">Ad</span>
                                <input
                                  className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                                  value={p.name}
                                  onChange={(e) =>
                                    setPrizes((prev) =>
                                      prev.map((x) =>
                                        x.id === p.id
                                          ? { ...x, name: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (!v) {
                                      void loadPrizes();
                                      return;
                                    }
                                    void patchPrize(p.id, { name: v });
                                  }}
                                />
                              </label>
                              <div>
                                <p className="mb-1 text-xs text-muted">Renk</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {SLICE_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() =>
                                        void patchPrize(p.id, { color: c })
                                      }
                                      className={`h-6 w-6 rounded-full border ${
                                        p.color.toLowerCase() === c.toLowerCase()
                                          ? "border-ink ring-1 ring-ink"
                                          : "border-white ring-1 ring-black/10"
                                      }`}
                                      style={{ background: c }}
                                    />
                                  ))}
                                  <input
                                    type="color"
                                    value={
                                      p.color.startsWith("#")
                                        ? p.color
                                        : "#888888"
                                    }
                                    onChange={(e) =>
                                      void patchPrize(p.id, {
                                        color: e.target.value,
                                      })
                                    }
                                    className="h-6 w-8 cursor-pointer rounded border border-line"
                                  />
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-xs text-muted">
                                  Şans önerisi
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {CHANCE_PRESETS.filter((pr) =>
                                    p.isEmpty ? true : !pr.forEmpty,
                                  ).map((pr) => (
                                    <button
                                      key={pr.id}
                                      type="button"
                                      title={pr.hint}
                                      onClick={() =>
                                        void patchPrize(p.id, {
                                          weight: pr.weight,
                                          ...(pr.forEmpty
                                            ? { isEmpty: true }
                                            : {}),
                                        })
                                      }
                                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                        p.weight === pr.weight
                                          ? "border-ink bg-ink text-white"
                                          : "border-line bg-white"
                                      }`}
                                    >
                                      {pr.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs">
                                <span className="text-muted">Ağırlık</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="w-16 rounded border border-line px-1 py-0.5"
                                  value={p.weight}
                                  onChange={(e) =>
                                    void patchPrize(p.id, {
                                      weight: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                                <span className="font-semibold text-accent">
                                  ≈ %{pct}
                                </span>
                              </label>
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={p.isEmpty}
                                  onChange={(e) =>
                                    void patchPrize(p.id, {
                                      isEmpty: e.target.checked,
                                    })
                                  }
                                />
                                Boş dilim
                              </label>
                            </div>
                          ) : null}

                          {!p.isEmpty ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <QuotaCard
                                title="Günlük kota"
                                hint="Bugün (İstanbul)"
                                field="dailyLimit"
                                prizeId={p.id}
                                value={dailyKota}
                                used={dayWon}
                                left={dayLeft}
                              />
                              <QuotaCard
                                title="Haftalık kota"
                                hint="Pzt–Paz bu hafta"
                                field="weeklyLimit"
                                prizeId={p.id}
                                value={weeklyKota}
                                used={weekWon}
                                left={weekLeft}
                              />
                              <QuotaCard
                                title="Aylık kota"
                                hint="Bu ay"
                                field="monthlyLimit"
                                prizeId={p.id}
                                value={monthlyKota}
                                used={monthWon}
                                left={monthLeft}
                              />
                              <QuotaCard
                                title="Toplam kota"
                                hint="Kampanya boyu"
                                field="totalLimit"
                                prizeId={p.id}
                                value={totalKota}
                                used={allWon}
                                left={totalLeft}
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-muted">
                              Boş dilim stok sayılmaz; her zaman seçilebilir.
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <label className="flex items-center gap-1">
                              <span className="text-xs text-muted">
                                Şans ağırlığı
                              </span>
                              <input
                                type="number"
                                min={0}
                                className="w-16 rounded border border-line px-1 py-0.5"
                                value={p.weight}
                                onChange={(e) =>
                                  void patchPrize(p.id, {
                                    weight: Number(e.target.value) || 0,
                                  })
                                }
                              />
                              <span className="text-xs text-muted">%{pct}</span>
                            </label>
                            <button
                              type="button"
                              className={`text-xs underline ${
                                p.active ? "text-danger" : "text-accent"
                              }`}
                              onClick={() => {
                                if (p.active) {
                                  const isLastActiveEmpty =
                                    p.isEmpty && activeEmptyCount <= 1;
                                  const msg = isLastActiveEmpty
                                    ? `"${p.name}" pasife alınsın? Bu, kampanyanın YEGANE aktif boş dilimidir — pasife alınca çarxta görünməyəcək və hər fırlatma mütləq hədiyyə qazandıracaq.`
                                    : `"${p.name}" pasife alınsın? Çarxta görünməyəcək və seçilməyəcək.`;
                                  if (!window.confirm(msg)) return;
                                }
                                void patchPrize(p.id, { active: !p.active });
                              }}
                            >
                              {p.active ? "Pasifə al" : "Aktivləştir"}
                            </button>
                            <button
                              type="button"
                              className="text-xs text-danger underline"
                              onClick={() => void removePrize(p.id)}
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-line pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">Raporlar</h3>
              <div className="flex gap-1 rounded-lg border border-line bg-white p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setReportTab("spins")}
                  className={`rounded-md px-3 py-1.5 ${
                    reportTab === "spins"
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-bg-deep/40"
                  }`}
                >
                  Çevirmeler
                </button>
                <button
                  type="button"
                  onClick={() => setReportTab("analytics")}
                  className={`rounded-md px-3 py-1.5 ${
                    reportTab === "analytics"
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-bg-deep/40"
                  }`}
                >
                  Analitik
                </button>
              </div>
            </div>

            {reportTab === "analytics" ? (
              <WheelAnalyticsPanel campaignId={campaignId} />
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">
                      Çevirmeler &amp; teslim
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <label>
                        Gün
                        <input
                          type="date"
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                          className="ml-2 rounded border border-line px-2 py-1"
                        />
                      </label>
                      <label>
                        Filial
                        <select
                          value={locationId ?? ""}
                          onChange={(e) => setLocationId(e.target.value || null)}
                          className="ml-2 rounded border border-line px-2 py-1"
                        >
                          <option value="">Tümü</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <select
                        value={filter}
                        onChange={(e) =>
                          setFilter(e.target.value as "all" | "pending")
                        }
                        className="rounded border border-line px-2 py-1"
                      >
                        <option value="all">Tümü</option>
                        <option value="pending">Teslim bekleyen</option>
                      </select>
                    </div>
                  </div>
                  <a
                    href={`/api/campaigns/${campaignId}/wheel/spins?day=${encodeURIComponent(
                      day,
                    )}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}${filter === "pending" ? "&filter=pending" : ""}&format=csv`}
                    className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-accent hover:bg-bg-deep/30"
                  >
                    CSV export
                  </a>
                </div>
                {stock.filter((s) => !s.isEmpty).length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-line bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-muted">
                          <th className="px-2 py-1.5">Hediye</th>
                          <th className="px-2 py-1.5">Gün (kalan)</th>
                          <th className="px-2 py-1.5">Hafta (kalan)</th>
                          <th className="px-2 py-1.5">Ay (kalan)</th>
                          <th className="px-2 py-1.5">Toplam (kalan)</th>
                          <th className="px-2 py-1.5">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock
                          .filter((s) => !s.isEmpty)
                          .map((s) => (
                            <tr
                              key={s.prizeId}
                              className="border-b border-line/50"
                            >
                              <td className="px-2 py-1.5 font-medium">
                                {s.name}
                              </td>
                              <td className="px-2 py-1.5">
                                {s.dailyLimit == null
                                  ? "∞"
                                  : `${s.todayWins}/${s.dailyLimit} → ${s.remaining ?? 0}`}
                              </td>
                              <td className="px-2 py-1.5">
                                {s.weeklyLimit == null
                                  ? "∞"
                                  : `${s.weekWins ?? 0}/${s.weeklyLimit} → ${s.remainingWeekly ?? 0}`}
                              </td>
                              <td className="px-2 py-1.5">
                                {s.monthlyLimit == null
                                  ? "∞"
                                  : `${s.monthWins ?? 0}/${s.monthlyLimit} → ${s.remainingMonthly ?? 0}`}
                              </td>
                              <td className="px-2 py-1.5">
                                {s.totalLimit == null
                                  ? "∞"
                                  : `${s.totalWins ?? 0}/${s.totalLimit} → ${s.remainingTotal ?? 0}`}
                              </td>
                              <td className="px-2 py-1.5">
                                {s.selectable === false ? (
                                  <span className="text-danger">Seçilmez</span>
                                ) : (
                                  <span className="text-accent">Aktif</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className="max-h-52 overflow-y-auto rounded border border-line bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="px-2 py-1">Ad soyad</th>
                        <th className="px-2 py-1">Telefon</th>
                        <th className="px-2 py-1">Hediye</th>
                        <th className="px-2 py-1">Tarih / saat</th>
                        <th className="px-2 py-1">Gün</th>
                        <th className="px-2 py-1">Filial</th>
                        <th className="px-2 py-1">Teslim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spins.map((s) => (
                        <tr key={s.id} className="border-b border-line/50">
                          <td className="px-2 py-1 text-[11px]">
                            {s.fullName || "—"}
                          </td>
                          <td className="px-2 py-1 font-mono text-[11px]">
                            {s.phone}
                          </td>
                          <td className="px-2 py-1">
                            {s.prizeName}
                            {!s.won ? " (boş)" : ""}
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            {s.spunAtLabel}
                          </td>
                          <td className="px-2 py-1 font-mono text-[10px] text-muted">
                            {s.dayKey}
                          </td>
                          <td className="px-2 py-1">{s.locationName ?? "—"}</td>
                          <td className="px-2 py-1">
                            {!s.won ? (
                              "—"
                            ) : s.claimed ? (
                              <span className="text-accent">
                                Alındı
                                {s.claimedAtLabel
                                  ? ` · ${s.claimedAtLabel}`
                                  : ""}
                              </span>
                            ) : s.cancelled ? (
                              <span className="text-danger">
                                Zamanında alınmadı — iptal
                              </span>
                            ) : (
                              <span className="text-danger">Bekliyor</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {spins.length === 0 ? (
                    <p className="p-2 text-muted">Bu gün kayıt yok.</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {message ? <p className="text-sm text-accent">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
