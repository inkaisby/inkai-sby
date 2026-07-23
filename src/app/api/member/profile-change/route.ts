import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { memberProfileChangeSchema } from "@/lib/security/schemas";
import {
  isFieldLocked,
  mshAllowedForRank,
  normalizeEmail,
  normalizeMsh,
  normalizeNia,
  normalizeSelfRank,
} from "@/lib/member-profile-locks";

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.verification.findMany({
    where: {
      memberId: session.user.memberId,
      type: "PROFILE_CHANGE",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = memberProfileChangeSchema.safeParse(await request.json());
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Data tidak valid";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const memberId = String(session.user.memberId);
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      nia: true,
      mshNumber: true,
      currentRank: true,
      emailSelfEditedAt: true,
      niaSelfEditedAt: true,
      rankSelfEditedAt: true,
      mshSelfEditedAt: true,
      user: { select: { email: true } },
    },
  });
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  const locks = {
    emailSelfEditedAt: member.emailSelfEditedAt,
    niaSelfEditedAt: member.niaSelfEditedAt,
    rankSelfEditedAt: member.rankSelfEditedAt,
    mshSelfEditedAt: member.mshSelfEditedAt,
  };

  const requested: Record<string, string> = {};
  const fields: string[] = [];

  if (parsed.data.email) {
    if (!isFieldLocked(locks, "email")) {
      return NextResponse.json(
        {
          error:
            "Email masih bisa diubah langsung 1x di profil — belum perlu pengajuan.",
        },
        { status: 400 },
      );
    }
    const email = normalizeEmail(parsed.data.email);
    if (!email) {
      return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
    }
    requested.email = email;
    fields.push("email");
  }

  if (parsed.data.nia) {
    if (!isFieldLocked(locks, "nia")) {
      return NextResponse.json(
        {
          error:
            "NIA masih bisa diubah langsung 1x di profil — belum perlu pengajuan.",
        },
        { status: 400 },
      );
    }
    const nia = normalizeNia(parsed.data.nia);
    if (!nia) {
      return NextResponse.json({ error: "NIA tidak valid" }, { status: 400 });
    }
    requested.nia = nia;
    fields.push("nia");
  }

  if (parsed.data.currentRank) {
    if (!isFieldLocked(locks, "currentRank")) {
      return NextResponse.json(
        {
          error:
            "Sabuk masih bisa diubah langsung 1x di profil — belum perlu pengajuan.",
        },
        { status: 400 },
      );
    }
    const rank = normalizeSelfRank(parsed.data.currentRank);
    if (!rank) {
      return NextResponse.json({ error: "Sabuk tidak valid" }, { status: 400 });
    }
    requested.currentRank = rank;
    fields.push("currentRank");
  }

  if (parsed.data.mshNumber) {
    if (!isFieldLocked(locks, "mshNumber")) {
      return NextResponse.json(
        {
          error:
            "No. MSH masih bisa diubah langsung 1x di profil — belum perlu pengajuan.",
        },
        { status: 400 },
      );
    }
    const rankForMsh = requested.currentRank || member.currentRank;
    if (!mshAllowedForRank(rankForMsh)) {
      return NextResponse.json(
        { error: "No. MSH hanya untuk sabuk Hitam (DAN)" },
        { status: 400 },
      );
    }
    const msh = normalizeMsh(parsed.data.mshNumber);
    if (!msh) {
      return NextResponse.json({ error: "No. MSH tidak valid" }, { status: 400 });
    }
    requested.mshNumber = msh;
    fields.push("mshNumber");
  }

  const pending = await prisma.verification.findFirst({
    where: {
      memberId: member.id,
      type: "PROFILE_CHANGE",
      status: "PENDING",
    },
  });
  if (pending) {
    return NextResponse.json(
      { error: "Masih ada pengajuan perubahan profil yang menunggu verifikasi" },
      { status: 400 },
    );
  }

  const created = await prisma.verification.create({
    data: {
      memberId: member.id,
      type: "PROFILE_CHANGE",
      data: JSON.stringify({
        fields,
        current: {
          email: member.user?.email ?? null,
          nia: member.nia,
          currentRank: member.currentRank,
          mshNumber: member.mshNumber,
        },
        requested,
        reason: parsed.data.reason,
        requestedAt: new Date().toISOString(),
      }),
      proofUrl: parsed.data.proofUrl || "—",
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ...created,
    message:
      "Pengajuan perubahan profil terkirim. Menunggu verifikasi pengurus.",
  });
}
