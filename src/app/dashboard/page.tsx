import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Wallet } from "lucide-react";
import {
  fetchMyAttendance,
  fetchMyBillings,
  fetchMyMemberProfile,
  fetchMyNotifications,
} from "@/lib/inkai-api/member-data";
import { getDojoDetail } from "@/lib/public-data";
import { DashboardHomeHeader } from "@/components/member/DashboardHomeHeader";
import { MemberCard } from "@/components/member/MemberCard";
import { QuickActions } from "@/components/member/QuickActions";
import { MemberUktStatus } from "@/components/member/MemberUktStatus";
import {
  MembershipChecklist,
  buildMembershipChecklist,
} from "@/components/member/MembershipChecklist";
import { DojoTodayCard } from "@/components/member/DojoTodayCard";
import { ImpersonationDataNotice } from "@/components/member/ImpersonationDataNotice";
import { formatMemberName, formatRankLabel, resolveMemberDisplayRank } from "@/lib/belt";
import {
  isDocumentComplete,
  isProfileComplete,
} from "@/lib/memberCompleteness";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  attendanceProgressLabel,
  isCheckedInOnJakartaDay,
  semesterAttendanceStats,
  UKT_MIN_ATTENDANCE_PCT,
} from "@/lib/ukt";

export const dynamic = "force-dynamic";

