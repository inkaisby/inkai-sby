"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import type { AbsensiClientPayload } from "@/lib/admin-absensi-data";
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
  dayLogs: initialDayLogs,
  belumHadir: initialBelumHadir,
  progressRows: initialProgressRows,
}: Props) {
  const [view, setView] = useState<AbsensiView>(initialView);
  const [query, setQuery] = useState(q);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateStrState, setDateStrState] = useState(dateStr);
  const [semesterState, setSemesterState] = useState(semester);
  const [yearState, setYearState] = useState(year);
  const [presentCountState, setPresentCountState] = useState(presentCount);
  const [dayLogs, setDayLogs] = useState(initialDayLogs);
  const [belumHadir, setBelumHadir] = useState(initialBelumHadir);
  const [progressRows, setProgressRows] = useState(initialProgressRows);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const semesterLabel = `Semester ${semesterState} ${yearState}`;

  const applyPayload = useCallback((data: AbsensiClientPayload) => {
    setDateStrState(data.dateStr);
    setSemesterState(data.semester);
    setYearState(data.year);
    setPresentCountState(data.presentCount);
    setDayLogs(data.dayLogs);
    setBelumHadir(data.belumHadir);
    setProgressRows(data.progressRows);
  }, []);

  const fetchAbsensi = useCallback(
    async (opts: {
      date: string;
      semester: "I" | "II";
      year: number;
      q: string;
      view: AbsensiView;
    }) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          date: opts.date,
          semester: opts.semester,
          year: String(opts.year),
        });
        const res = await fetch(`/api/admin/absensi?${qs}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as
          | AbsensiClientPayload
          | { error?: string };
        if (!res.ok) throw new Error("error" in data ? data.error : "Gagal");
        applyPayload(data as AbsensiClientPayload);
        const params = new URLSearchParams();
        params.set("view", opts.view);
        params.set("date", opts.date);
        params.set("semester", opts.semester);
        params.set("year", String(opts.year));
        if (opts.q.trim()) params.set("q", opts.q.trim());
        window.history.replaceState(
          null,
          "",
          `/admin/absensi?${params.toString()}`,
        );
      } catch (err) {
        if (!ac.signal.aborted) {
          console.error("[absensi-client]", err);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [applyPayload],
  );

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

  const activeTotal =
    view === "progress"
      ? filteredProgress.length
      : view === "harian"
        ? filteredDay.length
        : filteredBelum.length;
  const totalPages = Math.max(1, Math.ceil(activeTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = <T,>(rows: T[]) =>
    rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedProgress = useMemo(
    () => pageSlice(filteredProgress),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageSlice depends on safePage/pageSize
    [filteredProgress, safePage, pageSize],
  );
  const pagedDay = useMemo(
    () => pageSlice(filteredDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredDay, safePage, pageSize],
  );
  const pagedBelum = useMemo(
    () => pageSlice(filteredBelum),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredBelum, safePage, pageSize],
  );

  function switchView(next: AbsensiView) {
    if (next === view) return;
    setView(next);
    setPage(1);
    const params = new URLSearchParams();
    params.set("view", next);
    params.set("date", dateStrState);
    params.set("semester", semesterState);
    params.set("year", String(yearState));
    if (query.trim()) params.set("q", query.trim());
    window.history.replaceState(null, "", `/admin/absensi?${params.toString()}`);
  }

  function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nextQ = String(fd.get("q") || "").trim();
    const nextDate = String(fd.get("date") || dateStrState);
    const nextSem = (String(fd.get("semester") || semesterState) === "II"
      ? "II"
      : "I") as "I" | "II";
    const nextYear = Number(fd.get("year") || yearState) || yearState;

    setQuery(nextQ);
    setPage(1);

    const needsRefetch =
      nextDate !== dateStrState ||
      nextSem !== semesterState ||
      nextYear !== yearState;

    if (!needsRefetch) {
      const params = new URLSearchParams();
      params.set("view", view);
      params.set("date", dateStrState);
      params.set("semester", semesterState);
      params.set("year", String(yearState));
      if (nextQ) params.set("q", nextQ);
      window.history.replaceState(null, "", `/admin/absensi?${params.toString()}`);
      return;
    }

    void fetchAbsensi({
      date: nextDate,
      semester: nextSem,
      year: nextYear,
      q: nextQ,
      view,
    });
  }

  return (
    <div>
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
            filename={`absensi-${dateStrState}.csv`}
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
            filename={`absensi-belum-${dateStrState}.csv`}
            headers={["Nama", "NIA", "Dojo"]}
            rows={filteredBelum.map((m) => [
              m.fullName,
              m.nia ?? "",
              m.dojoName,
            ])}
          />
        ) : (
          <ExportCsvButton
            filename={`absensi-progress-${semesterState}-${yearState}.csv`}
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
            defaultValue={dateStrState}
            key={`date-${dateStrState}`}
            className="h-10 w-full sm:h-8 sm:max-w-[180px] sm:w-auto"
          />
        ) : null}
        {view === "progress" ? (
          <>
            <select
              name="semester"
              defaultValue={semesterState}
              key={`sem-${semesterState}-${yearState}`}
              className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
            >
              <option value="I">Semester I</option>
              <option value="II">Semester II</option>
            </select>
            <Input
              name="year"
              type="number"
              defaultValue={yearState}
              key={`year-${yearState}`}
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

      <div
        className={cn(
          loading ? "opacity-60 transition-opacity duration-150" : "",
        )}
        aria-busy={loading}
      >
      {view === "progress" ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {semesterLabel} · target {UKT_SEMESTER_SESSION_TOTAL} sesi (hari
            unik) · klik baris untuk detail · diurutkan dari % terendah
          </p>
          <AdminAbsensiProgressTable
            rows={pagedProgress}
            semesterLabel={semesterLabel}
          />
          <AbsensiPager
            page={safePage}
            pageSize={pageSize}
            total={filteredProgress.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
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
            {pagedDay.map((log) => (
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
            <AbsensiPager
              page={safePage}
              pageSize={pageSize}
              total={filteredDay.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )
      ) : null}

      {view === "belum" ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {filteredBelum.length} anggota aktif belum absen pada {dateStrState}
            {presentCountState > 0
              ? ` · ${presentCountState} sudah hadir`
              : ""}
          </p>
          {filteredBelum.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Semua anggota aktif sudah absen (atau data anggota kosong).
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pagedBelum.map((m) => (
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
              <AbsensiPager
                page={safePage}
                pageSize={pageSize}
                total={filteredBelum.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          )}
        </>
      ) : null}
      </div>
    </div>
  );
}

function AbsensiPager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Menampilkan {from}–{to} dari {total}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Per halaman</span>
          <select
            className="h-8 rounded-lg border bg-background px-2 text-sm text-foreground"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex gap-1.5 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border px-2.5 py-1 hover:bg-muted disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border px-2.5 py-1 hover:bg-muted disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
