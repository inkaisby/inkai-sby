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
import {
  NIA_LOGIN_BCRYPT_ROUNDS,
  provisionMemberNiaLogin,
} from "../src/lib/member-nia-login";
import { normalizeNiaKey } from "../src/lib/security/password";

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

  if (!member.userId) {
    if (!createAccount) {
      throw new Error(
        `Member ${member.fullName} (${nia}) belum punya akun login. Jalankan ulang dengan --create-account.`,
      );
    }
    const result = await provisionMemberNiaLogin(member.id);
    if (result.status === "failed") {
      throw new Error(result.reason);
    }
    if (result.status === "skipped" && result.reason !== "already_has_user") {
      throw new Error(`Provision skipped: ${result.reason}`);
    }
    const email =
      result.status === "created"
        ? result.email
        : result.status === "skipped"
          ? result.email
          : null;
    const userId =
      result.status === "created"
        ? result.userId
        : result.status === "skipped"
          ? result.userId
          : null;
    console.log(
      JSON.stringify(
        {
          ok: true,
          memberId: member.id,
          fullName: member.fullName,
          nia: result.status === "created" ? result.nia : nia,
          userId,
          email,
          createdAccount: result.status === "created",
          message:
            "passwordHash set to bcrypt(NIA,12); MEMBER role ensured; login dengan NIA / NIA",
        },
        null,
        2,
      ),
    );
    return;
  }

  const passwordHash = await bcrypt.hash(
    normalizeNiaKey(nia),
    NIA_LOGIN_BCRYPT_ROUNDS,
  );
  await prisma.user.update({
    where: { id: member.userId },
    data: { passwordHash, isActive: true },
  });
  const role = await prisma.role.upsert({
    where: { name: "MEMBER" },
    create: { name: "MEMBER" },
    update: {},
    select: { id: true },
  });
  await prisma.user.update({
    where: { id: member.userId },
    data: { roles: { connect: { id: role.id } } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        memberId: member.id,
        fullName: member.fullName,
        nia,
        userId: member.userId,
        email: member.user?.email ?? null,
        createdAccount: false,
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
