import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm uppercase tracking-[0.2em] text-muted">
        QR Reklam
      </p>
      <h1
        className="mb-4 text-5xl leading-tight text-ink"
        style={{ fontFamily: "var(--display)" }}
      >
        Reklam Panosu
      </h1>
      <p className="mb-10 max-w-xl text-lg text-muted">
        Müşteri QR kodu okutur; reklam görseli veya şans çarkı açılır. Uygulama
        indirme yok.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin"
          className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          Yönetim paneli
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-line bg-card px-5 py-3 text-sm font-medium text-ink transition hover:bg-white"
        >
          Giriş yap
        </Link>
      </div>
    </main>
  );
}
