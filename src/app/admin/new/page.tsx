"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminBackLink from "@/components/admin/AdminBackLink";

export default function NewCampaignPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        slug: form.get("slug") || undefined,
        notes: form.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Oluşturulamadı");
      return;
    }
    router.push(`/admin/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4">
        <AdminBackLink />
      </div>
      <h1 className="mb-6 text-3xl" style={{ fontFamily: "var(--display)" }}>
        Yeni kampanya
      </h1>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-line bg-card p-6"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Kampanya adı</span>
          <input
            name="name"
            required
            placeholder="Süpermarket yaz kampanyası"
            className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Slug (opsiyonel)</span>
          <input
            name="slug"
            placeholder="yaz-kampanyasi"
            className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Notlar</span>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Oluşturuluyor…" : "Oluştur"}
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-bg-deep/40"
          >
            İptal / Geri
          </Link>
        </div>
      </form>
    </div>
  );
}
