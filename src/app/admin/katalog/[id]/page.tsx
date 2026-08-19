import { notFound } from "next/navigation";
import { getCatalogForAdmin } from "@/lib/catalog";
import CatalogEditor from "@/components/admin/CatalogEditor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CatalogDetailPage({ params }: Props) {
  const { id } = await params;
  const catalog = await getCatalogForAdmin(id);
  if (!catalog) notFound();

  return <CatalogEditor initial={catalog} />;
}
