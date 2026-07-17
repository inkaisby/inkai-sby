import { NextResponse } from "next/server";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { buildDojoFilter, getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { DEFAULT_MEMBER_RANK } from "@/lib/belt";
import type { z } from "zod";
import type { uktMemberCreateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

type CreateInput = z.infer<typeof uktMemberCreateSchema>;

export async function createAdminMember(opts: {
  user: SessionUser;
  token: string;
  input: CreateInput;
  request: Request;
  auditAction?: string;
}) {
  const { user, token, input, request } = opts;
  const role = getPrimaryAdminRole(user.roles);
  let dojoId = input.dojoId;

  if (role === "ADMIN_DOJO") {
    if (!user.managedDojoId) {
      return NextResponse.json({ error: "Dojo tidak terkonfigurasi" }, { status: 403 });
    }
    dojoId = user.managedDojoId;
  } else if (!dojoId) {
    const { res, data } = await inkaiFetch("/v1/org/dojos/all", {}, token);
    if (!res.ok) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
    }
    const dojos = (data.data as Array<{ id: string; name: string }>) ?? [];
    const filter = buildDojoFilter(user);
    const scoped = dojos.filter((d) => {
      if (filter.id) return d.id === filter.id;
      return true;
    });
    if (!scoped[0]) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
    }
    dojoId = scoped[0].id;
  }

  const currentRank = input.currentRank?.trim() || DEFAULT_MEMBER_RANK;
  const nik = input.nik?.trim() || undefined;
  const nia = input.nia?.trim() || undefined;
  const phoneNumber = input.phoneNumber?.trim() || undefined;

  const payload: Record<string, unknown> = {
    fullName: input.fullName.toUpperCase(),
    gender: input.gender || null,
    birthPlace: input.birthPlace || null,
    birthDate: input.birthDate || null,
    address: input.address || null,
    dojoId,
    currentRank,
    status: "Active",
  };
  if (nik) payload.nik = nik;
  if (nia) payload.nia = nia;
  if (phoneNumber) payload.phoneNumber = phoneNumber;

  const { res, data } = await inkaiFetch(
    "/v1/members",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat anggota") },
      { status: res.status },
    );
  }

  const member = data.data as Record<string, unknown>;
  writeAuditLog({
    userId: user.id,
    email: user.email,
    action: opts.auditAction || "MEMBER_CREATE",
    details: `Created member ${member.fullName} (${currentRank})${nia ? ` NIA ${nia}` : ""}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({ success: true, member });
}
