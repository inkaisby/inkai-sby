/**
 * Seed dummy untuk dev lokal Docker — bukan dump produksi.
 *
 * Usage: npx tsx scripts/seed-local.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const PASSWORD = "inkai-local";

const ROLES = [
  "ADMINISTRATOR",
  "ADMIN_PUSAT",
  "ADMIN_PROVINCE",
  "ADMIN_BRANCH",
  "ADMIN_DOJO",
  "MEMBER",
  "PARENT",
] as const;

const PERMISSIONS = [
  { name: "Dashboard", slug: "dashboard" },
  { name: "Anggota", slug: "members" },
  { name: "Organisasi", slug: "organization" },
  { name: "Verifikasi", slug: "verification" },
  { name: "Event", slug: "events" },
  { name: "Store", slug: "store" },
  { name: "Library", slug: "library" },
  { name: "Broadcast", slug: "broadcast" },
  { name: "Settings", slug: "settings" },
] as const;

const prisma = new PrismaClient();

async function upsertRole(name: string) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertUser(opts: {
  email: string;
  fullName: string;
  roleName: string;
  passwordHash: string;
  managedProvinceId?: string | null;
  managedBranchId?: string | null;
  managedDojoId?: string | null;
}) {
  const role = await prisma.role.findUnique({ where: { name: opts.roleName } });
  if (!role) throw new Error(`Role ${opts.roleName} tidak ditemukan`);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: opts.email, mode: "insensitive" } },
    select: { id: true },
  });

  const data = {
    email: opts.email,
    fullName: opts.fullName,
    passwordHash: opts.passwordHash,
    isActive: true,
    isDeleted: false,
    managedProvinceId: opts.managedProvinceId ?? null,
    managedBranchId: opts.managedBranchId ?? null,
    managedDojoId: opts.managedDojoId ?? null,
  };

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        ...data,
        roles: { set: [{ id: role.id }] },
      },
      select: { id: true, email: true },
    });
  }

  return prisma.user.create({
    data: {
      ...data,
      roles: { connect: [{ id: role.id }] },
    },
    select: { id: true, email: true },
  });
}

async function main() {
  assertLocalDatabase();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  console.log("Seeding roles & permissions…");

  const roleMap: Record<string, { id: string }> = {};
  for (const name of ROLES) {
    roleMap[name] = await upsertRole(name);
  }

  const permMap: Record<string, { id: string }> = {};
  for (const p of PERMISSIONS) {
    permMap[p.slug] = await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { name: p.name },
      create: p,
    });
  }

  for (const p of Object.values(permMap)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleMap.ADMINISTRATOR.id,
          permissionId: p.id,
        },
      },
      update: {},
      create: {
        roleId: roleMap.ADMINISTRATOR.id,
        permissionId: p.id,
      },
    });
  }

  const basePerms = ["dashboard", "members", "organization", "events"];
  for (const roleName of ["ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN_DOJO"] as const) {
    for (const slug of basePerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleMap[roleName].id,
            permissionId: permMap[slug].id,
          },
        },
        update: {},
        create: {
          roleId: roleMap[roleName].id,
          permissionId: permMap[slug].id,
        },
      });
    }
  }

  console.log("Seeding organisasi Surabaya…");
  const province = await prisma.province.upsert({
    where: { name: "JAWA TIMUR" },
    update: {},
    create: { name: "JAWA TIMUR" },
  });

  const branch = await prisma.branch.upsert({
    where: {
      name_provinceId: {
        name: "Cabang Surabaya",
        provinceId: province.id,
      },
    },
    update: { city: "Surabaya" },
    create: {
      name: "Cabang Surabaya",
      city: "Surabaya",
      provinceId: province.id,
    },
  });

  const dojo = await prisma.dojo.upsert({
    where: {
      name_branchId: {
        name: "Ranting Contoh",
        branchId: branch.id,
      },
    },
    update: {
      address: "Jl. Kertajaya Indah 77, Surabaya",
      schedule: "Senin & Kamis 18:00",
    },
    create: {
      name: "Ranting Contoh",
      branchId: branch.id,
      address: "Jl. Kertajaya Indah 77, Surabaya",
      schedule: "Senin & Kamis 18:00",
    },
  });

  console.log("Seeding akun admin & anggota…");
  await upsertUser({
    email: "admin@local.inkai",
    fullName: "Admin Lokal",
    roleName: "ADMINISTRATOR",
    passwordHash,
  });

  await upsertUser({
    email: "cabang@local.inkai",
    fullName: "Admin Cabang Surabaya",
    roleName: "ADMIN_BRANCH",
    passwordHash,
    managedBranchId: branch.id,
  });

  await upsertUser({
    email: "ranting@local.inkai",
    fullName: "Admin Ranting Contoh",
    roleName: "ADMIN_DOJO",
    passwordHash,
    managedDojoId: dojo.id,
  });

  const memberUser = await upsertUser({
    email: "anggota@local.inkai",
    fullName: "Anggota Contoh",
    roleName: "MEMBER",
    passwordHash,
  });

  const existingMember = await prisma.member.findFirst({
    where: { userId: memberUser.id },
    select: { id: true },
  });

  if (!existingMember) {
    await prisma.member.create({
      data: {
        userId: memberUser.id,
        dojoId: dojo.id,
        fullName: "Anggota Contoh",
        nia: "LOCAL001",
        currentRank: "Putih (Kyu 10)",
        status: "Active",
      },
    });
  }

  const carouselCount = await prisma.newsCarousel.count();
  if (carouselCount === 0) {
    await prisma.newsCarousel.create({
      data: {
        title: "Dev lokal INKAI Surabaya",
        imageUrl:
          "https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&q=80&w=800",
        targetUrl: "/",
        order: 0,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        password: PASSWORD,
        accounts: [
          { email: "admin@local.inkai", role: "ADMINISTRATOR" },
          { email: "cabang@local.inkai", role: "ADMIN_BRANCH", branch: branch.name },
          { email: "ranting@local.inkai", role: "ADMIN_DOJO", dojo: dojo.name },
          { email: "anggota@local.inkai", role: "MEMBER", nia: "LOCAL001" },
        ],
        verify: {
          backend: "GET http://localhost:5001/health/db",
          portal: "GET http://localhost:3000/api/auth/health",
        },
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
