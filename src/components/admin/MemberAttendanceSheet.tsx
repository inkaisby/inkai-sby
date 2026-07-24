"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  attendanceProgressLabel,
  UKT_MIN_ATTENDANCE_PCT,
  UKT_SEMESTER_SESSION_TOTAL,
} from "@/lib/ukt";

export type AttendanceLogRow = {
  id: string;
  checkInAt: string;
  method?: string;
  dojoName?: string;
  eventTitle?: string | null;
};

export type MemberAttendanceProgress = {
  id: string;
  fullName: string;
  nia: string | null;
  dojo: string;
  count: number;
  pct: number;
  logs: AttendanceLogRow[];
};

export function MemberAttendanceSheet({
  open,
  onOpenChange,
  member,
  semesterLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberAttendanceProgress | null;
  semesterLabel: string;
}) {
  if (!member) return null;
  const progress = attendanceProgressLabel(member.pct);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-4 sm:px-6">
          <SheetTitle className="pr-8 text-left">{member.fullName}</SheetTitle>
          <SheetDescription className="text-left">
            {member.nia || "—"} · {member.dojo}
          </SheetDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                progress.tone === "green"
                  ? "bg-emerald-500/15 text-emerald-700"
                  : progress.tone === "amber"
                    ? "bg-amber-500/15 text-amber-800"
                    : "bg-inkai-red/10 text-inkai-red",
              )}
            >
              {progress.label}
            </Badge>
            <span className="text-sm font-semibold">
              {member.pct}% · {member.count}/{UKT_SEMESTER_SESSION_TOTAL}
            </span>
            <span className="text-xs text-muted-foreground">{semesterLabel}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                progress.tone === "green"
                  ? "bg-emerald-500"
                  : progress.tone === "amber"
                    ? "bg-amber-500"
                    : "bg-inkai-red",
              )}
              style={{
                width: `${Math.min(100, Math.max(4, member.pct))}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Min. {UKT_MIN_ATTENDANCE_PCT}% · hari unik semester
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-2 px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Riwayat absensi
          </p>
          {member.logs.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada absensi semester ini
            </p>
          ) : (
            member.logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm"
              >
                <p className="font-medium">{log.dojoName || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {log.eventTitle || log.method || "—"} ·{" "}
                  {new Date(log.checkInAt).toLocaleString("id-ID")}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
