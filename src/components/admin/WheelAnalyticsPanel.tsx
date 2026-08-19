"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "week" | "month" | "custom";

type AnalyticsPayload = {
  range: Range;
  from: string;
  to: string;
  kpis: {
    spins: number;
    wins: number;
    empties: number;
    claimed: number;
    cancelled: number;
    uniquePhones: number;
    claimRate: number;
    cancelRate: number;
    emptyRate: number;
    winRate: number;
  };
  byDay: {
    day: string;
    spins: number;
    wins: number;
    empties: number;
    claimed: number;
    cancelled: number;
  }[];
  byMonth: {
    month: string;
    spins: number;
    wins: number;
    empties: number;
    claimed: number;
    cancelled: number;
  }[];
  byPrize: {
    prizeId: string;
    name: string;
    isEmpty: boolean;
    wins: number;
    claimed: number;
    cancelled: number;
    pending: number;
    claimRate: number;
    share: number;
    remainingTotal: number | null;
    totalLimit: number | null;
    dailyLimit: number | null;
    selectable: boolean;
  }[];
  byLocation: {
    locationId: string | null;
    locationName: string;
    spins: number;
    wins: number;
    empties: number;
    claimed: number;
    cancelled: number;
    claimRate: number;
  }[];
  seriesCompare: {
    prevFrom: string;
    prevTo: string;
    spinsDeltaPct: number | null;
    winsDeltaPct: number | null;
    claimRateDelta: number | null;
  };
  insights: {
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
    action: string;
  }[];
  aiSummary: string | null;
  recentSpins: {
    id: string;
    phone: string;
    prizeName: string;
    status: string;
    spunAtLabel: string;
    won: boolean;
    locationName: string | null;
  }[];
};

type PrizeSortKey = "name" | "wins" | "share" | "claimRate" | "cancelled" | "remaining";

type Props = { campaignId: string };

function deltaLabel(v: number | null) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

function statusTr(s: string) {
  if (s === "alindi") return "Alındı";
  if (s === "iptal") return "İptal";
  if (s === "bekliyor") return "Bekliyor";
  return "Boş";
}

