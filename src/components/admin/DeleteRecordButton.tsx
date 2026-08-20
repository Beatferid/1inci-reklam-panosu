"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  /** DELETE isteği yolu, örn. /api/admin/catalogs/xyz */
  endpoint: string;
  /** confirm() metni */
  confirmMessage: string;
  /** Silindikten sonra gidecek sayfa; yoksa sayfa yenilenir */
  redirectTo?: string;
  label?: string;
  /** Liste satırı için küçük stil */
  compact?: boolean;
  className?: string;
  onDeleted?: () => void;
};

export default function DeleteRecordButton({
  endpoint,
  confirmMessage,
  redirectTo,
  label = "Sil",
  compact = false,
  className,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Silinemedi.",
        );
        setBusy(false);
        return;
      }
      onDeleted?.();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
        setBusy(false);
      }
    } catch {
      setError("Bağlantı hatası — silinemedi.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className={
          className ||
          (compact
            ? "rounded border border-danger/40 px-2.5 py-1 text-danger hover:bg-danger/10 disabled:opacity-60"
            : "rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60")
        }
      >
        {busy ? "Siliniyor…" : label}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
