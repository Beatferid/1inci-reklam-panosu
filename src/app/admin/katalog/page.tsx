import Link from "next/link";
import { listCatalogs } from "@/lib/catalog";
import { catalogEntryUrl } from "@/lib/qr";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import DeleteRecordButton from "@/components/admin/DeleteRecordButton";

export const dynamic = "force-dynamic";

export default async function CatalogListPage() {
  const catalogs = await listCatalogs();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: "var(--display)" }}>
            Dijital Katalog
          </h1>
          <p className="mt-1 text-sm text-muted">
            QR okutulunca sayfa çevirerek gezilen dergi/broşür. Kampanyalardan
            bağımsız çalışır.
          </p>
        </div>
        <Link
          href="/admin/katalog/new"
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white"
        >
          Yeni katalog
        </Link>
      </div>

      {catalogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/60 p-10 text-center">
          <p className="text-muted">Henüz katalog yok.</p>
          <Link
            href="/admin/katalog/new"
            className="mt-4 inline-block text-sm font-medium text-accent"
          >
            İlk kataloğu oluştur
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-bg-deep/50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ad</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Sayfa</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Görüntülenme
                </th>
                <th className="px-4 py-3 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((c) => (
                <tr key={c.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs ${
                        c.status === "PUBLISHED"
                          ? "bg-accent-soft text-accent"
                          : "bg-bg-deep text-muted"
                      }`}
                    >
                      {c.status === "PUBLISHED" ? "Yayında" : "Taslak"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{c.pageCount}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{c.viewCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/katalog/${c.id}`}
                        className="rounded border border-line px-2.5 py-1 hover:bg-white"
                      >
                        Düzenle
                      </Link>
                      {c.status === "PUBLISHED" ? (
                        <>
                          <a
                            href={catalogEntryUrl(c.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-line px-2.5 py-1 hover:bg-white"
                          >
                            Önizle
                          </a>
                          <CopyLinkButton url={catalogEntryUrl(c.slug)} />
                        </>
                      ) : null}
                      <DeleteRecordButton
                        endpoint={`/api/admin/catalogs/${c.id}`}
                        confirmMessage={`«${c.name}» kataloğu ve tüm sayfaları silinsin mi? Bu işlem geri alınamaz.`}
                        compact
                      />
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
