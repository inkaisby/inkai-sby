import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchPendingVerificationClaims } from "@/lib/inkai-api/admin-data";
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
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const claims = await fetchPendingVerificationClaims(token);

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
          {claims.map((c) => {
            const member = c.member as Record<string, unknown> | undefined;
            const dojo = member?.dojo as { name?: string } | undefined;
            const event = c.event as { title?: string } | undefined;
            return (
            <Card key={String(c.id)}>
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{String(member?.fullName ?? "—")}</p>
                    <p className="text-sm text-muted-foreground">
                      {String(member?.nia ?? "—")} · {dojo?.name ?? "—"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {TYPE_LABELS[String(c.type)] || String(c.type)}
                  </Badge>
                </div>
                {c.data != null && c.data !== "" && (
                  <p className="mb-2 text-sm">{String(c.data)}</p>
                )}
                {event != null && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Event: {event.title}
                  </p>
                )}
                {c.proofUrl != null && c.proofUrl !== "" && (
                  <a
                    href={String(c.proofUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 inline-block text-xs text-inkai-red hover:underline"
                  >
                    Lihat bukti pendukung
                  </a>
                )}
                <p className="mb-3 text-xs text-muted-foreground">
                  Diajukan: {new Date(String(c.createdAt)).toLocaleString("id-ID")}
                </p>
                <VerificationActions verificationId={String(c.id)} />
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
