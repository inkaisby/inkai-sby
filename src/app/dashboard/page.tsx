import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Award,
  Bell,
  ChevronRight,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  fetchMyAttendance,
  fetchMyBillings,
  fetchMyEventRegistrations,
  fetchMyMemberProfile,
  fetchMyNotifications,
  fetchPublicUpcomingEvents,
} from "@/lib/inkai-api/member-data";
import { getDojoDetail } from "@/lib/public-data";
import { DashboardHomeHeader } from "@/components/member/DashboardHomeHeader";
import { MemberCard } from "@/components/member/MemberCard";
import { QuickActions } from "@/components/member/QuickActions";
import { UktStatusCard } from "@/components/member/UktStatusCard";
import {
  MembershipChecklist,
  buildMembershipChecklist,
} from "@/components/member/MembershipChecklist";
import { DojoTodayCard } from "@/components/member/DojoTodayCard";
import { formatMemberName, formatRankLabel, resolveMemberDisplayRank } from "@/lib/belt";
import {
  isDocumentComplete,
  isProfileComplete,
} from "@/lib/memberCompleteness";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function semesterAttendancePct(attendances: Array<{ checkInAt: string }>) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isFirstSemester = currentMonth < 6;

  const count = attendances.filter((h) => {
    const d = new Date(h.checkInAt);
    const isFirst = d.getMonth() < 6;
    return isFirst === isFirstSemester && d.getFullYear() === currentYear;
  }).length;

  const totalSessions = 48;
  const pct =
    totalSessions > 0
      ? Math.min(100, Math.round((count / totalSessions) * 1000) / 10)
      : 0;

  return { count, totalSessions, pct, isFirstSemester };
}

