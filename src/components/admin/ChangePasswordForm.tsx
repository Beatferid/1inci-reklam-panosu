"use client";

import { FormEvent, useState } from "react";

export default function ChangePasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirm = String(form.get("confirmPassword") || "");
    if (newPassword !== confirm) {
      setBusy(false);
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (newPassword.length < 4) {
      setBusy(false);
      setError("Yeni şifre en az 4 karakter olmalı.");
      return;
    }
    if (currentPassword === newPassword) {
      setBusy(false);
      setError("Yeni şifre mevcut şifreyle aynı olamaz.");
      return;
    }
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Şifre değiştirilemedi.");
      return;
    }
    setOk(true);
    e.currentTarget.reset();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md space-y-3 rounded-xl border border-line bg-card p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Şifre değiştir</h2>
        <p className="mt-0.5 text-xs text-muted">
          Yeni şifre en az 4 karakter olmalı.
        </p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Mevcut şifre</span>
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Yeni şifre</span>
        <input
          name="newPassword"
          type="password"
          required
          minLength={4}
          autoComplete="new-password"
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Yeni şifre (tekrar)</span>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={4}
          autoComplete="new-password"
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {ok ? (
        <p className="text-sm text-accent">Şifre güncellendi.</p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Kaydediliyor…" : "Şifreyi kaydet"}
      </button>
    </form>
  );
}
