import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { fetchMyBillings } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { IuranListClient } from "@/components/member/IuranListClient";

export const dynamic = "force-dynamic";

export default async function IuranPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const billings = await fetchMyBillings(token, 50);

  return (
    <>
      <MemberPageHeader title="Iuran & Tagihan" />
      <p className="mb-4 text-sm text-muted-foreground">
        Unggah bukti transfer untuk tagihan yang belum lunas. Pengurus ranting
        akan memverifikasi.
      </p>
      <IuranListClient
        billings={billings.map((b) => ({
          id: String(b.id),
          type: b.type != null ? String(b.type) : undefined,
          description:
            b.description != null ? String(b.description) : null,
          dueDate: b.dueDate != null ? String(b.dueDate) : undefined,
          amount: Number(b.amount ?? 0),
          status: b.status != null ? String(b.status) : undefined,
          payment: (b.payment as { proofUrl?: string | null } | null) ?? null,
        }))}
      />
    </>
  );
}
