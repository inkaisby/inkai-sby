"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { AdminAbsensiProgressTable } from "@/components/admin/AdminAbsensiProgressTable";
import type { MemberAttendanceProgress } from "@/components/admin/MemberAttendanceSheet";
import {
  attendanceProgressLabel,
  UKT_SEMESTER_SESSION_TOTAL,
} from "@/lib/ukt";
import { cn } from "@/lib/utils";

export type AbsensiView = "progress" | "harian" | "belum";

export type DayLogRow = {
  id: string;
  fullName: string;
  nia: string;
  dojoName: string;
  eventTitle: string | null;
  checkInAt: string;
  method: string;
};

export type BelumRow = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName: string;
};

type Props = {
  initialView: AbsensiView;
  dateStr: string;
  semester: "I" | "II";
  year: number;
  q: string;
  presentCount: number;
  dayLogs: DayLogRow[];
  belumHadir: BelumRow[];
  progressRows: MemberAttendanceProgress[];
};

const VIEWS: { id: AbsensiView; label: string }[] = [
  { id: "progress", label: "Progress" },
  { id: "harian", label: "Harian" },
  { id: "belum", label: "Belum hadir hari ini" },
];

export function AdminAbsensiClient({
  initialView,
  dateStr,
  semester,
  year,
  q,
  presentCount,
  dayLogs,
  belumHadir,
  progressRows,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<AbsensiView>(initialView);
  const [query, setQuery] = useState(q);
  const [isPending, startTransition] = useTransition();

  const semesterLabel = `Semester ${semester} ${year}`;

  const filterName = useCallback(
    (name: string, nia: string | null | undefined) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return (
        name.toLowerCase().includes(needle) ||
        (nia || "").toLowerCase().includes(needle)
      );
    },
    [query],
  );

  const filteredProgress = useMemo(
    () =>
      progressRows.filter((m) => filterName(m.fullName, m.nia)),
    [progressRows, filterName],
  );

  const filteredDay = useMemo(
    () =>
      dayLogs.filter((m) => filterName(m.fullName, m.nia)),
    [dayLogs, filterName],
  );

  const filteredBelum = useMemo(
    () =>
      belumHadir.filter((m) => filterName(m.fullName, m.nia)),
    [belumHadir, filterName],
  );

  function switchView(next: AbsensiView) {
    if (next === view) return;
    setView(next);
    const params = new URLSearchParams();
    params.set("view", next);
    params.set("date", dateStr);
    params.set("semester", semester);
    params.set("year", String(year));
    if (query.trim()) params.set("q", query.trim());
    // Soft URL update — tanpa navigasi RSC / tanpa blank loader
    window.history.replaceState(null, "", `/admin/absensi?${params.toString()}`);
  }

  function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nextQ = String(fd.get("q") || "").trim();
    const nextDate = String(fd.get("date") || dateStr);
    const nextSem = (String(fd.get("semester") || semester) === "II"
      ? "II"
      : "I") as "I" | "II";
    const nextYear = Number(fd.get("year") || year) || year;

    setQuery(nextQ);

    // Semester/tahun/tanggal butuh refetch server; q saja cukup client filter
    const needsRefetch =
      nextDate !== dateStr ||
      nextSem !== semester ||
      nextYear !== year;

    if (!needsRefetch) {
      const params = new URLSearchParams();
      params.set("view", view);
      params.set("date", dateStr);
      params.set("semester", semester);
      params.set("year", String(year));
      if (nextQ) params.set("q", nextQ);
      window.history.replaceState(null, "", `/admin/absensi?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams();
    params.set("view", view);
    params.set("date", nextDate);
    params.set("semester", nextSem);
    params.set("year", String(nextYear));
    if (nextQ) params.set("q", nextQ);
    startTransition(() => {
      router.replace(`/admin/absensi?${params.toString()}`);
    });
  }

  return (
    <div className={cn(isPending && "opacity-70 pointer-events-none")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => switchView(v.id)}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
                view === v.id
                  ? "bg-inkai-red text-white"
                  : "border hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "harian" ? (
          <ExportCsvButton
            filename={`absensi-${dateStr}.csv`}
            headers={["Nama", "NIA", "Dojo", "Check-in", "Metode"]}
            rows={filteredDay.map((log) => [
              log.fullName,
              log.nia,
              log.dojoName,
              new Date(log.checkInAt).toLocaleString("id-ID"),
              log.method,
            ])}
          />
        ) : view === "belum" ? (
          <ExportCsvButton
            filename={`absensi-belum-${dateStr}.csv`}
            headers={["Nama", "NIA", "Dojo"]}
            rows={filteredBelum.map((m) => [
              m.fullName,
              m.nia ?? "",
              m.dojoName,
            ])}
          />
        ) : (
          <ExportCsvButton
            filename={`absensi-progress-${semester}-${year}.csv`}
            headers={["Nama", "NIA", "Dojo", "Hadir", "Persen", "Status"]}
            rows={filteredProgress.map((m) => [
              m.fullName,
              m.nia ?? "",
              m.dojo,
              m.count,
              m.pct,
              attendanceProgressLabel(m.pct).label,
            ])}
          />
        )}
      </div>

      <form
        onSubmit={onFilterSubmit}
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      >
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
          onChange={(e) => setQuery(e.target.value)}
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
            rows={filteredProgress}
            semesterLabel={semesterLabel}
          />
        </>
      ) : null}

      {view === "harian" ? (
        filteredDay.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Tidak ada data absensi untuk tanggal ini.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredDay.map((log) => (
              <Card key={log.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <p className="font-medium">{log.fullName}</p>
                    <p className="text-muted-foreground">
                      {log.nia || "—"} · {log.dojoName}
                      {log.eventTitle ? ` · ${log.eventTitle}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {new Date(log.checkInAt).toLocaleString("id-ID")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {view === "belum" ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {filteredBelum.length} anggota aktif belum absen pada {dateStr}
            {presentCount > 0 ? ` · ${presentCount} sudah hadir` : ""}
          </p>
          {filteredBelum.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Semua anggota aktif sudah absen (atau data anggota kosong).
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredBelum.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div>
                      <p className="font-medium">{m.fullName}</p>
                      <p className="text-muted-foreground">
                        {m.nia || "—"} · {m.dojoName}
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
    </div>
  );
}
