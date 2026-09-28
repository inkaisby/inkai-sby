import { Suspense } from "react";
import { auth } from "@/auth";
import { getMemberPertandinganStatus } from "@/lib/member-pertandingan-status";
import { PertandinganStatusCard } from "@/components/member/PertandinganStatusCard";

function PertandinganSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-border/60 bg-card p-4 ${compact ? "" : "mb-6"}`}
    >
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="mt-3 h-6 w-48 rounded bg-muted" />
    </div>
  );
}

async function PertandinganStatusInner({ compact }: { compact?: boolean }) {
  const session = await auth();
  const memberId = session?.user.memberId;
  if (!memberId) return null;

  const data = await getMemberPertandinganStatus(memberId);
  if (!data.event) return null;

  return <PertandinganStatusCard compact={compact} data={data} />;
}

export function MemberPertandinganStatus({ compact }: { compact?: boolean }) {
  return (
    <Suspense fallback={<PertandinganSkeleton compact={compact} />}>
      <PertandinganStatusInner compact={compact} />
    </Suspense>
  );
}
