import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildBillingFilter, canAccessAdmin } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BillingActions } from "./BillingActions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function AdminIuranPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const params = await searchParams;
  const status = params.status?.trim() || "";
  const q = params.q?.trim() || "";

  const billings = await prisma.billing.findMany({
    where: {
      ...buildBillingFilter(session.user),
      ...(status ? { status } : {}),
      ...(q
        ? {
            member: {
              ...buildBillingFilter(session.user).member,
              OR: [
                { fullName: { contains: q, mode: "insensitive" as const } },
                { nia: { contains: q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    include: {
      member: { include: { dojo: true } },
      payment: true,
    },
    orderBy: { dueDate: "desc" },
    take: 100,
  });

  const stats = billings.reduce(
    (acc, b) => {
      if (b.status === "PAID") acc.paid += b.amount;
      else if (b.status === "WAITING_VERIFICATION") acc.waiting += 1;
      else if (b.status === "PENDING") acc.pending += 1;
      return acc;
    },
    { paid: 0, waiting: 0, pending: 0 }
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Iuran & Tagihan Anggota</h2>
        <p className="text-muted-foreground">
          Total lunas: Rp {stats.paid.toLocaleString("id-ID")} · Menunggu
          verifikasi: {stats.waiting} · Pending: {stats.pending}
        </p>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={q}
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border px-2 text-sm"
        >
          <option value="">Semua status</option>
          <option value="PENDING">PENDING</option>
          <option value="WAITING_VERIFICATION">WAITING_VERIFICATION</option>
          <option value="PAID">PAID</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-inkai-red px-4 py-1.5 text-sm text-white"
        >
          Filter
        </button>
      </form>

      {billings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada data iuran.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {billings.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{b.member.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.member.nia || "—"} · {b.member.dojo.name} · {b.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Jatuh tempo:{" "}
                    {new Date(b.dueDate).toLocaleDateString("id-ID")}
                  </p>
                  {b.payment?.proofUrl && (
                    <a
                      href={b.payment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-inkai-red hover:underline"
                    >
                      Lihat bukti transfer
                    </a>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-bold">
                    Rp {b.amount.toLocaleString("id-ID")}
                  </p>
                  <Badge
                    variant={b.status === "PAID" ? "default" : "secondary"}
                  >
                    {b.status}
                  </Badge>
                  {b.status === "WAITING_VERIFICATION" && (
                    <BillingActions billingId={b.id} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
