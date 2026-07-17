import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { AdminPesanClient } from "./AdminPesanClient";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

export default function AdminPesanPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Pesan Anggota</h2>
      <p className="mb-6 text-muted-foreground">
        Balas pesan dari anggota dashboard.
      </p>
      <AdminPesanClient />
    </>
  );
}
