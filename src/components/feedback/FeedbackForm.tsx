"use client";

import { useEffect, useRef, useState } from "react";
import {
  checkClientGeo,
  type ClientGeoState,
  type PublicLocation,
} from "@/lib/client-geo";
import { getOrCreateFeedbackDeviceId } from "@/components/feedback/device-id";

type FeedbackTypeValue = "SUGGESTION" | "COMPLAINT";

type Props = {
  slug: string;
  boxName: string;
  dailyLimitPerDevice: number;
  remainingToday: number;
  geoRequired: boolean;
  locations: PublicLocation[];
};

const MESSAGE_MAX = 2000;
const RATING_LABELS = ["", "Zəif", "Orta", "Yaxşı", "Çox yaxşı", "Əla"];
const RATING_EMOJI = ["🌟", "😕", "😐", "🙂", "😄", "🤩"];
const SPARKLE_OFFSETS: { sx: string; sy: string; delay: string; icon: string }[] = [
  { sx: "34px", sy: "-30px", delay: "0ms", icon: "✨" },
  { sx: "-32px", sy: "-26px", delay: "60ms", icon: "⭐" },
  { sx: "28px", sy: "24px", delay: "120ms", icon: "✨" },
  { sx: "-30px", sy: "22px", delay: "40ms", icon: "🎉" },
  { sx: "0px", sy: "-40px", delay: "90ms", icon: "✨" },
  { sx: "0px", sy: "36px", delay: "150ms", icon: "⭐" },
];

