"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { playPageFlipSound } from "@/lib/paper-sound";
import CatalogEffects, { type CatalogEffectTheme } from "@/components/catalog/CatalogEffects";
import CatalogCssPager, {
  type CatalogCssPagerHandle,
  type CssFlipStyle,
} from "@/components/catalog/CatalogCssPager";
import CatalogShareSheet from "@/components/catalog/CatalogShareSheet";
import CatalogMagicTouch from "@/components/catalog/CatalogMagicTouch";
import { patchCatalogFlipPrev } from "@/lib/catalog-flip-mirror";

export type CatalogViewerPage = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
};

export type CatalogFlipStyleProp = "CURL" | CssFlipStyle;

const MAX_ZOOM = 2.6;
const DOUBLE_TAP_MS = 320;
const SOUND_PREF_KEY = "catalog-sound-muted";
const DESKTOP_MAX_WIDTH = 720;
const DIM_SNAP = 2;

const ZoomBusCtx = createContext(0);

function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Şəkilləri decode + (Android-də) GPU-ya yüklə — ilk çevirmələrdəki flaşı azaldır. */
async function preloadCatalogImages(
  urls: string[],
  opts: { warmGpu: boolean; maxEdge: number },
) {
  const unique = [...new Set(urls.filter(Boolean))];
  await Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            const finish = () => {
              if (opts.warmGpu) {
                try {
                  const w = img.naturalWidth || 1;
                  const h = img.naturalHeight || 1;
                  const scale = Math.min(1, opts.maxEdge / Math.max(w, h));
                  const cw = Math.max(1, Math.round(w * scale));
                  const ch = Math.max(1, Math.round(h * scale));
                  const canvas = document.createElement("canvas");
                  canvas.width = cw;
                  canvas.height = ch;
                  const ctx = canvas.getContext("2d");
                  ctx?.drawImage(img, 0, 0, cw, ch);
                  // Canvas pixel oxuma — CPU↔GPU sinxronlaşdırır
                  ctx?.getImageData(0, 0, 1, 1);
                } catch {
                  // ignore CORS / memory
                }
              }
              resolve();
            };
            if (typeof img.decode === "function") {
              img.decode().then(finish).catch(finish);
            } else {
              finish();
            }
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  );
}

type FlipPageProps = {
  page: CatalogViewerPage;
  index: number;
  total: number;
  onZoomChange: (zoomed: boolean) => void;
  /** Android: blur arxa plansız yüngül DOM (flip soft qalır) */
  liteMode?: boolean;
};

/**
 * Flip page — yalnız şəkil + zoom. Overlay-lər (səhifə №, CTA, hint)
 * kitabın xaricindədir ki, prop dəyişiklikləri pageflip-i reset etməsin.
 */
