"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER" | "CLIENT";
  active: boolean;
  createdAt: string;
  _count: { campaigns: number; catalogs: number; feedbackBoxes: number };
};

export default function UsersManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CLIENT" | "SUPER">("CLIENT");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Liste yüklenemedi");
      return;
    }
    setUsers(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          password,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Oluşturulamadı");
      setEmail("");
      setName("");
      setPassword("");
      setRole("CLIENT");
      setMessage(`Kullanıcı oluşturuldu: ${data.email}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(id: string, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: string, label: string) {
    const next = window.prompt(`${label} için yeni şifre (min 6 karakter):`);
    if (!next || next.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre güncellenemedi");
      setMessage("Şifre güncellendi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: string, label: string) {
    if (
      !window.confirm(
        `«${label}» silinsin mi? Kayıtları size (süper admin) taşınır.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Silinemedi");
      await load();
      setMessage("Kullanıcı silindi; kayıtlar size taşındı");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-line bg-card p-5"
      >
        <h2 className="text-lg" style={{ fontFamily: "var(--display)" }}>
          Yeni müşteri / kullanıcı
        </h2>
        <p className="text-xs text-muted">
          CLIENT yalnızca kendi kampanya, katalog ve geri bildirimlerini görür.
          SUPER her şeyi yönetir.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Kullanıcı adı / e-posta
            <input
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
              placeholder="ornek.musteri"
            />
          </label>
          <label className="block text-sm">
            Görünen ad
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
              placeholder="Market A"
            />
          </label>
          <label className="block text-sm">
            Şifre
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Rol
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "CLIENT" | "SUPER")
              }
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
            >
              <option value="CLIENT">Müşteri (CLIENT)</option>
              <option value="SUPER">Süper admin (SUPER)</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Oluştur
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-bg-deep/50 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Kullanıcı</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Kayıtlar
              </th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name || u.email}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role === "SUPER"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-sky-100 text-sky-900"
                    }`}
                  >
                    {u.role === "SUPER" ? "Süper" : "Müşteri"}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-xs text-muted md:table-cell">
                  {u._count.campaigns} kamp. · {u._count.catalogs} kat. ·{" "}
                  {u._count.feedbackBoxes} kutu
                </td>
                <td className="px-4 py-3">
                  {u.active ? (
                    <span className="text-xs font-semibold text-emerald-700">
                      Aktif
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-red-700">
                      Pasif
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setActive(u.id, !u.active)}
                      className="rounded border border-line px-2 py-1 text-xs hover:bg-white"
                    >
                      {u.active ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void resetPassword(u.id, u.name || u.email)
                      }
                      className="rounded border border-line px-2 py-1 text-xs hover:bg-white"
                    >
                      Şifre
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void removeUser(u.id, u.name || u.email)
                      }
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
