import type { SessionUser } from "@/lib/rbac";
import { getPrimaryAdminRole, buildDojoFilter } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { prisma } from "@/lib/prisma";
import {
  fetchAdminMembers,
  fetchAdminMembersForDojoIds,
  fetchAttendanceLogs,
} from "@/lib/inkai-api/admin-data";
import {
  UKT_SEMESTER_SESSION_TOTAL,
  computeSemesterAttendance,
  currentSemester,
  jakartaDayKey,
  type UktSemester,
} from "@/lib/ukt";
import {
  loadLatberAttendanceCreditsInRange,
  mergeAttendanceWithLatberCredits,
} from "@/lib/latber-attendance";

export type AbsensiClientPayload = {
  dateStr: string;
  semester: UktSemester;
  year: number;
  selectedCabangId: string | null;
  selectedDojoId: string | null;
  cabangs: Array<{ id: string; name: string }>;
  dojos: Array<{ id: string; name: string; branchId: string }>;
  dayLogs: Array<{
    id: string;
    memberId: string;
    fullName: string;
    nia: string;
    dojoId: string;
    dojoName: string;
    eventTitle: string | null;
    checkInAt: string;
    method: string;
  }>;
  belumHadir: Array<{
    id: string;
    fullName: string;
    nia: string | null;
    dojoId?: string;
    dojoName: string;
  }>;
  progressRows: Array<{
    id: string;
    fullName: string;
    nia: string | null;
    dojo: string;
    count: number;
    pct: number;
    logs: Array<{
      id: string;
      checkInAt: string;
      method?: string;
      dojoId?: string;
      dojoName?: string;
      eventTitle?: string | null;
    }>;
  }>;
  sessionTotal: number;
  presentCount: number;
};

