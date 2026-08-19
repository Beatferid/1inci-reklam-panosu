"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CatalogViewer = dynamic(() => import("@/components/catalog/CatalogViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[#8a5a1f]/70">
      Səhifələr yüklənir…
    </div>
  ),
});

type CatalogPage = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
  order: number;
};

type CatalogTheme = "NONE" | "NEW_YEAR" | "EID" | "RAMADAN" | "SNOW" | "SPRING";
type CatalogFlipStyle = "CURL" | "SLIDE" | "FADE" | "ZOOM" | "FLIP_H";

type Meta = {
  id: string;
  name: string;
  slug: string;
  coverTitle: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  musicUrl: string | null;
  musicVolume: number;
  theme: CatalogTheme;
  flipStyle: CatalogFlipStyle;
  pages: CatalogPage[];
};

export default function CatalogClient({ slug }: { slug: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [introMounted, setIntroMounted] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/public/catalogs/${slug}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(String(data.error || "Kataloq tapılmadı"));
          return;
        }
        setMeta(data as Meta);
      } catch {
        if (!cancelled) {
          setError("Bağlantı xətası / server tapılmadı. Səhifəni yeniləyin.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!meta || meta.pages.filter((p) => p.imageUrl).length === 0) return;
    const t1 = window.setTimeout(() => setShowIntro(false), 1400);
    const t2 = window.setTimeout(() => setIntroMounted(false), 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [meta]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#f7f2e7] px-6 text-center">
        <p className="text-lg font-bold text-[#5c3b00]">Kataloq açıla bilmədi</p>
        <p className="text-sm text-[#5c3b00]/70">{error}</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f2e7] text-sm text-[#5c3b00]/70">
        Kataloq hazırlanır…
      </div>
    );
  }

  const visiblePages = meta.pages.filter((p) => Boolean(p.imageUrl));

  if (visiblePages.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#f7f2e7] px-6 text-center">
        <p className="text-lg font-bold text-[#5c3b00]">{meta.name}</p>
        <p className="text-sm text-[#5c3b00]/70">
          Bu kataloqda hələ səhifə yoxdur. Tezliklə əlavə olunacaq.
        </p>
      </div>
    );
  }

  return (
    <div
      className="catalog-shell fixed inset-0 flex flex-col overflow-visible"
      style={{
        width: "100%",
        height: "100dvh",
        maxHeight: "100dvh",
        background:
          "radial-gradient(circle at 50% 0%, #fdf6e8 0%, #f3e6c8 55%, #ecd9ae 100%)",
      }}
    >
      <div className="relative min-h-0 flex-1 overflow-visible">
        <CatalogViewer
          pages={visiblePages}
          catalogName={meta.name}
          coverUrl={meta.coverUrl}
          theme={meta.theme}
          flipStyle={meta.flipStyle || "CURL"}
          musicUrl={meta.musicUrl}
          musicVolume={meta.musicVolume}
        />

        {introMounted ? (
          <div
            className={`pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-6 text-center transition-opacity duration-700 ${
              showIntro ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background:
                "radial-gradient(circle at 50% 40%, rgba(253,246,232,0.97) 0%, rgba(243,230,200,0.98) 70%)",
            }}
          >
            {meta.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.logoUrl}
                alt={meta.name}
                className="mb-2 h-16 max-w-[70%] object-contain drop-shadow-sm"
              />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a8752e]">
              Endirim Kataloqu
            </p>
            <h1
              className="mt-1 text-3xl font-bold text-[#5c3b00]"
              style={{ fontFamily: "var(--display)" }}
            >
              {meta.coverTitle || meta.name}
            </h1>
            <p className="mt-3 text-xs text-[#8a5a1f]/70">açılır…</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
