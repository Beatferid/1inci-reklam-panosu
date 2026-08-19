"use client";

import { useEffect, useRef } from "react";

type Spark = {
  el: HTMLSpanElement;
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  hue: number;
  kind: "dot" | "star";
};

type Props = {
  /** Android / zayıf cihazlarda daha az parçacık */
  lite?: boolean;
};

/**
 * Parmak / imleci takip eden sihirli parıltı.
 * DOM'u doğrudan günceller (setState yok) — flip sırasında kasmayı azaltır.
 */
export default function CatalogMagicTouch({ lite = false }: Props) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const layer = layerRef.current;
    if (!layer) return;

    const maxSparks = lite ? 18 : 36;
    const spawnEveryMs = lite ? 36 : 22;
    const burst = lite ? 1 : 2;
    const sparks: Spark[] = [];
    let raf = 0;
    let lastSpawn = 0;
    let active = false;
    let last = performance.now();
    let rect = layer.getBoundingClientRect();

    const refreshRect = () => {
      rect = layer.getBoundingClientRect();
    };

    const stopRafIfIdle = () => {
      if (sparks.length === 0 && !active && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const paint = (s: Spark) => {
      const opacity = Math.max(0, s.life);
      const scale = 0.35 + s.life * 0.9;
      const el = s.el;
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${scale})${
        s.kind === "star" ? ` rotate(${(1 - s.life) * 80}deg)` : ""
      }`;
      el.style.opacity = String(opacity);
    };

    const makeEl = (s: Omit<Spark, "el">): HTMLSpanElement => {
      const el = document.createElement("span");
      el.setAttribute("aria-hidden", "true");
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.pointerEvents = "none";
      el.style.willChange = "transform, opacity";
      el.style.lineHeight = "1";
      if (s.kind === "star") {
        el.textContent = "✦";
        el.style.fontSize = `${s.size * 1.6}px`;
        el.style.color = `hsla(${s.hue}, 90%, 72%, 0.85)`;
        if (!lite) {
          el.style.textShadow = `0 0 6px hsla(${s.hue}, 100%, 70%, 0.85)`;
        }
      } else {
        el.style.width = `${s.size}px`;
        el.style.height = `${s.size}px`;
        el.style.borderRadius = "9999px";
        el.style.background = `radial-gradient(circle, hsla(${s.hue}, 100%, 92%, 1) 0%, hsla(${s.hue}, 90%, 60%, 0.5) 45%, transparent 72%)`;
      }
      return el;
    };

    const spawnAt = (clientX: number, clientY: number, moving: boolean) => {
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < -20 || y < -20 || x > rect.width + 20 || y > rect.height + 20) {
        return;
      }

      const now = performance.now();
      if (moving && now - lastSpawn < spawnEveryMs) return;
      lastSpawn = now;

      const count = moving ? burst : burst + 2;
      for (let i = 0; i < count; i++) {
        while (sparks.length >= maxSparks) {
          const old = sparks.shift();
          old?.el.remove();
        }
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.35 + Math.random() * (moving ? 1.2 : 1.8);
        const base = {
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          size: (lite ? 3 : 4) + Math.random() * (lite ? 4 : 6),
          life: 1,
          maxLife: 0.4 + Math.random() * 0.45,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.35,
          hue: 38 + Math.random() * 28,
          kind: (Math.random() > 0.55 ? "star" : "dot") as "dot" | "star",
        };
        const el = makeEl(base);
        layer.appendChild(el);
        const spark: Spark = { ...base, el };
        paint(spark);
        sparks.push(spark);
      }
      ensureRaf();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt / s.maxLife;
        if (s.life <= 0) {
          s.el.remove();
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.04;
        s.vx *= 0.98;
        paint(s);
      }
      if (sparks.length > 0 || active) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const ensureRaf = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      active = true;
      refreshRect();
      spawnAt(e.clientX, e.clientY, false);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !active) return;
      if (e.pointerType === "touch" || active) {
        active = true;
        spawnAt(e.clientX, e.clientY, true);
      }
    };
    const onUp = () => {
      active = false;
      stopRafIfIdle();
    };

    const root = layer.parentElement || window;
    root.addEventListener("pointerdown", onDown as EventListener, {
      passive: true,
    });
    root.addEventListener("pointermove", onMove as EventListener, {
      passive: true,
    });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("resize", refreshRect, { passive: true });

    return () => {
      root.removeEventListener("pointerdown", onDown as EventListener);
      root.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", refreshRect);
      if (raf) cancelAnimationFrame(raf);
      for (const s of sparks) s.el.remove();
      sparks.length = 0;
    };
  }, [lite]);

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0 z-[28] overflow-hidden"
      aria-hidden
    />
  );
}
