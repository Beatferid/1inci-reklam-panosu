import { Suspense } from "react";
import LoginPage from "./page-client";

export default function LoginRoute() {
  return (
    <Suspense fallback={<main className="p-8 text-muted">Yükleniyor…</main>}>
      <LoginPage />
    </Suspense>
  );
}
