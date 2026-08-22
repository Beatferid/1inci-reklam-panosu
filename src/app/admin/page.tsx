import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { campaignEntryUrl } from "@/lib/qr";
import BoardExportButton from "@/components/admin/BoardExportButton";
import DeleteRecordButton from "@/components/admin/DeleteRecordButton";
import { getAppUser, isSuper, ownerWhere } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    where: ownerWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { email: true, name: true } },
    },
  });
  const publishedReady = campaigns.filter((c) => c.status === "PUBLISHED");
  const showOwner = isSuper(user);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl" style={{ fontFamily: "var(--display)" }}>
            Kampanyalar
          </h1>
          <p className="mt-1 text-sm text-muted">
            {showOwner
              ? "Tüm müşteri kampanyaları. QR ile görsel veya şans çarkı."
              : "Size ait kampanyalar. QR ile görsel veya şans çarkı."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BoardExportButton disabled={publishedReady.length === 0} />
          <Link
            href="/admin/new"
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white"
          >
            Yeni kampanya
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/60 p-10 text-center">
          <p className="text-muted">Henüz kampanya yok.</p>
          <Link
            href="/admin/new"
            className="mt-4 inline-block text-sm font-medium text-accent"
          >
            İlk kampanyayı oluştur
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-bg-deep/50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ad</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                {showOwner ? (
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Sahip
                  </th>
                ) : null}
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Tarama
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Görsel
                </th>
                <th className="px-4 py-3 font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
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
                  {showOwner ? (
                    <td className="hidden px-4 py-3 text-xs text-muted lg:table-cell">
                      {c.owner?.name || c.owner?.email || "—"}
                    </td>
                  ) : null}
                  <td className="hidden px-4 py-3 md:table-cell">
                    {c.scanCount}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {c.mediaPath ? "Var" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/${c.id}`}
                        className="rounded border border-line px-2.5 py-1 hover:bg-white"
                      >
                        Düzenle
                      </Link>
                      {c.status === "PUBLISHED" ? (
                        <a
                          href={campaignEntryUrl(c.slug, {
                            wheelEnabled: Boolean(c.wheelEnabled),
                          })}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-line px-2.5 py-1 hover:bg-white"
                        >
                          Önizle
                        </a>
                      ) : null}
                      <DeleteRecordButton
                        endpoint={`/api/campaigns/${c.id}`}
                        confirmMessage={`«${c.name}» kampanyası silinsin mi? Bu işlem geri alınamaz.`}
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

      <section className="mt-10 rounded-xl border border-line bg-card p-6">
        <h2 className="mb-2 text-lg" style={{ fontFamily: "var(--display)" }}>
          Yayın kontrol listesi
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Görsel yükle (veya şans çarkını aç) → QR indir → yayınla</li>
          <li>
            Tek büyük pano için üstteki &quot;Pano şablonu indir&quot; (QR
            hücreleri)
          </li>
          <li>Telefonda HTTPS gerekir (Vercel veya tunnel.bat)</li>
        </ul>
      </section>
    </div>
  );
}
