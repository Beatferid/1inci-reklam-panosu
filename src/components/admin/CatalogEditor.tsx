"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminBackLink from "@/components/admin/AdminBackLink";
import CopyLinkButton from "@/components/admin/CopyLinkButton";

export type CatalogPageDto = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
  order: number;
};

export type CatalogTheme = "NONE" | "NEW_YEAR" | "EID" | "RAMADAN" | "SNOW" | "SPRING";

export type CatalogFlipStyle = "CURL" | "SLIDE" | "FADE" | "ZOOM" | "FLIP_H";

export type CatalogDto = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  coverTitle: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  musicUrl: string | null;
  musicVolume: number;
  theme: CatalogTheme;
  flipStyle: CatalogFlipStyle;
  viewCount: number;
  pageCount: number;
  pages: CatalogPageDto[];
};

type Tab = "settings" | "pages";

const TABS: { id: Tab; label: string }[] = [
  { id: "settings", label: "Ayarlar" },
  { id: "pages", label: "Sayfalar" },
];

const THEME_OPTIONS: { id: CatalogTheme; label: string; hint: string }[] = [
  { id: "NONE", label: "Yok", hint: "Görsel efekt eklenmez" },
  { id: "NEW_YEAR", label: "Yılbaşı", hint: "Kar taneleri + havai fişek + altın parıltı" },
  { id: "EID", label: "Kurban Bayramı", hint: "Zarif altın parıltı + hilal" },
  { id: "RAMADAN", label: "Ramazan Bayramı", hint: "Fener + hilal + gece ambiyansı" },
  { id: "SNOW", label: "Kar efekti", hint: "Sade, düşen kar taneleri" },
  { id: "SPRING", label: "Bahar efekti", hint: "Çiçek, kelebek + yeşil ambiyans" },
];

const FLIP_OPTIONS: { id: CatalogFlipStyle; label: string; hint: string }[] = [
  { id: "CURL", label: "Kıvrım (klasik)", hint: "Kağıt sayfa çevirme efekti" },
  { id: "SLIDE", label: "Kaydırma", hint: "Sola/sağa kayarak geçiş" },
  { id: "FADE", label: "Fade", hint: "Yumuşak solma ile geçiş" },
  { id: "ZOOM", label: "Zoom", hint: "Yakınlaşarak/uzaklaşarak geçiş" },
  { id: "FLIP_H", label: "Yatay flip", hint: "3D yatay döndürme" },
];

