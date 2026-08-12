import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { getMemberLatberStatus } from "@/lib/member-latber-status";
import { LatberStatusCard } from "@/components/member/LatberStatusCard";

function LatberSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-border/60 bg-card p-4 ${compact ? "" : "mb-4"}`}
    >
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="mt-3 h-6 w-48 rounded bg-muted" />
    </div>
  );
}

async function LatberStatusInner({ compact }: { compact?: boolean }) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) return null;
  const data = await getMemberLatberStatus(
    token,
    session.user.memberId,
    session.user.name,
  );
  if (!data.period) return null;
  return <LatberStatusCard compact={compact} initialData={data} />;
}

export function MemberLatberStatus({ compact }: { compact?: boolean }) {
  return (
    <Suspense fallback={<LatberSkeleton compact={compact} />}>
      <LatberStatusInner compact={compact} />
    </Suspense>
  );
}
