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

type Range = "day" | "week" | "month" | "custom";

type AnalyticsPayload = {
  range: Range;
  from: string;
  to: string;
  kpis: {
    total: number;
    suggestions: number;
    complaints: number;
    uniqueDevices: number;
    avgRating: number | null;
    ratedCount: number;
    unratedCount: number;
    resolved: number;
    unresolved: number;
    resolutionRate: number;
    complaintRate: number;
  };
  byDay: {
    day: string;
    total: number;
    suggestions: number;
    complaints: number;
    resolved: number;
    ratingSum: number;
    ratingCount: number;
  }[];
  byRating: { rating: number; count: number; share: number }[];
  byLocation: {
    locationId: string | null;
    locationName: string;
    total: number;
    complaints: number;
    avgRating: number | null;
    unresolved: number;
  }[];
  byDevice: {
    deviceId: string;
    label: string | null;
    total: number;
    complaints: number;
    avgRating: number | null;
  }[];
  seriesCompare: {
    totalDeltaPct: number | null;
    complaintRateDelta: number | null;
    avgRatingDelta: number | null;
    resolutionRateDelta: number | null;
  };
  insights: {
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
    action: string;
  }[];
  aiSummary: string | null;
  unresolvedProblems: {
    id: string;
    message: string;
    rating: number | null;
    customerName: string | null;
    customerPhone: string | null;
    locationName: string | null;
    deviceLabel: string | null;
    deviceId: string;
    status: string;
    createdAtLabel: string;
    ageDays: number;
    urgencyScore: number;
  }[];
};

type Props = { feedbackBoxId: string };

const RANGE_OPTIONS: { id: Range; label: string }[] = [
  { id: "day", label: "Günlük" },
  { id: "week", label: "Haftalık" },
  { id: "month", label: "Aylık" },
  { id: "custom", label: "İki tarih arası" },
];

function deltaLabel(v: number | null) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

function statusTr(s: string) {
  if (s === "NEW") return "Yeni";
  if (s === "READ") return "Okundu";
  if (s === "RESOLVED") return "Çözüldü";
  return s;
}

