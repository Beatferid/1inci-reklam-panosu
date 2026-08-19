"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  open: boolean;
  onClose: () => void;
  catalogName: string;
  coverUrl?: string | null;
};

export default function CatalogShareSheet({
  open,
  onClose,
  catalogName,
  coverUrl = null,
}: Props) {
  const [url, setUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!open) return;
    const href = window.location.href;
    setUrl(href);
    setCopied(false);
    let cancelled = false;
    void QRCode.toDataURL(href, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#5c3b00", light: "#fdf6e8" },
    }).then((data) => {
      if (!cancelled) setQrDataUrl(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url || window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!canNativeShare) return;
    setSharing(true);
    try {
      const shareUrl = url || window.location.href;
      const data: ShareData = {
        title: catalogName,
        text: `${catalogName} — endirim kataloqu`,
        url: shareUrl,
      };

      if (coverUrl && navigator.canShare) {
        try {
          const res = await fetch(coverUrl);
          const blob = await res.blob();
          const ext = blob.type.includes("png")
            ? "png"
            : blob.type.includes("webp")
              ? "webp"
              : "jpg";
          const file = new File([blob], `katalog-kapak.${ext}`, {
            type: blob.type || "image/jpeg",
          });
          const withFile: ShareData = { ...data, files: [file] };
          if (navigator.canShare(withFile)) {
            await navigator.share(withFile);
            return;
          }
        } catch {
          // fall through to URL-only share
        }
      }

      await navigator.share(data);
    } catch (e) {
      // AbortError = user cancelled
      if (e instanceof Error && e.name === "AbortError") return;
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Bağla"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paylaş"
        className="relative z-10 w-full max-w-sm rounded-t-2xl px-5 pb-7 pt-4 shadow-2xl sm:rounded-2xl"
        style={{ background: "#fdf6e8" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a8752e]">
              Paylaş
            </p>
            <h2
              className="text-lg font-bold text-[#5c3b00]"
              style={{ fontFamily: "var(--display)" }}
            >
              {catalogName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5c3b00]/10 text-[#5c3b00]"
            aria-label="Bağla"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Kataloq QR"
              className="h-48 w-48 rounded-lg border border-[#e8d5a8] bg-[#fdf6e8]"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center text-xs text-[#8a5a1f]/70">
              QR hazırlanır…
            </div>
          )}
          <p className="max-w-full truncate text-center text-[11px] text-[#8a5a1f]/75">
            {url}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {canNativeShare ? (
            <button
              type="button"
              disabled={sharing}
              onClick={() => void nativeShare()}
              className="rounded-full bg-[#c99a3d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sharing ? "Paylaşılır…" : "Bu cihazdan paylaş"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-full border border-[#d4b872] bg-white/70 px-4 py-3 text-sm font-semibold text-[#5c3b00]"
          >
            {copied ? "Kopyalandı ✓" : "Linki kopyala"}
          </button>
        </div>
      </div>
    </div>
  );
}
