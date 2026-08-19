"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { playPageFlipSound } from "@/lib/paper-sound";

export type CssFlipStyle = "SLIDE" | "FADE" | "ZOOM" | "FLIP_H";

export type CatalogCssPagerHandle = {
  flipNext: () => void;
  flipPrev: () => void;
};

type Page = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
};

type Props = {
  pages: Page[];
  width: number;
  height: number;
  style: CssFlipStyle;
  pageIndex: number;
  onPageIndex: (index: number) => void;
  muted: boolean;
  onUserFlip?: () => void;
};

const DURATION_MS = 520;

/**
 * Curl (pageflip) xaricindəki stillər — CSS keçidləri ilə səhifə dəyişimi.
 * Arxa plan rəngi mövcud krem jurnal fondunu saxlayır.
 */
const CatalogCssPager = forwardRef<CatalogCssPagerHandle, Props>(
  function CatalogCssPager(
    { pages, width, height, style, pageIndex, onPageIndex, muted, onUserFlip },
    ref,
  ) {
    const [animating, setAnimating] = useState(false);
    const [overlay, setOverlay] = useState<{
      from: number;
      to: number;
      dir: "next" | "prev";
      phase: "from" | "to";
    } | null>(null);
    const locked = useRef(false);
    const pageIndexRef = useRef(pageIndex);
    pageIndexRef.current = pageIndex;

    const go = useCallback(
      (dir: "next" | "prev") => {
        if (locked.current) return;
        const cur = pageIndexRef.current;
        const nextIndex = dir === "next" ? cur + 1 : cur - 1;
        if (nextIndex < 0 || nextIndex >= pages.length) return;

        locked.current = true;
        setAnimating(true);
        if (!muted) playPageFlipSound(0.45, dir);
        onUserFlip?.();

        setOverlay({ from: cur, to: nextIndex, dir, phase: "from" });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setOverlay((o) => (o ? { ...o, phase: "to" } : null));
          });
        });

        window.setTimeout(() => {
          onPageIndex(nextIndex);
          setOverlay(null);
          setAnimating(false);
          locked.current = false;
        }, DURATION_MS);
      },
      [muted, onPageIndex, onUserFlip, pages.length],
    );

    useImperativeHandle(
      ref,
      () => ({
        flipNext: () => go("next"),
        flipPrev: () => go("prev"),
      }),
      [go],
    );

    const touchX = useRef<number | null>(null);
    function onTouchStart(e: React.TouchEvent) {
      touchX.current = e.changedTouches[0]?.clientX ?? null;
    }
    function onTouchEnd(e: React.TouchEvent) {
      if (touchX.current == null) return;
      const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) < 48) return;
      go(dx < 0 ? "next" : "prev");
    }

    const current = pages[pageIndex];
    const showFrom = overlay ? pages[overlay.from] : null;
    const showTo = overlay ? pages[overlay.to] : null;

    function layerStyle(
      which: "from" | "to",
      dir: "next" | "prev",
      phase: "from" | "to",
    ): React.CSSProperties {
      const leaving = which === "from";
      const active = phase === "to";
      const base: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        transition: `transform ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${DURATION_MS}ms ease`,
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
      };

      if (style === "SLIDE") {
        if (leaving) {
          return {
            ...base,
            transform: active
              ? `translateX(${dir === "next" ? "-100%" : "100%"})`
              : "translateX(0)",
            zIndex: 2,
          };
        }
        return {
          ...base,
          transform: active
            ? "translateX(0)"
            : `translateX(${dir === "next" ? "100%" : "-100%"})`,
          zIndex: 3,
        };
      }

      if (style === "FADE") {
        if (leaving) {
          return { ...base, opacity: active ? 0 : 1, zIndex: 2 };
        }
        return { ...base, opacity: active ? 1 : 0, zIndex: 3 };
      }

      if (style === "ZOOM") {
        if (leaving) {
          return {
            ...base,
            opacity: active ? 0 : 1,
            transform: active ? "scale(0.88)" : "scale(1)",
            zIndex: 2,
          };
        }
        return {
          ...base,
          opacity: active ? 1 : 0,
          transform: active ? "scale(1)" : "scale(1.08)",
          zIndex: 3,
        };
      }

      // FLIP_H
      const origin = dir === "next" ? "left center" : "right center";
      if (leaving) {
        return {
          ...base,
          transformOrigin: origin,
          transform: active
            ? `rotateY(${dir === "next" ? "-90deg" : "90deg"})`
            : "rotateY(0deg)",
          opacity: active ? 0.35 : 1,
          zIndex: 3,
        };
      }
      return {
        ...base,
        transformOrigin: dir === "next" ? "right center" : "left center",
        transform: active
          ? "rotateY(0deg)"
          : `rotateY(${dir === "next" ? "90deg" : "-90deg"})`,
        opacity: active ? 1 : 0.35,
        zIndex: 2,
      };
    }

    function PageArt({ page, alt }: { page: Page; alt: string }) {
      return (
        <div className="relative h-full w-full overflow-hidden bg-[#f7f2e7]">
          {page.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.imageUrl}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60 blur-2xl"
                style={{ transform: "scale(1.15)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.imageUrl}
                alt={alt}
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </>
          ) : null}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_16px_rgba(0,0,0,0.12)]" />
        </div>
      );
    }

    void animating;

    return (
      <div
        className="relative overflow-hidden"
        style={{
          width,
          height,
          perspective: style === "FLIP_H" ? 1400 : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {!overlay && current ? (
          <PageArt page={current} alt={`Səhifə ${pageIndex + 1}`} />
        ) : null}

        {overlay && showFrom && showTo ? (
          <>
            <div style={layerStyle("to", overlay.dir, overlay.phase)}>
              <PageArt page={showTo} alt={`Səhifə ${overlay.to + 1}`} />
            </div>
            <div style={layerStyle("from", overlay.dir, overlay.phase)}>
              <PageArt page={showFrom} alt={`Səhifə ${overlay.from + 1}`} />
            </div>
          </>
        ) : null}
      </div>
    );
  },
);

export default CatalogCssPager;
