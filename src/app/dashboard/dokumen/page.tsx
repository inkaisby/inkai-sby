import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Pencil } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { ImpersonationDataNotice } from "@/components/member/ImpersonationDataNotice";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DokumenPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const impersonating = Boolean(session.impersonatorId);
  const member = await fetchMyMemberProfile(token);
  if (!member?.id) {
    if (impersonating) {
      return (
        <>
          <MemberPageHeader title="Dokumen" />
          <ImpersonationDataNotice />
        </>
      );
    }
    redirect("/dashboard");
  }

  // Fetch official letters delivered to member portal
  const memberData = await prisma.member.findUnique({
    where: { id: session.user.memberId },
    select: { dojoId: true },
  });

  const deliveredSurat = await prisma.suratEntry.findMany({
    where: {
      deliveredToMembers: true,
      OR: [
        { scopeType: "BRANCH" },
        { scopeType: "PROVINCE" },
        { scopeType: "DOJO", scopeId: memberData?.dojoId || "none" },
      ],
    },
    orderBy: { tanggalSurat: "desc" },
    take: 10,
  });

  const docs = [
    {
      label: "Akte Kelahiran",
      url: member.birthCertificateUrl as string | null,
      required: true,
    },
    {
      label: "Kartu BPJS",
      url: member.bpjsCardUrl as string | null,
      required: true,
      extra: member.bpjsCardNumber
        ? `No. BPJS: ${String(member.bpjsCardNumber)}`
        : undefined,
    },
  ];

  return (
    <>
      <MemberPageHeader title="Dokumen" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Dokumen & Surat Resmi {String(member.fullName)}
        </p>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/dashboard/profil">
            <Pencil className="h-3.5 w-3.5" />
            Edit di Profil
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        {/* Pribadi Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Dokumen Pribadi</h3>
          {docs.map((doc) => (
            <div
              key={doc.label}
              className="rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-inkai-red" />
                <p className="font-semibold">{doc.label}</p>
                {doc.required && (
                  <Badge variant="outline" className="text-[10px]">
                    Wajib
                  </Badge>
                )}
              </div>
              {doc.url ? (
                <a
                  href={String(doc.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-inkai-red"
                >
                  Lihat dokumen <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum diunggah —{" "}
                  <Link href="/dashboard/profil" className="text-inkai-red hover:underline">
                    lengkapi di Profil
                  </Link>
                </p>
              )}
              {doc.extra && (
                <p className="mt-2 text-xs text-muted-foreground">{doc.extra}</p>
              )}
            </div>
          ))}
        </div>

        {/* Official Letters Delivered to Member Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Surat Resmi & Undangan Kegiatan Terbit</h3>
          {deliveredSurat.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
              Belum ada surat resmi/undangan kegiatan diterbitkan untuk Anda.
            </div>
          ) : (
            deliveredSurat.map((surat: any) => (
              <div
                key={surat.id}
                className="rounded-2xl border border-border/60 bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {surat.nomorSurat}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(surat.tanggalSurat).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <h4 className="font-semibold text-sm">{surat.perihal}</h4>
                <p className="text-xs text-muted-foreground">
                  Kategori: {surat.kategori} &bull; Tujuan: {surat.tujuan || "Seluruh Anggota"}
                </p>
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <a
                    href={`/v/surat/${surat.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-inkai-red hover:underline"
                  >
                    Buka & Verifikasi Surat <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
