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

const prisma = new PrismaClient();

function emailForNia(nia: string) {
  const compact = nia.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "member";
  return `nia.${compact}@members.inkaisby.local`;
}

async function main() {
  const member = await prisma.member.findFirst({
    where: {
      isDeleted: false,
      nia: { equals: niaArg, mode: "insensitive" },
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
    throw new Error(`Member dengan NIA ${niaArg} tidak ditemukan`);
  }

  const nia = (member.nia || niaArg).trim();
  const passwordHash = await bcrypt.hash(nia, 10);
  let userId = member.userId;
  let email = member.user?.email || null;

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
      },
      select: { id: true, email: true },
    });
    userId = created.id;
    email = created.email;
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        memberId: member.id,
        fullName: member.fullName,
        nia,
        userId,
        email,
        createdAccount: Boolean(!member.userId && createAccount),
        message: "passwordHash set to bcrypt(NIA); login dengan NIA / NIA",
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
