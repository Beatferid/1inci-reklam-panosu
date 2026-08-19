import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { deleteStorageFile, publicMediaUrl } from "@/lib/storage";
import type { CampaignStatus, CatalogTheme, CatalogFlipStyle } from "@prisma/client";

export type CatalogPageSummary = {
  id: string;
  imageUrl: string | null;
  linkUrl: string | null;
  order: number;
};

export type CatalogSummary = {
  id: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  coverTitle: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  musicUrl: string | null;
  musicVolume: number;
  theme: CatalogTheme;
  flipStyle: CatalogFlipStyle;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
};

export type CatalogWithPages = CatalogSummary & {
  pages: CatalogPageSummary[];
};

export type CatalogPublicMeta = {
  id: string;
  name: string;
  slug: string;
  coverTitle: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  musicUrl: string | null;
  musicVolume: number;
  theme: CatalogTheme;
  flipStyle: CatalogFlipStyle;
  pages: CatalogPageSummary[];
};

function mapPage(p: {
  id: string;
  imagePath: string;
  linkUrl: string | null;
  order: number;
}): CatalogPageSummary {
  return {
    id: p.id,
    imageUrl: publicMediaUrl(p.imagePath),
    linkUrl: p.linkUrl,
    order: p.order,
  };
}

export async function listCatalogs(): Promise<CatalogSummary[]> {
  const rows = await prisma.catalog.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { pages: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    coverTitle: c.coverTitle,
    coverUrl: publicMediaUrl(c.coverPath),
    logoUrl: publicMediaUrl(c.logoPath),
    musicUrl: publicMediaUrl(c.musicPath),
    musicVolume: c.musicVolume,
    theme: c.theme,
    flipStyle: c.flipStyle,
    viewCount: c.viewCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    pageCount: c._count.pages,
  }));
}

export async function createCatalog(input: {
  name: string;
  slug?: string;
}) {
  let slug = slugify(input.slug || input.name);
  if (!slug) slug = `katalog-${Date.now()}`;

  const existing = await prisma.catalog.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  return prisma.catalog.create({ data: { name: input.name, slug } });
}

export async function getCatalogForAdmin(
  id: string,
): Promise<CatalogWithPages | null> {
  const catalog = await prisma.catalog.findUnique({
    where: { id },
    include: { pages: { orderBy: { order: "asc" } } },
  });
  if (!catalog) return null;
  return {
    id: catalog.id,
    name: catalog.name,
    slug: catalog.slug,
    status: catalog.status,
    coverTitle: catalog.coverTitle,
    coverUrl: publicMediaUrl(catalog.coverPath),
    logoUrl: publicMediaUrl(catalog.logoPath),
    musicUrl: publicMediaUrl(catalog.musicPath),
    musicVolume: catalog.musicVolume,
    theme: catalog.theme,
    flipStyle: catalog.flipStyle,
    viewCount: catalog.viewCount,
    createdAt: catalog.createdAt.toISOString(),
    updatedAt: catalog.updatedAt.toISOString(),
    pageCount: catalog.pages.length,
    pages: catalog.pages.map(mapPage),
  };
}

export async function updateCatalog(
  id: string,
  input: {
    name?: string;
    slug?: string;
    status?: CampaignStatus;
    coverTitle?: string | null;
    theme?: CatalogTheme;
    flipStyle?: CatalogFlipStyle;
    musicVolume?: number;
  },
) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.coverTitle !== undefined) data.coverTitle = input.coverTitle;
  if (input.theme !== undefined) data.theme = input.theme;
  if (input.flipStyle !== undefined) data.flipStyle = input.flipStyle;
  if (input.musicVolume !== undefined) {
    data.musicVolume = Math.min(1, Math.max(0, input.musicVolume));
  }
  if (input.slug !== undefined) {
    let slug = slugify(input.slug);
    if (!slug) throw new Error("Geçersiz slug");
    const existing = await prisma.catalog.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      throw new Error("Bu slug zaten kullanımda");
    }
    data.slug = slug;
  }
  if (input.status !== undefined) {
    if (input.status === "PUBLISHED") {
      const pageCount = await prisma.catalogPage.count({
        where: { catalogId: id },
      });
      if (pageCount === 0) {
        throw new Error("Yayınlamak için en az 1 sayfa ekleyin");
      }
    }
    data.status = input.status;
  }
  return prisma.catalog.update({ where: { id }, data });
}

export async function deleteCatalog(id: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  const pages = await prisma.catalogPage.findMany({ where: { catalogId: id } });
  for (const p of pages) {
    await deleteStorageFile(p.imagePath);
  }
  if (catalog?.coverPath) await deleteStorageFile(catalog.coverPath);
  if (catalog?.logoPath) await deleteStorageFile(catalog.logoPath);
  if (catalog?.musicPath) await deleteStorageFile(catalog.musicPath);
  await prisma.catalog.delete({ where: { id } });
}

export async function setCatalogCover(id: string, coverPath: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) throw new Error("Katalog bulunamadı");
  if (catalog.coverPath) await deleteStorageFile(catalog.coverPath);
  return prisma.catalog.update({ where: { id }, data: { coverPath } });
}

export async function removeCatalogCover(id: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) throw new Error("Katalog bulunamadı");
  if (catalog.coverPath) await deleteStorageFile(catalog.coverPath);
  return prisma.catalog.update({ where: { id }, data: { coverPath: null } });
}

