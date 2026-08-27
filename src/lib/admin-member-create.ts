import { NextResponse } from "next/server";
import { inkaiFetch, inkaiErrorMessage, isInkaiAuthFailure, inkaiServiceToken } from "@/lib/inkai-api/server";
import {
  buildDojoFilter,
  getPrimaryAdminRole,
  type SessionUser,
} from "@/lib/rbac";
import {
  assertDojoAllowed,
  getManagedDojoIdsFromUser,
} from "@/lib/managed-dojos";
import { DEFAULT_MEMBER_RANK, formatRankLabel } from "@/lib/belt";
import type { z } from "zod";
import type { uktMemberCreateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import {
  mshAllowedForRank,
  normalizeMsh,
  normalizeNia,
} from "@/lib/member-profile-locks";
import { notifyAdminsAboutMemberMsh } from "@/lib/member-msh-notify";
import { tryProvisionMemberNiaLogin } from "@/lib/member-nia-login";
import {
  activeHardDuplicates,
  archivedIdentityConflicts,
  enrichNiaConflictError,
  findMemberDuplicates,
  formatDuplicateError,
  releasableArchivedIdConflicts,
  releaseIdentifiersFromArchivedMembers,
} from "@/lib/member-duplicate";

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
    const allowlist = getManagedDojoIdsFromUser(user);
    if (allowlist.length === 0) {
      return NextResponse.json(
        { error: "Dojo tidak terkonfigurasi" },
        { status: 403 },
      );
    }
    if (dojoId) {
      if (!assertDojoAllowed(user, dojoId)) {
        return NextResponse.json(
          { error: "Ranting di luar cakupan akun Anda" },
          { status: 403 },
        );
      }
    } else if (allowlist.length === 1) {
      dojoId = allowlist[0];
    } else {
      return NextResponse.json(
        {
          error:
            "Pilih ranting tujuan. Akun Anda mengelola lebih dari satu ranting.",
          code: "DOJO_REQUIRED",
        },
        { status: 400 },
      );
    }
  } else if (!dojoId) {
    const { res, data } = await inkaiFetch("/v1/org/dojos/all", {}, token, {
      timeoutMs: 8_000,
      retries: 0,
    });
    let dojos = res.ok
      ? ((data.data as Array<{ id: string; name: string }>) ?? [])
      : [];
    if (dojos.length === 0) {
      // JWT expired / Inkai blip — ambil ranting dari Prisma.
      const { prisma } = await import("@/lib/prisma");
      dojos = await prisma.dojo.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
      });
    }
    const filter = buildDojoFilter(user);
    const scoped = dojos.filter((d) => {
      if (!("id" in filter) || filter.id == null) return true;
      const idFilter = filter.id;
      if (typeof idFilter === "string") return d.id === idFilter;
      if (typeof idFilter === "object" && "in" in idFilter) {
        return (idFilter.in as string[]).includes(d.id);
      }
      return true;
    });
    if (!scoped[0]) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
    }
    dojoId = scoped[0].id;
  }

  const currentRank =
    formatRankLabel(input.currentRank?.trim() || "") ||
    input.currentRank?.trim() ||
    DEFAULT_MEMBER_RANK;
  // NIK opsional: hanya kirim jika tepat 16 digit (jangan "" — bentrok unique).
  const nikRaw = input.nik?.trim() || "";
  const nik = /^\d{16}$/.test(nikRaw) ? nikRaw : undefined;
  const nia = normalizeNia(input.nia) || undefined;
  const phoneNumber = input.phoneNumber?.trim() || undefined;
  const mshRaw = input.mshNumber?.trim() || "";
  const msh = mshRaw ? normalizeMsh(mshRaw) : null;
  if (mshRaw && !msh) {
    return NextResponse.json(
      { error: "No. MSH tidak valid" },
      { status: 400 },
    );
  }
  if (msh) {
    if (!mshAllowedForRank(currentRank)) {
      return NextResponse.json(
        { error: "No. MSH hanya untuk sabuk Hitam (DAN)" },
        { status: 400 },
      );
    }
    const { prisma } = await import("@/lib/prisma");
    const clash = await prisma.member.findFirst({
      where: { mshNumber: msh, isDeleted: false },
      select: { fullName: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `No. MSH sudah dipakai anggota lain (${clash.fullName})` },
        { status: 409 },
      );
    }
  }

  const duplicates = await findMemberDuplicates({
    fullName: input.fullName,
    birthDate: input.birthDate,
    nik,
    nia,
  });

  const activeHard = activeHardDuplicates(duplicates);
  if (activeHard.length > 0) {
    return NextResponse.json(
      {
        error: formatDuplicateError(activeHard, "admin"),
        duplicates: activeHard,
        code: "DUPLICATE_MEMBER",
      },
      { status: 409 },
    );
  }

  const archivedIdentity = archivedIdentityConflicts(duplicates);
  if (archivedIdentity.length > 0) {
    return NextResponse.json(
      {
        error: formatDuplicateError(archivedIdentity, "admin"),
        duplicates: archivedIdentity,
        code: "DUPLICATE_ARCHIVED_IDENTITY",
      },
      { status: 409 },
    );
  }

  const releasable = releasableArchivedIdConflicts(duplicates);
  const knownNiaHits = duplicates.filter((h) => h.reasons.includes("NIA"));
  if (releasable.length > 0) {
    try {
      await releaseIdentifiersFromArchivedMembers({
        hits: releasable,
        token,
      });
    } catch (err) {
      console.error("[createAdminMember:releaseArchivedNia]", err);
      return NextResponse.json(
        {
          error: formatDuplicateError(releasable, "admin"),
          duplicates: releasable,
          code: "DUPLICATE_ARCHIVED_NIA",
        },
        { status: 409 },
      );
    }
  }

  const payload: Record<string, unknown> = {
    fullName: input.fullName.toUpperCase(),
    // Beberapa versi Inkai memvalidasi `name` (bukan hanya fullName).
    name: input.fullName.toUpperCase(),
    gender: input.gender || null,
    birthPlace: input.birthPlace?.trim()
      ? input.birthPlace.trim().toUpperCase()
      : null,
    birthDate: input.birthDate || null,
    address: input.address?.trim()
      ? input.address.trim().toUpperCase()
      : null,
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
    { timeoutMs: 12_000, retries: 0 },
  );

  if (!res.ok) {
    const rawError = inkaiErrorMessage(data, "Gagal membuat anggota");

    // JWT sesi expired — coba service token, lalu Prisma lokal (portal baca Prisma).
    if (isInkaiAuthFailure(res, data)) {
      const service = inkaiServiceToken();
      if (service && service !== token) {
        try {
          const retry = await inkaiFetch(
            "/v1/members",
            { method: "POST", body: JSON.stringify(payload) },
            service,
            { timeoutMs: 12_000, retries: 0 },
          );
          if (retry.res.ok) {
            const member = retry.data.data as Record<string, unknown>;
            return await finalizeCreatedMember({
              user,
              token: service,
              request,
              member,
              nik,
              phoneNumber,
              input,
              currentRank,
              nia,
              msh,
              dojoId: String(dojoId),
              auditAction: opts.auditAction,
            });
          }
          console.warn(
            "[createAdminMember] service token POST failed",
            retry.res.status,
            retry.data,
          );
        } catch (err) {
          console.warn("[createAdminMember] service token POST error", err);
        }
      }

      try {
        const member = await createMemberInPrisma({
          dojoId: String(dojoId),
          fullName: String(payload.fullName),
          gender: input.gender || null,
          birthPlace: input.birthPlace?.trim()
            ? input.birthPlace.trim().toUpperCase()
            : null,
          birthDate: input.birthDate || null,
          address: input.address?.trim()
            ? input.address.trim().toUpperCase()
            : null,
          currentRank,
          nik,
          nia,
          msh,
        });
        console.warn(
          "[createAdminMember] Inkai auth failed — created member in Prisma",
          member.id,
        );
        return await finalizeCreatedMember({
          user,
          token,
          request,
          member,
          nik,
          phoneNumber,
          input,
          currentRank,
          nia,
          msh,
          dojoId: String(dojoId),
          auditAction: opts.auditAction,
          skipInkaiSync: true,
        });
      } catch (err) {
        console.error("[createAdminMember:prismaFallback]", err);
        return NextResponse.json(
          {
            error:
              "Sesi API berakhir dan gagal menyimpan anggota ke database lokal. Silakan refresh/login lalu coba lagi.",
          },
          { status: 503 },
        );
      }
    }

    // Fallback: Inkai menolak NIA yang masih dipegang (lokal/arsip/lintas cabang).
    if (nia && /nia/i.test(rawError)) {
      const again = await findMemberDuplicates({ nia });
      const release = releasableArchivedIdConflicts(
        again.length > 0 ? again : knownNiaHits,
      );
      if (release.length > 0) {
        try {
          await releaseIdentifiersFromArchivedMembers({
            hits: release,
            token,
          });
          const retry = await inkaiFetch(
            "/v1/members",
            { method: "POST", body: JSON.stringify(payload) },
            token,
          );
          if (retry.res.ok) {
            const member = retry.data.data as Record<string, unknown>;
            return await finalizeCreatedMember({
              user,
              token,
              request,
              member,
              nik,
              phoneNumber,
              input,
              currentRank,
              nia,
              msh,
              dojoId: String(dojoId),
              auditAction: opts.auditAction,
            });
          }
        } catch (err) {
          console.error("[createAdminMember:niaRetry]", err);
        }
      }
      const enriched = await enrichNiaConflictError(
        rawError,
        nia,
        again.length > 0 ? again : knownNiaHits,
      );
      return NextResponse.json(
        {
          error: enriched,
          duplicates: again.length > 0 ? again : knownNiaHits,
          code: "DUPLICATE_NIA",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: rawError },
      { status: res.status },
    );
  }

  const member = data.data as Record<string, unknown>;
  return finalizeCreatedMember({
    user,
    token,
    request,
    member,
    nik,
    phoneNumber,
    input,
    currentRank,
    nia,
    msh,
    dojoId: String(dojoId),
    auditAction: opts.auditAction,
  });
}