export default function FeedbackAnalyticsPanel({ feedbackBoxId }: Props) {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [devices, setDevices] = useState<{ deviceId: string; label: string | null }[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [rating, setRating] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

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
      if (deviceId) q.set("deviceId", deviceId);
      if (rating) q.set("rating", rating);
      if (typeFilter) q.set("type", typeFilter);
      const res = await fetch(
        `/api/admin/feedback-boxes/${feedbackBoxId}/analytics?${q}`,
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
  }, [feedbackBoxId, range, from, to, locationId, deviceId, rating, typeFilter]);

  useEffect(() => {
    if (range !== "custom") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, locationId, deviceId, rating, typeFilter]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackBoxId]);

  useEffect(() => {
    void (async () => {
      try {
        const [locRes, devRes] = await Promise.all([
          fetch(`/api/admin/feedback-boxes/${feedbackBoxId}/locations`),
          fetch(`/api/admin/feedback-boxes/${feedbackBoxId}/devices`),
        ]);
        if (locRes.ok) {
          const json = await locRes.json();
          const locs = (json.locations || []).map((l: any) => ({
            id: l.id,
            name: l.branchName || l.name,
          }));
          setLocations(locs);
        }
        if (devRes.ok) {
          const json = await devRes.json();
          const devs = (json.devices || []).map((d: any) => ({
            deviceId: d.deviceId,
            label: d.label,
          }));
          setDevices(devs);
        }
      } catch {
        // ignore
      }
    })();
  }, [feedbackBoxId]);

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
    if (deviceId) q.set("deviceId", deviceId);
    if (rating) q.set("rating", rating);
    if (typeFilter) q.set("type", typeFilter);
    return `/api/admin/feedback-boxes/${feedbackBoxId}/analytics?${q}`;
  }, [feedbackBoxId, range, from, to, data, locationId, deviceId, rating, typeFilter]);

  const dayChart = useMemo(
    () =>
      (data?.byDay || []).map((d) => ({
        ...d,
        label: d.day.slice(5),
        avgRating: d.ratingCount > 0 ? Math.round((d.ratingSum / d.ratingCount) * 10) / 10 : 0,
      })),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Dönem</p>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map(({ id, label }) => (
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
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {locations.length > 0 ? (
            <select
              className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
              value={locationId ?? ""}
              onChange={(e) => setLocationId(e.target.value || null)}
            >
              <option value="">Tüm şubeler</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          {devices.length > 0 ? (
            <select
              className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
              value={deviceId ?? ""}
              onChange={(e) => setDeviceId(e.target.value || null)}
            >
              <option value="">Tüm cihazlar</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Cihaz ${d.deviceId.slice(0, 8)}…`}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tüm tipler</option>
            <option value="SUGGESTION">Öneri</option>
            <option value="COMPLAINT">Şikayet</option>
          </select>
          <select
            className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="">Tüm puanlar</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {"★".repeat(r)} ({r})
              </option>
            ))}
          </select>
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
              label="Gönderim"
              value={String(data.kpis.total)}
              hint={deltaLabel(data.seriesCompare.totalDeltaPct)}
            />
            <Kpi
              label="Şikayet oranı"
              value={`%${data.kpis.complaintRate}`}
              hint={`${data.kpis.complaints} şikayet · Δ ${deltaLabel(data.seriesCompare.complaintRateDelta)}`}
            />
            <Kpi
              label="Ortalama puan"
              value={data.kpis.avgRating != null ? data.kpis.avgRating.toFixed(1) : "—"}
              hint={`${data.kpis.ratedCount} puanlı · ${data.kpis.unratedCount} puansız · Δ ${data.seriesCompare.avgRatingDelta != null ? data.seriesCompare.avgRatingDelta : "—"}`}
            />
            <Kpi
              label="Çözüm oranı"
              value={`%${data.kpis.resolutionRate}`}
              hint={`${data.kpis.resolved} çözüldü · ${data.kpis.unresolved} açık · ${data.kpis.uniqueDevices} tekil cihaz`}
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
                    <p className="mt-1 text-xs font-medium text-ink">Öneri: {i.action}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Çözülmemiş problemler</h4>
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {data.unresolvedProblems.length} açık şikayet
              </span>
            </div>
            {data.unresolvedProblems.length === 0 ? (
              <p className="text-sm text-muted">Açık şikayet yok — harika sonuç.</p>
            ) : (
              <ul className="space-y-2">
                {data.unresolvedProblems.slice(0, 12).map((p) => (
                  <li
                    key={p.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      p.ageDays >= 7
                        ? "border-danger/40 bg-danger/5"
                        : p.ageDays >= 3
                          ? "border-amber-500/35 bg-amber-50"
                          : "border-line bg-bg-deep/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {p.rating != null ? (
                          <>
                            {"★".repeat(p.rating)}
                            {"☆".repeat(5 - p.rating)}
                          </>
                        ) : (
                          "Puansız"
                        )}{" "}
                        · {statusTr(p.status)}
                      </span>
                      <span className="text-xs text-muted">
                        {p.ageDays} gün açık · {p.createdAtLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink/90">{p.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {p.locationName || "Şube yok"} ·{" "}
                      {p.deviceLabel || `Cihaz ${p.deviceId.slice(0, 8)}…`}
                    </p>
                    <p className="mt-1 text-xs">
                      {p.customerName || p.customerPhone ? (
                        <span className="inline-flex items-center gap-1 font-medium text-accent">
                          👤 {p.customerName || "Ad yok"}
                          {p.customerPhone ? ` · ${p.customerPhone}` : ""}
                        </span>
                      ) : (
                        <span className="rounded-full bg-bg-deep/60 px-2 py-0.5 text-[10px] font-medium text-muted">
                          Anonim
                        </span>
                      )}
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
                      dataKey="total"
                      name="Toplam"
                      stroke="#1c1917"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="suggestions"
                      name="Öneri"
                      stroke="#0f6b5c"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="complaints"
                      name="Şikayet"
                      stroke="#9f1239"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="resolved"
                      name="Çözüldü"
                      stroke="#1d4ed8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-3">
              <h4 className="mb-2 text-sm font-medium">Puan dağılımı</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byRating}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e2dc" />
                    <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Gönderim" fill="#1c1917" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2 text-sm font-medium">
              Şube raporu
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-1.5">Şube</th>
                  <th className="px-2 py-1.5">Gönderim</th>
                  <th className="px-2 py-1.5">Şikayet</th>
                  <th className="px-2 py-1.5">Ortalama puan</th>
                  <th className="px-2 py-1.5">Açık</th>
                </tr>
              </thead>
              <tbody>
                {data.byLocation.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-muted">
                      Bu dönemde şube kaydı yok
                    </td>
                  </tr>
                ) : (
                  data.byLocation.map((l) => (
                    <tr key={l.locationId || l.locationName} className="border-b border-line/50">
                      <td className="px-2 py-1.5 font-medium">{l.locationName}</td>
                      <td className="px-2 py-1.5">{l.total}</td>
                      <td className="px-2 py-1.5">{l.complaints}</td>
                      <td className="px-2 py-1.5">{l.avgRating ?? "—"}</td>
                      <td className="px-2 py-1.5">{l.unresolved}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2 text-sm font-medium">
              Cihaz raporu
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-1.5">Cihaz</th>
                  <th className="px-2 py-1.5">Gönderim</th>
                  <th className="px-2 py-1.5">Şikayet</th>
                  <th className="px-2 py-1.5">Ortalama puan</th>
                </tr>
              </thead>
              <tbody>
                {data.byDevice.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-muted">
                      Bu dönemde cihaz kaydı yok
                    </td>
                  </tr>
                ) : (
                  data.byDevice.slice(0, 20).map((d) => (
                    <tr key={d.deviceId} className="border-b border-line/50">
                      <td className="px-2 py-1.5 font-medium">
                        {d.label || `Cihaz ${d.deviceId.slice(0, 8)}…`}
                      </td>
                      <td className="px-2 py-1.5">{d.total}</td>
                      <td className="px-2 py-1.5">{d.complaints}</td>
                      <td className="px-2 py-1.5">{d.avgRating ?? "—"}</td>
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

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
