import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="text-lg"
              style={{ fontFamily: "var(--display)" }}
            >
              Reklam Panosu
            </Link>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link
                href="/admin"
                className="rounded-md border border-line bg-white px-3 py-1.5 font-medium text-ink shadow-sm hover:bg-bg-deep/40"
              >
                Kampanyalar
              </Link>
              <Link
                href="/admin/new"
                className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
              >
                Yeni kampanya
              </Link>
              <Link
                href="/admin/geri-bildirim"
                className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
              >
                Geri bildirim
              </Link>
              <Link
                href="/admin/katalog"
                className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
              >
                Katalog
              </Link>
              <Link
                href="/admin/hesap"
                className="rounded-md border border-line px-3 py-1.5 text-muted hover:bg-white hover:text-ink"
              >
                Şifre
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">
              {session?.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 hover:bg-white"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
