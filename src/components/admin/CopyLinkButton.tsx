"use client";

import { useState } from "react";

type Props = {
  url: string;
  label?: string;
  className?: string;
};

/** Panoya link kopyalar, kısa süreli "Kopyalandı" onayı gösterir */
export default function CopyLinkButton({
  url,
  label = "Linki kopyala",
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement("textarea");
        el.value = url;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard izni yoksa sessizce geç
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={
        className ||
        "rounded border border-line px-2.5 py-1 text-xs hover:bg-bg-deep/40"
      }
    >
      {copied ? "Kopyalandı ✓" : label}
    </button>
  );
}
