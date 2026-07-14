import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DokumenPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const member = await prisma.member.findFirst({
    where: { id: session.user.memberId, isDeleted: false },
    select: {
      fullName: true,
      nik: true,
      birthCertificateUrl: true,
      bpjsCardUrl: true,
      bpjsCardNumber: true,
    },
  });

  if (!member) redirect("/dashboard");

  const docs = [
    {
      label: "Akte Kelahiran",
      url: member.birthCertificateUrl,
      required: true,
    },
    {
      label: "Kartu BPJS",
      url: member.bpjsCardUrl,
      required: true,
      extra: member.bpjsCardNumber
        ? `No. BPJS: ${member.bpjsCardNumber}`
        : undefined,
    },
  ];

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Dokumen Keanggotaan</h2>
      <p className="mb-6 text-muted-foreground">
        Dokumen {member.fullName} — data dari Supabase
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {docs.map((doc) => (
          <Card key={doc.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                {doc.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {doc.url ? (
                <div className="space-y-2">
                  <Badge className="bg-green-600 text-white">Sudah diunggah</Badge>
                  {doc.extra && (
                    <p className="text-sm text-muted-foreground">{doc.extra}</p>
                  )}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-inkai-red hover:underline"
                  >
                    Lihat dokumen <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <Badge variant="secondary">Belum diunggah</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {member.nik && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">NIK</p>
            <p className="font-mono font-medium">{member.nik}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
