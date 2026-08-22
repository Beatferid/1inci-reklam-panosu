import { redirect } from "next/navigation";
import UsersManager from "@/components/admin/UsersManager";
import { getAppUser, isSuper } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!isSuper(user)) redirect("/admin");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl" style={{ fontFamily: "var(--display)" }}>
          Kullanıcılar
        </h1>
        <p className="mt-1 text-sm text-muted">
          Müşteri hesapları oluşturun. Her müşteri yalnız kendi panosunu görür;
          siz her şeyi kontrol edersiniz.
        </p>
      </div>
      <UsersManager />
    </div>
  );
}
