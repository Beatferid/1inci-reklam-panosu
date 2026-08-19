"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), "/admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Kullanıcı veya şifre hatalı.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1
        className="mb-2 text-3xl text-ink"
        style={{ fontFamily: "var(--display)" }}
      >
        Yönetici girişi
      </h1>
      <p className="mb-8 text-sm text-muted">
        Kampanyaları yönetmek için oturum açın.
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-line bg-card p-6 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Kullanıcı</span>
          <input
            name="email"
            type="text"
            required
            autoComplete="username"
            className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Şifre</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
