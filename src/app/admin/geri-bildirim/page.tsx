import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { feedbackEntryUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function FeedbackBoxListPage() {
  const boxes = await prisma.feedbackBox.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { entries: true, locations: true, devices: true } } },
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: "var(--display)" }}>
            Öneri &amp; Şikayet Kutuları
          </h1>
          <p className="mt-1 text-sm text-muted">
            Her kutu: kendi QR&apos;ı, kendi şubeleri, kendi ayarları. Kampanyalardan
            bağımsız çalışır.
          </p>
        </div>
        <Link
          href="/admin/geri-bildirim/new"
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white"
        >
          Yeni kutu
        </Link>
      </div>

      {boxes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/60 p-10 text-center">
          <p className="text-muted">Henüz geri bildirim kutusu yok.</p>
          <Link
            href="/admin/geri-bildirim/new"
            className="mt-4 inline-block text-sm font-medium text-accent"
          >
            İlk kutuyu oluştur
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-bg-deep/50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ad</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Şube</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Gönderim</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Cihaz</th>
                <th className="px-4 py-3 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {boxes.map((b) => (
                <tr key={b.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted">/{b.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs ${
                        b.status === "PUBLISHED"
                          ? "bg-accent-soft text-accent"
                          : "bg-bg-deep text-muted"
                      }`}
                    >
                      {b.status === "PUBLISHED" ? "Yayında" : "Taslak"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {b._count.locations}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {b._count.entries}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {b._count.devices}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/geri-bildirim/${b.id}`}
                        className="rounded border border-line px-2.5 py-1 hover:bg-white"
                      >
                        Düzenle
                      </Link>
                      {b.status === "PUBLISHED" ? (
                        <a
                          href={feedbackEntryUrl(b.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-line px-2.5 py-1 hover:bg-white"
                        >
                          Önizle
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
