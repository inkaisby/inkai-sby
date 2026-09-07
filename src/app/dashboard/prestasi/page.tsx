import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { ImpersonationDataNotice } from "@/components/member/ImpersonationDataNotice";
import { MemberUktStatus } from "@/components/member/MemberUktStatus";
import { PiagamUploadClient } from "@/components/member/PiagamUploadClient";
import {
  resolveUktDisplayStatus,
  uktDisplayStatusLabel,
} from "@/lib/ukt";
import { beltRingVisual, decodeUktRegisteredRank, formatMemberName, formatRankLabel, ranksEqual } from "@/lib/belt";
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

  const impersonating = Boolean(session.impersonatorId);
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
  if (!member?.id) {
    if (impersonating) {
      return (
        <>
          <MemberPageHeader title="Prestasi & Sabuk" />
          <ImpersonationDataNotice />
        </>
      );
    }
    redirect("/dashboard");
  }

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

  const memberName = formatMemberName(String(member.fullName ?? ""));
  const memberNia = String(member.nia ?? "").trim();
  const headerSubtitle = memberNia ? `${memberNia} · ${memberName}` : memberName;

  const dojo = member.dojo as { name?: string } | undefined;
  const currentRing = beltRingVisual(String(member.currentRank));

  return (
    <>
      <MemberPageHeader title="Prestasi & Sabuk" subtitle={headerSubtitle} />

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
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Award className="h-4 w-4 text-inkai-red" />
                Sabuk Saat Ini
              </div>
              {dojo?.name && (
                <span className="text-xs font-medium text-muted-foreground">
                  {dojo.name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-base font-bold shadow-xs"
                style={{
                  backgroundColor: currentRing.bg,
                  color: currentRing.bg === "#e2e8f0" ? "#0f172a" : "#ffffff",
                  boxShadow: currentRing.shadow || undefined,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/20"
                  style={{
                    backgroundColor: currentRing.bg === "#e2e8f0" ? "#0f172a" : "#ffffff",
                  }}
                />
                {formatRankLabel(String(member.currentRank)) || "—"}
              </div>
              {Boolean(member.mshNumber) && (
                <Badge variant="outline" className="text-xs font-semibold">
                  No. MSH: {String(member.mshNumber)}
                </Badge>
              )}
            </div>
          </div>

          <h3 className="mb-3 text-base font-extrabold">Riwayat Sabuk</h3>
          {ranks.length === 0 ? (
            <div className="mb-8 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat kenaikan sabuk tercatat.
            </div>
          ) : (
            <div className="mb-8 space-y-2">
              {ranks.map((r) => {
                const rankRing = beltRingVisual(String(r.rank));
                const formattedDate = r.date
                  ? new Date(String(r.date)).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—";
                return (
                  <div
                    key={String(r.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                          style={{
                            backgroundColor: rankRing.bg,
                            boxShadow: rankRing.shadow || undefined,
                          }}
                        />
                        <p className="font-semibold">
                          {formatRankLabel(String(r.rank)) || String(r.rank)}
                        </p>
                      </div>
                      {r.location != null && r.location !== "" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {String(r.location)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-medium">
                        {formattedDate}
                      </p>
                      {r.isVerified === true && (
                        <Badge variant="outline" className="mt-1 text-[10px] py-0">
                          Terverifikasi
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
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
          | { title?: string; startDate?: string; location?: string }
          | undefined;
        const category = r.category as { name?: string } | null | undefined;
        const registeredRank =
          typeof r.registeredRank === "string" ? r.registeredRank : null;
        const decoded = decodeUktRegisteredRank(registeredRank);
        const kyuLama =
          decoded.kyuLama ||
          (typeof r.registeredRank === "string" ? r.registeredRank : null);
        const kyuBaru = decoded.kyuBaru || null;

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
          kyuLama: kyuLama ?? "",
          kyuBaru: kyuBaru ?? category?.name ?? null,
          birthCertificateUrl: null,
          bpjsCardUrl: null,
          dojoName: "",
          dojoId: "",
          status: String(r.status ?? ""),
          billingId: (r.billing as { id?: string })?.id ?? null,
          billingStatus:
            (r.billing as { status?: string })?.status ??
            (r.billingStatus as string | null) ??
            (r.status === "PAID" || r.status === "SUCCESS" ? "PAID" : null),
          billingAmount: null,
          outstandingDues: 0,
          pendingVerifications: 0,
          attendanceCount: 0,
          attendancePct: null,
          examResult: null,
          examPresent: null,
        });

        const rankLabel =
          kyuBaru && kyuLama && !ranksEqual(kyuLama, kyuBaru)
            ? `${formatRankLabel(kyuLama)} → ${formatRankLabel(kyuBaru)}`
            : kyuBaru
              ? formatRankLabel(kyuBaru)
              : formatRankLabel(kyuLama || category?.name || "") || "—";

        const formattedEventDate = event?.startDate
          ? new Date(event.startDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "—";

        return (
          <div
            key={String(r.id)}
            className="flex justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">{event?.title ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {rankLabel} · {formattedEventDate}
                {event?.location ? ` · ${event.location}` : ""}
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
