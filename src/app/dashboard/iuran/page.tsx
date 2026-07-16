import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { fetchMyBillings } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";

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
      {billings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Tidak ada tagihan iuran.
        </div>
      ) : (
        <div className="space-y-3">
          {billings.map((b) => (
            <div
              key={String(b.id)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{String(b.type)}</p>
                <p className="text-sm text-muted-foreground">
                  {String(b.description || "Iuran anggota")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Jatuh tempo:{" "}
                  {new Date(String(b.dueDate)).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">
                  Rp {Number(b.amount).toLocaleString("id-ID")}
                </p>
                <Badge
                  variant={b.status === "PAID" ? "default" : "secondary"}
                  className={
                    b.status === "PAID"
                      ? "mt-1 bg-emerald-600 hover:bg-emerald-600"
                      : "mt-1"
                  }
                >
                  {String(b.status)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
