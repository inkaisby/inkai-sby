import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { fetchMyBillings } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { IuranListClient } from "@/components/member/IuranListClient";
import { prisma } from "@/lib/prisma";
import { isMonthlyDuesBilling } from "@/lib/iuran-ledger";

export const dynamic = "force-dynamic";

export default async function IuranPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const memberId = session.user.memberId;
  const [inkaiBillings, localBillings] = await Promise.all([
    fetchMyBillings(token, 50),
    prisma.billing.findMany({
      where: { memberId, isDeleted: false },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        description: true,
        dueDate: true,
        amount: true,
        status: true,
        payment: {
          select: {
            proofUrl: true,
            paidAt: true,
            paymentMethod: true,
          },
        },
      },
    }),
  ]);

  const localById = new Map(localBillings.map((b) => [b.id, b]));
  const inkaiIds = new Set(
    inkaiBillings.map((b) => String((b as { id?: string }).id ?? "")),
  );

  type Row = {
    id: string;
    type?: string;
    description?: string | null;
    dueDate?: string;
    amount?: number;
    status?: string;
    payment?: {
      proofUrl?: string | null;
      paidAt?: string | null;
      paymentMethod?: string | null;
    } | null;
  };

  const merged: Row[] = inkaiBillings.map((b) => {
    const id = String(b.id);
    const local = localById.get(id);
    return {
      id,
      type: b.type != null ? String(b.type) : local?.type,
      description:
        b.description != null ? String(b.description) : local?.description ?? null,
      dueDate:
        b.dueDate != null
          ? String(b.dueDate)
          : local?.dueDate.toISOString(),
      amount: Number(b.amount ?? local?.amount ?? 0),
      // Prisma menang untuk status/payment setelah laporan setor lokal
      status: local?.status ?? (b.status != null ? String(b.status) : undefined),
      payment: local?.payment
        ? {
            proofUrl: local.payment.proofUrl,
            paidAt: local.payment.paidAt?.toISOString() ?? null,
            paymentMethod: local.payment.paymentMethod,
          }
        : ((b.payment as Row["payment"]) ?? null),
    };
  });

  for (const local of localBillings) {
    if (inkaiIds.has(local.id)) continue;
    if (!isMonthlyDuesBilling(local.type, local.description)) continue;
    merged.push({
      id: local.id,
      type: local.type,
      description: local.description,
      dueDate: local.dueDate.toISOString(),
      amount: local.amount,
      status: local.status,
      payment: local.payment
        ? {
            proofUrl: local.payment.proofUrl,
            paidAt: local.payment.paidAt?.toISOString() ?? null,
            paymentMethod: local.payment.paymentMethod,
          }
        : null,
    });
  }

  return (
    <>
      <MemberPageHeader title="Iuran & Tagihan" />
      <p className="mb-4 text-sm text-muted-foreground">
        Setor iuran secara manual ke pengurus ranting, lalu laporkan tanggal
        bayar di sini. Bukti fisik diserahkan ke ranting — tidak perlu unggah.
        Pengurus akan mengonfirmasi.
      </p>
      <IuranListClient billings={merged} />
    </>
  );
}
