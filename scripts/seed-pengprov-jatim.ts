/**
 * Data migration: akun Admin Provinsi (Pengprov) Jawa Timur.
 *
 * Usage: npx tsx scripts/seed-pengprov-jatim.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const EMAIL = "pengprovjatim@gmail.com";
const PASSWORD = "123456";
const FULL_NAME = "Pengprov Jawa Timur";
const PROVINCE_NAME = "JAWA TIMUR";
const ROLE_NAME = "ADMIN_PROVINCE";

const prisma = new PrismaClient();

async function main() {
  const province = await prisma.province.findFirst({
    where: {
      isDeleted: false,
      name: { equals: PROVINCE_NAME, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (!province) {
    throw new Error(`Provinsi ${PROVINCE_NAME} tidak ditemukan`);
  }

  const role = await prisma.role.findUnique({
    where: { name: ROLE_NAME },
    select: { id: true, name: true },
  });
  if (!role) {
    throw new Error(`Role ${ROLE_NAME} tidak ditemukan`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });

  let userId: string;

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: EMAIL,
        fullName: FULL_NAME,
        passwordHash,
        isActive: true,
        isDeleted: false,
        managedProvinceId: province.id,
        managedBranchId: null,
        managedDojoId: null,
        roles: { set: [{ id: role.id }] },
      },
    });
    userId = existing.id;
    console.log("Updated existing user:", EMAIL);
  } else {
    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        fullName: FULL_NAME,
        passwordHash,
        isActive: true,
        isDeleted: false,
        managedProvinceId: province.id,
        roles: { connect: [{ id: role.id }] },
      },
      select: { id: true },
    });
    userId = created.id;
    console.log("Created user:", EMAIL);
  }

  const verify = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
      managedProvinceId: true,
      roles: { select: { name: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        province: province.name,
        provinceId: province.id,
        user: verify,
        login: { email: EMAIL, password: PASSWORD },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
