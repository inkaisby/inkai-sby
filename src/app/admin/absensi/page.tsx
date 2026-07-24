import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import {
  fetchAdminMembers,
  fetchAdminMembersForDojoIds,
  fetchAttendanceLogs,
} from "@/lib/inkai-api/admin-data";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  AdminAbsensiClient,
  type AbsensiView,
} from "@/components/admin/AdminAbsensiClient";
import {
  UKT_SEMESTER_SESSION_TOTAL,
  computeSemesterAttendance,
  currentSemester,
  jakartaDayKey,
  type UktSemester,
} from "@/lib/ukt";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  date?: string;
  q?: string;
  view?: string;
  semester?: string;
  year?: string;
}>;

export default function AdminAbsensiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminAbsensiContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAbsensiContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token, user } = await requireAdminSession();

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const today = jakartaDayKey();
  const dateStr = params.date?.trim() || today;
  const rawView = params.view?.trim() || "progress";
  const initialView: AbsensiView =
    rawView === "rekap"
      ? "progress"
      : rawView === "harian" || rawView === "belum" || rawView === "progress"
        ? rawView
        : "progress";
  const year = Number(params.year) || new Date().getFullYear();
  const semester = (
    params.semester === "II"
      ? "II"
      : params.semester === "I"
        ? "I"
        : currentSemester()
  ) as UktSemester;

  const role = getPrimaryAdminRole(user.roles ?? []);
  const managedDojoIds =
    role === "ADMIN_DOJO" ? getManagedDojoIdsFromUser(user) : [];

  // Satu fetch untuk semua tab — ganti tab di client tanpa delay RSC
  const [dayLogsRaw, semesterLogs, membersResult] = await Promise.all([
    fetchAttendanceLogs(token, { date: dateStr, limit: 200 }),
    fetchAttendanceLogs(token, {
      from: new Date(year, semester === "II" ? 6 : 0, 1).toISOString(),
      to: new Date(
        year,
        semester === "II" ? 12 : 6,
        0,
        23,
        59,
        59,
        999,
      ).toISOString(),
      limit: 600,
    }),
    role === "ADMIN_DOJO"
      ? fetchAdminMembersForDojoIds(token, managedDojoIds, {
          status: "ACTIVE",
          limit: 400,
        })
      : fetchAdminMembers(token, {
          status: "ACTIVE",
          limit: 400,
        }),
  ]);

  const members =
    membersResult.ok && "members" in membersResult
      ? membersResult.members
      : [];

  const presentIds = new Set(
    dayLogsRaw
      .map((log) => {
        const member = log.member as { id?: string } | undefined;
        return member?.id ? String(member.id) : String(log.memberId ?? "");
      })
      .filter(Boolean),
  );

  const dayLogs = dayLogsRaw.map((log) => {
    const member = log.member as
      | { fullName?: string; nia?: string }
      | undefined;
    const dojo = log.dojo as { name?: string } | undefined;
    const event = log.event as { title?: string } | null | undefined;
    return {
      id: String(log.id),
      fullName: member?.fullName ?? "—",
      nia: member?.nia ?? "",
      dojoName: dojo?.name ?? "—",
      eventTitle: event?.title ?? null,
      checkInAt: String(log.checkInAt),
      method: String(log.method ?? ""),
    };
  });

  const belumHadir = members
    .filter((m) => !presentIds.has(m.id))
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      dojoName: m.dojo?.name ?? "—",
    }));

  const attendanceRows = semesterLogs.map((log) => ({
    checkInAt: String(log.checkInAt),
    memberId: String(
      (log.member as { id?: string } | undefined)?.id ?? log.memberId ?? "",
    ),
  }));
  const { countByMember, pctByMember } = computeSemesterAttendance(
    attendanceRows,
    semester,
    year,
  );

  const logsByMember = new Map<
    string,
    Array<{
      id: string;
      checkInAt: string;
      method?: string;
      dojoName?: string;
      eventTitle?: string | null;
    }>
  >();
  for (const log of semesterLogs) {
    const mid = String(
      (log.member as { id?: string } | undefined)?.id ?? log.memberId ?? "",
    );
    if (!mid) continue;
    const list = logsByMember.get(mid) ?? [];
    if (list.length >= 40) continue; // batasi payload Sheet
    list.push({
      id: String(log.id),
      checkInAt: String(log.checkInAt),
      method: log.method ? String(log.method) : undefined,
      dojoName: (log.dojo as { name?: string } | undefined)?.name,
      eventTitle:
        (log.event as { title?: string } | null | undefined)?.title ?? null,
    });
    logsByMember.set(mid, list);
  }

  const progressRows = members
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nia: m.nia,
      dojo: m.dojo?.name ?? "—",
      count: countByMember.get(m.id) ?? 0,
      pct: pctByMember.get(m.id) ?? 0,
      logs: (logsByMember.get(m.id) ?? []).sort(
        (a, b) =>
          new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime(),
      ),
    }))
    .sort((a, b) => a.pct - b.pct);

  return (
    <>
      <AdminPageHeader
        title="Laporan Absensi"
        description={
          <>
            Progress kehadiran anggota, absensi harian, dan yang belum hadir
            (syarat UKT {UKT_SEMESTER_SESSION_TOTAL} sesi). Tab berganti instan
            tanpa reload.
          </>
        }
      />
      <AdminAbsensiClient
        initialView={initialView}
        dateStr={dateStr}
        semester={semester}
        year={year}
        q={q}
        presentCount={presentIds.size}
        dayLogs={dayLogs}
        belumHadir={belumHadir}
        progressRows={progressRows}
      />
    </>
  );
}
