/**
 * One-way dump: produksi (read-only) → Postgres lokal :5433 (sanitize PII).
 *
 * Usage:
 *   PROD_DATABASE_URL="postgresql://..." npm run db:local:dump-from-prod
 *
 * Prasyarat: Docker Postgres up, DATABASE_URL lokal di .env.local (port 5433).
 * Setelah dump: jangan jalankan seed-local (menimpa data). Password semua user = inkai-local.
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase } from "./assert-local-database";

// Sumber prod = PROD_DATABASE_URL saja. Target tulis = DATABASE_URL dari .env.local (wajib menang).
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const LOCAL_PASSWORD = "inkai-local";
const EVENT_LIMIT = 50;
const BILLING_MONTHS = 12;
const ATTENDANCE_LIMIT = 8_000;
const BATCH = 200;

const LOCAL_TRUNCATE_SQL = `
TRUNCATE TABLE
  "StoreOrderItem",
  "StoreOrder",
  "Payment",
  "Billing",
  "EventRegistration",
  "EventCategory",
  "Attendance",
  "Verification",
  "MemberRank",
  "Member",
  "AppSetting",
  "UserSession",
  "AuditLog",
  "Message",
  "Notification",
  "_UserConversations",
  "Conversation",
  "_UserRoles",
  "User",
  "RolePermission",
  "Permission",
  "Role",
  "Event",
  "Dojo",
  "Branch",
  "Province"
RESTART IDENTITY CASCADE;
`;

function requireProdUrl(): string {
  const raw = process.env.PROD_DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "PROD_DATABASE_URL belum diset. Isi di shell atau .env.local (jangan commit). Contoh: connection string session/direct Supabase inkai-db.",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PROD_DATABASE_URL tidak valid");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1"
  ) {
    throw new Error(
      "PROD_DATABASE_URL tidak boleh mengarah ke localhost — itu target lokal, bukan sumber produksi.",
    );
  }
  return raw;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function createManyBatched(
  label: string,
  rows: unknown[],
  insert: (batch: any[]) => Promise<unknown>,
) {
  if (rows.length === 0) {
    console.log(`  ${label}: 0`);
    return;
  }
  for (const batch of chunk(rows, BATCH)) {
    await insert(batch);
  }
  console.log(`  ${label}: ${rows.length}`);
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 10);
}

function sanitizeNik(nik: string | null | undefined): string | null {
  if (!nik?.trim()) return null;
  return createHash("sha256").update(nik.trim()).digest("hex").slice(0, 16);
}

function stripUser(row: Record<string, unknown>, passwordHash: string) {
  const id = String(row.id);
  return {
    ...row,
    email: `local+${shortId(id)}@local.inkai`,
    phoneNumber: null,
    passwordHash,
    photoUrl: null,
    resetToken: null,
    resetTokenExpiry: null,
  };
}

/** Scalar Member fields for createMany — ignore extra/missing prod columns (schema drift). */
const MEMBER_SCALAR_KEYS = [
  "id",
  "userId",
  "dojoId",
  "nia",
  "mshNumber",
  "nik",
  "fullName",
  "gender",
  "birthPlace",
  "birthDate",
  "address",
  "currentRank",
  "status",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "allowEventWithoutDues",
  "monthlyDuesAmount",
  "parentUserId",
  "birthCertificateUrl",
  "bpjsCardUrl",
  "bpjsCardNumber",
  "bpjsOcrExtracted",
  "emailSelfEditedAt",
  "niaSelfEditedAt",
  "rankSelfEditedAt",
  "mshSelfEditedAt",
  "signatureUrl",
  "signatureUpdatedAt",
] as const;