export default function WheelAnalyticsPanel({ campaignId }: Props) {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [locationId, setLocationId] = useState<string | null>(null);
  const [prizeSort, setPrizeSort] = useState<{
    key: PrizeSortKey;
    dir: "asc" | "desc";
  }>({ key: "wins", dir: "desc" });

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ range });
      if (range === "custom") {
        if (from) q.set("from", from);
        if (to) q.set("to", to);
      }
      if (locationId) q.set("locationId", locationId);
      const res = await fetch(
        `/api/campaigns/${campaignId}/wheel/analytics?${q}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Yüklenemedi");
        return;
      }
      setData(json as AnalyticsPayload);
      if (!from) setFrom(json.from);
      if (!to) setTo(json.to);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }, [campaignId, range, from, to, locationId]);

  useEffect(() => {
    if (range !== "custom") void load();
  }, [range, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
    // reload on location change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    void load();
    // ilk yükleme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

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

  const sortedPrizes = useMemo(() => {
    if (!data) return [];
    const rows = data.byPrize.filter((p) => !p.isEmpty);
    const { key, dir } = prizeSort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av =
        key === "name"
          ? a.name
          : key === "remaining"
            ? (a.remainingTotal ?? 1e12)
            : a[key];
      const bv =
        key === "name"
          ? b.name
          : key === "remaining"
            ? (b.remainingTotal ?? 1e12)
            : b[key];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * mul;
      }
      return ((av as number) - (bv as number)) * mul;
    });
  }, [data, prizeSort]);

  function toggleSort(key: PrizeSortKey) {
    setPrizeSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  const csvHref = useMemo(() => {
    const q = new URLSearchParams({ range, format: "csv" });
    if (range === "custom") {
      if (from) q.set("from", from);
      if (to) q.set("to", to);
    } else if (data) {
      q.set("from", data.from);
      q.set("to", data.to);
    }
    if (locationId) q.set("locationId", locationId);
    return `/api/campaigns/${campaignId}/wheel/analytics?${q}`;
  }, [campaignId, range, from, to, data, locationId]);

  const dayChart = useMemo(
    () =>
      (data?.byDay || []).map((d) => ({
        ...d,
        label: d.day.slice(5),
      })),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Dönem</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["week", "Haftalık"],
                ["month", "Aylık"],
                ["custom", "İki tarih arası"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRange(id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  range === id
                    ? "bg-ink text-white"
                    : "border border-line bg-white text-muted hover:bg-bg-deep/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {range === "custom" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="text-muted">
                Başlangıç
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="ml-2 rounded border border-line px-2 py-1"
                />
              </label>
              <label className="text-muted">
                Bitiş
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="ml-2 rounded border border-line px-2 py-1"
                />
              </label>
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy}
                className="rounded-md border border-line bg-white px-3 py-1.5 text-sm disabled:opacity-60"
              >
                Uygula
              </button>
            </div>
          ) : null}
          {data ? (
            <p className="text-xs text-muted">
              {data.from} → {data.to}
              {data.seriesCompare.prevFrom ? (
                <>
                  {" "}
                  · önceki: {data.seriesCompare.prevFrom} →{" "}
                  {data.seriesCompare.prevTo}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {locations.length > 0 ? (
            <label className="text-sm text-muted">
              Filial
              <select
                className="ml-2 rounded border border-line px-2 py-1.5"
                value={locationId ?? ""}
                onChange={(e) => {
                  setLocationId(e.target.value || null);
                }}
              >
                <option value="">Tümü</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-60"
          >
            {busy ? "Yükleniyor…" : "Yenile"}
          </button>
          <a
            href={csvHref}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-accent hover:bg-bg-deep/30"
          >
            CSV export
          </a>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Çevirme"
              value={String(data.kpis.spins)}
              hint={deltaLabel(data.seriesCompare.spinsDeltaPct)}
            />
            <Kpi
              label="Kazanç"
              value={String(data.kpis.wins)}
              hint={`Oran %${data.kpis.winRate} · ${deltaLabel(data.seriesCompare.winsDeltaPct)}`}
            />
            <Kpi
              label="Teslim oranı"
              value={`%${data.kpis.claimRate}`}
              hint={`${data.kpis.claimed} alındı · Δ ${deltaLabel(data.seriesCompare.claimRateDelta)}`}
            />
            <Kpi
              label="İptal / Boş"
              value={`%${data.kpis.cancelRate} / %${data.kpis.emptyRate}`}
              hint={`${data.kpis.cancelled} iptal · ${data.kpis.empties} boş · ${data.kpis.uniquePhones} tekil no`}
            />
          </div>

          <div className="rounded-xl border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Akıllı öneriler</h4>
              <span className="text-[10px] uppercase tracking-wide text-muted">
                Yerel analiz{data.aiSummary ? " + AI özet" : ""}
              </span>
            </div>
            {data.aiSummary ? (
              <p className="mb-3 rounded-lg border border-line bg-bg-deep/30 px-3 py-2 text-sm leading-relaxed text-ink">
                {data.aiSummary}
              </p>
            ) : null}
            {data.insights.length === 0 ? (
              <p className="text-sm text-muted">
                Bu dönemde kritik uyarı yok — dengeli görünüyor.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.insights.map((i) => (
                  <li
                    key={i.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      i.severity === "critical"
                        ? "border-danger/40 bg-danger/5"
                        : i.severity === "warning"
                          ? "border-amber-500/35 bg-amber-50"
                          : "border-line bg-bg-deep/20"
                    }`}
                  >
                    <p className="font-medium">{i.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{i.detail}</p>
                    <p className="mt-1 text-xs font-medium text-ink">
                      Öneri: {i.action}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-3">
              <h4 className="mb-2 text-sm font-medium">Gün gün</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dayChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e2dc" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="spins"
                      name="Çevirme"
                      stroke="#1c1917"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="wins"
                      name="Kazanç"
                      stroke="#0f6b5c"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="claimed"
                      name="Teslim"
                      stroke="#1d4ed8"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cancelled"
                      name="İptal"
                      stroke="#9f1239"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-3">
              <h4 className="mb-2 text-sm font-medium">Ay ay</h4>
              <div className="h-64 w-full">
                {data.byMonth.length === 0 ? (
                  <p className="text-sm text-muted">Veri yok</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e2dc" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="spins" name="Çevirme" fill="#1c1917" />
                      <Bar dataKey="wins" name="Kazanç" fill="#0f6b5c" />
                      <Bar dataKey="claimed" name="Teslim" fill="#1d4ed8" />
                      <Bar dataKey="cancelled" name="İptal" fill="#9f1239" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  {(
                    [
                      ["name", "Hediye"],
                      ["wins", "Kazanç"],
                      ["share", "Pay %"],
                      ["claimRate", "Teslim %"],
                      ["cancelled", "İptal"],
                      ["remaining", "Kalan"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className="px-2 py-2">
                      <button
                        type="button"
                        className="font-medium hover:text-ink"
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        {prizeSort.key === key
                          ? prizeSort.dir === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {sortedPrizes.map((p) => (
                  <tr key={p.prizeId} className="border-b border-line/50">
                    <td className="px-2 py-1.5 font-medium">{p.name}</td>
                    <td className="px-2 py-1.5">{p.wins}</td>
                    <td className="px-2 py-1.5">{p.share}</td>
                    <td className="px-2 py-1.5">{p.claimRate}</td>
                    <td className="px-2 py-1.5">{p.cancelled}</td>
                    <td className="px-2 py-1.5">
                      {p.remainingTotal == null ? "∞" : p.remainingTotal}
                    </td>
                    <td className="px-2 py-1.5">
                      {p.selectable ? (
                        <span className="text-accent">Aktif</span>
                      ) : (
                        <span className="text-danger">Seçilmez</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2 text-sm font-medium">
              Filial / konum raporu
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-1.5">Market · Filial</th>
                  <th className="px-2 py-1.5">Çevirme</th>
                  <th className="px-2 py-1.5">Kazanç</th>
                  <th className="px-2 py-1.5">Boş</th>
                  <th className="px-2 py-1.5">Teslim</th>
                  <th className="px-2 py-1.5">İptal</th>
                  <th className="px-2 py-1.5">Teslim %</th>
                </tr>
              </thead>
              <tbody>
                {(data.byLocation || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-muted">
                      Bu dönemde konum kaydı yok
                    </td>
                  </tr>
                ) : (
                  data.byLocation.map((l) => (
                    <tr
                      key={l.locationId || l.locationName}
                      className="border-b border-line/50"
                    >
                      <td className="px-2 py-1.5 font-medium">
                        {l.locationName}
                      </td>
                      <td className="px-2 py-1.5">{l.spins}</td>
                      <td className="px-2 py-1.5">{l.wins}</td>
                      <td className="px-2 py-1.5">{l.empties}</td>
                      <td className="px-2 py-1.5">{l.claimed}</td>
                      <td className="px-2 py-1.5">{l.cancelled}</td>
                      <td className="px-2 py-1.5">{l.claimRate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2 text-sm font-medium">
              Dönem detay listesi (son {data.recentSpins.length})
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-1.5">Telefon</th>
                  <th className="px-2 py-1.5">Filial</th>
                  <th className="px-2 py-1.5">Hediye</th>
                  <th className="px-2 py-1.5">Çevirme saati</th>
                  <th className="px-2 py-1.5">Durum</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSpins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-muted">
                      Kayıt yok
                    </td>
                  </tr>
                ) : (
                  data.recentSpins.map((r) => (
                    <tr key={r.id} className="border-b border-line/40">
                      <td className="px-2 py-1.5">{r.phone}</td>
                      <td className="px-2 py-1.5">
                        {r.locationName || "—"}
                      </td>
                      <td className="px-2 py-1.5">{r.prizeName}</td>
                      <td className="px-2 py-1.5">{r.spunAtLabel}</td>
                      <td className="px-2 py-1.5">{statusTr(r.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : busy ? (
        <p className="text-sm text-muted">Analitik hazırlanıyor…</p>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
