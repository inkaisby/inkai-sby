import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchMyBillings } from "@/lib/inkai-api/member-data";

export const dynamic = "force-dynamic";

export default async function IuranPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  if (!session.accessToken) redirect("/login");

  const billings = await fetchMyBillings(session.accessToken, 50);

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Iuran & Tagihan</h2>
      {billings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada tagihan iuran.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {billings.map((b) => {
            const payment = b.payment as { proofUrl?: string } | null | undefined;
            return (
            <Card key={String(b.id)}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{String(b.type)}</p>
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
                  >
                    {String(b.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
