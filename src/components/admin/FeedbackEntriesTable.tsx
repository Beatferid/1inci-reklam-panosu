"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  type: "SUGGESTION" | "COMPLAINT";
  rating: number | null;
  message: string;
  customerName: string | null;
  customerPhone: string | null;
  locationId: string | null;
  locationName: string | null;
  deviceId: string;
  deviceLabel: string | null;
  status: "NEW" | "READ" | "RESOLVED";
  createdAt: string;
  createdAtLabel: string;
};

type Props = { feedbackBoxId: string };

const TYPE_LABEL: Record<string, string> = {
  SUGGESTION: "Öneri",
  COMPLAINT: "Şikayet",
};

const PAGE_SIZE = 20;

type QuickRange = "" | "day" | "week" | "month";

function istanbulDayKeyLocal(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysLocal(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00+03:00`);
  d.setDate(d.getDate() + n);
  return istanbulDayKeyLocal(d);
}

function rangeForQuick(q: QuickRange): { from: string; to: string } | null {
  const today = istanbulDayKeyLocal();
  if (q === "day") return { from: today, to: today };
  if (q === "week") return { from: addDaysLocal(today, -6), to: today };
  if (q === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return null;
}

export default function FeedbackEntriesTable({ feedbackBoxId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [quickRange, setQuickRange] = useState<QuickRange>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [devices, setDevices] = useState<{ deviceId: string; label: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRange = useMemo(() => {
    if (quickRange) return rangeForQuick(quickRange);
    if (customFrom || customTo) return { from: customFrom, to: customTo };
    return null;
  }, [quickRange, customFrom, customTo]);

  const buildFilterParams = useCallback(() => {
    const sp = new URLSearchParams();
    if (typeFilter) sp.set("type", typeFilter);
    if (statusFilter) sp.set("status", statusFilter);
    if (ratingFilter) sp.set("rating", ratingFilter);
    if (deviceFilter) sp.set("deviceId", deviceFilter);
    if (activeRange?.from) sp.set("from", activeRange.from);
    if (activeRange?.to) sp.set("to", activeRange.to);
    return sp;
  }, [typeFilter, statusFilter, ratingFilter, deviceFilter, activeRange]);

  const csvHref = useMemo(() => {
    const sp = buildFilterParams();
    sp.set("format", "csv");
    return `/api/admin/feedback-boxes/${feedbackBoxId}/entries?${sp}`;
  }, [buildFilterParams, feedbackBoxId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = buildFilterParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(PAGE_SIZE));
    try {
      const res = await fetch(
        `/api/admin/feedback-boxes/${feedbackBoxId}/entries?${sp}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Yüklenemedi");
        return;
      }
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch {
      setError("Bağlantı hatası — gönderimler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [feedbackBoxId, buildFilterParams, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/feedback-boxes/${feedbackBoxId}/devices`);
        if (!res.ok) return;
        const data = await res.json();
        setDevices(
          (data.devices || []).map((d: any) => ({ deviceId: d.deviceId, label: d.label })),
        );
      } catch {
        // ignore
      }
    })();
  }, [feedbackBoxId]);

  async function setStatus(entryId: string, status: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: status as Entry["status"] } : e)),
    );
    const res = await fetch(
      `/api/admin/feedback-boxes/${feedbackBoxId}/entries/${entryId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) void load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["", "Tüm tarihler"],
            ["day", "Günlük"],
            ["week", "Haftalık"],
            ["month", "Aylık"],
          ] as [QuickRange, string][]
        ).map(([id, label]) => (
          <button
            key={id || "all"}
            type="button"
            onClick={() => {
              setPage(1);
              setQuickRange(id);
              if (id) {
                setCustomFrom("");
                setCustomTo("");
              }
            }}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
              quickRange === id
                ? "bg-ink text-white"
                : "border border-line bg-white text-muted hover:bg-bg-deep/40"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="text-xs text-muted">
          Başlangıç
          <input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setPage(1);
              setQuickRange("");
              setCustomFrom(e.target.value);
            }}
            className="ml-1.5 rounded border border-line px-1.5 py-1 text-xs"
          />
        </label>
        <label className="text-xs text-muted">
          Bitiş
          <input
            type="date"
            value={customTo}
            onChange={(e) => {
              setPage(1);
              setQuickRange("");
              setCustomTo(e.target.value);
            }}
            className="ml-1.5 rounded border border-line px-1.5 py-1 text-xs"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => {
            setPage(1);
            setTypeFilter(e.target.value);
          }}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Tüm tipler</option>
          <option value="SUGGESTION">Öneri</option>
          <option value="COMPLAINT">Şikayet</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Tüm durumlar</option>
          <option value="NEW">Yeni</option>
          <option value="READ">Okundu</option>
          <option value="RESOLVED">Çözüldü</option>
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => {
            setPage(1);
            setRatingFilter(e.target.value);
          }}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Tüm puanlar</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {"★".repeat(r)} ({r})
            </option>
          ))}
        </select>
        {devices.length > 0 ? (
          <select
            value={deviceFilter}
            onChange={(e) => {
              setPage(1);
              setDeviceFilter(e.target.value);
            }}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Tüm cihazlar</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Cihaz ${d.deviceId.slice(0, 8)}…`}
              </option>
            ))}
          </select>
        ) : null}
        <span className="text-xs text-muted">{total} gönderim</span>
        <a
          href={csvHref}
          className="ml-auto rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-accent hover:bg-bg-deep/30"
        >
          ⬇ CSV export
        </a>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-bg-deep/50 text-muted">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tarih · Saat</th>
              <th className="px-3 py-2 font-medium">Tip</th>
              <th className="px-3 py-2 font-medium">Puan</th>
              <th className="px-3 py-2 font-medium">Mesaj</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Müşteri</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Şube</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Cihaz</th>
              <th className="px-3 py-2 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-line/70 align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                  {e.createdAtLabel}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.type === "COMPLAINT"
                        ? "bg-danger/10 text-danger"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {TYPE_LABEL[e.type]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {e.rating != null ? (
                    <>
                      {"★".repeat(e.rating)}
                      {"☆".repeat(5 - e.rating)}
                    </>
                  ) : (
                    <span className="text-muted">Puansız</span>
                  )}
                </td>
                <td className="min-w-[200px] max-w-sm px-3 py-2 text-xs">{e.message}</td>
                <td className="hidden px-3 py-2 text-xs md:table-cell">
                  {e.customerName || e.customerPhone ? (
                    <>
                      {e.customerName ? (
                        <span className="block font-medium text-ink">{e.customerName}</span>
                      ) : null}
                      {e.customerPhone ? (
                        <span className="block text-muted">{e.customerPhone}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-full bg-bg-deep/60 px-2 py-0.5 text-[10px] font-medium text-muted">
                      Anonim
                    </span>
                  )}
                </td>
                <td className="hidden px-3 py-2 text-xs text-muted md:table-cell">
                  {e.locationName || "—"}
                </td>
                <td className="hidden px-3 py-2 text-xs text-muted md:table-cell">
                  {e.deviceLabel || `${e.deviceId.slice(0, 8)}…`}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={e.status}
                    onChange={(ev) => void setStatus(e.id, ev.target.value)}
                    className="rounded border border-line bg-white px-1.5 py-1 text-xs"
                  >
                    <option value="NEW">Yeni</option>
                    <option value="READ">Okundu</option>
                    <option value="RESOLVED">Çözüldü</option>
                  </select>
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">
                  Gönderim yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-line px-2 py-1 disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-line px-2 py-1 disabled:opacity-40"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
