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
import { parseSortDir } from "@/lib/table-sort";
import { buildMemberEventRegistrationMap } from "@/lib/ukt-suggest";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { user } = authResult;
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim() || "";
  const status = sp.get("status")?.trim() || "";
  const docs = sp.get("docs") === "incomplete" ? "incomplete" : "";
  const niaFilter = sp.get("nia") === "missing" ? "missing" : "";
  const accountFilter = sp.get("account") === "missing" ? "missing" : "";
  const dupFilter = sp.get("dup") === "nia_nik" ? "nia_nik" : "";
  const inactiveMonthsRaw = Number(sp.get("inactiveMonths") || 0);
  const inactiveMonths =
    inactiveMonthsRaw === 3 ||
    inactiveMonthsRaw === 6 ||
    inactiveMonthsRaw === 12
      ? inactiveMonthsRaw
      : 0;
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const pageSizeParam = sp.get("pageSize")?.trim() || "";
  const isExport =
    pageSizeParam === "export" || sp.get("export") === "1";
  const pageSizeRaw = Number(pageSizeParam || 25);
  const EXPORT_CAP = 2000;
  const pageSize = isExport
    ? EXPORT_CAP
    : [25, 50, 100].includes(pageSizeRaw)
      ? pageSizeRaw
      : 25;
  const effectivePage = isExport ? 1 : page;
  const sort = sp.get("sort")?.trim() || "";
  const sortDir = parseSortDir(sp.get("sortDir"));
  const includeCounts = sp.get("counts") !== "0";
  const uktEventId = sp.get("uktEventId")?.trim() || "";
  const latberEventId = sp.get("latberEventId")?.trim() || "";

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
      page: effectivePage,
      limit: pageSize,
      search: q || undefined,
      status: status || undefined,
      ...scopeOpts,
      docsIncomplete: docs === "incomplete",
      missingNia: niaFilter === "missing",
      withoutAccount: accountFilter === "missing",
      duplicateIdentity: dupFilter === "nia_nik",
      sort: sort || undefined,
      sortDir,
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

  let eventRegistration: Record<
    string,
    { ukt?: boolean; latber?: boolean }
  > | null = null;
  if (uktEventId || latberEventId) {
    const flagMap = await buildMemberEventRegistrationMap(
      members.map((m) => m.id),
      uktEventId || undefined,
      latberEventId || undefined,
    );
    eventRegistration = Object.fromEntries(flagMap);
  }

  return NextResponse.json({
    members,
    total,
    page: result.page,
    pageSize,
    dojoId,
    eventRegistration,
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
  if (authResult.adminDojoGrants && !authResult.adminDojoGrants.crud) {
    return NextResponse.json(
      { error: "Akun admin ranting Anda tidak diizinkan menambah anggota" },
      { status: 403 },
    );
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
