import { Suspense } from "react";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { AttendanceCheckIn } from "@/components/member/AttendanceCheckIn";

function CheckInSkeleton() {
  return (
    <div className="mb-6 animate-pulse rounded-2xl border border-border/60 bg-card p-4">
      <div className="h-5 w-36 rounded bg-muted" />
      <div className="mt-2 h-4 w-48 rounded bg-muted" />
      <div className="mt-4 h-10 w-full rounded-lg bg-muted sm:w-48" />
    </div>
  );
}

async function CheckInInner() {
  const token = await getInkaiAccessToken();
  if (!token) return null;
  const member = await fetchMyMemberProfile(token);
  const dojoId =
    (member as { dojoId?: string } | null)?.dojoId ||
    ((member?.dojo as { id?: string } | undefined)?.id ?? null);
  const homeDojoName =
    (member?.dojo as { name?: string } | undefined)?.name || null;

  return (
    <AttendanceCheckIn defaultDojoId={dojoId} homeDojoName={homeDojoName} />
  );
}

export function AttendanceCheckInPanel() {
  return (
    <Suspense fallback={<CheckInSkeleton />}>
      <CheckInInner />
    </Suspense>
  );
}
