"use client";

import { useCallback, useEffect, useState } from "react";

type TunnelStatus = {
  ok: boolean;
  severity: "ok" | "warn" | "error";
  configuredUrl: string;
  reachable: boolean;
  originReachable: boolean;
  isTryCloudflare: boolean;
  isLocalhost: boolean;
  title: string;
  detail: string;
  steps: string[];
  checkedAt: string;
};

type RepairResult = {
  ok: boolean;
  url?: string;
  error?: string;
  logTail?: string;
  status?: TunnelStatus;
};

const DISMISS_KEY = "tunnel-alert-dismissed-url";

export default function TunnelAlertOverlay() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    try {
      setDismissedFor(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const h = window.location.hostname;
      if (
        h !== "localhost" &&
        h !== "127.0.0.1" &&
        !h.endsWith("trycloudflare.com")
      ) {
        return;
      }
      const liveHost = window.location.host;
      const qs = liveHost ? `?liveHost=${encodeURIComponent(liveHost)}` : "";
      const res = await fetch(`/api/tunnel${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      let json = (await res.json()) as TunnelStatus;

      // Çalışan trycloudflare'dayız ama kayıtlı URL eski/ölü → sessiz senkron
      const live = window.location.origin;
      if (
        live.includes("trycloudflare.com") &&
        (!json.ok ||
          json.configuredUrl.replace(/\/$/, "") !== live.replace(/\/$/, ""))
      ) {
        const sync = await fetch("/api/tunnel", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: live }),
        });
        if (sync.ok) {
          json = (await sync.json()) as TunnelStatus;
        } else {
          // Sayfa zaten açık — yanlış alarm gösterme
          json = {
            ...json,
            ok: true,
            severity: "ok",
            reachable: true,
            configuredUrl: live,
            title: "Tunnel sağlıklı",
            detail: `Bu sekme çalışan tunnel ile açık: ${live}`,
            steps: [],
          };
        }
      }

      setStatus(json);
      if (json.ok && json.severity !== "warn") {
        setRepairMsg(null);
        setNewUrl(null);
      }
    } catch {
      // ağ yok — sessiz
    }
  }, []);

  useEffect(() => {
    void load();
    // Sağlıklıysa seyrek kontrol — katalog flip'ini meşgul etmesin
    const ms = status && !status.ok ? 10000 : 45000;
    const id = window.setInterval(() => void load(), ms);
    return () => window.clearInterval(id);
  }, [load, status?.ok]);

  async function repair() {
    setBusy(true);
    setRepairMsg("Tunnel yeniden başlatılıyor… (30–45 sn sürebilir)");
    setNewUrl(null);
    try {
      const res = await fetch("/api/tunnel", { method: "POST" });
      const json = (await res.json()) as RepairResult & { error?: string };
      if (!res.ok || !json.ok) {
        setRepairMsg(
          [json.error, json.logTail ? `Log: ${json.logTail.slice(0, 280)}` : ""]
            .filter(Boolean)
            .join("\n") ||
            "Düzeltme başarısız. Admin girişi / localhost ile deneyin.",
        );
        return;
      }
      setNewUrl(json.url || null);
      setRepairMsg(
        json.error ||
          "Tunnel yenilendi. Admin’de QR’ı yenileyin; eski linki atın.",
      );
      if (json.status) setStatus(json.status);
      else await load();
      try {
        sessionStorage.removeItem(DISMISS_KEY);
        setDismissedFor(null);
      } catch {
        // ignore
      }
      setMinimized(false);
    } catch {
      setRepairMsg("Bağlantı hatası — düzeltme isteği gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    if (!status) return;
    try {
      sessionStorage.setItem(DISMISS_KEY, status.configuredUrl);
      setDismissedFor(status.configuredUrl);
    } catch {
      setDismissedFor(status.configuredUrl);
    }
  }

  if (!status) return null;

  // Localhost uyarısı: tam ekran değil, ince üst şerit
  if (status.severity === "warn" && status.isLocalhost && !newUrl && !busy) {
    if (dismissedFor === status.configuredUrl) return null;
    return (
      <div
        className="fixed inset-x-0 top-0 z-[9999] border-b-4 border-yellow-300 px-3 py-3 text-center shadow-lg"
        style={{ background: "#92400e", color: "#fff7ed" }}
      >
        <p className="text-sm font-bold">
          Tunnel yok — QR telefonda açılmaz (şu an localhost)
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void repair()}
            className="rounded-lg bg-yellow-300 px-4 py-2 text-xs font-black uppercase text-black disabled:opacity-60"
          >
            Otomatik tunnel aç
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs underline opacity-90"
          >
            Gizle
          </button>
        </div>
      </div>
    );
  }

  if (status.severity === "ok" && !newUrl) return null;
  if (
    status.severity === "error" &&
    dismissedFor === status.configuredUrl &&
    !newUrl &&
    !busy
  ) {
    return (
      <button
        type="button"
        onClick={() => {
          setDismissedFor(null);
          try {
            sessionStorage.removeItem(DISMISS_KEY);
          } catch {
            // ignore
          }
          setMinimized(false);
        }}
        className="fixed bottom-4 right-4 z-[9999] max-w-[min(100vw-2rem,20rem)] rounded-xl border-2 border-amber-400 bg-amber-500 px-4 py-3 text-left text-sm font-bold text-black shadow-2xl"
      >
        ⚠ Tunnel uyarısı gizli — dokununca aç
      </button>
    );
  }

  if (status.severity !== "error" && !newUrl && !busy && !repairMsg) return null;

  const isError = status.severity === "error" || !status.ok;
  const panelBg = isError ? "#7f1d1d" : "#92400e";
  const accent = isError ? "#fef08a" : "#fde68a";

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed left-1/2 top-3 z-[9999] -translate-x-1/2 animate-pulse rounded-full border-2 border-yellow-300 px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-black shadow-2xl"
        style={{ background: accent }}
      >
        {isError ? "⚠ TUNNEL KOPTU — dokun" : "⚠ Tunnel uyarısı — dokun"}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="tunnel-alert-title"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />

      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border-4 border-yellow-300 shadow-[0_0_0_4px_rgba(0,0,0,0.35),0_25px_80px_rgba(0,0,0,0.55)]"
        style={{ background: panelBg, color: "#fff7ed" }}
      >
        <div
          className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.25em] text-black"
          style={{ background: accent }}
        >
          {isError ? "Kritik · Cloudflare Tunnel" : "Uyarı · Telefon / QR"}
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-200/90">
              Anlık durum
            </p>
            <h2
              id="tunnel-alert-title"
              className="mt-1 text-2xl font-black leading-tight text-yellow-50"
              style={{ fontFamily: "var(--display)" }}
            >
              {newUrl ? "Tunnel yenilendi ✓" : status.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-orange-50/95">
              {newUrl
                ? "Yeni adres hazır. Aşağıdaki linki kullanın ve admin’de QR’ı yenileyin."
                : status.detail}
            </p>
          </div>

          <div className="rounded-xl border border-white/20 bg-black/25 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-200/80">
              Kayıtlı public URL
            </p>
            <p className="mt-1 break-all font-mono text-xs text-yellow-50">
              {newUrl || status.configuredUrl}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  status.originReachable
                    ? "bg-emerald-500/30 text-emerald-100"
                    : "bg-red-500/40 text-red-100"
                }`}
              >
                localhost:3000 {status.originReachable ? "OK" : "KAPALI"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  (newUrl ? true : status.reachable)
                    ? "bg-emerald-500/30 text-emerald-100"
                    : "bg-red-500/40 text-red-100"
                }`}
              >
                tunnel {(newUrl ? true : status.reachable) ? "OK" : "KOPTU"}
              </span>
            </div>
          </div>

          {!newUrl && status.steps.length > 0 ? (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-orange-50/95">
              {status.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}

          {repairMsg ? (
            <p className="rounded-lg bg-black/30 px-3 py-2 text-sm text-yellow-100">
              {repairMsg}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {!newUrl || !status.ok ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void repair()}
                className="flex-1 rounded-xl px-4 py-3.5 text-base font-black uppercase tracking-wide text-black disabled:opacity-60"
                style={{ background: accent }}
              >
                {busy ? "Düzeltiliyor…" : "Otomatik düzelt"}
              </button>
            ) : null}
            {newUrl ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newUrl);
                    setRepairMsg("Yeni URL panoya kopyalandı.");
                  } catch {
                    setRepairMsg(newUrl);
                  }
                }}
                className="flex-1 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-red-950"
              >
                Yeni URL’yi kopyala
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-orange-100/80">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="underline-offset-2 hover:underline"
            >
              Küçült
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="underline-offset-2 hover:underline"
            >
              Bu oturumda gizle
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="underline-offset-2 hover:underline"
            >
              Yeniden kontrol
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
