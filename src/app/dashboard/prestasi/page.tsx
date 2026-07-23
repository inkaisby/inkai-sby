import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { MemberUktStatus } from "@/components/member/MemberUktStatus";
import { PiagamUploadClient } from "@/components/member/PiagamUploadClient";
import {
  resolveUktDisplayStatus,
  uktDisplayStatusLabel,
} from "@/lib/ukt";
import { formatRankLabel } from "@/lib/belt";
import { cn } from "@/lib/utils";
import { prisma, withPrismaFallback } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TABS = ["Sabuk", "Piagam", "Pelatihan"] as const;
type Tab = (typeof TABS)[number];

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function PrestasiPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const params = await searchParams;
  const tabParam = params.tab;
  const activeTab: Tab = TABS.includes(tabParam as Tab)
    ? (tabParam as Tab)
    : "Sabuk";

  const [member, piagamClaims] = await Promise.all([
    fetchMyMemberProfile(token),
    withPrismaFallback(
      "member-piagam",
      () =>
        prisma.verification.findMany({
          where: {
            memberId: session.user.memberId!,
            type: "ACHIEVEMENT",
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      [],
    ),
  ]);
  if (!member?.id) redirect("/dashboard");

  const ranks = (member.ranks as Array<Record<string, unknown>>) ?? [];
  const eventRegistrations =
    (member.eventRegistrations as Array<Record<string, unknown>>) ?? [];

  const uktEvents = eventRegistrations.filter((r) => {
    const event = r.event as { title?: string } | undefined;
    const title = (event?.title ?? "").toUpperCase();
    return title.includes("UKT") || title.includes("UJIAN");
  });

  const piagamEvents = eventRegistrations.filter((r) => {
    const event = r.event as { title?: string } | undefined;
    const title = (event?.title ?? "").toUpperCase();
    return title.includes("PIAGAM") || title.includes("SERTIFIKAT");
  });

  const pelatihanEvents = eventRegistrations.filter((r) => {
    const event = r.event as { title?: string } | undefined;
    const title = (event?.title ?? "").toUpperCase();
    return (
      title.includes("PELATIHAN") ||
      title.includes("SEMINAR") ||
      title.includes("WORKSHOP")
    );
  });

  return (
    <>
      <MemberPageHeader title="Prestasi & Sabuk" />

      <div className="mb-5 flex gap-1 rounded-2xl bg-muted/60 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/prestasi?tab=${tab}`}
            className={cn(
              "flex-1 rounded-xl py-2 text-center text-xs font-bold transition-colors",
              activeTab === tab
                ? "bg-card text-inkai-red shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {tab}
          </Link>
        ))}
      </div>

      {activeTab === "Sabuk" && (
        <>
          <MemberUktStatus />

          <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Award className="h-4 w-4 text-inkai-red" />
              Sabuk Saat Ini
            </div>
            <Badge className="bg-inkai-yellow text-base text-inkai-black hover:bg-inkai-yellow">
              {formatRankLabel(String(member.currentRank)) || "—"}
            </Badge>
          </div>

          <h3 className="mb-3 text-base font-extrabold">Riwayat Sabuk</h3>
          {ranks.length === 0 ? (
            <div className="mb-8 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat kenaikan sabuk tercatat.
            </div>
          ) : (
            <div className="mb-8 space-y-2">
              {ranks.map((r) => (
                <div
                  key={String(r.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {formatRankLabel(String(r.rank)) || String(r.rank)}
                    </p>
                    {r.location != null && r.location !== "" && (
                      <p className="text-sm text-muted-foreground">
                        {String(r.location)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {new Date(String(r.date)).toLocaleDateString("id-ID")}
                    </p>
                    {r.isVerified === true && (
                      <Badge variant="outline" className="mt-1">
                        Terverifikasi
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="mb-3 text-base font-extrabold">Riwayat UKT / Ujian</h3>
          {uktEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat UKT tercatat.
            </div>
          ) : (
            <EventList items={uktEvents} />
          )}
        </>
      )}

      {activeTab === "Piagam" && (
        <PiagamUploadClient
          items={piagamClaims.data.map((c) => ({
            id: c.id,
            status: c.status,
            data: c.data,
            proofUrl: c.proofUrl,
            createdAt: c.createdAt.toISOString(),
            adminNotes: c.adminNotes,
          }))}
          eventItems={piagamEvents}
        />
      )}

      {activeTab === "Pelatihan" &&
        (pelatihanEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Belum ada riwayat pelatihan tercatat.
          </div>
        ) : (
          <EventList items={pelatihanEvents} />
        ))}
    </>
  );
}

function EventList({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="space-y-2">
      {items.map((r) => {
        const event = r.event as
          | { title?: string; startDate?: string }
          | undefined;
        const category = r.category as { name?: string } | null | undefined;
        const displayStatus = resolveUktDisplayStatus({
          memberId: "",
          registrationId: String(r.id),
          photoUrl: null,
          nia: null,
          fullName: "",
          birthPlace: null,
          birthDate: null,
          gender: null,
          address: null,
          kyuLama: "",
          kyuBaru: category?.name ?? null,
          birthCertificateUrl: null,
          bpjsCardUrl: null,
          dojoName: "",
          dojoId: "",
          status: String(r.status ?? ""),
          billingId: null,
          billingStatus: null,
          billingAmount: null,
          outstandingDues: 0,
          pendingVerifications: 0,
          attendanceCount: 0,
          attendancePct: null,
          examResult: null,
          examPresent: null,
        });
        return (
          <div
            key={String(r.id)}
            className="flex justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">{event?.title ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {formatRankLabel(
                  String(category?.name || r.registeredRank || ""),
                ) || "—"}{" "}
                ·{" "}
                {event?.startDate
                  ? new Date(event.startDate).toLocaleDateString("id-ID")
                  : "—"}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {uktDisplayStatusLabel(displayStatus)}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
