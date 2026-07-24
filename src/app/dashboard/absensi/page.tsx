import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { AttendanceCheckInPanel } from "@/components/member/AttendanceCheckInPanel";
import { AttendanceHistory } from "@/components/member/AttendanceHistory";

export const dynamic = "force-dynamic";

export default function AbsensiPage() {
  return (
    <>
      <MemberPageHeader title="Absensi" />
      <AttendanceCheckInPanel />
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Riwayat
      </h3>
      <AttendanceHistory />
    </>
  );
}
