import Link from "next/link";

type Props = {
  href?: string;
  label?: string;
};

/** Alt sayfalardan Kampanyalar listesine net dönüş */
export default function AdminBackLink({
  href = "/admin",
  label = "← Kampanyalar",
}: Props) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm hover:bg-bg-deep/40"
    >
      {label}
    </Link>
  );
}