export default function FeedbackForm({
  slug,
  boxName,
  dailyLimitPerDevice,
  remainingToday: initialRemaining,
  geoRequired,
  locations,
}: Props) {
  const [type, setType] = useState<FeedbackTypeValue>("SUGGESTION");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingBumpKey, setRatingBumpKey] = useState(0);
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingToday, setRemainingToday] = useState(initialRemaining);
  const [success, setSuccess] = useState<{ atLabel: string } | null>(null);
  const [geo, setGeo] = useState<ClientGeoState>({ status: "idle" });
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focusMessage, setFocusMessage] = useState(false);

  async function refreshGeo(): Promise<ClientGeoState> {
    if (!geoRequired) {
      setGeo({ status: "idle" });
      coordsRef.current = null;
      return { status: "idle" };
    }
    setGeo((g) => ({ status: "loading", fix: "fix" in g ? g.fix : null }));
    const next = await checkClientGeo({ required: true, locations });
    setGeo(next);
    if (next.status === "ready" && next.inside) {
      coordsRef.current = { lat: next.fix.lat, lng: next.fix.lng };
    } else {
      coordsRef.current = null;
    }
    return next;
  }

  const locationsKey = locations.map((l) => l.id).join(",");
  useEffect(() => {
    void refreshGeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoRequired, locationsKey]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, Math.max(96, el.scrollHeight))}px`;
  }, [message]);

  const geoBlocked =
    geoRequired &&
    (locations.length === 0 ||
      geo.status === "loading" ||
      geo.status === "denied" ||
      geo.status === "error" ||
      (geo.status === "ready" && !geo.inside));

  const messageOk = message.trim().length >= 3;
  const canSubmit = !busy && remainingToday > 0 && messageOk && !geoBlocked;
  const showRatingNudge = rating === 0 && hoverRating === 0 && message.trim().length > 8;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const deviceId = getOrCreateFeedbackDeviceId();
      const res = await fetch(`/api/public/feedback/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          type,
          rating: rating > 0 ? rating : null,
          message: message.trim(),
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          lat: coordsRef.current?.lat,
          lng: coordsRef.current?.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Göndərilə bilmədi. Yenidən cəhd edin.");
        return;
      }
      setSuccess({ atLabel: data.createdAtLabel || "" });
      setRemainingToday(typeof data.remainingToday === "number" ? data.remainingToday : 0);
    } catch {
      setError("Bağlantı xətası. Yenidən cəhd edin.");
    } finally {
      setBusy(false);
    }
  }

  function sendAnother() {
    setSuccess(null);
    setRating(0);
    setRatingBumpKey(0);
    setMessage("");
    setType("SUGGESTION");
    setError(null);
    setCustomerName("");
    setCustomerPhone("");
  }

  const isAnonymous = customerName.trim().length === 0 && customerPhone.trim().length === 0;

  const charPct = Math.min(100, Math.round((message.length / MESSAGE_MAX) * 100));
  const counterTone =
    charPct >= 95 ? "text-danger" : charPct >= 80 ? "text-amber-600" : "text-[#8a5a1f]";

  return (
    <div
      className="relative min-h-[100dvh] overflow-hidden px-4 py-8 text-[#3d2914]"
      style={{
        background:
          "linear-gradient(165deg, #FFF9EE 0%, #FFE7B0 38%, #FFD078 72%, #F0B85A 100%)",
      }}
    >
      <div
        aria-hidden
        className="animate-blob-float pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob-float pointer-events-none absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl"
        style={{ animationDelay: "3s" }}
      />
      <div
        aria-hidden
        className="animate-blob-float pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-[#c99a3d]/25 blur-3xl"
        style={{ animationDelay: "6s" }}
      />

      <div className="relative mx-auto max-w-md">
        <div className="mb-5 text-center animate-fade-in-up">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a5a1f]">
            Təklif &amp; Şikayət
          </p>
          <h1
            className="mt-1 text-2xl font-bold text-[#5c3b00]"
            style={{ fontFamily: "var(--display)" }}
          >
            {boxName}
          </h1>
        </div>

        {success ? (
          <div className="animate-fade-in-up relative overflow-hidden rounded-2xl bg-white/95 p-6 text-center shadow-xl ring-1 ring-black/5 backdrop-blur">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 20% 15%, rgba(16,185,129,0.12), transparent 40%), radial-gradient(circle at 85% 20%, rgba(217,119,6,0.10), transparent 45%)",
              }}
            />
            <div className="animate-ring-pulse animate-pop-in relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 ring-4 ring-white">
              ✓
            </div>
            <h2 className="text-lg font-bold text-[#3d2914]">Təşəkkürlər!</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6b4a1f]">
              Rəyiniz qeydə alındı{success.atLabel ? ` (${success.atLabel})` : ""}.
              Dəyərləndirməyinizə görə təşəkkür edirik.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#fff3d6] px-3 py-1.5 text-xs font-medium text-[#8a5a1f] ring-1 ring-[#f0d9a8]">
              <span>📨</span>
              Bu gün üçün qalan haqq: {remainingToday} / {dailyLimitPerDevice}
            </div>
            {remainingToday > 0 ? (
              <button
                type="button"
                onClick={sendAnother}
                className="mt-4 block w-full rounded-xl bg-[#5C3200] px-5 py-2.5 text-sm font-bold text-[#FFF6D6] shadow-lg shadow-[#5C3200]/20 transition active:scale-[0.98]"
              >
                Yeni göndəriş et
              </button>
            ) : null}
          </div>
        ) : (
          <div className="animate-fade-in-up relative space-y-5 rounded-2xl bg-white/95 p-5 shadow-xl ring-1 ring-black/5 backdrop-blur">
            <div className="flex items-center justify-between rounded-xl bg-[#fff3d6] px-3 py-2 text-xs ring-1 ring-[#f0d9a8]">
              <span className="font-medium text-[#8a5a1f]">Bu gün üçün qalan haqq</span>
              <span className="font-bold text-[#5c3b00]">
                {remainingToday} / {dailyLimitPerDevice}
              </span>
            </div>

            {geoRequired ? (
              <div className="rounded-xl border border-[#f0d9a8] bg-[#fff8ea] p-3 text-xs transition-all">
                {geo.status === "loading" ? (
                  <p className="flex items-center gap-2 text-[#8a5a1f]">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#c99a3d] border-t-transparent" />
                    Məkanınız alınır…
                  </p>
                ) : geo.status === "ready" && geo.inside ? (
                  <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <span>✓</span>
                    {geo.matchedLocation ? geo.matchedLocation.label : "Şöbə"} daxilindəsiniz.
                  </p>
                ) : geo.status === "ready" && !geo.inside ? (
                  <div className="space-y-2">
                    <p className="font-medium text-danger">
                      Şöbədən kənardasınız
                      {geo.distanceMeters != null
                        ? ` (~${Math.round(geo.distanceMeters)} m)`
                        : ""}
                      . Yalnız şöbədə göndəriş edilə bilər.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refreshGeo()}
                      className="rounded-lg border border-[#e0c088] px-2.5 py-1 font-medium text-[#5c3b00] transition hover:bg-[#fff3d6] active:scale-95"
                    >
                      Məkanı yenilə
                    </button>
                  </div>
                ) : geo.status === "denied" || geo.status === "error" ? (
                  <div className="space-y-2">
                    <p className="font-medium text-danger">{geo.message}</p>
                    <button
                      type="button"
                      onClick={() => void refreshGeo()}
                      className="rounded-lg border border-[#e0c088] px-2.5 py-1 font-medium text-[#5c3b00] transition hover:bg-[#fff3d6] active:scale-95"
                    >
                      Yenidən cəhd et
                    </button>
                  </div>
                ) : locations.length === 0 ? (
                  <p className="font-medium text-danger">
                    Aktiv şöbə təyin edilməyib. Menecerə bildirin.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a5a1f]">
                Növ
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setType("SUGGESTION")}
                  className={`group relative overflow-hidden rounded-xl border-2 px-3 py-3 text-left transition-all active:scale-[0.97] ${
                    type === "SUGGESTION"
                      ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-500/10"
                      : "border-[#e8dcc0] bg-white hover:border-emerald-300"
                  }`}
                >
                  {type === "SUGGESTION" ? (
                    <span className="animate-shine-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  ) : null}
                  <span className="block text-xl">💡</span>
                  <span
                    className={`mt-1 block text-sm font-bold ${
                      type === "SUGGESTION" ? "text-emerald-700" : "text-[#8a5a1f]"
                    }`}
                  >
                    Təklif
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[#a8895a]">
                    Fikrinizi bölüşün
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("COMPLAINT")}
                  className={`group relative overflow-hidden rounded-xl border-2 px-3 py-3 text-left transition-all active:scale-[0.97] ${
                    type === "COMPLAINT"
                      ? "border-danger bg-danger/10 shadow-md shadow-danger/10"
                      : "border-[#e8dcc0] bg-white hover:border-danger/40"
                  }`}
                >
                  {type === "COMPLAINT" ? (
                    <span className="animate-shine-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  ) : null}
                  <span className="block text-xl">⚠️</span>
                  <span
                    className={`mt-1 block text-sm font-bold ${
                      type === "COMPLAINT" ? "text-danger" : "text-[#8a5a1f]"
                    }`}
                  >
                    Şikayət
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[#a8895a]">
                    Problemi bildirin
                  </span>
                </button>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8a5a1f]">
                  Təcrübənizi qiymətləndirin
                </p>
                <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[10px] font-medium text-[#a8895a] ring-1 ring-[#f0d9a8]">
                  İstəyə bağlı
                </span>
              </div>

              {showRatingNudge ? (
                <div className="animate-fade-in-up mb-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-emerald-700">
                  <span className="inline-block animate-bounce">👇</span>
                  Bir kliklə bal verməyə nə deyirsiniz?
                  <span className="inline-block animate-bounce" style={{ animationDelay: "0.15s" }}>
                    👇
                  </span>
                </div>
              ) : null}

              <div
                className={`relative flex flex-col items-center gap-2.5 overflow-hidden rounded-2xl border-2 py-6 shadow-inner transition-all ${
                  showRatingNudge
                    ? "border-emerald-300 bg-emerald-50/70 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                    : rating > 0
                      ? "border-amber-300 bg-gradient-to-b from-[#fffaf0] to-[#fff3d6]"
                      : "border-[#f0e6cc] bg-[#fffaf0]"
                }`}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 0%, rgba(245,190,90,0.25), transparent 60%)",
                  }}
                />
                {rating > 0 ? (
                  <span className="animate-shine-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                ) : null}

                <div className="relative flex items-center gap-2">
                  <div
                    key={`emoji-${hoverRating || rating}`}
                    className="animate-emoji-pop text-4xl leading-none drop-shadow-sm"
                  >
                    {RATING_EMOJI[hoverRating || rating]}
                  </div>
                  {rating > 0 ? (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                      {rating}/5
                    </span>
                  ) : null}
                </div>

                <div className="relative flex gap-1 text-5xl sm:gap-2 sm:text-6xl">
                  {(rating >= 4 || hoverRating >= 4) && ratingBumpKey > 0
                    ? SPARKLE_OFFSETS.map((s, i) => (
                        <span
                          key={`${ratingBumpKey}-${i}`}
                          className="animate-sparkle-fly pointer-events-none absolute left-1/2 top-1/2 text-base"
                          style={
                            {
                              "--sx": s.sx,
                              "--sy": s.sy,
                              animationDelay: s.delay,
                            } as React.CSSProperties
                          }
                        >
                          {s.icon}
                        </span>
                      ))
                    : null}
                  {[1, 2, 3, 4, 5].map((n) => {
                    const effective = hoverRating || rating;
                    const active = n <= effective;
                    const distance = effective ? Math.abs(effective - n) : 0;
                    const dockScale = effective ? Math.max(1, 1.32 - distance * 0.16) : 1;
                    return (
                      <button
                        key={n}
                        type="button"
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        onTouchStart={() => setHoverRating(n)}
                        onClick={() => {
                          setRating((r) => (r === n ? 0 : n));
                          setRatingBumpKey((k) => k + 1);
                          setHoverRating(0);
                        }}
                        aria-label={`${n} ulduz`}
                        style={
                          { "--star-scale": dockScale } as React.CSSProperties
                        }
                        className="-m-1 rounded-full p-1 leading-none transition-transform duration-200 ease-out active:scale-90"
                      >
                        <span
                          key={active ? `on-${n}-${ratingBumpKey}` : `off-${n}`}
                          className={`inline-block origin-bottom ${
                            active ? "animate-star-wiggle text-amber-500" : "text-[#e8dcc0]"
                          } ${rating === n ? "animate-glow-pulse" : ""}`}
                          style={{ transform: `scale(${dockScale})` }}
                        >
                          ★
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="h-4 text-xs font-semibold text-[#a8895a] transition-opacity">
                  {(hoverRating || rating) > 0
                    ? RATING_LABELS[hoverRating || rating]
                    : "Toxunun və seçin — istəsəniz keçə bilərsiniz"}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8a5a1f]">
                  Mesajınız
                </p>
                <p className={`text-[10px] font-medium transition-colors ${counterTone}`}>
                  {message.length}/{MESSAGE_MAX}
                </p>
              </div>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                onFocus={() => setFocusMessage(true)}
                onBlur={() => setFocusMessage(false)}
                rows={4}
                placeholder={
                  type === "COMPLAINT"
                    ? "Yaşadığınız problemi qısaca yazın…"
                    : "Təklifinizi qısaca yazın…"
                }
                className={`w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition-all ${
                  focusMessage
                    ? "border-[#c99a3d] shadow-[0_0_0_3px_rgba(201,154,61,0.15)]"
                    : "border-[#e8dcc0]"
                }`}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8a5a1f]">
                  Əlaqə məlumatı
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors ${
                    isAnonymous
                      ? "bg-[#f2ecdd] text-[#8a5a1f] ring-[#e8dcc0]"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  }`}
                >
                  {isAnonymous ? "🕶 Anonim göndəriləcək" : "✓ Adınızla göndəriləcək"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.slice(0, 80))}
                  placeholder="Adınız (istəyə bağlı)"
                  className="w-full rounded-xl border border-[#e8dcc0] bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#c99a3d] focus:shadow-[0_0_0_3px_rgba(201,154,61,0.15)]"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.slice(0, 30))}
                  placeholder="Telefon (istəyə bağlı)"
                  className="w-full rounded-xl border border-[#e8dcc0] bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-[#c99a3d] focus:shadow-[0_0_0_3px_rgba(201,154,61,0.15)]"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#a8895a]">
                Boş buraxsanız rəyiniz anonim qeydə alınır.
              </p>
            </div>

            {error ? (
              <p className="animate-fade-in-up rounded-lg bg-danger/10 px-3 py-2 text-center text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
            {remainingToday <= 0 ? (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-center text-sm font-medium text-danger">
                Bu günlük göndərmə haqqınız bitdi. Sabah yenidən cəhd edin.
              </p>
            ) : null}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void onSubmit()}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#6b3c00] to-[#8a5a1f] px-4 py-3.5 text-sm font-bold text-[#FFF6D6] shadow-lg shadow-[#5C3200]/25 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {canSubmit && !busy ? (
                <span className="animate-shine-sweep absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              ) : null}
              <span className="relative flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#FFF6D6] border-t-transparent" />
                    Göndərilir…
                  </>
                ) : (
                  <>
                    Göndər
                    <span aria-hidden>✦</span>
                  </>
                )}
              </span>
            </button>
            {!messageOk && !busy ? (
              <p className="text-center text-[11px] text-[#a8895a]">
                Göndərmək üçün ən azı bir neçə söz yazın — bal vermək məcburi deyil.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
