"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { AdminAbsensiProgressTable } from "@/components/admin/AdminAbsensiProgressTable";
import type { MemberAttendanceProgress } from "@/components/admin/MemberAttendanceSheet";
import {
  attendanceProgressLabel,
  UKT_SEMESTER_SESSION_TOTAL,
} from "@/lib/ukt";
import type { AbsensiClientPayload } from "@/lib/admin-absensi-data";
import { showError, showSuccess } from "@/lib/client-toast";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";

export type AbsensiView = "progress" | "harian" | "belum";

export type DayLogRow = {
  id: string;
  memberId: string;
  fullName: string;
  nia: string;
  dojoId: string;
  dojoName: string;
  eventTitle: string | null;
  checkInAt: string;
  method: string;
};

export type BelumRow = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoId?: string;
  dojoName: string;
};

type Props = {
  initialView: AbsensiView;
  dateStr: string;
  semester: "I" | "II";
  year: number;
  selectedCabangId: string | null;
  selectedDojoId: string | null;
  cabangs: Array<{ id: string; name: string }>;
  dojos: Array<{ id: string; name: string; branchId: string }>;
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
  selectedCabangId,
  selectedDojoId,
  cabangs,
  dojos,
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
  const [cabangIdState, setCabangIdState] = useState<string>(
    selectedCabangId || "",
  );
  const [dojoIdState, setDojoIdState] = useState<string>(selectedDojoId || "");
  const [presentCountState, setPresentCountState] = useState(presentCount);
  const [dayLogs, setDayLogs] = useState(initialDayLogs);
  const [belumHadir, setBelumHadir] = useState(initialBelumHadir);
  const [progressRows, setProgressRows] = useState(initialProgressRows);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // State Koreksi Modal
  const [editingLog, setEditingLog] = useState<{
    id: string;
    fullName: string;
    nia: string;
    dojoId?: string;
    dojoName?: string;
    checkInAt: string;
  } | null>(null);
  const [editDojoId, setEditDojoId] = useState<string>("");
  const [editCheckInAt, setEditCheckInAt] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingEdit, setIsDeletingEdit] = useState(false);

  const semesterLabel = `Semester ${semesterState} ${yearState}`;

  const filteredDojosForSelect = useMemo(() => {
    if (!cabangIdState) return dojos;
    return dojos.filter((d) => d.branchId === cabangIdState);
  }, [dojos, cabangIdState]);

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
      cabangId: string;
      dojoId: string;
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
        if (opts.cabangId) qs.set("cabangId", opts.cabangId);
        if (opts.dojoId) qs.set("dojoId", opts.dojoId);

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
        if (opts.cabangId) params.set("cabangId", opts.cabangId);
        if (opts.dojoId) params.set("dojoId", opts.dojoId);
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

  const handleOpenKoreksi = useCallback(
    (log: {
      id: string;
      fullName: string;
      nia: string;
      dojoId?: string;
      dojoName?: string;
      checkInAt: string;
    }) => {
      setEditingLog(log);
      const matchedDojo = dojos.find(
        (d) => d.id === log.dojoId || d.name === log.dojoName,
      );
      setEditDojoId(matchedDojo?.id || log.dojoId || (dojos[0]?.id ?? ""));
      const d = new Date(log.checkInAt);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate(),
        )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setEditCheckInAt(localIso);
      } else {
        setEditCheckInAt("");
      }
    },
    [dojos],
  );

  async function handleSaveKoreksi() {
    if (!editingLog) return;
    if (!editDojoId) {
      showError("Pilih ranting / dojo");
      return;
    }
    if (!editCheckInAt) {
      showError("Tentukan waktu check-in");
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/admin/absensi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLog.id,
          dojoId: editDojoId,
          checkInAt: new Date(editCheckInAt).toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui absensi");
      showSuccess("Absensi berhasil dikoreksi");
      setEditingLog(null);
      void fetchAbsensi({
        date: dateStrState,
        semester: semesterState,
        year: yearState,
        cabangId: cabangIdState,
        dojoId: dojoIdState,
        q: query,
        view,
      });
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal memperbarui absensi",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteKoreksi() {
    if (!editingLog) return;
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus absensi untuk ${editingLog.fullName}?`,
      )
    ) {
      return;
    }
    setIsDeletingEdit(true);
    try {
      const res = await fetch(
        `/api/admin/absensi?id=${encodeURIComponent(editingLog.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menghapus absensi");
      showSuccess("Absensi berhasil dihapus");
      setEditingLog(null);
      void fetchAbsensi({
        date: dateStrState,
        semester: semesterState,
        year: yearState,
        cabangId: cabangIdState,
        dojoId: dojoIdState,
        q: query,
        view,
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus absensi");
    } finally {
      setIsDeletingEdit(false);
    }
  }

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
    () => progressRows.filter((m) => filterName(m.fullName, m.nia)),
    [progressRows, filterName],
  );

  const filteredDay = useMemo(
    () => dayLogs.filter((m) => filterName(m.fullName, m.nia)),
    [dayLogs, filterName],
  );

  const filteredBelum = useMemo(
    () => belumHadir.filter((m) => filterName(m.fullName, m.nia)),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (cabangIdState) params.set("cabangId", cabangIdState);
    if (dojoIdState) params.set("dojoId", dojoIdState);
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
    const nextCabang = String(fd.get("cabangId") || "");
    const nextDojo = String(fd.get("dojoId") || "");

    setQuery(nextQ);
    setPage(1);

    void fetchAbsensi({
      date: nextDate,
      semester: nextSem,
      year: nextYear,
      cabangId: nextCabang,
      dojoId: nextDojo,
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
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        {cabangs.length > 0 ? (
          <select
            name="cabangId"
            value={cabangIdState}
            onChange={(e) => {
              const newCabang = e.target.value;
              setCabangIdState(newCabang);
              if (newCabang) {
                const match = dojos.find(
                  (d) => d.id === dojoIdState && d.branchId === newCabang,
                );
                if (!match) setDojoIdState("");
              }
            }}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm sm:h-8 sm:w-auto"
          >
            <option value="">Semua Cabang</option>
            {cabangs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}

        {dojos.length > 0 ? (
          <select
            name="dojoId"
            value={dojoIdState}
            onChange={(e) => setDojoIdState(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm sm:h-8 sm:w-auto"
          >
            <option value="">Semua Ranting / Dojo</option>
            {filteredDojosForSelect.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : null}

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
              className="h-10 w-full rounded-lg border bg-background px-2 text-sm sm:h-8 sm:w-auto"
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
          className="h-10 rounded-lg bg-inkai-red px-4 text-sm font-medium text-white hover:bg-inkai-red/90 sm:h-8 sm:py-1.5"
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
              onEditLog={handleOpenKoreksi}
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {new Date(log.checkInAt).toLocaleString("id-ID")}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleOpenKoreksi(log)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-2.5 py-1 text-xs font-medium hover:bg-muted"
                        title="Koreksi Absensi"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        Koreksi
                      </button>
                    </div>
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
              {filteredBelum.length} anggota aktif belum absen pada{" "}
              {dateStrState}
              {presentCountState > 0 ? ` · ${presentCountState} sudah hadir` : ""}
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

      {/* Modal Koreksi Absensi */}
      <Dialog
        open={Boolean(editingLog)}
        onOpenChange={(open) => {
          if (!open) setEditingLog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Koreksi Absensi</DialogTitle>
          </DialogHeader>

          {editingLog ? (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">
                  {editingLog.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  NIA: {editingLog.nia || "—"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="koreksi-dojo">Ranting / Dojo Lokasi Absen</Label>
                <select
                  id="koreksi-dojo"
                  value={editDojoId}
                  onChange={(e) => setEditDojoId(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Pilih Dojo / Ranting...</option>
                  {dojos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="koreksi-checkin">Waktu Check-In</Label>
                <Input
                  id="koreksi-checkin"
                  type="datetime-local"
                  value={editCheckInAt}
                  onChange={(e) => setEditCheckInAt(e.target.value)}
                  className="h-10 w-full"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingEdit || isDeletingEdit}
              onClick={handleDeleteKoreksi}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {isDeletingEdit ? "Menghapus..." : "Hapus Absensi"}
            </Button>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingLog(null)}
                disabled={isSavingEdit || isDeletingEdit}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveKoreksi}
                disabled={isSavingEdit || isDeletingEdit}
                className="bg-inkai-red text-white hover:bg-inkai-red/90"
              >
                {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
