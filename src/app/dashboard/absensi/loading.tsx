import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { AttendanceHistorySkeleton } from "@/components/member/AttendanceHistory";

export default function AbsensiLoading() {
  return (
    <>
      <MemberPageHeader title="Absensi" />
      <div className="mb-6 animate-pulse rounded-2xl border border-border/60 bg-card p-4">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-2 h-4 w-48 rounded bg-muted" />
        <div className="mt-4 h-10 w-full rounded-lg bg-muted sm:w-48" />
      </div>
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Riwayat
      </h3>
      <AttendanceHistorySkeleton />
    </>
  );
}
