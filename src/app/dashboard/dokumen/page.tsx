import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Pencil } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DokumenPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const member = await fetchMyMemberProfile(token);
  if (!member?.id) redirect("/dashboard");

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
          Dokumen {String(member.fullName)}
        </p>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/dashboard/profil">
            <Pencil className="h-3.5 w-3.5" />
            Edit di Profil
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
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
    </>
  );
}