export default function CatalogEditor({ initial }: { initial: CatalogDto }) {
  const [tab, setTab] = useState<Tab>("settings");
  const [catalog, setCatalog] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [coverTitle, setCoverTitle] = useState(initial.coverTitle || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [qrNonce, setQrNonce] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [origin, setOrigin] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicVolume, setMusicVolume] = useState(initial.musicVolume);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function refreshCatalog() {
    const res = await fetch(`/api/admin/catalogs/${catalog.id}`);
    if (res.ok) {
      const json = await res.json();
      setCatalog(json);
    }
  }

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${catalog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Kaydedilemedi");
        return false;
      }
      setCatalog(json);
      setMessage("Kaydedildi.");
      return true;
    } catch {
      setError("Bağlantı hatası — kaydedilemedi.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveBasics() {
    await patch({ name, slug, coverTitle: coverTitle.trim() || null });
  }

  async function togglePublish() {
    const next = catalog.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await patch({ status: next });
  }

  async function setTheme(theme: CatalogTheme) {
    await patch({ theme });
  }

  async function setFlipStyle(flipStyle: CatalogFlipStyle) {
    await patch({ flipStyle });
  }

  async function saveMusicVolume(volume: number) {
    await patch({ musicVolume: volume });
  }

  async function uploadLogo(file: File) {
    setLogoBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/catalogs/${catalog.id}/logo`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Logo yüklenemedi");
        return;
      }
      setCatalog(json);
    } catch {
      setError("Bağlantı hatası — logo yüklenemedi.");
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${catalog.id}/logo`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) setCatalog(json);
    } finally {
      setLogoBusy(false);
    }
  }

  async function uploadCover(file: File) {
    setCoverBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/catalogs/${catalog.id}/cover`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Kapak yüklenemedi");
        return;
      }
      setCatalog(json);
    } catch {
      setError("Bağlantı hatası — kapak yüklenemedi.");
    } finally {
      setCoverBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function removeCover() {
    setCoverBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${catalog.id}/cover`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) setCatalog(json);
    } finally {
      setCoverBusy(false);
    }
  }

  async function uploadMusic(file: File) {
    setMusicBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/catalogs/${catalog.id}/music`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Müzik yüklenemedi");
        return;
      }
      setCatalog(json);
    } catch {
      setError("Bağlantı hatası — müzik yüklenemedi.");
    } finally {
      setMusicBusy(false);
      if (musicInputRef.current) musicInputRef.current.value = "";
    }
  }

  async function removeMusic() {
    setMusicBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalogs/${catalog.id}/music`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) setCatalog(json);
    } finally {
      setMusicBusy(false);
    }
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) {
        setUploadProgress(`${i + 1} / ${list.length} yükleniyor…`);
        const form = new FormData();
        form.append("file", list[i]);
        const res = await fetch(`/api/admin/catalogs/${catalog.id}/pages`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error || `${list[i].name} yüklenemedi`);
          break;
        }
      }
      await refreshCatalog();
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function movePage(pageId: string, dir: -1 | 1) {
    const ids = catalog.pages.map((p) => p.id);
    const idx = ids.indexOf(pageId);
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setBusy(true);
    try {
      await fetch(`/api/admin/catalogs/${catalog.id}/pages/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ids }),
      });
      await refreshCatalog();
    } finally {
      setBusy(false);
    }
  }

  async function deletePage(pageId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/catalogs/${catalog.id}/pages/${pageId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Silinemedi");
        return;
      }
      await refreshCatalog();
    } finally {
      setBusy(false);
    }
  }

  async function updatePageLink(pageId: string, linkUrl: string) {
    await fetch(`/api/admin/catalogs/${catalog.id}/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkUrl: linkUrl.trim() || null }),
    });
    await refreshCatalog();
  }

  async function replacePageImage(pageId: string, file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/admin/catalogs/${catalog.id}/pages/${pageId}`,
        { method: "PATCH", body: form },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Görsel değiştirilemedi");
        return;
      }
      await refreshCatalog();
    } finally {
      setBusy(false);
    }
  }

  const entryUrl = `/katalog/${catalog.slug}`;
  const absoluteEntryUrl = `${origin}${entryUrl}`;
  const canPublish = catalog.status === "PUBLISHED" || catalog.pageCount > 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <AdminBackLink href="/admin/katalog" label="← Katalog listesi" />
        <button
          type="button"
          disabled={busy || !canPublish}
          title={!canPublish ? "Yayınlamak için en az 1 sayfa ekleyin" : undefined}
          onClick={() => void togglePublish()}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            catalog.status === "PUBLISHED"
              ? "border border-line bg-white text-ink hover:bg-bg-deep/40"
              : "bg-accent text-white"
          }`}
        >
          {catalog.status === "PUBLISHED" ? "Yayından kaldır" : "Yayınla"}
        </button>
      </div>

      <h1 className="mb-1 text-3xl" style={{ fontFamily: "var(--display)" }}>
        {catalog.name}
      </h1>
      <p className="mb-6 text-sm text-muted">
        /{catalog.slug} ·{" "}
        <span
          className={
            catalog.status === "PUBLISHED" ? "text-accent" : "text-muted"
          }
        >
          {catalog.status === "PUBLISHED" ? "Yayında" : "Taslak"}
        </span>{" "}
        · {catalog.pageCount} sayfa · {catalog.viewCount} görüntülenme
      </p>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-accent text-white"
                : "border border-line bg-white text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-line bg-card p-5">
            <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
              Temel ayarlar
            </h2>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Katalog adı</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">
                Kapak başlığı (opsiyonel)
              </span>
              <input
                value={coverTitle}
                onChange={(e) => setCoverTitle(e.target.value)}
                placeholder="Ağustos İndirimleri"
                className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
              />
            </label>
            <div>
              <span className="mb-2 block text-sm text-muted">
                Görsel tema / mövsümi effekt
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    title={opt.hint}
                    onClick={() => void setTheme(opt.id)}
                    className={`rounded-md border px-2.5 py-2 text-left text-xs font-medium transition disabled:opacity-60 ${
                      catalog.theme === opt.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line bg-white text-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Seçilən tema kataloq açılanda jurnalın üzərində hərəkətli
                hissəciklərlə (qar, parıltı, çiçək) göstərilir.
              </p>
            </div>
            <div>
              <span className="mb-2 block text-sm text-muted">
                Sayfa çevirme animasyonu
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FLIP_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    title={opt.hint}
                    onClick={() => void setFlipStyle(opt.id)}
                    className={`rounded-md border px-2.5 py-2 text-left text-xs font-medium transition disabled:opacity-60 ${
                      (catalog.flipStyle ?? "CURL") === opt.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line bg-white text-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Kıvrım = klasik kağıt çevirme. Diğerleri kaydırma, fade, zoom ve
                yatay 3D flip stilleridir.
              </p>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? (
              <p className="text-sm font-medium text-emerald-700">{message}</p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveBasics()}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Kapak fotoğrafı</h3>
                {catalog.coverUrl ? (
                  <button
                    type="button"
                    disabled={coverBusy}
                    onClick={() => void removeCover()}
                    className="text-xs text-danger disabled:opacity-50"
                  >
                    Kaldır
                  </button>
                ) : null}
              </div>
              {catalog.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={catalog.coverUrl}
                  alt="Paylaşım kapağı"
                  className="mx-auto max-h-40 w-full max-w-xs rounded-md object-cover"
                />
              ) : (
                <p className="text-center text-xs text-muted">
                  WhatsApp ve sosyal paylaşım önizlemesi için kapak görseli
                  (opsiyonel).
                </p>
              )}
              <label className="mt-3 block">
                <span className="block cursor-pointer rounded-md border border-line px-3 py-2 text-center text-xs font-medium hover:bg-bg-deep/40">
                  {coverBusy
                    ? "Yükleniyor…"
                    : catalog.coverUrl
                      ? "Kapağı değiştir"
                      : "Kapak yükle"}
                </span>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={coverBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Logo</h3>
                {catalog.logoUrl ? (
                  <button
                    type="button"
                    disabled={logoBusy}
                    onClick={() => void removeLogo()}
                    className="text-xs text-danger disabled:opacity-50"
                  >
                    Kaldır
                  </button>
                ) : null}
              </div>
              {catalog.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={catalog.logoUrl}
                  alt="Katalog logosu"
                  className="mx-auto h-20 max-w-full object-contain"
                />
              ) : (
                <p className="text-center text-xs text-muted">
                  Açılış ekranında görünecek logo yükleyin (opsiyonel).
                </p>
              )}
              <label className="mt-3 block">
                <span className="block cursor-pointer rounded-md border border-line px-3 py-2 text-center text-xs font-medium hover:bg-bg-deep/40">
                  {logoBusy
                    ? "Yükleniyor…"
                    : catalog.logoUrl
                      ? "Logoyu değiştir"
                      : "Logo yükle"}
                </span>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={logoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Arka plan müziği</h3>
                {catalog.musicUrl ? (
                  <button
                    type="button"
                    disabled={musicBusy}
                    onClick={() => void removeMusic()}
                    className="text-xs text-danger disabled:opacity-50"
                  >
                    Kaldır
                  </button>
                ) : null}
              </div>
              {catalog.musicUrl ? (
                <audio
                  controls
                  src={catalog.musicUrl}
                  className="mb-3 w-full"
                  style={{ height: 32 }}
                />
              ) : (
                <p className="mb-3 text-center text-xs text-muted">
                  Kataloq açıq olarkən sakit şəkildə çalınacaq müzik (opsiyonel).
                </p>
              )}
              {catalog.musicUrl ? (
                <label className="mb-3 block text-xs">
                  <span className="mb-1 flex items-center justify-between text-muted">
                    <span>Səs həcmi</span>
                    <span>{Math.round(musicVolume * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    onMouseUp={() => void saveMusicVolume(musicVolume)}
                    onTouchEnd={() => void saveMusicVolume(musicVolume)}
                    className="w-full accent-accent"
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="block cursor-pointer rounded-md border border-line px-3 py-2 text-center text-xs font-medium hover:bg-bg-deep/40">
                  {musicBusy
                    ? "Yükleniyor…"
                    : catalog.musicUrl
                      ? "Müziği değiştir"
                      : "Müzik yükle (MP3/M4A/OGG/WAV)"}
                </span>
                <input
                  ref={musicInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav"
                  disabled={musicBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadMusic(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">QR kod</h3>
                <button
                  type="button"
                  className="text-sm text-accent"
                  onClick={() => setQrNonce((n) => n + 1)}
                >
                  Yenile
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/catalogs/${catalog.id}/qr?v=${qrNonce}`}
                alt="Katalog QR"
                className="mx-auto h-40 w-40 rounded border border-line bg-white p-2"
              />
              <p className="mt-2 text-center text-xs text-muted">
                Bu QR birbaşa sayfa çevirme kataloğuna açılır
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <a
                  href={`/api/admin/catalogs/${catalog.id}/qr`}
                  className="rounded border border-line px-2.5 py-1 text-xs hover:bg-bg-deep/40"
                >
                  PNG indir
                </a>
                <Link
                  href={entryUrl}
                  target="_blank"
                  className="rounded border border-line px-2.5 py-1 text-xs hover:bg-bg-deep/40"
                >
                  Kataloğu aç
                </Link>
                <CopyLinkButton url={absoluteEntryUrl || entryUrl} />
              </div>
            </div>
            {catalog.pageCount === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-card/60 p-3 text-center text-xs text-muted">
                Yayınlamadan önce &quot;Sayfalar&quot; sekmesinden en az 1 görsel
                ekleyin.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "pages" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
                  Sayfalar
                </h2>
                <p className="text-sm text-muted">
                  Her görsel bir dergi sayfası olur. Sırasını yukarı/aşağı ile
                  değiştirebilirsiniz.
                </p>
              </div>
              <label className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white">
                {uploading ? uploadProgress || "Yükleniyor…" : "Görsel(ler) ekle"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  disabled={uploading}
                  onChange={(e) => void onFilesSelected(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>
            {error ? (
              <p className="mt-3 text-sm text-danger">{error}</p>
            ) : null}
          </div>

          {catalog.pages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-card/60 p-10 text-center">
              <p className="text-muted">Henüz sayfa yok.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.pages.map((p, idx) => (
                <CatalogPageCard
                  key={p.id}
                  page={p}
                  index={idx}
                  total={catalog.pages.length}
                  busy={busy}
                  onMoveUp={() => void movePage(p.id, -1)}
                  onMoveDown={() => void movePage(p.id, 1)}
                  onDelete={() => void deletePage(p.id)}
                  onLinkChange={(url) => void updatePageLink(p.id, url)}
                  onReplaceImage={(file) => void replacePageImage(p.id, file)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CatalogPageCard({
  page,
  index,
  total,
  busy,
  onMoveUp,
  onMoveDown,
  onDelete,
  onLinkChange,
  onReplaceImage,
}: {
  page: CatalogPageDto;
  index: number;
  total: number;
  busy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onLinkChange: (url: string) => void;
  onReplaceImage: (file: File) => void;
}) {
  const [linkUrl, setLinkUrl] = useState(page.linkUrl || "");
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative aspect-[3/4] bg-bg-deep/30">
        {page.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.imageUrl}
            alt={`Sayfa ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : null}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {index + 1} / {total}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onBlur={() => onLinkChange(linkUrl)}
          placeholder="Link (opsiyonel) — örn. WhatsApp/site"
          className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            disabled={busy || index === 0}
            onClick={onMoveUp}
            className="rounded border border-line px-2 py-1 hover:bg-bg-deep/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↑ Yukarı
          </button>
          <button
            type="button"
            disabled={busy || index === total - 1}
            onClick={onMoveDown}
            className="rounded border border-line px-2 py-1 hover:bg-bg-deep/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↓ Aşağı
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => replaceInputRef.current?.click()}
            className="rounded border border-line px-2 py-1 hover:bg-bg-deep/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Görseli değiştir
          </button>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onReplaceImage(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="rounded border border-danger/40 px-2 py-1 text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
