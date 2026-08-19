import { Suspense } from "react";
import type { Metadata } from "next";
import CatalogClient from "./CatalogClient";
import { getCatalogOgMeta } from "@/lib/catalog";
import { publicMediaUrl } from "@/lib/storage";
import { getPublicAppUrl } from "@/lib/tunnel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getCatalogOgMeta(slug);
  const base = getPublicAppUrl();
  if (!meta) {
    return {
      title: `Kataloq · ${slug}`,
      description: "Endirim kataloqumuzu səhifə çevirərək gəzin",
    };
  }

  const title = meta.coverTitle || meta.name;
  const description = `${meta.name} — endirim kataloqumuzu səhifə çevirərək gəzin`;
  const mediaPath = publicMediaUrl(meta.imagePath);
  const imageUrl = mediaPath ? `${base}${mediaPath}` : undefined;

  return {
    title: `Kataloq · ${title}`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${base}/katalog/${slug}`,
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: title }]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function CatalogPage({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f2e7] text-sm text-[#8a5a1f]/70">
          Kataloq hazırlanır…
        </div>
      }
    >
      <CatalogClient slug={slug} />
    </Suspense>
  );
}
