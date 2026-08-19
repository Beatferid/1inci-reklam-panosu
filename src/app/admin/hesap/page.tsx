import AdminBackLink from "@/components/admin/AdminBackLink";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";

export default function AdminAccountPage() {
  return (
    <div>
      <div className="mb-4">
        <AdminBackLink />
      </div>
      <h1 className="mb-2 text-3xl" style={{ fontFamily: "var(--display)" }}>
        Hesap
      </h1>
      <p className="mb-6 text-sm text-muted">
        Yönetici şifresini buradan değiştirebilirsiniz.
      </p>
      <ChangePasswordForm />
    </div>
  );
}
