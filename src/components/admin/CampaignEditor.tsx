"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminBackLink from "@/components/admin/AdminBackLink";
import WheelEditor from "@/components/admin/WheelEditor";
import { publicMediaUrl } from "@/lib/media-url";

export type CampaignDto = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  notes: string | null;
  targetImagePath: string | null;
  mindPath: string | null;
  mediaType: "VIDEO" | "IMAGE" | null;
  mediaPath: string | null;
  mediaMime: string | null;
  scanCount: number;
  targetFoundCount: number;
  playCount: number;
  wheelEnabled?: boolean;
  spinsPerPlayerPerDay?: number;
  wheelShowPrizeNames?: boolean;
  wheelEqualSlices?: boolean;
  spinCooldownMinutes?: number;
  claimWindowMinutes?: number;
  spinPin?: string;
  requirePin?: boolean;
  claimPin?: string;
  requireClaimPin?: boolean;
  geoEnabled?: boolean;
  geoLat?: number | null;
  geoLng?: number | null;
  geoRadiusMeters?: number;
};

type Props = {
  initial: CampaignDto;
  targetImageUrl: string | null;
  mediaUrl: string | null;
  arUrl: string;
  gameUrl?: string;
};

export default function CampaignEditor({
  initial,
  mediaUrl: initialMediaUrl,
  arUrl,
  gameUrl,
}: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDto>({
    ...initial,
    wheelEnabled: Boolean(initial.wheelEnabled),
    spinsPerPlayerPerDay: initial.spinsPerPlayerPerDay ?? 1,
    wheelShowPrizeNames: Boolean(initial.wheelShowPrizeNames),
    wheelEqualSlices: initial.wheelEqualSlices !== false,
    spinCooldownMinutes: initial.spinCooldownMinutes ?? 0,
    claimWindowMinutes: initial.claimWindowMinutes ?? 30,
    spinPin: initial.spinPin ?? "",
    claimPin: initial.claimPin ?? "",
    geoEnabled: Boolean(initial.geoEnabled),
    geoLat: initial.geoLat ?? null,
    geoLng: initial.geoLng ?? null,
    geoRadiusMeters: initial.geoRadiusMeters ?? 150,
  });
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [notes, setNotes] = useState(initial.notes || "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState(`/api/campaigns/${initial.id}/qr`);
  const [qrTargetUrl, setQrTargetUrl] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<{
    tone: "info" | "success" | "warning";
    text: string;
  } | null>(null);
  const [mediaUrl, setMediaUrl] = useState(initialMediaUrl);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${initial.id}`);
    if (res.ok) {
      const data = (await res.json()) as CampaignDto;
      setCampaign({
        ...data,
        wheelEnabled: Boolean(data.wheelEnabled),
        spinsPerPlayerPerDay: data.spinsPerPlayerPerDay ?? 1,
        wheelShowPrizeNames: Boolean(data.wheelShowPrizeNames),
        wheelEqualSlices: data.wheelEqualSlices !== false,
        spinCooldownMinutes: data.spinCooldownMinutes ?? 0,
        claimWindowMinutes: data.claimWindowMinutes ?? 30,
        spinPin: data.spinPin ?? "",
        claimPin: data.claimPin ?? "",
        geoEnabled: Boolean(data.geoEnabled),
        geoLat: data.geoLat ?? null,
        geoLng: data.geoLng ?? null,
        geoRadiusMeters: data.geoRadiusMeters ?? 150,
      });
      setMediaUrl(publicMediaUrl(data.mediaPath));
    }
    router.refresh();
  }, [router, initial.id]);

  useEffect(() => {
    setCampaign(initial);
    setName(initial.name);
    setSlug(initial.slug);
    setNotes(initial.notes || "");
    setMediaUrl(initialMediaUrl);
  }, [initial, initialMediaUrl]);

  useEffect(() => {
    let cancelled = false;

    async function syncQrStatus() {
      try {
        const res = await fetch(`/api/campaigns/${campaign.id}/qr?format=json`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "QR bilgisi alınamadı");
        if (cancelled) return;

        setQrTargetUrl(data.url);
        if (gameUrl && data.url !== gameUrl) {
          setQrStatus({
            tone: "warning",
            text: `QR hedefi ile aktif oyun adresi uyuşmuyor. QR yeniden derlenmeli.\nHedef: ${data.url}`,
          });
        } else {
          setQrStatus({
            tone: "success",
            text: `QR senkron. Hedef: ${data.url}`,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setQrStatus({
            tone: "warning",
            text: e instanceof Error ? e.message : "QR senkron durumu kontrol edilemedi.",
          });
        }
      }
    }

    void syncQrStatus();
    return () => {
      cancelled = true;
    };
  }, [campaign.id, gameUrl]);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Kaydedilemedi");
      return;
    }
    setCampaign((prev) => ({ ...prev, ...data }));
    setMessage("Kaydedildi.");
    refresh();
  }

  async function upload(file: File) {
    setUploading("media");
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("kind", "media");
    form.append("file", file);
    const res = await fetch(`/api/campaigns/${campaign.id}/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setUploading(null);
    if (!res.ok) {
      setError(data.error || "Yükleme başarısız");
      return;
    }
    setCampaign((prev) => ({ ...prev, ...data }));
    setMediaUrl(publicMediaUrl(data.mediaPath));
    setMessage("Görsel yüklendi.");
    void refresh();
  }

  async function rebuildQr() {
    setError(null);
    setMessage(null);
    setQrStatus({
      tone: "info",
      text: "QR yenileniyor…",
    });

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/qr?format=json`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "QR yeniden derlenemedi");
      }

      setQrTargetUrl(data.url);
      setQrUrl(`/api/campaigns/${campaign.id}/qr?t=${Date.now()}`);

      const deadHint = data.url.includes("trycloudflare.com")
        ? "\nNot: trycloudflare adresi her tunnel’da değişir. tunnel.bat açık değilse telefonda «sunucu bulunamadı» olur."
        : "";

      setQrStatus({
        tone: "success",
        text: `QR güncellendi. Hedef: ${data.url}${deadHint}`,
      });
      setMessage("QR yenilendi.");
      void refresh();
    } catch (e) {
      setQrStatus({
        tone: "warning",
        text: e instanceof Error ? e.message : "QR yeniden derlenemedi.",
      });
      setError(e instanceof Error ? e.message : "QR yeniden derlenemedi.");
    }
  }

  const publishDisabled = useMemo(() => {
    if (campaign.wheelEnabled) return false;
    return !campaign.mediaPath;
  }, [campaign.wheelEnabled, campaign.mediaPath]);

  async function setStatus(status: "DRAFT" | "PUBLISHED") {
    setError(null);
    if (status === "PUBLISHED") {
      const gaps: string[] = [];
      if (!campaign.wheelEnabled && !campaign.mediaPath) {
        gaps.push("Reklam görseli yükleyin");
      }
      if (gaps.length) {
        setError(`Yayınlanamaz:\n• ${gaps.join("\n• ")}`);
        return;
      }
    }
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Durum güncellenemedi");
      return;
    }
    setCampaign((prev) => ({ ...prev, ...data }));
    setMessage(status === "PUBLISHED" ? "Kampanya yayında." : "Taslağa alındı.");
    void refresh();
  }

  async function remove() {
    if (!confirm("Kampanya silinsin mi?")) return;
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Silinemedi");
      return;
    }
    router.push("/admin");
  }

  const publicLink = gameUrl || arUrl;

  return (
    <div className="space-y-6">
      <AdminBackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: "var(--display)" }}>
            {campaign.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {gameUrl ? "Oyun (QR): " : "Görsel (QR): "}
            <a
              href={`${publicLink}${publicLink.includes("?") ? "&" : "?"}from=admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              {publicLink}
            </a>
            <span className="ml-1 text-xs">(yeni pəncərə)</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium"
          >
            ← Kampanyalar
          </button>
          {gameUrl ? (
            <a
              href={`${gameUrl}${gameUrl.includes("?") ? "&" : "?"}from=admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent"
            >
              Oyunu test et ↗
            </a>
          ) : null}
          {campaign.status === "PUBLISHED" ? (
            <button
              type="button"
              onClick={() => setStatus("DRAFT")}
              className="rounded-md border border-line bg-card px-3 py-2 text-sm"
            >
              Yayından kaldır
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStatus("PUBLISHED")}
              disabled={publishDisabled}
              className={`rounded-md px-3 py-2 text-sm font-medium text-white ${publishDisabled ? "bg-gray-300 text-muted cursor-not-allowed" : "bg-accent"}`}
            >
              Yayınla
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger"
          >
            Sil
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-accent">{message}</p> : null}
      {error ? (
        <p className="whitespace-pre-line text-sm text-danger">{error}</p>
      ) : null}

      <div className="rounded-xl border border-line bg-card px-5 py-4">
        <h2 className="mb-2 text-sm font-medium text-muted">Yayın checklist</h2>
        <ul className="space-y-1 text-sm">
          {campaign.wheelEnabled ? (
            <CheckItem
              ok={true}
              label="Şans çarkı açık — QR /oyun adresine gider"
            />
          ) : (
            <CheckItem ok={Boolean(campaign.mediaPath)} label="Reklam görseli" />
          )}
        </ul>
        {campaign.wheelEnabled ? (
          <p className="mt-2 text-xs text-muted">
            Çark açıkken en az bir aktif hediye dilimi gerekir.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={saveMeta}
          className="space-y-4 rounded-xl border border-line bg-card p-5"
        >
          <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
            Bilgiler
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Ad</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Slug</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Notlar</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-line px-3 py-2 text-sm hover:bg-white"
          >
            Kaydet
          </button>
        </form>

        <div className="space-y-4 rounded-xl border border-line bg-card p-5">
          <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
            Analitik
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            {campaign.wheelEnabled ? (
              <>
                <Stat label="QR açılış" value={campaign.scanCount} />
                <Stat label="Giriş" value={campaign.targetFoundCount} />
                <Stat label="Çevirme" value={campaign.playCount} />
              </>
            ) : (
              <>
                <Stat label="Tarama" value={campaign.scanCount} />
                <Stat label="Oynatma" value={campaign.playCount} />
              </>
            )}
          </div>
          {campaign.wheelEnabled ? (
            <p className="text-[11px] text-muted">
              QR açılış = oyun sayfası · Giriş = telefonla başla · Çevirme =
              çark fırlatma
            </p>
          ) : null}
          <div className="rounded-lg border border-line bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">QR kod</h3>
              <button
                type="button"
                className="text-sm text-accent"
                onClick={() => void rebuildQr()}
              >
                QR yeniden derle
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Kampanya QR"
              className="mx-auto h-40 w-40 rounded border border-line bg-white p-2"
            />
            {qrStatus ? (
              <p
                className={`mt-2 text-center text-xs whitespace-pre-line ${
                  qrStatus.tone === "warning"
                    ? "text-danger"
                    : qrStatus.tone === "success"
                      ? "text-accent"
                      : "text-muted"
                }`}
              >
                {qrStatus.text}
              </p>
            ) : null}
            {qrTargetUrl ? (
              <p className="mt-2 break-all text-center text-xs text-muted">
                {qrTargetUrl}
              </p>
            ) : null}
            {campaign.wheelEnabled ? (
              <p className="mt-2 text-center text-xs text-muted">
                Bu QR birbaşa şans çarxı oyununa açılır (/oyun)
              </p>
            ) : (
              <p className="mt-2 text-center text-xs text-muted">
                Bu QR reklam görseline açılır
              </p>
            )}
          </div>
        </div>

        <div
          className={`space-y-4 rounded-xl border bg-card p-5 lg:col-span-2 ${
            !campaign.wheelEnabled && !mediaUrl
              ? "border-accent ring-2 ring-accent/20"
              : "border-line"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
              1) Reklam görseli
            </h2>
            {campaign.wheelEnabled ? (
              <span className="rounded-full bg-bg-deep px-2 py-0.5 text-xs text-muted">
                Çarkta zorunlu değil
              </span>
            ) : mediaUrl ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                Yüklü
              </span>
            ) : (
              <span className="rounded-full bg-bg-deep px-2 py-0.5 text-xs text-muted">
                Eksik
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            {campaign.wheelEnabled
              ? "Çark kapalıyken QR bu görseli açar. Şans çarkı medya olmadan çalışır; hediye görselleri dilim ayarlarından eklenir."
              : "QR okutulunca müşteri bu görseli (veya videoyu) görür. Kamera kullanılmaz."}
          </p>

          <input
            ref={mediaInputRef}
            type="file"
            accept="video/mp4,video/webm,image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading === "media"}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading === "media"}
              onClick={() => mediaInputRef.current?.click()}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {uploading === "media"
                ? "Yükleniyor…"
                : mediaUrl
                  ? "Görseli / videoyu değiştir"
                  : "Görsel veya video yükle"}
            </button>
            {mediaUrl ? (
              <span className="self-center text-xs text-muted">
                {campaign.mediaType === "VIDEO" ? "Video" : "Görsel"} yüklü
              </span>
            ) : null}
          </div>

          {mediaUrl && campaign.mediaType === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={mediaUrl}
              src={mediaUrl}
              alt="Medya"
              className="max-h-56 rounded-md border border-line bg-white object-contain"
            />
          ) : null}
          {mediaUrl && campaign.mediaType === "VIDEO" ? (
            <video
              key={mediaUrl}
              src={mediaUrl}
              controls
              muted
              className="max-h-56 w-full rounded-md border border-line"
            />
          ) : null}
          {!mediaUrl ? (
            <p className="text-sm text-muted">Henüz görsel yok.</p>
          ) : null}
        </div>
      </div>

      <WheelEditor
        campaignId={campaign.id}
        wheelEnabled={Boolean(campaign.wheelEnabled)}
        spinsPerPlayerPerDay={campaign.spinsPerPlayerPerDay ?? 1}
        wheelShowPrizeNames={Boolean(campaign.wheelShowPrizeNames)}
        wheelEqualSlices={campaign.wheelEqualSlices !== false}
        spinCooldownMinutes={campaign.spinCooldownMinutes ?? 0}
        claimWindowMinutes={campaign.claimWindowMinutes ?? 30}
        spinPin={campaign.spinPin ?? ""}
        claimPin={campaign.claimPin ?? ""}
        onCampaignChange={async (patch) => {
          const res = await fetch(`/api/campaigns/${campaign.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Kaydedilemedi");
          }
          setCampaign((prev) => ({ ...prev, ...data }));
          void refresh();
          return data as {
            spinPin?: string;
            claimPin?: string;
            requireClaimPin?: boolean;
          };
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg-deep/60 px-3 py-4">
      <div className="text-2xl font-medium">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "text-accent" : "text-muted"}>
      {ok ? "✓" : "○"} {label}
    </li>
  );
}
