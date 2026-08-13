import { Suspense } from "react";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { auth } from "@/auth";
import { fetchMyAttendanceMerged } from "@/lib/inkai-api/member-data";
import { LATBER_ATTENDANCE_LABEL, isLatberAttendanceMethod } from "@/lib/latber-attendance";
import { Badge } from "@/components/ui/badge";

export function AttendanceHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-border/60 bg-card p-4"
        >
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="mt-2 h-3 w-24 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

async function HistoryInner() {
  const token = await getInkaiAccessToken();
  if (!token) return null;
  const session = await auth();
  const memberId =
    typeof session?.user.memberId === "string" ? session.user.memberId : null;
  const attendances = await fetchMyAttendanceMerged(token, memberId, 20);

  if (attendances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Belum ada riwayat absensi.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attendances.map((a) => {
        const dojo = a.dojo as { name?: string } | undefined;
        const event = a.event as { title?: string } | null | undefined;
        return (
          <div
            key={String(a.id)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">{dojo?.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">
                {isLatberAttendanceMethod(String(a.method ?? ""))
                  ? event?.title || LATBER_ATTENDANCE_LABEL
                  : event?.title || String(a.method ?? "—")}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {new Date(String(a.checkInAt)).toLocaleString("id-ID")}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function AttendanceHistory() {
  return (
    <Suspense fallback={<AttendanceHistorySkeleton />}>
      <HistoryInner />
    </Suspense>
  );
}
