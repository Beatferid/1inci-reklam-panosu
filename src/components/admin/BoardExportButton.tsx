"use client";

import { useState } from "react";

export default function BoardExportButton({
  disabled,
}: {
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/board/export");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Pano oluşturulamadı");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ar-pano.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={disabled || busy}
        className="rounded-md border border-line bg-card px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        title={
          disabled
            ? "Önce yayınlı ve derlenmiş kampanya gerekli"
            : "Serpilmiş pano PNG indir"
        }
      >
        {busy ? "Hazırlanıyor…" : "Pano şablonu indir"}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
