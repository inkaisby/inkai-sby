import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { uktMemberCreateSchema } from "@/lib/security/schemas";
import { createAdminMember } from "@/lib/admin-member-create";
import {
  fetchAdminMemberStatusCountsCached,
  fetchAdminMembersScoped,
  type MemberStatusCounts,
} from "@/lib/inkai-api/admin-data";
import { getPrimaryAdminRole } from "@/lib/rbac";
import {
  getManagedDojoIdsFromUser,
  resolveActiveDojoId,
} from "@/lib/managed-dojos";
import { getMemberLifecycles, monthsSince } from "@/lib/member-lifecycle";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { user } = authResult;
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim() || "";
  const status = sp.get("status")?.trim() || "";
  const docs = sp.get("docs") === "incomplete" ? "incomplete" : "";
  const niaFilter = sp.get("nia") === "missing" ? "missing" : "";
  const inactiveMonthsRaw = Number(sp.get("inactiveMonths") || 0);
  const inactiveMonths =
    inactiveMonthsRaw === 3 ||
    inactiveMonthsRaw === 6 ||
    inactiveMonthsRaw === 12
      ? inactiveMonthsRaw
      : 0;
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const pageSizeRaw = Number(sp.get("pageSize") || 25);
  const pageSize = [25, 50, 100, 1000].includes(pageSizeRaw) ? pageSizeRaw : 25;
  const includeCounts = sp.get("counts") !== "0";

  const primaryRole = getPrimaryAdminRole(user.roles);
  const isDojoAdmin = primaryRole === "ADMIN_DOJO";
  const allowlist = getManagedDojoIdsFromUser(user);
  const resolved = resolveActiveDojoId(user, sp.get("dojoId"));
  const activeDojoId =
    resolved.ok && isDojoAdmin
      ? resolved.activeDojoId
      : sp.get("dojoId")?.trim() || "";
  const dojoId = isDojoAdmin
    ? activeDojoId || ""
    : sp.get("dojoId")?.trim() || "";

  const scopeOpts = {
    dojoId: dojoId || undefined,
    dojoIds:
      isDojoAdmin && !dojoId && allowlist.length > 0 ? allowlist : undefined,
  };

  const [result, statusCounts] = await Promise.all([
    fetchAdminMembersScoped(user, {
      page,
      limit: pageSize,
      search: q || undefined,
      status: status || undefined,
      ...scopeOpts,
      docsIncomplete: docs === "incomplete",
      missingNia: niaFilter === "missing",
    }),
    includeCounts
      ? fetchAdminMemberStatusCountsCached(user, scopeOpts)
      : Promise.resolve(null as MemberStatusCounts | null),
  ]);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Gagal memuat anggota" },
      { status: 502 },
    );
  }

  let members = result.members;
  let total = result.total;
  if (inactiveMonths > 0) {
    const lifecycles = await getMemberLifecycles(members.map((m) => m.id));
    members = members.filter((m) => {
      const st = m.status.trim().toUpperCase();
      if (st !== "INACTIVE" && st !== "SUSPENDED") return false;
      const meta = lifecycles.get(m.id);
      const months = monthsSince(meta?.changedAt);
      return months != null && months >= inactiveMonths;
    });
    total = members.length;
  }

  return NextResponse.json({
    members,
    total,
    page: result.page,
    pageSize,
    dojoId,
    statusCounts: statusCounts
      ? (() => {
          const counts = { ...statusCounts };
          if (
            !q &&
            !status &&
            !docs &&
            !niaFilter &&
            !inactiveMonths &&
            counts.all !== total
          ) {
            counts.all = total;
          }
          return counts;
        })()
      : null,
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: first || "Data tidak valid" },
      { status: 400 },
    );
  }

  return createAdminMember({
    user: authResult.user,
    token: authResult.token,
    input: parsed.data,
    request,
    auditAction: "MEMBER_CREATE",
  });
}
