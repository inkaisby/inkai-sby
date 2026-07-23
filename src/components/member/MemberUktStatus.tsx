import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { getMemberUktStatus } from "@/lib/member-ukt-status";
import { UktStatusCard } from "@/components/member/UktStatusCard";

function UktSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-border/60 bg-card p-4 ${compact ? "" : "mb-6"}`}
    >
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="mt-3 h-6 w-48 rounded bg-muted" />
    </div>
  );
}

async function UktStatusInner({ compact }: { compact?: boolean }) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) return null;
  const data = await getMemberUktStatus(
    token,
    session.user.memberId,
    session.user.name,
  );
  return <UktStatusCard compact={compact} initialData={data} />;
}

/** UKT status di-stream terpisah agar beranda tidak menunggu rantai Inkai UKT. */
export function MemberUktStatus({ compact }: { compact?: boolean }) {
  return (
    <Suspense fallback={<UktSkeleton compact={compact} />}>
      <UktStatusInner compact={compact} />
    </Suspense>
  );
}