export default async function MemberDashboard() {
  const [session, token] = await Promise.all([
    auth(),
    getInkaiAccessToken(),
  ]);
  if (!session) redirect("/login");
  if (!token) redirect("/login");

  const impersonating = Boolean(session.impersonatorId);

  // Critical path only — agenda/events tidak di-fetch di beranda
  const userId = String(session.user.id);
  const memberIdHint =
    typeof session.user.memberId === "string" ? session.user.memberId : null;
  const [member, notifications, attendances, billings, unreadPesanResult] =
    await Promise.all([
      fetchMyMemberProfile(token, memberIdHint),
      fetchMyNotifications(token, 15, session.user.id),
      fetchMyAttendance(token, 48),
      fetchMyBillings(token, 12),
      withPrismaFallback(
        "member-pesan-unread",
        () =>
          prisma.message.count({
            where: {
              isRead: false,
              senderId: { not: userId },
              conversation: {
                participants: { some: { id: userId } },
              },
            },
          }),
        0,
      ),
    ]);

  const unreadPesan = unreadPesanResult.data || 0;

  const attendanceStats = semesterAttendanceStats(
    attendances.map((a) => ({ checkInAt: String(a.checkInAt) })),
  );
  const attendanceRows = attendances.map((a) => ({
    checkInAt: String(a.checkInAt),
  }));
  const checkedInToday = isCheckedInOnJakartaDay(attendanceRows);
  const progress = attendanceProgressLabel(attendanceStats.pct);
  const unpaidMonthly = billings.filter(
    (b) => b.type === "MONTHLY_IURAN" && b.status !== "PAID",
  ).length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const dojo = member?.dojo as
    | {
        id?: string;
        name?: string;
        branch?: { name?: string };
        schedule?: string | null;
        tempatLatihan?: string | null;
        phoneNumber?: string | null;
        headName?: string | null;
        contactPerson?: string | null;
      }
    | undefined;
  const dojoId = String(member?.dojoId || dojo?.id || "");
  // Skip round-trip jika profil Inkai sudah membawa detail dojo
  const dojoHasDetail = Boolean(
    dojo?.schedule ||
      dojo?.tempatLatihan ||
      dojo?.headName ||
      dojo?.contactPerson ||
      dojo?.phoneNumber,
  );
  const dojoDetail =
    dojoId && !dojoHasDetail ? await getDojoDetail(dojoId) : null;
  const dojoLine = [
    dojoDetail?.name || dojo?.name,
    dojoDetail?.branch?.name || dojo?.branch?.name,
  ]
    .filter(Boolean)
    .join(" - ");

  const displayName = formatMemberName(
    String(member?.fullName || session.user.name || "Anggota"),
  );
  const nia = String(member?.nia || "MEMPROSES NIA...");
  const belt =
    formatRankLabel(
      resolveMemberDisplayRank({
        currentRank: String(member?.currentRank ?? ""),
        ranks: member?.ranks as Array<{
          rank?: string | null;
          date?: string | Date | null;
        }>,
        eventRegistrations: member?.eventRegistrations as Array<{
          status?: string | null;
          registeredRank?: string | null;
          event?: { title?: string | null } | null;
        }>,
      }),
    ) || "Belum tercatat";
  const photoUrl = (member?.photoUrl as string | null | undefined) ?? null;
  const memberId = String(member?.id || session.user.memberId || "");
  const qrValue = memberId
    ? `${SITE_URL}/v/${member?.nia || memberId}`
    : undefined;
  const mshNumber =
    (member?.mshNumber as string | null | undefined)?.trim() || null;

  const semesterLabel = attendanceStats.isFirstSemester
    ? "I (Jan - Jun)"
    : "II (Jul - Des)";
  const eligible = attendanceStats.pct >= UKT_MIN_ATTENDANCE_PCT;
  const isActive =
    member?.status === "Active" || member?.status === "ACTIVE";
  const isPending = member?.status === "PENDING";

  const profileOk = isProfileComplete({
    fullName: member?.fullName as string | undefined,
    phoneNumber: member?.phoneNumber as string | undefined,
    photoUrl: member?.photoUrl as string | undefined,
    gender: member?.gender as string | undefined,
    birthDate: member?.birthDate as string | Date | undefined,
    birthPlace: member?.birthPlace as string | undefined,
    address: member?.address as string | undefined,
    dojoId: (member?.dojoId as string | undefined) || dojoId || undefined,
  });
  const documentsOk = isDocumentComplete({
    birthCertificateUrl: member?.birthCertificateUrl as string | undefined,
    bpjsCardUrl: member?.bpjsCardUrl as string | undefined,
  });
  const iuranOk =
    unpaidMonthly === 0 || Boolean(member?.allowEventWithoutDues);

  const checklistItems = buildMembershipChecklist({
    profileOk,
    documentsOk,
    iuranOk,
    attendancePct: attendanceStats.pct,
    attendanceEligible: eligible,
    unpaidCount: unpaidMonthly,
  });

  const roleLabel = isPending
    ? "Menunggu Verifikasi"
    : isActive
      ? "Anggota Aktif"
      : "Anggota";

  const schedule = dojoDetail?.schedule || dojo?.schedule || null;
  const tempat = dojoDetail?.tempatLatihan || dojo?.tempatLatihan || null;
  const picName =
    dojoDetail?.headName ||
    dojoDetail?.contactPerson ||
    dojo?.headName ||
    dojo?.contactPerson ||
    null;
  const phone = dojoDetail?.phoneNumber || dojo?.phoneNumber || null;

  return (
    <div className="flex flex-col gap-7 py-1">
      <DashboardHomeHeader
        name={displayName}
        roleLabel={roleLabel}
        photoUrl={photoUrl}
        unreadCount={unreadCount}
        unreadPesan={unreadPesan}
      />

      {isPending && (
        <div className="flex items-start gap-3 rounded-2xl border border-inkai-yellow/40 bg-inkai-yellow/10 p-4">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-inkai-yellow" />
          <div>
            <p className="font-semibold">Akun sedang diverifikasi</p>
            <p className="text-sm text-muted-foreground">
              Pendaftaran menunggu persetujuan admin. Lengkapi profil & dokumen
              agar proses lebih cepat.
            </p>
          </div>
        </div>
      )}

      {isActive && <MemberUktStatus compact />}

      {unpaidMonthly > 0 && isActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-amber-600" />
            <p className="text-sm">
              Anda memiliki <b>{unpaidMonthly}</b> tagihan iuran belum lunas.
            </p>
          </div>
          <Link
            href="/dashboard/iuran"
            className="text-sm font-semibold text-inkai-red"
          >
            Bayar iuran →
          </Link>
        </div>
      )}

      {member ? (
        <MembershipChecklist
          items={checklistItems}
          readyLabel="Siap ikut ujian & kegiatan — pantau Status UKT dan menu Kegiatan."
        />
      ) : null}

      {member ? (
        <MemberCard
          nia={nia}
          name={displayName}
          dojo={dojoLine || "—"}
          highestBelt={belt}
          mshNumber={mshNumber}
          qrValue={qrValue}
        />
      ) : impersonating ? (
        <ImpersonationDataNotice />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Data anggota belum tersedia. Hubungi admin cabang/dojo Anda.
        </div>
      )}

      {member && dojoLine ? (
        <DojoTodayCard
          dojoName={dojoLine}
          schedule={schedule}
          tempatLatihan={tempat}
          picName={picName}
          phoneNumber={phone}
          checkedInToday={checkedInToday}
          isActive={isActive}
        />
      ) : null}

      {member ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">
              Kehadiran Semester {semesterLabel}
            </h2>
            <Link
              href="/dashboard/absensi"
              className="text-xs font-semibold text-inkai-red"
            >
              Detail
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[26px] font-black leading-none",
                  progress.tone === "green"
                    ? "text-emerald-500"
                    : progress.tone === "amber"
                      ? "text-amber-600"
                      : "text-inkai-red",
                )}
              >
                {attendanceStats.pct}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {attendanceStats.count} dari {attendanceStats.totalSessions}{" "}
                latihan semester ini
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progress.tone === "green"
                      ? "bg-emerald-500"
                      : progress.tone === "amber"
                        ? "bg-amber-500"
                        : "bg-inkai-red",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(4, attendanceStats.pct))}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  "inline-block rounded-full px-3 py-1 text-[10px] font-bold tracking-wide uppercase",
                  progress.tone === "green"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : progress.tone === "amber"
                      ? "bg-amber-500/15 text-amber-700"
                      : "bg-inkai-red/10 text-inkai-red",
                )}
              >
                {progress.label}
              </span>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Min. {UKT_MIN_ATTENDANCE_PCT}%
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <QuickActions
          checkedInToday={checkedInToday}
          unpaidIuran={unpaidMonthly}
          documentsIncomplete={!documentsOk}
          unreadPesan={unreadPesan}
        />
      </section>
    </div>
  );
}
