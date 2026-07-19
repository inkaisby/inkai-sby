import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  canMergeMembers,
  findMergeCandidatesForMember,
} from "@/lib/member-merge";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canMergeMembers(authResult.user.roles)) {
    return NextResponse.json({ candidates: [] });
  }

  const { id } = await context.params;
  const { member, candidates } = await findMergeCandidatesForMember(
    authResult.user,
    id,
  );
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    member: {
      id: member.id,
      fullName: member.fullName,
      nia: member.nia,
      status: member.status,
      hasAccount: Boolean(member.userId),
      email: member.user?.email ?? null,
      dojoId: member.dojoId,
      counts: member._count,
    },
    candidates: candidates.map((c) => ({
      id: c.member.id,
      fullName: c.member.fullName,
      nia: c.member.nia,
      status: c.member.status,
      hasAccount: Boolean(c.member.userId),
      email: c.member.user?.email ?? null,
      reasons: c.reasons,
      suggestedKeepId: c.suggestedKeepId,
      suggestedMergeId: c.suggestedMergeId,
      mergeEligible: c.mergeEligible,
      mergeBlockReason: c.mergeBlockReason,
      counts: c.member._count,
    })),
  });
}
