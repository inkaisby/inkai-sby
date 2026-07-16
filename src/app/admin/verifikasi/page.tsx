import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchPendingVerificationClaims } from "@/lib/inkai-api/admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationActions } from "./VerificationActions";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  RANK_UPGRADE: "Kenaikan Sabuk",
  RANK_PROMOTION: "Kenaikan Sabuk",
  TRANSFER: "Pindah Dojo",
  DOJO_TRANSFER: "Pindah Dojo",
  DOCUMENT: "Dokumen",
  ACHIEVEMENT: "Prestasi",
  MONTHLY_IURAN: "Iuran Bulanan",
  PASSWORD_RESET: "Reset Password",
};

export default function AdminVerifikasiPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <AdminVerifikasiContent />
    </Suspense>
  );
}

async function AdminVerifikasiContent() {
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
          {claims.length} pengajuan menunggu persetujuan (termasuk reset
          password anggota)
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
            const claimType = String(c.type);
            let resetEmail: string | null = null;
            if (claimType === "PASSWORD_RESET" && c.data != null) {
              try {
                const parsed = JSON.parse(String(c.data)) as { email?: string };
                resetEmail = parsed.email ?? null;
              } catch {
                resetEmail = null;
              }
            }
            return (
            <Card key={String(c.id)}>
              <CardContent className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{String(member?.fullName ?? "—")}</p>
                    <p className="text-sm text-muted-foreground">
                      {String(member?.nia ?? "—")} · {dojo?.name ?? "—"}
                    </p>
                    {resetEmail ? (
                      <p className="text-sm font-medium text-inkai-red">
                        Email login: {resetEmail}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      claimType === "PASSWORD_RESET"
                        ? "bg-inkai-red/10 text-inkai-red"
                        : undefined
                    }
                  >
                    {TYPE_LABELS[claimType] || claimType}
                  </Badge>
                </div>
                {claimType !== "PASSWORD_RESET" &&
                  c.data != null &&
                  c.data !== "" && (
                  <p className="mb-2 text-sm">{String(c.data)}</p>
                )}
                {event != null && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Event: {event.title}
                  </p>
                )}
                {c.proofUrl != null && c.proofUrl !== "" && c.proofUrl !== "—" && (
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
                <VerificationActions
                  verificationId={String(c.id)}
                  type={claimType}
                />
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