function stripMember(row: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};
  for (const key of MEMBER_SCALAR_KEYS) {
    picked[key] = row[key] ?? null;
  }
  return {
    ...picked,
    nik: sanitizeNik(row.nik as string | null),
    birthCertificateUrl: null,
    bpjsCardUrl: null,
    bpjsCardNumber: null,
    bpjsOcrExtracted: null,
    signatureUrl: null,
    signatureUpdatedAt: null,
    address: row.address ? "[redacted]" : null,
    currentRank: (row.currentRank as string) ?? "Putih (Kyu 10)",
    status: (row.status as string) ?? "Active",
    isDeleted: Boolean(row.isDeleted ?? false),
    allowEventWithoutDues: Boolean(row.allowEventWithoutDues ?? false),
    monthlyDuesAmount: Number(row.monthlyDuesAmount ?? 50000),
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

/** Prod may lag Prisma schema (e.g. missing signatureUrl) — avoid findMany RETURNING all scalars. */
async function fetchProdMembers(prod: PrismaClient): Promise<Record<string, unknown>[]> {
  try {
    const rows = await prod.member.findMany();
    return rows as unknown as Record<string, unknown>[];
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code !== "P2022") throw error;
    console.warn(
      "  Member: kolom schema belum ada di prod — fallback SELECT * (sanitize tetap).",
    );
    return prod.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "Member"`,
    );
  }
}

async function main() {
  assertLocalDatabase();
  const prodUrl = requireProdUrl();

  console.log("\n→ Memastikan schema lokal (prisma db push)…");
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  const local = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  const prod = new PrismaClient({
    datasources: { db: { url: prodUrl } },
  });

  try {
    console.log("\n→ Cek koneksi produksi (read)…");
    const prodCount = await prod.member.count();
    console.log(`  Member di produksi: ${prodCount}`);
    if (prodCount === 0) {
      throw new Error("Produksi tidak punya Member — batalkan (URL salah / DB kosong).");
    }

    console.log("\n→ Truncate tabel target di lokal…");
    await local.$executeRawUnsafe(LOCAL_TRUNCATE_SQL);

    const passwordHash = await bcrypt.hash(LOCAL_PASSWORD, 10);
    const billingSince = new Date();
    billingSince.setMonth(billingSince.getMonth() - BILLING_MONTHS);

    console.log("\n→ Menyalin subset (sanitize)…");

    const provinces = await prod.province.findMany();
    await createManyBatched("Province", provinces, (b) =>
      local.province.createMany({ data: b }),
    );

    const branches = await prod.branch.findMany();
    await createManyBatched("Branch", branches, (b) =>
      local.branch.createMany({ data: b }),
    );

    const dojos = await prod.dojo.findMany();
    await createManyBatched("Dojo", dojos, (b) =>
      local.dojo.createMany({ data: b }),
    );

    const roles = await prod.role.findMany();
    await createManyBatched("Role", roles, (b) =>
      local.role.createMany({ data: b }),
    );

    const permissions = await prod.permission.findMany();
    await createManyBatched("Permission", permissions, (b) =>
      local.permission.createMany({ data: b }),
    );

    const rolePermissions = await prod.rolePermission.findMany();
    await createManyBatched("RolePermission", rolePermissions, (b) =>
      local.rolePermission.createMany({ data: b }),
    );

    const usersRaw = await prod.user.findMany();
    const users = usersRaw.map((u) =>
      stripUser(u as unknown as Record<string, unknown>, passwordHash),
    );
    await createManyBatched("User", users, (b) =>
      local.user.createMany({ data: b }),
    );

    const userRoles = await prod.$queryRaw<
      Array<{ A: string; B: string }>
    >`SELECT "A", "B" FROM "_UserRoles"`;
    await createManyBatched("UserRoles", userRoles, async (b) => {
      for (const row of b as Array<{ A: string; B: string }>) {
        await local.$executeRaw`
          INSERT INTO "_UserRoles" ("A", "B") VALUES (${row.A}, ${row.B})
          ON CONFLICT DO NOTHING
        `;
      }
    });

    const membersRaw = await fetchProdMembers(prod);
    const members = membersRaw.map((m) => stripMember(m));
    await createManyBatched("Member", members, (b) =>
      local.member.createMany({ data: b }),
    );

    const ranks = await prod.memberRank.findMany();
    await createManyBatched("MemberRank", ranks, (b) =>
      local.memberRank.createMany({ data: b }),
    );

    const events = await prod.event.findMany({
      orderBy: { startDate: "desc" },
      take: EVENT_LIMIT,
    });
    const eventIds = new Set(events.map((e) => e.id));
    await createManyBatched("Event", events, (b) =>
      local.event.createMany({ data: b }),
    );

    const categories = await prod.eventCategory.findMany({
      where: { eventId: { in: [...eventIds] } },
    });
    await createManyBatched("EventCategory", categories, (b) =>
      local.eventCategory.createMany({ data: b }),
    );

    const registrations = await prod.eventRegistration.findMany({
      where: { eventId: { in: [...eventIds] } },
    });
    await createManyBatched("EventRegistration", registrations, (b) =>
      local.eventRegistration.createMany({ data: b }),
    );

    const billings = await prod.billing.findMany({
      where: {
        OR: [
          { dueDate: { gte: billingSince } },
          { status: { not: "PAID" } },
        ],
      },
    });
    const billingIds = billings.map((b) => b.id);
    await createManyBatched("Billing", billings, (b) =>
      local.billing.createMany({ data: b }),
    );

    const payments = await prod.payment.findMany({
      where: { billingId: { in: billingIds } },
    });
    const paymentsClean = payments.map((p) => ({
      ...p,
      proofUrl: null,
    }));
    await createManyBatched("Payment", paymentsClean, (b) =>
      local.payment.createMany({ data: b }),
    );

    const settings = await prod.appSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: "member.lifecycle." } },
          { key: { startsWith: "ukt." } },
          { key: { startsWith: "ukt-" } },
          { key: { startsWith: "latber." } },
          { key: { startsWith: "latber-" } },
          { key: { startsWith: "pengurus." } },
        ],
      },
    });
    await createManyBatched("AppSetting", settings, (b) =>
      local.appSetting.createMany({ data: b }),
    );

    const attendances = await prod.attendance.findMany({
      where: {
        OR: [{ eventId: null }, { eventId: { in: [...eventIds] } }],
      },
      orderBy: { checkInAt: "desc" },
      take: ATTENDANCE_LIMIT,
    });
    await createManyBatched("Attendance", attendances, (b) =>
      local.attendance.createMany({ data: b }),
    );

    const localMembers = await local.member.count();
    const localUsers = await local.user.count();
    console.log("\nDump selesai.");
    console.log(`  Lokal Member=${localMembers}, User=${localUsers}`);
    console.log(`  Password semua user: ${LOCAL_PASSWORD}`);
    console.log("  Email contoh: local+<10hex>@local.inkai");
    console.log(
      "  Jangan jalankan db:local:seed setelah ini (akan menimpa data dump).",
    );
    console.log(
      "  Backend sibling :5001 harus memakai DATABASE_URL lokal yang sama.",
    );
  } finally {
    await Promise.all([local.$disconnect(), prod.$disconnect()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
