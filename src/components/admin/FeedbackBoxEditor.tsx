"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminBackLink from "@/components/admin/AdminBackLink";
import DeleteRecordButton from "@/components/admin/DeleteRecordButton";
import LocationEditor from "@/components/admin/LocationEditor";
import FeedbackEntriesTable from "@/components/admin/FeedbackEntriesTable";
import FeedbackDevicesTable from "@/components/admin/FeedbackDevicesTable";
import FeedbackAnalyticsPanel from "@/components/admin/FeedbackAnalyticsPanel";

export type FeedbackBoxDto = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  geoEnabled: boolean;
  dailyLimitPerDevice: number;
};

type Tab = "settings" | "locations" | "entries" | "devices" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "settings", label: "Ayarlar" },
  { id: "locations", label: "Şubeler" },
  { id: "entries", label: "Gönderimler" },
  { id: "devices", label: "Cihazlar" },
  { id: "analytics", label: "İstatistik" },
];

export default function FeedbackBoxEditor({ initial }: { initial: FeedbackBoxDto }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("settings");
  const [box, setBox] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [dailyLimit, setDailyLimit] = useState(initial.dailyLimitPerDevice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [qrNonce, setQrNonce] = useState(0);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/feedback-boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Kaydedilemedi");
        return false;
      }
      setBox((b) => ({ ...b, ...json }));
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
    await patch({ name, slug, dailyLimitPerDevice: dailyLimit });
  }

  async function togglePublish() {
    const next = box.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await patch({ status: next });
  }

  const entryUrl = `/geri-bildirim/${box.slug}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminBackLink
          href="/admin/geri-bildirim"
          label="← Geri bildirim kutuları"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void togglePublish()}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              box.status === "PUBLISHED"
                ? "border border-line bg-white text-ink hover:bg-bg-deep/40"
                : "bg-accent text-white"
            }`}
          >
            {box.status === "PUBLISHED" ? "Yayından kaldır" : "Yayınla"}
          </button>
          <DeleteRecordButton
            endpoint={`/api/admin/feedback-boxes/${box.id}`}
            confirmMessage={`«${box.name}» kutusu, gönderimler ve şubeler silinsin mi? Bu işlem geri alınamaz.`}
            redirectTo="/admin/geri-bildirim"
            className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
            onDeleted={() => router.refresh()}
          />
        </div>
      </div>

      <h1 className="mb-1 text-3xl" style={{ fontFamily: "var(--display)" }}>
        {box.name}
      </h1>
      <p className="mb-6 text-sm text-muted">
        /{box.slug} ·{" "}
        <span
          className={box.status === "PUBLISHED" ? "text-accent" : "text-muted"}
        >
          {box.status === "PUBLISHED" ? "Yayında" : "Taslak"}
        </span>
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
              <span className="mb-1 block text-muted">Kutu adı</span>
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
                Cihaz başına günlük gönderim limiti
              </span>
              <input
                type="number"
                min={1}
                max={50}
                value={dailyLimit}
                onChange={(e) =>
                  setDailyLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
                className="w-28 rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
              />
            </label>
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
            <div className="rounded-xl border border-line bg-card p-5">
              <LocationEditor
                baseUrl={`/api/admin/feedback-boxes/${box.id}/locations`}
                itemLabel="şube"
              />
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
                src={`/api/admin/feedback-boxes/${box.id}/qr?v=${qrNonce}`}
                alt="Geri bildirim QR"
                className="mx-auto h-40 w-40 rounded border border-line bg-white p-2"
              />
              <p className="mt-2 text-center text-xs text-muted">
                Bu QR birbaşa geri bildirim formuna açılır
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <a
                  href={`/api/admin/feedback-boxes/${box.id}/qr`}
                  className="rounded border border-line px-2.5 py-1 text-xs hover:bg-bg-deep/40"
                >
                  PNG indir
                </a>
                <Link
                  href={entryUrl}
                  target="_blank"
                  className="rounded border border-line px-2.5 py-1 text-xs hover:bg-bg-deep/40"
                >
                  Formu aç
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "locations" ? (
        <div className="max-w-xl rounded-xl border border-line bg-card p-5">
          <LocationEditor
            baseUrl={`/api/admin/feedback-boxes/${box.id}/locations`}
            itemLabel="şube"
          />
        </div>
      ) : null}

      {tab === "entries" ? <FeedbackEntriesTable feedbackBoxId={box.id} /> : null}

      {tab === "devices" ? <FeedbackDevicesTable feedbackBoxId={box.id} /> : null}

      {tab === "analytics" ? <FeedbackAnalyticsPanel feedbackBoxId={box.id} /> : null}
    </div>
  );
}
