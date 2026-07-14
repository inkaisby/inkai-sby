import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";

export const dynamic = "force-dynamic";

export default async function DokumenPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  if (!session.accessToken) redirect("/login");

  const member = await fetchMyMemberProfile(session.accessToken);
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
      <h2 className="mb-2 text-2xl font-bold">Dokumen Keanggotaan</h2>
      <p className="mb-6 text-muted-foreground">
        Dokumen {String(member.fullName)} — data dari API backend
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {docs.map((doc) => (
          <Card key={doc.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {doc.label}
                {doc.required && (
                  <Badge variant="outline" className="text-xs">
                    Wajib
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {doc.url ? (
                <a
                  href={String(doc.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-inkai-red hover:underline"
                >
                  Lihat dokumen <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Belum diunggah</p>
              )}
              {doc.extra && (
                <p className="mt-2 text-xs text-muted-foreground">{doc.extra}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
