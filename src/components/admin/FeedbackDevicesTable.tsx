"use client";

import { useCallback, useEffect, useState } from "react";

type Device = {
  id: string;
  deviceId: string;
  label: string | null;
  firstSeenAtLabel: string;
  lastSeenAtLabel: string;
  totalCount: number;
  suggestionCount: number;
  complaintCount: number;
  avgRating: number | null;
};

type HistoryEntry = {
  id: string;
  type: "SUGGESTION" | "COMPLAINT";
  rating: number | null;
  message: string;
  locationName: string | null;
  createdAtLabel: string;
};

type Props = { feedbackBoxId: string };

export default function FeedbackDevicesTable({ feedbackBoxId }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback-boxes/${feedbackBoxId}/devices`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Yüklenemedi");
        return;
      }
      setDevices(data.devices || []);
    } catch {
      setError("Bağlantı hatası — cihazlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [feedbackBoxId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLabel(deviceRecordId: string, label: string) {
    const res = await fetch(
      `/api/admin/feedback-boxes/${feedbackBoxId}/devices/${deviceRecordId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || null }),
      },
    );
    if (res.ok) void load();
  }

  async function toggleExpand(deviceRecordId: string) {
    if (expanded === deviceRecordId) {
      setExpanded(null);
      return;
    }
    setExpanded(deviceRecordId);
    if (!history[deviceRecordId]) {
      setHistoryLoading(deviceRecordId);
      try {
        const res = await fetch(
          `/api/admin/feedback-boxes/${feedbackBoxId}/devices/${deviceRecordId}/entries`,
        );
        const data = await res.json();
        if (res.ok) {
          setHistory((h) => ({ ...h, [deviceRecordId]: data.entries || [] }));
        }
      } finally {
        setHistoryLoading(null);
      }
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Her cihazın gönderim geçmişi anonim bir kimlikle (deviceId) takip edilir.
        Analiz/raporlama için cihazlara isim/etiket verebilirsiniz (örn.
        &quot;Giriş kiosku&quot;).
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">Yükleniyor…</p> : null}
      {!loading && devices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-card/60 p-6 text-center text-sm text-muted">
          Henüz cihaz kaydı yok — birileri gönderim yapınca burada görünecek.
        </p>
      ) : null}

      <div className="space-y-2">
        {devices.map((d) => (
          <div key={d.id} className="rounded-xl border border-line bg-card">
            <div className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-[180px] flex-1">
                <input
                  defaultValue={d.label || ""}
                  key={`${d.id}-${d.label}`}
                  placeholder={`Cihaz ${d.deviceId.slice(0, 8)}…`}
                  onBlur={(e) => {
                    if (e.target.value !== (d.label || "")) void saveLabel(d.id, e.target.value);
                  }}
                  className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium outline-none focus:border-accent"
                />
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                  {d.deviceId}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                <Stat label="Toplam" value={d.totalCount} />
                <Stat label="Öneri" value={d.suggestionCount} tone="emerald" />
                <Stat label="Şikayet" value={d.complaintCount} tone="danger" />
                <Stat
                  label="Ort. yıldız"
                  value={d.avgRating != null ? d.avgRating.toFixed(1) : "—"}
                />
              </div>
              <div className="text-right text-[11px] text-muted">
                <div>İlk: {d.firstSeenAtLabel}</div>
                <div>Son: {d.lastSeenAtLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => void toggleExpand(d.id)}
                className="rounded border border-line px-2.5 py-1 text-xs hover:bg-bg-deep/40"
              >
                {expanded === d.id ? "Kapat" : "Geçmiş"}
              </button>
            </div>
            {expanded === d.id ? (
              <div className="border-t border-line bg-bg-deep/20 p-3">
                {historyLoading === d.id ? (
                  <p className="text-xs text-muted">Yükleniyor…</p>
                ) : (history[d.id] || []).length === 0 ? (
                  <p className="text-xs text-muted">Kayıt yok.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(history[d.id] || []).map((h) => (
                      <li key={h.id} className="rounded-md border border-line bg-white p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {h.type === "COMPLAINT" ? "Şikayet" : "Öneri"} ·{" "}
                            {h.rating != null ? (
                              <>
                                {"★".repeat(h.rating)}
                                {"☆".repeat(5 - h.rating)}
                              </>
                            ) : (
                              "Puansız"
                            )}
                          </span>
                          <span className="whitespace-nowrap text-muted">
                            {h.createdAtLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-ink/80">{h.message}</p>
                        {h.locationName ? (
                          <p className="mt-1 text-muted">{h.locationName}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "emerald" | "danger";
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`font-semibold ${
          tone === "emerald"
            ? "text-emerald-700"
            : tone === "danger"
              ? "text-danger"
              : "text-ink"
        }`}
      >
        {value}
      </span>
      {label}
    </span>
  );
}
