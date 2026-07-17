import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { getMemberVerification } from "@/lib/public-data";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function statusMeta(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") {
    return {
      label: "Anggota Aktif",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      icon: CheckCircle2,
    };
  }
  if (normalized === "pending") {
    return {
      label: "Menunggu Verifikasi",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      icon: AlertCircle,
    };
  }
  return {
    label: status || "Tidak Aktif",
    className: "bg-muted text-muted-foreground",
    icon: AlertCircle,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const member = await getMemberVerification(id);
  return {
    title: member
      ? `Verifikasi ${formatMemberName(member.fullName)}`
      : "Verifikasi Anggota",
    robots: { index: false, follow: false },
  };
}

export default async function MemberVerifyPage({ params }: Props) {
  const { id } = await params;
  const member = await getMemberVerification(id);

  if (!member) notFound();

  const displayName = formatMemberName(member.fullName);
  const belt = formatRankLabel(member.currentRank) || "Belum tercatat";
  const nia = member.nia?.trim() || "Belum ada NIA";
  const status = statusMeta(member.status);
  const StatusIcon = status.icon;
  const joinedLabel = member.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="mb-6 text-center">
        <Badge className="mb-3 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
          Verifikasi Kartu Anggota
        </Badge>
        <h1 className="text-2xl font-bold">INKAI Surabaya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hasil pemindaian QR kartu anggota resmi
        </p>
      </div>

      <Card className="overflow-hidden border-border shadow-lg">
        <CardContent className="relative p-0">
          <Shield
            className="pointer-events-none absolute -right-6 -bottom-6 text-foreground/[0.03]"
            size={180}
          />

          <div className="relative z-[1] space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-inkai.png"
                  alt="Logo INKAI"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg object-contain"
                />
                <span className="text-xs font-extrabold tracking-[1.5px] text-muted-foreground">
                  KARTU ANGGOTA
                </span>
              </div>
              <Badge className={status.className}>
                <StatusIcon className="mr-1 h-3.5 w-3.5" />
                {status.label}
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photoUrl}
                    alt={displayName}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    Foto
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-foreground">
                  {displayName}
                </h2>
                <p className="text-base font-bold tracking-wide text-inkai-red">
                  {nia}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground/80">
                  {belt}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl bg-secondary/40 p-4 text-sm">
              <p>
                <span className="font-medium text-muted-foreground">Dojo:</span>{" "}
                {member.dojoName}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Cabang:</span>{" "}
                {member.branchName}
              </p>
              {joinedLabel && (
                <p>
                  <span className="font-medium text-muted-foreground">
                    Terdaftar:
                  </span>{" "}
                  {joinedLabel}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Data diverifikasi melalui sistem resmi INKAI Cabang Surabaya. Jika
        informasi tidak sesuai, hubungi sekretariat cabang.
      </p>
    </div>
  );
}