export async function setCatalogLogo(id: string, logoPath: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) throw new Error("Katalog bulunamadı");
  if (catalog.logoPath) await deleteStorageFile(catalog.logoPath);
  return prisma.catalog.update({ where: { id }, data: { logoPath } });
}

export async function removeCatalogLogo(id: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) throw new Error("Katalog bulunamadı");
  if (catalog.logoPath) await deleteStorageFile(catalog.logoPath);
  return prisma.catalog.update({ where: { id }, data: { logoPath: null } });
}

export async function setCatalogMusic(id: string, musicPath: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) throw new Error("Katalog bulunamadı");
  if (catalog.musicPath) await deleteStorageFile(catalog.musicPath);
  return prisma.catalog.update({ where: { id }, data: { musicPath } });
}

export async function removeCatalogMusic(id: string) {
  const catalog = await prisma.catalog.findUnique({ where: { id } });
  if (!catalog) throw new Error("Katalog bulunamadı");
  if (catalog.musicPath) await deleteStorageFile(catalog.musicPath);
  return prisma.catalog.update({ where: { id }, data: { musicPath: null } });
}

export async function addCatalogPage(
  catalogId: string,
  input: { imagePath: string; linkUrl?: string | null },
) {
  const last = await prisma.catalogPage.findFirst({
    where: { catalogId },
    orderBy: { order: "desc" },
  });
  const order = (last?.order ?? -1) + 1;
  return prisma.catalogPage.create({
    data: {
      catalogId,
      imagePath: input.imagePath,
      linkUrl: input.linkUrl?.trim() || null,
      order,
    },
  });
}

export async function updateCatalogPage(
  catalogId: string,
  pageId: string,
  input: { linkUrl?: string | null; imagePath?: string },
) {
  const page = await prisma.catalogPage.findFirst({
    where: { id: pageId, catalogId },
  });
  if (!page) throw new Error("Sayfa bulunamadı");
  const data: Record<string, unknown> = {};
  if (input.linkUrl !== undefined) data.linkUrl = input.linkUrl?.trim() || null;
  if (input.imagePath !== undefined) {
    await deleteStorageFile(page.imagePath);
    data.imagePath = input.imagePath;
  }
  return prisma.catalogPage.update({ where: { id: pageId }, data });
}

export async function deleteCatalogPage(catalogId: string, pageId: string) {
  const page = await prisma.catalogPage.findFirst({
    where: { id: pageId, catalogId },
  });
  if (!page) throw new Error("Sayfa bulunamadı");
  await deleteStorageFile(page.imagePath);
  await prisma.catalogPage.delete({ where: { id: pageId } });

  const remaining = await prisma.catalogPage.findMany({
    where: { catalogId },
    orderBy: { order: "asc" },
  });
  await prisma.$transaction(
    remaining.map((p, idx) =>
      prisma.catalogPage.update({ where: { id: p.id }, data: { order: idx } }),
    ),
  );
}

export async function reorderCatalogPages(
  catalogId: string,
  orderedIds: string[],
) {
  const pages = await prisma.catalogPage.findMany({ where: { catalogId } });
  const validIds = new Set(pages.map((p) => p.id));
  if (
    orderedIds.length !== pages.length ||
    !orderedIds.every((id) => validIds.has(id))
  ) {
    throw new Error("Geçersiz sıralama listesi");
  }
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.catalogPage.update({ where: { id }, data: { order: idx } }),
    ),
  );
}

export async function getCatalogPublicMeta(
  slug: string,
): Promise<
  { status: 200; data: CatalogPublicMeta } | { status: 404; error: string }
> {
  const catalog = await prisma.catalog.findUnique({
    where: { slug },
    include: { pages: { orderBy: { order: "asc" } } },
  });
  if (!catalog || catalog.status !== "PUBLISHED") {
    return { status: 404, error: "Kataloq tapılmadı" };
  }

  await prisma.catalog
    .update({ where: { id: catalog.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => null);

  return {
    status: 200,
    data: {
      id: catalog.id,
      name: catalog.name,
      slug: catalog.slug,
      coverTitle: catalog.coverTitle,
      coverUrl: publicMediaUrl(catalog.coverPath),
      logoUrl: publicMediaUrl(catalog.logoPath),
      musicUrl: publicMediaUrl(catalog.musicPath),
      musicVolume: catalog.musicVolume,
      theme: catalog.theme,
      flipStyle: catalog.flipStyle,
      pages: catalog.pages.map(mapPage),
    },
  };
}

/** OG / paylaşım meta — viewCount artırmadan */
export async function getCatalogOgMeta(slug: string): Promise<{
  name: string;
  coverTitle: string | null;
  imagePath: string | null;
} | null> {
  const catalog = await prisma.catalog.findUnique({
    where: { slug },
    include: {
      pages: { orderBy: { order: "asc" }, take: 1, select: { imagePath: true } },
    },
  });
  if (!catalog || catalog.status !== "PUBLISHED") return null;
  const imagePath =
    catalog.coverPath ||
    catalog.logoPath ||
    catalog.pages[0]?.imagePath ||
    null;
  return {
    name: catalog.name,
    coverTitle: catalog.coverTitle,
    imagePath,
  };
}
