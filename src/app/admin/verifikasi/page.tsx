import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildVerificationFilter, canAccessAdmin } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationActions } from "./VerificationActions";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  RANK_UPGRADE: "Kenaikan Sabuk",
  TRANSFER: "Pindah Dojo",
  DOCUMENT: "Dokumen",
  ACHIEVEMENT: "Prestasi",
  MONTHLY_IURAN: "Iuran Bulanan",
};

export default async function AdminVerifikasiPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const claims = await prisma.verification.findMany({
    where: { ...buildVerificationFilter(session.user), status: "PENDING" },
    include: {
      member: { include: { dojo: true } },
      event: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Antrean Verifikasi</h2>
        <p className="text-muted-foreground">
          {claims.length} pengajuan menunggu persetujuan
        </p>
      </div>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada pengajuan verifikasi pending.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.member.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.member.nia || "—"} · {c.member.dojo.name}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {TYPE_LABELS[c.type] || c.type}
                  </Badge>
                </div>
                {c.data && (
                  <p className="mb-2 text-sm">{c.data}</p>
                )}
                {c.event && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Event: {c.event.title}
                  </p>
                )}
                {c.proofUrl && (
                  <a
                    href={c.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 inline-block text-xs text-inkai-red hover:underline"
                  >
                    Lihat bukti pendukung
                  </a>
                )}
                <p className="mb-3 text-xs text-muted-foreground">
                  Diajukan: {new Date(c.createdAt).toLocaleString("id-ID")}
                </p>
                <VerificationActions verificationId={c.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