const FlipPage = forwardRef<HTMLDivElement, FlipPageProps>(function FlipPage(
  { page, index, total, onZoomChange, liteMode = false },
  ref,
) {
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [interacting, setInteracting] = useState(false);
  const lastTapRef = useRef(0);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const onZoomChangeRef = useRef(onZoomChange);
  const zoomRef = useRef(1);
  onZoomChangeRef.current = onZoomChange;

  const zoomBus = useContext(ZoomBusCtx);

  useEffect(() => {
    if (zoomBus === 0) return;
    if (zoomRef.current <= 1.02) return;
    zoomRef.current = 1;
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
    onZoomChangeRef.current(false);
  }, [zoomBus]);

  function notifyZoom(zoomed: boolean) {
    onZoomChangeRef.current(zoomed);
  }

  function applyZoom(next: number, tx = 0, ty = 0) {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
    zoomRef.current = clamped;
    setZoom(clamped);
    setTranslate(clamped <= 1.02 ? { x: 0, y: 0 } : { x: tx, y: ty });
    notifyZoom(clamped > 1.02);
  }

  function toggleZoom() {
    applyZoom(zoomRef.current > 1.02 ? 1 : 2.1);
  }

  function dist(t0: React.Touch, t1: React.Touch) {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.stopPropagation();
      pinchRef.current = {
        dist: dist(e.touches[0], e.touches[1]),
        zoom: zoomRef.current,
      };
      setInteracting(true);
      return;
    }
    if (e.touches.length === 1 && zoomRef.current > 1.02) {
      e.stopPropagation();
      panRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        tx: translate.x,
        ty: translate.y,
      };
      setInteracting(true);
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.stopPropagation();
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      applyZoom(pinchRef.current.zoom * (d / pinchRef.current.dist), translate.x, translate.y);
      return;
    }
    if (e.touches.length === 1 && panRef.current) {
      e.stopPropagation();
      e.preventDefault();
      const maxOffset = (zoomRef.current - 1) * 150;
      const dx = e.touches[0].clientX - panRef.current.x;
      const dy = e.touches[0].clientY - panRef.current.y;
      setTranslate({
        x: Math.max(-maxOffset, Math.min(maxOffset, panRef.current.tx + dx)),
        y: Math.max(-maxOffset, Math.min(maxOffset, panRef.current.ty + dy)),
      });
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const wasPinching = Boolean(pinchRef.current);
    const wasPanning = Boolean(panRef.current);
    setInteracting(false);
    pinchRef.current = null;
    panRef.current = null;
    if (zoomRef.current < 1.15) applyZoom(1);
    if (wasPinching || wasPanning || zoomRef.current > 1.02) {
      e.stopPropagation();
      return;
    }
    if (e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        e.stopPropagation();
        toggleZoom();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  }

  return (
    <div
      ref={ref}
      data-density="soft"
      className="relative h-full w-full overflow-hidden bg-[#f7f2e7]"
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggleZoom();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {page.imageUrl ? (
        <>
          {/* Blur Android-də soft-flip klonunu ağırlaşdırır — yalnız digər platformlarda */}
          {!liteMode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.imageUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60 blur-2xl"
              style={{ transform: "scale(1.15)" }}
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.imageUrl}
            alt={`Səhifə ${index + 1} / ${total}`}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
            decoding="async"
            loading={index < 3 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            style={
              zoom > 1.001 || translate.x !== 0 || translate.y !== 0
                ? {
                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoom})`,
                    transition: interacting ? "none" : "transform 0.22s ease-out",
                    willChange: "transform",
                  }
                : undefined
            }
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-sm text-[#8a5a1f]/70">
          Şəkil yoxdur
        </div>
      )}
      {!liteMode ? (
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_16px_rgba(0,0,0,0.12)]" />
      ) : null}
    </div>
  );
});

type PageFlipHandle = {
  flipNext: (corner?: string) => void;
  flipPrev: (corner?: string) => void;
  getCurrentPageIndex: () => number;
  getFlipController?: () => unknown;
  turnToPrevPage?: () => void;
  turnToPage?: (page: number) => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function readSafeInsets() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top,0px);" +
    "padding-right:env(safe-area-inset-right,0px);" +
    "padding-bottom:env(safe-area-inset-bottom,0px);" +
    "padding-left:env(safe-area-inset-left,0px);";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  document.body.removeChild(probe);
  return insets;
}

/** Viewport-u az və bərabər kənar boşluğu ilə doldur — jurnal ortada, kiçik qalmasın. */
function measurePageDims(el?: HTMLElement | null) {
  const insets = readSafeInsets();
  const isDesktop =
    (typeof window !== "undefined" ? window.innerWidth : 0) >= 768;

  // Ölçünü birbaşa viewer qutusundan al (padding artıq tətbiq olunub).
  let availW: number;
  let availH: number;
  if (el && el.clientWidth > 0 && el.clientHeight > 0) {
    availW = el.clientWidth;
    availH = el.clientHeight;
  } else {
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth;
    const vh = vv?.height || window.innerHeight;
    const edge = isDesktop ? 16 : 4;
    const padX = Math.max(edge, insets.left, insets.right) + (isDesktop ? 48 : 0);
    const padY = Math.max(edge, insets.top, insets.bottom);
    availW = vw - padX * 2;
    availH = vh - padY * 2;
  }

  let width = Math.max(180, availW);
  let height = Math.max(220, availH);

  if (isDesktop) {
    width = Math.min(width, DESKTOP_MAX_WIDTH);
    const targetH = width / (3 / 4);
    if (targetH <= height) {
      height = targetH;
    } else {
      height = Math.min(height, availH);
      width = height * (3 / 4);
    }
  }

  width = Math.round(width / DIM_SNAP) * DIM_SNAP;
  height = Math.round(height / DIM_SNAP) * DIM_SNAP;

  return {
    width: Math.max(180, width),
    height: Math.max(220, height),
  };
}

export default function CatalogViewer({
  pages,
  catalogName = "Kataloq",
  coverUrl = null,
  theme = "NONE",
  flipStyle = "CURL",
  musicUrl = null,
  musicVolume = 0.5,
}: {
  pages: CatalogViewerPage[];
  catalogName?: string;
  coverUrl?: string | null;
  theme?: CatalogEffectTheme;
  flipStyle?: CatalogFlipStyleProp;
  musicUrl?: string | null;
  musicVolume?: number;
}) {
  const useCurl = flipStyle === "CURL";
  const [dims, setDims] = useState({ width: 340, height: 453 });
  const [dimsReady, setDimsReady] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [showShareHint, setShowShareHint] = useState(true);
  const [muted, setMuted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [zoomBus, setZoomBus] = useState(0);
  const [cornerHintPulse, setCornerHintPulse] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [androidLite] = useState(isAndroidDevice);
  const [imagesReady, setImagesReady] = useState(false);
  const [prevRoll, setPrevRoll] = useState<{
    from: number;
    to: number;
  } | null>(null);

  const bookRef = useRef<{ pageFlip: () => PageFlipHandle | null } | null>(null);
  const cssPagerRef = useRef<CatalogCssPagerHandle | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pageIndexRef = useRef(0);
  const flippingRef = useRef(false);
  const flipLockUntilRef = useRef(0);
  const prevRollActiveRef = useRef(false);
  const prevRollTimerRef = useRef<number | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const directionRef = useRef<"next" | "prev">("next");
  const zoomActiveRef = useRef(false);
  const mutedRef = useRef(false);

  // Sabit child ağacı — hər render-də yeni element pageflip updateFromHtml çağırırdı.
  const handleZoomChange = useCallback((zoomed: boolean) => {
    zoomActiveRef.current = zoomed;
  }, []);

  const flipPages = useMemo(
    () =>
      pages.map((p, idx) => (
        <FlipPage
          key={p.id}
          page={p}
          index={idx}
          total={pages.length}
          onZoomChange={handleZoomChange}
          liteMode={androidLite}
        />
      )),
    [pages, handleZoomChange, androidLite],
  );

  useEffect(() => {
    let cancelled = false;
    const urls = pages.map((p) => p.imageUrl).filter((u): u is string => Boolean(u));
    setImagesReady(false);

    void (async () => {
      await preloadCatalogImages(urls, {
        warmGpu: androidLite,
        // Ekran ölçüsünə yaxın — tam 4K rasterləmə yaddaş və GPU-nu öldürməsin
        maxEdge: androidLite ? 1280 : 1600,
      });
      // İki frame gözlə — decode/compositor otursun
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      if (!cancelled) setImagesReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [pages, androidLite]);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(SOUND_PREF_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = Math.min(1, Math.max(0, musicVolume));
  }, [musicVolume]);

  useEffect(() => {
    const el = musicRef.current;
    if (!el || !musicUrl || muted) return;
    function tryStart() {
      el?.play().catch(() => {});
    }
    tryStart();
    window.addEventListener("pointerdown", tryStart, { once: true });
    window.addEventListener("touchstart", tryStart, { once: true });
    return () => {
      window.removeEventListener("pointerdown", tryStart);
      window.removeEventListener("touchstart", tryStart);
    };
  }, [musicUrl, muted]);

  useLayoutEffect(() => {
    function computeDims() {
      if (flippingRef.current) return;
      const next = measurePageDims(rootRef.current);
      setDims((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
      setDimsReady(true);
    }
    computeDims();
    let resizeTimer: number | undefined;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(computeDims, 180);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const ro =
      typeof ResizeObserver !== "undefined" && rootRef.current
        ? new ResizeObserver(onResize)
        : null;
    if (rootRef.current && ro) ro.observe(rootRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    pageIndexRef.current = pageIndex;
  }, [pageIndex]);

  useEffect(() => {
    if (pages.length <= 1) return;
    const t = window.setTimeout(() => setShowSwipeHint(false), 4200);
    return () => window.clearTimeout(t);
  }, [pages.length]);

  useEffect(() => {
    const t = window.setTimeout(() => setShowShareHint(false), 5200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (pages.length <= 1) return;
    const interval = window.setInterval(() => {
      if (flippingRef.current || zoomActiveRef.current) return;
      setCornerHintPulse(true);
      window.setTimeout(() => setCornerHintPulse(false), 1200);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [pages.length]);

  const bumpZoomReset = useCallback(() => {
    if (!zoomActiveRef.current) return;
    zoomActiveRef.current = false;
    setZoomBus((n) => n + 1);
  }, []);

  const startCurlPrevRoll = useCallback(() => {
    if (prevRollActiveRef.current) return;
    if (flippingRef.current) return;
    if (Date.now() < flipLockUntilRef.current) return;
    const from = pageIndexRef.current;
    if (from <= 0) return;
    const to = from - 1;

    bumpZoomReset();
    directionRef.current = "prev";
    flippingRef.current = true;
    prevRollActiveRef.current = true;
    flipLockUntilRef.current = Date.now() + 900;
    setPrevRoll({ from, to });
    setHasFlipped(true);
    setShowSwipeHint(false);
    setShowShareHint(false);
    if (!mutedRef.current) playPageFlipSound(0.5, "prev");

    // Overlay boyandıktan sonra kitabı hedef sayfaya sessizce al —
    // animasyon bitince zıplama / çift görüntü olmasın.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!prevRollActiveRef.current) return;
        const pf = bookRef.current?.pageFlip?.();
        try {
          if (pf?.turnToPage) pf.turnToPage(to);
          else if (pf?.turnToPrevPage) pf.turnToPrevPage();
        } catch {
          // ignore
        }
        pageIndexRef.current = to;
      });
    });

    if (prevRollTimerRef.current != null) {
      window.clearTimeout(prevRollTimerRef.current);
    }
    prevRollTimerRef.current = window.setTimeout(() => {
      prevRollTimerRef.current = null;
      pageIndexRef.current = to;
      setPageIndex(to);
      setPrevRoll(null);
      prevRollActiveRef.current = false;
      flippingRef.current = false;
      flipLockUntilRef.current = Date.now() + 280;
    }, 580);
  }, [bumpZoomReset]);

  const startCurlPrevRollRef = useRef(startCurlPrevRoll);
  startCurlPrevRollRef.current = startCurlPrevRoll;

  useEffect(() => {
    return () => {
      if (prevRollTimerRef.current != null) {
        window.clearTimeout(prevRollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!useCurl || !dimsReady || !imagesReady) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const pf = bookRef.current?.pageFlip?.() ?? null;
      if (pf) {
        patchCatalogFlipPrev(pf, () => startCurlPrevRollRef.current());
        window.clearInterval(id);
      } else if (tries > 40) {
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [useCurl, dimsReady, imagesReady, dims.width, dims.height]);

  const goPrev = useCallback(() => {
    if (useCurl) {
      startCurlPrevRoll();
      return;
    }
    if (flippingRef.current) return;
    if (Date.now() < flipLockUntilRef.current) return;
    if (pageIndexRef.current <= 0) return;
    bumpZoomReset();
    directionRef.current = "prev";
    flippingRef.current = true;
    flipLockUntilRef.current = Date.now() + 650;
    cssPagerRef.current?.flipPrev();
  }, [bumpZoomReset, startCurlPrevRoll, useCurl]);

  const goNext = useCallback(() => {
    if (flippingRef.current || prevRoll) return;
    if (Date.now() < flipLockUntilRef.current) return;
    if (pageIndexRef.current >= pages.length - 1) return;
    bumpZoomReset();
    directionRef.current = "next";
    flippingRef.current = true;
    flipLockUntilRef.current = Date.now() + 650;
    if (useCurl) {
      bookRef.current?.pageFlip()?.flipNext("bottom");
    } else {
      cssPagerRef.current?.flipNext();
    }
  }, [bumpZoomReset, pages.length, prevRoll, useCurl]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(SOUND_PREF_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) musicRef.current?.play().catch(() => {});
      return next;
    });
  }

  // Stabil event handler — çevirmə BAŞLAYANDA setState etmə (Android flaş).
  const onChangeState = useCallback((e: { data: string }) => {
    if (prevRollActiveRef.current) return;
    const flipping = e.data === "flipping";
    if (flipping && !flippingRef.current) {
      bumpZoomReset();
      flipLockUntilRef.current = Date.now() + 650;
      if (!mutedRef.current) {
        playPageFlipSound(0.5, directionRef.current);
      }
    }
    flippingRef.current = flipping;
  }, [bumpZoomReset]);

  const onFlip = useCallback((e: { data: number }) => {
    const nextIndex = e.data;
    // CSS geri rulo sırasında turnToPage onFlip tetikler — React state ile yarışmasın
    if (prevRollActiveRef.current) {
      pageIndexRef.current = nextIndex;
      return;
    }
    directionRef.current = nextIndex > pageIndexRef.current ? "next" : "prev";
    pageIndexRef.current = nextIndex;
    flippingRef.current = false;
    // Çift çevirmə kilidi — swipe+click və ya ikinci jest
    flipLockUntilRef.current = Date.now() + 420;
    setPageIndex(nextIndex);
    setHasFlipped(true);
    setShowSwipeHint(false);
    setShowShareHint(false);
  }, []);

  const onCssPageIndex = useCallback((idx: number) => {
    pageIndexRef.current = idx;
    setPageIndex(idx);
  }, []);

  const onCssUserFlip = useCallback(() => {
    setHasFlipped(true);
    setShowSwipeHint(false);
    setShowShareHint(false);
  }, []);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pages.length - 1;
  const activePage = pages[pageIndex];

  // stretch+singlePage pageWidth = blockWidth/2 olduğundan bloku 2x enində veririk
  const bookShellW = dims.width * 2;
  const bookShellH = dims.height;

  return (
    <ZoomBusCtx.Provider value={zoomBus}>
      <div
        className={`catalog-viewer relative h-full w-full outline-none${useCurl ? " catalog-viewer--curl" : ""}`}
        tabIndex={0}
        role="application"
        aria-label="Kataloq oxuyucu"
        style={{
          paddingTop: "max(4px, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(4px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(4px, env(safe-area-inset-right, 0px))",
          boxSizing: "border-box",
        }}
      >
        {/* Ölçü bu qutudan götürülür — jurnal bərabər kiçik boşluqla ortada doldurur */}
        <div
          ref={rootRef}
          className={`relative flex h-full w-full items-center justify-center${useCurl ? " overflow-visible" : ""}`}
        >
        {/* Mövsümi effektlər jurnalın ÜSTÜNDƏ (z-25) — altda gizlənməsin */}
        <CatalogEffects theme={theme} />
        {/* Sihirli dokunuş — parmağı takip eder, çevirmeyi engellemez */}
        <CatalogMagicTouch lite={androidLite} />

        {musicUrl ? (
          <audio ref={musicRef} src={musicUrl} loop muted={muted} playsInline />
        ) : null}

        <div className="absolute right-2 top-2 z-[32] flex flex-col items-end gap-1.5">
          {showShareHint && !shareOpen ? (
            <span className="animate-fade-in-up pointer-events-none mr-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white">
              Paylaş →
            </span>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShareOpen(true);
                setShowShareHint(false);
              }}
              aria-label="Paylaş"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-base text-white backdrop-blur-sm transition active:scale-90"
            >
              ↗
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Səsi aç" : "Səsi bağla"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-base text-white backdrop-blur-sm transition active:scale-90"
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>

        <CatalogShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          catalogName={catalogName}
          coverUrl={coverUrl}
        />

        <div
          className={`catalog-flip-stage relative z-10${androidLite ? " catalog-flip-stage--android" : ""}${useCurl ? " catalog-flip-stage--curl" : ""}`}
          style={{
            width: dims.width,
            height: dims.height,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          {/* Lüks gloss işıq — yumşaq + nazik nüvə, soldurmadan */}
          <div className="catalog-page-shine-wrap" aria-hidden>
            <span className="catalog-page-shine-glow" />
            <span className="catalog-page-shine-core" />
          </div>

          {/* CTA yalnız stage içində — link varsa */}
          {activePage?.linkUrl ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-end px-3">
              <a
                href={activePage.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto rounded-full bg-[#c99a3d] px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-black/30 active:scale-95"
              >
                Ətraflı bax →
              </a>
            </div>
          ) : null}

          {cornerHintPulse && canNext && !prevRoll ? (
            <div className="pointer-events-none absolute bottom-0 right-0 z-[15] h-14 w-14 overflow-hidden">
              <div
                className="animate-corner-peel absolute bottom-0 right-0 h-10 w-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.55) 45%, rgba(0,0,0,0.15) 100%)",
                  clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                  boxShadow: "-4px -4px 10px rgba(0,0,0,0.18)",
                }}
              />
            </div>
          ) : null}

          {/* Geri peel overlay — kütüphane BACK animasyonu yerine */}
          {prevRoll ? (
            <div
              className="catalog-prev-roll pointer-events-none absolute inset-0 z-[18] overflow-hidden"
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pages[prevRoll.to]?.imageUrl || ""}
                alt=""
                className="catalog-prev-roll__base h-full w-full object-contain"
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pages[prevRoll.from]?.imageUrl || ""}
                alt=""
                className="catalog-prev-roll__out h-full w-full object-contain"
                draggable={false}
              />
              <div className="catalog-prev-roll__shade" />
            </div>
          ) : null}

          {dimsReady && imagesReady ? (
            useCurl ? (
            <div
              className="catalog-flip-shell absolute top-0"
              style={{
                left: -dims.width / 2,
                width: bookShellW,
                height: bookShellH,
                // Overlay sırasında kitap görünmesin (titreme / çift görüntü)
                visibility: prevRoll ? "hidden" : "visible",
              }}
            >
              <HTMLFlipBook
                key={`book-${dims.width}x${dims.height}-${androidLite ? "a" : "i"}`}
                ref={bookRef}
                width={dims.width}
                height={dims.height}
                size="stretch"
                minWidth={dims.width}
                maxWidth={dims.width}
                minHeight={dims.height}
                maxHeight={dims.height}
                startPage={pageIndexRef.current}
                showCover={false}
                usePortrait={false}
                singlePage
                autoSize={false}
                mobileScrollSupport
                clickEventForward
                useMouseEvents
                disableFlipByClick
                drawShadow
                maxShadowOpacity={androidLite ? 0.35 : 0.5}
                flippingTime={androidLite ? 950 : 850}
                swipeDistance={androidLite ? 52 : 48}
                renderOnlyPageLengthChange
                className="catalog-flipbook"
                style={{ width: "100%", height: "100%" }}
                onChangeState={onChangeState}
                onFlip={onFlip}
              >
                {flipPages}
              </HTMLFlipBook>
            </div>
            ) : (
              <CatalogCssPager
                ref={cssPagerRef}
                pages={pages}
                width={dims.width}
                height={dims.height}
                style={flipStyle as CssFlipStyle}
                pageIndex={pageIndex}
                onPageIndex={onCssPageIndex}
                muted={muted}
                onUserFlip={onCssUserFlip}
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-[#8a5a1f]/70">
              Səhifələr hazırlanır…
            </div>
          )}
        </div>

        {/* Səhifə sayğacı + kənar ipucları — effektlərin ÜSTÜNDƏ (əvvəl gizlənirdi) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-[32] flex flex-col items-center gap-1.5 px-3">
          {!hasFlipped && showSwipeHint && pages.length > 1 ? (
            <span className="animate-fade-in-up flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-2 text-[11px] font-medium text-white shadow-lg">
              <span
                className="text-sm leading-none"
                style={{ animation: "swipe-hint-arrow 1.3s ease-in-out infinite" }}
              >
                ←
              </span>
              Sola sürüşdürün — növbəti səhifə
            </span>
          ) : null}

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white">
              {pageIndex + 1} / {pages.length}
            </span>
            {pageIndex === 0 ? (
              <span className="rounded-full bg-black/45 px-2 py-1 text-[10px] text-white/90">
                Birinci səhifə
              </span>
            ) : null}
            {pageIndex === pages.length - 1 && pages.length > 1 ? (
              <span className="rounded-full bg-black/45 px-2 py-1 text-[10px] text-white/90">
                Son səhifə
              </span>
            ) : null}
          </div>
        </div>

        {pages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              disabled={!canPrev}
              aria-label="Əvvəlki səhifə"
              className={`absolute left-1 top-1/2 z-[32] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-2xl text-white backdrop-blur-sm transition active:scale-90 sm:left-3 ${
                canPrev ? "" : "pointer-events-none opacity-0"
              }`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              disabled={!canNext}
              aria-label="Növbəti səhifə"
              className={`absolute right-1 top-1/2 z-[32] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-2xl text-white backdrop-blur-sm transition active:scale-90 sm:right-3 ${
                canNext ? "" : "pointer-events-none opacity-0"
              }`}
            >
              ›
            </button>
          </>
        ) : null}
        </div>
      </div>
    </ZoomBusCtx.Provider>
  );
}