export async function loadAbsensiClientPayload(
  token: string,
  user: SessionUser,
  opts: {
    date?: string;
    semester?: string;
    year?: number;
    cabangId?: string;
    dojoId?: string;
  },
): Promise<AbsensiClientPayload> {
  const today = jakartaDayKey();
  const dateStr = opts.date?.trim() || today;
  const year = Number(opts.year) || new Date().getFullYear();
  const semester = (
    opts.semester === "II"
      ? "II"
      : opts.semester === "I"
        ? "I"
        : currentSemester()
  ) as UktSemester;

  const role = getPrimaryAdminRole(user.roles ?? []);
  const managedDojoIds =
    role === "ADMIN_DOJO" ? getManagedDojoIdsFromUser(user) : [];

  const userDojos = await prisma.dojo.findMany({
    where: {
      isDeleted: false,
      ...buildDojoFilter(user),
    },
    select: {
      id: true,
      name: true,
      branchId: true,
      branch: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const dojos = userDojos.map((d) => ({
    id: d.id,
    name: d.name,
    branchId: d.branchId,
  }));

  const branchMap = new Map<string, string>();
  for (const d of userDojos) {
    if (d.branch?.id && d.branch?.name) {
      branchMap.set(d.branch.id, d.branch.name);
    }
  }
  const cabangs = [...branchMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  const selectedCabangId = opts.cabangId?.trim() || null;
  const selectedDojoId = opts.dojoId?.trim() || null;

  let activeDojoIds: string[] | null = null;
  if (selectedDojoId) {
    activeDojoIds = [selectedDojoId];
  } else if (selectedCabangId) {
    activeDojoIds = userDojos
      .filter((d) => d.branchId === selectedCabangId)
      .map((d) => d.id);
  }

  const semesterFrom = new Date(year, semester === "II" ? 6 : 0, 1);
  const semesterTo = new Date(
    year,
    semester === "II" ? 12 : 6,
    0,
    23,
    59,
    59,
    999,
  );
  const [dayLogsRaw, semesterLogsRaw, membersResult, latberCredits] =
    await Promise.all([
      fetchAttendanceLogs(token, { date: dateStr, limit: 200 }),
      fetchAttendanceLogs(token, {
        from: semesterFrom.toISOString(),
        to: semesterTo.toISOString(),
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
      loadLatberAttendanceCreditsInRange({
        from: semesterFrom,
        to: semesterTo,
      }).catch(() => []),
    ]);

  const scopedCredits =
    role === "ADMIN_DOJO" && managedDojoIds.length > 0
      ? latberCredits.filter((c) => managedDojoIds.includes(c.dojoId))
      : latberCredits;
  const dayCredits = scopedCredits.filter(
    (c) => jakartaDayKey(c.checkInAt) === dateStr,
  );
  const dayLogsMerged = mergeAttendanceWithLatberCredits(dayLogsRaw, dayCredits);
  const semesterLogs = mergeAttendanceWithLatberCredits(
    semesterLogsRaw,
    scopedCredits,
  );

  let members =
    membersResult.ok && "members" in membersResult
      ? membersResult.members
      : [];

  if (activeDojoIds && activeDojoIds.length > 0) {
    members = members.filter((m) => m.dojoId && activeDojoIds!.includes(m.dojoId));
  }

  const presentIds = new Set(
    dayLogsMerged
      .map((log) => {
        const member = log.member as { id?: string } | undefined;
        return member?.id ? String(member.id) : String(log.memberId ?? "");
      })
      .filter(Boolean),
  );

  const dayLogs = dayLogsMerged
    .filter((log) => {
      if (!activeDojoIds || activeDojoIds.length === 0) return true;
      const credit = dayCredits.find((c) => c.id === String(log.id));
      const did = String(
        (log.dojo as { id?: string } | undefined)?.id ??
          log.dojoId ??
          credit?.dojoId ??
          "",
      );
      return activeDojoIds.includes(did);
    })
    .map((log) => {
      const member = log.member as
        | { id?: string; fullName?: string; nia?: string }
        | undefined;
      const dojo = log.dojo as { id?: string; name?: string } | undefined;
      const event = log.event as { title?: string } | null | undefined;
      const credit = dayCredits.find((c) => c.id === String(log.id));
      return {
        id: String(log.id),
        memberId: String(member?.id ?? log.memberId ?? credit?.memberId ?? ""),
        fullName: member?.fullName ?? credit?.fullName ?? "—",
        nia: member?.nia ?? credit?.nia ?? "",
        dojoId: String(dojo?.id ?? log.dojoId ?? credit?.dojoId ?? ""),
        dojoName: dojo?.name ?? credit?.dojoName ?? "—",
        eventTitle: event?.title ?? credit?.eventTitle ?? null,
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
      dojoId: m.dojoId ?? undefined,
      dojoName: m.dojo?.name ?? "—",
    }));

  const filteredSemesterLogs = activeDojoIds && activeDojoIds.length > 0
    ? semesterLogs.filter((log) => {
        const credit = scopedCredits.find((c) => c.id === String(log.id));
        const did = String(
          (log.dojo as { id?: string } | undefined)?.id ??
            log.dojoId ??
            credit?.dojoId ??
            "",
        );
        return activeDojoIds!.includes(did);
      })
    : semesterLogs;

  const attendanceRows = filteredSemesterLogs.map((log) => ({
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
      dojoId?: string;
      dojoName?: string;
      eventTitle?: string | null;
    }>
  >();
  for (const log of filteredSemesterLogs) {
    const mid = String(
      (log.member as { id?: string } | undefined)?.id ?? log.memberId ?? "",
    );
    if (!mid) continue;
    const list = logsByMember.get(mid) ?? [];
    if (list.length >= 40) continue;
    const credit = scopedCredits.find((c) => c.id === String(log.id));
    list.push({
      id: String(log.id),
      checkInAt: String(log.checkInAt),
      method: log.method ? String(log.method) : undefined,
      dojoId: String(
        (log.dojo as { id?: string } | undefined)?.id ??
          log.dojoId ??
          credit?.dojoId ??
          "",
      ),
      dojoName: (log.dojo as { name?: string } | undefined)?.name ?? credit?.dojoName ?? undefined,
      eventTitle:
        (log.event as { title?: string } | null | undefined)?.title ?? credit?.eventTitle ?? null,
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
    .sort((a, b) => b.pct - a.pct || a.fullName.localeCompare(b.fullName));

  return {
    dateStr,
    semester,
    year,
    selectedCabangId,
    selectedDojoId,
    cabangs,
    dojos,
    dayLogs,
    belumHadir,
    progressRows,
    sessionTotal: UKT_SEMESTER_SESSION_TOTAL,
    presentCount: presentIds.size,
  };
}
