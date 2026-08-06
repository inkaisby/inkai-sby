/**
 * Set passwordHash anggota = bcrypt(NIA) untuk login default NIA/NIA.
 * Jika belum punya akun: buat User + tautkan (flag --create-account).
 *
 * Usage:
 *   npx tsx scripts/set-member-nia-password.ts 26.37609
 *   npx tsx scripts/set-member-nia-password.ts 26.37609 --create-account
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2).filter(Boolean);
const createAccount = args.includes("--create-account");
const niaArg = args.find((a) => !a.startsWith("--"))?.trim();

if (!niaArg) {
  console.error(
    "Usage: npx tsx scripts/set-member-nia-password.ts <NIA> [--create-account]",
  );
  process.exit(1);
}

const niaInput: string = niaArg;

const prisma = new PrismaClient();

/** Match Inkai backend register/change-password cost. */
const BCRYPT_ROUNDS = 12;

function emailForNia(nia: string) {
  const compact = nia.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "member";
  return `nia.${compact}@members.inkaisby.local`;
}

async function ensureMemberRole(userId: string) {
  const role = await prisma.role.upsert({
    where: { name: "MEMBER" },
    create: { name: "MEMBER" },
    update: {},
    select: { id: true, name: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      roles: { connect: { id: role.id } },
    },
  });
}

async function main() {
  const member = await prisma.member.findFirst({
    where: {
      isDeleted: false,
      nia: { equals: niaInput, mode: "insensitive" },
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
      userId: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!member) {
    throw new Error(`Member dengan NIA ${niaInput} tidak ditemukan`);
  }

  const nia = (member.nia || niaInput).trim();
  const passwordHash = await bcrypt.hash(nia, BCRYPT_ROUNDS);
  let userId = member.userId;
  let email = member.user?.email || null;
  let createdAccount = false;

  if (!userId) {
    if (!createAccount) {
      throw new Error(
        `Member ${member.fullName} (${nia}) belum punya akun login. Jalankan ulang dengan --create-account.`,
      );
    }

    email = emailForNia(nia);
    const clash = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (clash) {
      throw new Error(`Email cadangan ${email} sudah dipakai user lain`);
    }

    const created = await prisma.user.create({
      data: {
        email,
        fullName: member.fullName,
        passwordHash,
        isActive: true,
        member: { connect: { id: member.id } },
        roles: {
          connectOrCreate: {
            where: { name: "MEMBER" },
            create: { name: "MEMBER" },
          },
        },
      },
      select: { id: true, email: true },
    });
    userId = created.id;
    email = created.email;
    createdAccount = true;
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, isActive: true },
    });
    await ensureMemberRole(userId);
  }

  // Verify Inkai-style lookup: User → member.nia
  const linked = await prisma.user.findFirst({
    where: {
      id: userId,
      member: { nia: { equals: nia, mode: "insensitive" } },
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      roles: { select: { name: true } },
      member: { select: { id: true, nia: true, userId: true } },
    },
  });
  if (!linked?.member?.userId) {
    throw new Error(
      `Relasi User↔Member gagal diverifikasi untuk NIA ${nia} (userId=${userId})`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        memberId: member.id,
        fullName: member.fullName,
        nia,
        userId,
        email: linked.email,
        roles: linked.roles.map((r) => r.name),
        createdAccount,
        message:
          "passwordHash set to bcrypt(NIA,12); MEMBER role ensured; login dengan NIA / NIA",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