async function createMemberInPrisma(opts: {
  dojoId: string;
  fullName: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  address: string | null;
  currentRank: string;
  nik: string | undefined;
  nia: string | undefined;
  msh: string | null;
}): Promise<Record<string, unknown>> {
  const { prisma } = await import("@/lib/prisma");
  const dojo = await prisma.dojo.findFirst({
    where: { id: opts.dojoId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!dojo) {
    throw new Error("Dojo tidak ditemukan di database lokal");
  }
  const created = await prisma.member.create({
    data: {
      fullName: opts.fullName,
      dojoId: opts.dojoId,
      gender: opts.gender,
      birthPlace: opts.birthPlace,
      birthDate: opts.birthDate ? new Date(opts.birthDate) : null,
      address: opts.address,
      currentRank: opts.currentRank,
      status: "Active",
      nik: opts.nik ?? null,
      nia: opts.nia ?? null,
      mshNumber: opts.msh,
    },
    select: {
      id: true,
      fullName: true,
      dojoId: true,
      currentRank: true,
      status: true,
      nia: true,
      nik: true,
      gender: true,
      birthPlace: true,
      birthDate: true,
      address: true,
      dojo: { select: { name: true } },
    },
  });
  return {
    id: created.id,
    fullName: created.fullName,
    dojoId: created.dojoId,
    currentRank: created.currentRank,
    status: created.status,
    nia: created.nia,
    nik: created.nik,
    gender: created.gender,
    birthPlace: created.birthPlace,
    birthDate: created.birthDate?.toISOString() ?? null,
    address: created.address,
    dojo: created.dojo,
  };
}

async function finalizeCreatedMember(opts: {
  user: SessionUser;
  token: string;
  request: Request;
  member: Record<string, unknown>;
  nik: string | undefined;
  phoneNumber: string | undefined;
  input: CreateInput;
  currentRank: string;
  nia: string | undefined;
  msh: string | null;
  dojoId: string;
  auditAction?: string;
  /** True bila member sudah dibuat di Prisma tanpa Inkai — jangan PATCH Inkai. */
  skipInkaiSync?: boolean;
}) {
  const {
    user,
    token,
    request,
    member,
    nik,
    phoneNumber,
    input,
    currentRank,
    nia,
    msh,
    dojoId,
    skipInkaiSync,
  } = opts;
  const memberId = typeof member?.id === "string" ? member.id : null;

  if (memberId && nia && !skipInkaiSync) {
    try {
      const patch = await inkaiFetch(
        `/v1/members/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ nia }),
        },
        token,
      );
      if (!patch.res.ok) {
        console.warn(
          "[createAdminMember:syncNia]",
          inkaiErrorMessage(patch.data, "unknown"),
        );
      }
    } catch (err) {
      console.error("[createAdminMember:syncNia]", err);
    }
  }

  // Selaraskan field identitas di DB lokal (NIK kosong = null, bukan "").
  if (memberId) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.member.update({
        where: { id: memberId },
        data: {
          nik: nik ?? null,
          birthPlace: input.birthPlace?.trim()
            ? input.birthPlace.trim().toUpperCase()
            : null,
          address: input.address?.trim()
            ? input.address.trim().toUpperCase()
            : null,
          gender: input.gender || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          currentRank,
          ...(nia ? { nia } : {}),
          ...(msh ? { mshNumber: msh } : {}),
        },
        select: {
          id: true,
          nik: true,
          nia: true,
          mshNumber: true,
          currentRank: true,
        },
      });
      const inkaiRank = String(member.currentRank ?? "").trim();
      if (!skipInkaiSync && inkaiRank !== currentRank) {
        try {
          const patch = await inkaiFetch(
            `/v1/members/${memberId}`,
            {
              method: "PATCH",
              body: JSON.stringify({ currentRank }),
            },
            token,
          );
          if (!patch.res.ok) {
            console.warn(
              "[createAdminMember:syncRank]",
              inkaiErrorMessage(patch.data, "unknown"),
            );
          }
        } catch (err) {
          console.error("[createAdminMember:syncRank]", err);
        }
      }
      if (phoneNumber && typeof member.userId === "string") {
        await prisma.user.update({
          where: { id: member.userId },
          data: { phoneNumber },
        });
      }
      if (msh) {
        const fullName = String(member.fullName ?? input.fullName);
        const dojoName =
          (member.dojo as { name?: string } | undefined)?.name || "Ranting";
        void notifyAdminsAboutMemberMsh({
          dojoId,
          token,
          excludeUserId: user.id,
          title: "No. MSH anggota baru",
          content: `${fullName} (${dojoName}): No. MSH ${msh} (saat tambah anggota).`,
        });
      }
    } catch (err) {
      console.error("[createAdminMember:sync]", err);
    }
  }

  if (memberId && nia) {
    const provision = await tryProvisionMemberNiaLogin(memberId, {
      actorUserId: user.id,
      actorEmail: user.email,
    });
    if (provision?.status === "failed") {
      console.warn(
        "[createAdminMember] NIA login provision failed:",
        provision.reason,
      );
    }
  }

  writeAuditLog({
    userId: user.id,
    email: user.email,
    action: opts.auditAction || "MEMBER_CREATE",
    details: `Created member ${member.fullName} (${currentRank})${nia ? ` NIA ${nia}` : ""}${msh ? ` MSH ${msh}` : ""}${skipInkaiSync ? " [prisma-fallback]" : ""}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  return NextResponse.json({ success: true, member });
}
