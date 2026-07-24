import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import {
  BELT_RANK_OPTIONS,
  formatMemberName,
  formatRankLabel,
  isBlackBeltRank,
  resolveMemberDisplayRank,
} from "@/lib/belt";
import { isFieldLocked } from "@/lib/member-profile-locks";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { ImpersonationDataNotice } from "@/components/member/ImpersonationDataNotice";
import ProfilPageClient from "./ProfilPageClient";

export const dynamic = "force-dynamic";

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const raw = String(value);
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? "";
  }
  return d.toISOString().slice(0, 10);
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function ProfilPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const impersonating = Boolean(session.impersonatorId);
  const member = await fetchMyMemberProfile(token);
  if (!member?.id) {
    if (impersonating) {
      return (
        <>
          <MemberPageHeader title="Profil" />
          <ImpersonationDataNotice description="Profil anggota (data, dokumen, kunci field) tidak dapat ditampilkan atau diubah dalam mode ambil alih karena token API tetap milik akun pengurus, bukan akun target. Hentikan ambil alih untuk mengelola profil sebenarnya." />
        </>
      );
    }
    redirect("/dashboard");
  }

  const dojo = member.dojo as
    | { name?: string; branch?: { name?: string } }
    | undefined;
  const belt = resolveMemberDisplayRank({
    currentRank: String(member.currentRank ?? ""),
    ranks: member.ranks as Array<{
      rank?: string | null;
      date?: string | Date | null;
    }>,
    eventRegistrations: member.eventRegistrations as Array<{
      status?: string | null;
      registeredRank?: string | null;
      event?: { title?: string | null } | null;
    }>,
  });
  const beltLabel = formatRankLabel(belt) || belt || "—";

  const locks = {
    emailSelfEditedAt: member.emailSelfEditedAt
      ? new Date(String(member.emailSelfEditedAt))
      : null,
    niaSelfEditedAt: member.niaSelfEditedAt
      ? new Date(String(member.niaSelfEditedAt))
      : null,
    rankSelfEditedAt: member.rankSelfEditedAt
      ? new Date(String(member.rankSelfEditedAt))
      : null,
    mshSelfEditedAt: member.mshSelfEditedAt
      ? new Date(String(member.mshSelfEditedAt))
      : null,
  };

  return (
    <ProfilPageClient
      beltOptions={[...BELT_RANK_OPTIONS]}
      member={{
        id: String(member.id),
        fullName: formatMemberName(String(member.fullName ?? "")),
        email:
          (typeof member.email === "string" && member.email) ||
          session.user.email ||
          "",
        nik: (member.nik as string | null) ?? null,
        nia: (member.nia as string | null) ?? null,
        mshNumber: (member.mshNumber as string | null) ?? null,
        gender: (member.gender as string | null) ?? null,
        birthPlace: (member.birthPlace as string | null) ?? null,
        birthDate: toDateInputValue(member.birthDate),
        address: (member.address as string | null) ?? null,
        phoneNumber: (member.phoneNumber as string | null) ?? null,
        photoUrl: (member.photoUrl as string | null) ?? null,
        birthCertificateUrl:
          (member.birthCertificateUrl as string | null) ?? null,
        bpjsCardUrl: (member.bpjsCardUrl as string | null) ?? null,
        bpjsCardNumber: (member.bpjsCardNumber as string | null) ?? null,
        currentRank: beltLabel,
        dojoLabel:
          [dojo?.name, dojo?.branch?.name].filter(Boolean).join(" · ") || "—",
        status: String(member.status ?? ""),
        isBlackBelt: isBlackBeltRank(beltLabel),
        locks: {
          email: isFieldLocked(locks, "email"),
          nia: isFieldLocked(locks, "nia"),
          currentRank: isFieldLocked(locks, "currentRank"),
          mshNumber: isFieldLocked(locks, "mshNumber"),
          emailSelfEditedAt: toIsoOrNull(member.emailSelfEditedAt),
          niaSelfEditedAt: toIsoOrNull(member.niaSelfEditedAt),
          rankSelfEditedAt: toIsoOrNull(member.rankSelfEditedAt),
          mshSelfEditedAt: toIsoOrNull(member.mshSelfEditedAt),
        },
      }}
    />
  );
}