function isCheckedInToday(attendances: Array<{ checkInAt: string }>) {
  const now = new Date();
  return attendances.some((a) => {
    const d = new Date(a.checkInAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });
}

function registrationBadge(status: string | undefined) {
  if (!status) return null;
  switch (status) {
    case "PAID":
      return { label: "LUNAS", className: "bg-emerald-500/15 text-emerald-600" };
    case "SUCCESS":
    case "APPROVED":
      return {
        label: "DISETUJUI",
        className: "bg-emerald-500/15 text-emerald-600",
      };
    case "PENDING":
      return { label: "PENDING", className: "bg-amber-500/15 text-amber-600" };
    case "REJECTED":
      return { label: "DITOLAK", className: "bg-red-500/15 text-red-600" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

function isMyEventStillVisible(event: {
  startDate?: string;
  endDate?: string;
}): boolean {
  const now = Date.now();
  if (event.endDate) {
    return new Date(event.endDate).getTime() >= now;
  }
  if (event.startDate) {
    const start = new Date(event.startDate);
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const eventDayStart = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    return eventDayStart.getTime() >= todayStart.getTime();
  }
  return true;
}

export default async function MemberDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");
  const member = await fetchMyMemberProfile(token);
  const userId = String(
    (member?.userId as string | undefined) || session.user.id,
  );

  const [notifications, attendances, billings, registrations, upcomingEvents, unreadPesanResult] =
    await Promise.all([
      fetchMyNotifications(token, 50, session.user.id),
      fetchMyAttendance(token, 100),
      fetchMyBillings(token, 12),
      member ? fetchMyEventRegistrations(token) : Promise.resolve([]),
      fetchPublicUpcomingEvents(5),
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

  const attendanceStats = semesterAttendancePct(
    attendances.map((a) => ({ checkInAt: String(a.checkInAt) })),
  );
  const attendanceRows = attendances.map((a) => ({
    checkInAt: String(a.checkInAt),
  }));
  const checkedInToday = isCheckedInToday(attendanceRows);
  const unpaidMonthly = billings.filter(
    (b) => b.type === "MONTHLY_IURAN" && b.status !== "PAID",
  ).length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const unreadPesan = unreadPesanResult.data || 0;

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
  const dojoDetail = dojoId ? await getDojoDetail(dojoId) : null;
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

  const semesterLabel = attendanceStats.isFirstSemester
    ? "I (Jan - Jun)"
    : "II (Jul - Des)";
  const eligible = attendanceStats.pct >= 75;
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
  const iuranOk = unpaidMonthly === 0;

  const checklistItems = buildMembershipChecklist({
    profileOk,
    documentsOk,
    iuranOk,
    attendancePct: attendanceStats.pct,
    attendanceEligible: eligible,
    unpaidCount: unpaidMonthly,
  });

  const myEventIds = new Set(
    registrations
      .map((r) => {
        const event = r.event as { id?: string } | undefined;
        return event?.id ? String(event.id) : null;
      })
      .filter(Boolean) as string[],
  );

  const visibleMyEvents = registrations
    .filter((r) => {
      const event = r.event as
        | { startDate?: string; endDate?: string }
        | undefined;
      return event ? isMyEventStillVisible(event) : true;
    })
    .slice(0, 4);

  const upcomingOther = upcomingEvents
    .filter((e) => !myEventIds.has(String(e.id)))
    .slice(0, 3);

  const roleLabel = isPending
    ? "Menunggu Verifikasi"
    : isActive
      ? "Anggota Aktif"
      : "Anggota";

  const schedule =
    dojoDetail?.schedule || dojo?.schedule || null;
  const tempat =
    dojoDetail?.tempatLatihan || dojo?.tempatLatihan || null;
  const picName =
    dojoDetail?.headName ||
    dojoDetail?.contactPerson ||
    dojo?.headName ||
    dojo?.contactPerson ||
    null;
  const phone =
    dojoDetail?.phoneNumber || dojo?.phoneNumber || null;

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

      {isActive && <UktStatusCard compact />}

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
          readyLabel="Siap ikut ujian & kegiatan — pantau UKT dan event di bawah."
        />
      ) : null}

      {member ? (
        <MemberCard
          nia={nia}
          name={displayName}
          dojo={dojoLine || "—"}
          highestBelt={belt}
          qrValue={qrValue}
        />
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
                  eligible ? "text-emerald-500" : "text-inkai-red",
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
                    eligible ? "bg-emerald-500" : "bg-inkai-red",
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
                  eligible
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-inkai-red/10 text-inkai-red",
                )}
              >
                {eligible ? "LAYAK UJIAN" : "TETAP SEMANGAT"}
              </span>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Min. 75%
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

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Agenda</h2>
          <Link
            href="/dashboard/kegiatan"
            className="text-xs font-semibold text-inkai-red"
          >
            Lihat Semua
          </Link>
        </div>

        {visibleMyEvents.length === 0 && upcomingOther.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada agenda terdekat
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleMyEvents.length > 0 ? (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kegiatan saya
              </p>
            ) : null}
            {visibleMyEvents.map((r) => {
              const event = r.event as
                | {
                    id?: string;
                    title?: string;
                    startDate?: string;
                    location?: string;
                    branch?: { name?: string; city?: string };
                  }
                | undefined;
              const badge = registrationBadge(String(r.status));
              const isUKT =
                (event?.title ?? "").toUpperCase().includes("UKT") ||
                (event?.title ?? "").toUpperCase().includes("UJIAN");
              const meta = [
                event?.startDate
                  ? new Date(event.startDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null,
                event?.branch?.name ||
                  event?.branch?.city ||
                  event?.location ||
                  null,
              ]
                .filter(Boolean)
                .join(" | ");

              return (
                <Link
                  key={String(r.id)}
                  href={
                    event?.id
                      ? `/dashboard/kegiatan/${event.id}`
                      : "/dashboard/kegiatan"
                  }
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                      isUKT
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-inkai-red/10 text-inkai-red",
                    )}
                  >
                    {isUKT ? <Award size={20} /> : <Trophy size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {event?.title ?? "—"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {meta || "—"}
                    </p>
                    {badge ? (
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
              );
            })}

            {upcomingOther.length > 0 ? (
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Event terbuka
              </p>
            ) : null}
            {upcomingOther.map((e) => {
              const title = String(e.title ?? "");
              const isUKT =
                title.toUpperCase().includes("UKT") ||
                title.toUpperCase().includes("UJIAN");
              const branch = e.branch as
                | { name?: string; city?: string }
                | undefined;
              const meta = [
                e.startDate
                  ? new Date(String(e.startDate)).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null,
                branch?.name || branch?.city || (e.location as string) || null,
              ]
                .filter(Boolean)
                .join(" | ");

              return (
                <Link
                  key={String(e.id)}
                  href={`/dashboard/kegiatan/${e.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                      isUKT
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-inkai-red/10 text-inkai-red",
                    )}
                  >
                    {isUKT ? <Award size={20} /> : <Trophy size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {meta || "—"}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
