import AdminShell from "@/components/admin/AdminShell";
import { auth, signOut } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AdminShell email={session?.user?.email} signOutAction={signOutAction}>
      {children}
    </AdminShell>
  );
}
