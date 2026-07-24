import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import {
  fetchAdminMembers,
  fetchAdminMembersForDojoIds,
  fetchAttendanceLogs,
} from "@/lib/inkai-api/admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminAbsensiProgressTable } from "@/components/admin/AdminAbsensiProgressTable";
import {
  UKT_SEMESTER_SESSION_TOTAL,
  attendanceProgressLabel,
  computeSemesterAttendance,
  currentSemester,
  jakartaDayKey,
  type UktSemester,
} from "@/lib/ukt";
import Link from "next/link";

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
  const view =
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

  const needMembers = view === "belum" || view === "progress";
  const needSemester = view === "progress" || view === "belum";

  const [dayLogs, semesterLogs, membersResult] = await Promise.all([
    fetchAttendanceLogs(token, { date: dateStr, limit: 300 }),
    needSemester
      ? fetchAttendanceLogs(token, {
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
          limit: 800,
        })
      : Promise.resolve([] as Array<Record<string, unknown>>),
    needMembers
      ? role === "ADMIN_DOJO"
        ? fetchAdminMembersForDojoIds(token, managedDojoIds, {
            status: "ACTIVE",
            limit: 500,
          })
        : fetchAdminMembers(token, {
            status: "ACTIVE",
            limit: 500,
          })
      : Promise.resolve({ ok: true as const, members: [], total: 0, page: 1 }),
  ]);

  const members =
    membersResult.ok && "members" in membersResult
      ? membersResult.members
      : [];

  let logs = dayLogs;
  if (q && view === "harian") {
    const lower = q.toLowerCase();
    logs = logs.filter((log) => {
      const member = log.member as
        | { fullName?: string; nia?: string }
        | undefined;
      return (
        member?.fullName?.toLowerCase().includes(lower) ||
        member?.nia?.toLowerCase().includes(lower)
      );
    });
  }

  const presentIds = new Set(
    dayLogs
      .map((log) => {
        const member = log.member as { id?: string } | undefined;
        return member?.id ? String(member.id) : String(log.memberId ?? "");
      })
      .filter(Boolean),
  );

  const belumHadir = members.filter((m) => !presentIds.has(m.id));

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

  const filterName = (name: string, nia: string | null) => {
    if (!q) return true;
    const lower = q.toLowerCase();
    return (
      name.toLowerCase().includes(lower) ||
      (nia || "").toLowerCase().includes(lower)
    );
  };

  const progressRows = members
    .filter((m) => filterName(m.fullName, m.nia))
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

  const views = [
    { id: "progress", label: "Progress" },
    { id: "harian", label: "Harian" },
    { id: "belum", label: "Belum hadir hari ini" },
  ] as const;

  const semesterLabel = `Semester ${semester} ${year}`;

  return (
    <>
      <AdminPageHeader
        title="Laporan Absensi"
        description={
          <>
            Progress kehadiran anggota, absensi harian, dan yang belum hadir
            (syarat UKT {UKT_SEMESTER_SESSION_TOTAL} sesi).
          </>
        }
        actions={
          view === "harian" ? (
            <ExportCsvButton
              filename={`absensi-${dateStr}.csv`}
              headers={["Nama", "NIA", "Dojo", "Check-in", "Metode"]}
              rows={logs.map((log) => {
                const member = log.member as
                  | { fullName?: string; nia?: string }
                  | undefined;
                const dojo = log.dojo as { name?: string } | undefined;
                return [
                  member?.fullName ?? "",
                  member?.nia ?? "",
                  dojo?.name ?? "",
                  new Date(String(log.checkInAt)).toLocaleString("id-ID"),
                  String(log.method ?? ""),
                ];
              })}
            />
          ) : view === "belum" ? (
            <ExportCsvButton
              filename={`absensi-belum-${dateStr}.csv`}
              headers={["Nama", "NIA", "Dojo"]}
              rows={belumHadir
                .filter((m) => filterName(m.fullName, m.nia))
                .map((m) => [m.fullName, m.nia ?? "", m.dojo?.name ?? ""])}
            />
          ) : view === "progress" ? (
            <ExportCsvButton
              filename={`absensi-progress-${semester}-${year}.csv`}
              headers={["Nama", "NIA", "Dojo", "Hadir", "Persen", "Status"]}
              rows={progressRows.map((m) => [
                m.fullName,
                m.nia ?? "",
                m.dojo,
                m.count,
                m.pct,
                attendanceProgressLabel(m.pct).label,
              ])}
            />
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {views.map((v) => (
          <Link
            key={v.id}
            href={`/admin/absensi?view=${v.id}&date=${dateStr}&semester=${semester}&year=${year}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-1.5 text-sm ${
              view === v.id
                ? "bg-inkai-red text-white"
                : "border hover:bg-muted"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input type="hidden" name="view" value={view} />
        {view !== "progress" ? (
          <Input
            name="date"
            type="date"
            defaultValue={dateStr}
            className="h-10 w-full sm:h-8 sm:max-w-[180px] sm:w-auto"
          />
        ) : null}
        {view === "progress" ? (
          <>
            <select
              name="semester"
              defaultValue={semester}
              className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
            >
              <option value="I">Semester I</option>
              <option value="II">Semester II</option>
            </select>
            <Input
              name="year"
              type="number"
              defaultValue={year}
              className="h-10 w-full sm:h-8 sm:max-w-[100px] sm:w-auto"
            />
          </>
        ) : null}
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={q}
          className="h-10 w-full sm:h-8 sm:max-w-xs sm:w-auto"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-inkai-red px-4 text-sm text-white sm:h-8 sm:py-1.5"
        >
          Filter
        </button>
      </form>

      {view === "progress" ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {semesterLabel} · target {UKT_SEMESTER_SESSION_TOTAL} sesi (hari
            unik) · klik baris untuk detail · diurutkan dari % terendah
          </p>
          <AdminAbsensiProgressTable
            rows={progressRows}
            semesterLabel={semesterLabel}
          />
        </>
      ) : null}

      {view === "harian" ? (
        logs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Tidak ada data absensi untuk tanggal ini.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const member = log.member as
                | { fullName?: string; nia?: string }
                | undefined;
              const dojo = log.dojo as { name?: string } | undefined;
              const event = log.event as { title?: string } | null | undefined;
              return (
                <Card key={String(log.id)}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div>
                      <p className="font-medium">{member?.fullName ?? "—"}</p>
                      <p className="text-muted-foreground">
                        {member?.nia || "—"} · {dojo?.name ?? "—"}
                        {event && ` · ${event.title}`}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {new Date(String(log.checkInAt)).toLocaleString("id-ID")}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {view === "belum" ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {belumHadir.filter((m) => filterName(m.fullName, m.nia)).length}{" "}
            anggota aktif belum absen pada {dateStr}
            {presentIds.size > 0 ? ` · ${presentIds.size} sudah hadir` : ""}
          </p>
          {belumHadir.filter((m) => filterName(m.fullName, m.nia)).length ===
          0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Semua anggota aktif sudah absen (atau data anggota kosong).
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {belumHadir
                .filter((m) => filterName(m.fullName, m.nia))
                .map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                      <div>
                        <p className="font-medium">{m.fullName}</p>
                        <p className="text-muted-foreground">
                          {m.nia || "—"} · {m.dojo?.name ?? "—"}
                        </p>
                      </div>
                      <Badge variant="outline">Belum hadir</Badge>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
