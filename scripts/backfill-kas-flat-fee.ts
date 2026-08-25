/**
 * Normalisasi KasEntry dan Billing (UKT & Latber): memotong sisa angka unik (amount % 1000) dan set uniqueTail = null.
 *
 * Usage (lokal Docker :5433):
 *   npx tsx scripts/backfill-kas-flat-fee.ts --dry-run
 *   npx tsx scripts/backfill-kas-flat-fee.ts --apply
 *
 * Produksi:
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-kas-flat-fee.ts --allow-remote --dry-run
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-kas-flat-fee.ts --allow-remote --apply
 */
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has("--dry-run") || !argSet.has("--apply");
const apply = argSet.has("--apply");
const allowRemote = argSet.has("--allow-remote");

if (!dryRun && !apply) {
  console.error("Usage: npx tsx scripts/backfill-kas-flat-fee.ts [--dry-run|--apply] [--allow-remote]");
  process.exit(1);
}

if (!allowRemote) {
  try {
    assertLocalDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("Untuk DB non-lokal (produksi), tambahkan --allow-remote.");
    process.exit(1);
  }
}

const prisma = new PrismaClient();

function flatThousands(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  const rounded = Math.round(val);
  return rounded - (rounded % 1000);
}

async function main() {
  // 1. KasEntry UKT & Latber
  const kasEntries = await prisma.kasEntry.findMany({
    where: {
      sourceType: { in: ["ukt", "latber"] },
    },
    select: {
      id: true,
      scopeType: true,
      scopeId: true,
      description: true,
      sourceType: true,
      sourceId: true,
      amountIn: true,
      amountOut: true,
    },
  });

  const kasToFix = kasEntries.filter(
    (k) => (k.amountIn > 0 && k.amountIn % 1000 !== 0) || (k.amountOut > 0 && k.amountOut % 1000 !== 0),
  );

  // 2. Billing UKT & Latber
  const billings = await prisma.billing.findMany({
    where: {
      isDeleted: false,
      OR: [
        { uniqueTail: { not: null } },
        {
          type: "EVENT",
          amount: { gt: 0 },
        },
      ],
    },
    select: {
      id: true,
      type: true,
      description: true,
      amount: true,
      baseFeeAmount: true,
      uniqueTail: true,
    },
  });

  const billingsToFix = billings.filter((b) => {
    const isUktOrLatber =
      b.type === "EVENT" ||
      /\bUKT\b/i.test(b.description ?? "") ||
      /\blatber\b/i.test(b.description ?? "") ||
      /latihan bersama/i.test(b.description ?? "");
    if (!isUktOrLatber) return false;
    return b.uniqueTail !== null || b.amount % 1000 !== 0;
  });

  // 3. Paid Latber Billings without KasEntry
  const paidLatberBillings = await prisma.billing.findMany({
    where: {
      isDeleted: false,
      status: { in: ["PAID", "SUCCESS"] },
      OR: [
        { type: "EVENT" },
        { description: { contains: "Latber", mode: "insensitive" } },
        { description: { contains: "Latihan Bersama", mode: "insensitive" } },
      ],
    },
    include: {
      member: { select: { id: true, dojoId: true, fullName: true, nia: true, dojo: { select: { id: true, branchId: true } } } },
    },
  });

  const missingLatberKas: Array<{
    billingId: string;
    dojoId: string;
    branchId: string | null;
    memberName: string;
    memberNia: string | null;
    periodTitle: string;
    createdAt: Date;
    feeAmount: number;
    komisiRanting: number;
  }> = [];

  for (const b of paidLatberBillings) {
    const isLatber =
      b.type === "EVENT" ||
      /latber/i.test(b.description ?? "") ||
      /latihan bersama/i.test(b.description ?? "");
    if (!isLatber || !b.member?.dojoId) continue;

    const existingRantingKas = await prisma.kasEntry.findFirst({
      where: { sourceType: "latber", sourceId: `${b.id}:ranting` },
    });
    if (!existingRantingKas) {
      missingLatberKas.push({
        billingId: b.id,
        dojoId: b.member.dojoId,
        branchId: b.member.dojo?.branchId ?? null,
        memberName: b.member.fullName,
        memberNia: b.member.nia,
        periodTitle: b.description || "Latihan Bersama",
        createdAt: b.createdAt,
        feeAmount: flatThousands(b.amount || 45000),
        komisiRanting: 5000,
      });
    }
  }

  const summary = {
    mode: apply ? "apply" : "dry-run",
    allowRemote,
    kasEntriesToFix: kasToFix.length,
    kasSample: kasToFix.slice(0, 10).map((k) => ({
      id: k.id,
      sourceType: k.sourceType,
      desc: k.description,
      amountIn: k.amountIn,
      fixedAmountIn: flatThousands(k.amountIn),
      amountOut: k.amountOut,
      fixedAmountOut: flatThousands(k.amountOut),
    })),
    billingsToFix: billingsToFix.length,
    billingSample: billingsToFix.slice(0, 10).map((b) => ({
      id: b.id,
      desc: b.description,
      amount: b.amount,
      fixedAmount: flatThousands(b.amount),
      uniqueTail: b.uniqueTail,
    })),
    missingLatberKasEntries: missingLatberKas.length,
    missingLatberSample: missingLatberKas.slice(0, 10),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("\nDry-run saja. Jalankan ulang dengan --apply untuk mengeksekusi perubahan.");
    return;
  }

  // Apply changes
  let kasUpdatedCount = 0;
  for (const k of kasToFix) {
    await prisma.kasEntry.update({
      where: { id: k.id },
      data: {
        amountIn: flatThousands(k.amountIn),
        amountOut: flatThousands(k.amountOut),
      },
    });
    kasUpdatedCount++;
  }

  let billingUpdatedCount = 0;
  for (const b of billingsToFix) {
    const flatAmount = flatThousands(b.amount);
    await prisma.billing.update({
      where: { id: b.id },
      data: {
        amount: flatAmount,
        baseFeeAmount: flatAmount,
        uniqueTail: null,
      },
    });
    billingUpdatedCount++;
  }

  let latberKasCreatedCount = 0;
  for (const item of missingLatberKas) {
    const nia = item.memberNia ? ` (${item.memberNia})` : "";
    const desc = `${item.memberName}${nia}`;
    const kegiatan = item.periodTitle.startsWith("Latber ")
      ? item.periodTitle
      : `Latber ${item.periodTitle}`;
    const txnDate = item.createdAt;

    // Ranting Kas (Komisi 5.000)
    await prisma.kasEntry.create({
      data: {
        scopeType: "dojo",
        scopeId: item.dojoId,
        txnDate,
        description: `Komisi ranting — ${desc}`,
        kegiatan,
        amountIn: item.komisiRanting,
        amountOut: 0,
        sourceType: "latber",
        sourceId: `${item.billingId}:ranting`,
        sourceHref: "/admin/latber",
      },
    });
    latberKasCreatedCount++;

    // Cabang Kas (Nett 40.000)
    if (item.branchId) {
      await prisma.kasEntry.create({
        data: {
          scopeType: "branch",
          scopeId: item.branchId,
          txnDate,
          description: desc,
          kegiatan,
          amountIn: Math.max(0, item.feeAmount - item.komisiRanting),
          amountOut: 0,
          sourceType: "latber",
          sourceId: `${item.billingId}:cabang`,
          sourceHref: "/admin/latber",
        },
      });
      latberKasCreatedCount++;
    }
  }

  console.log(
    JSON.stringify(
      {
        kasUpdated: kasUpdatedCount,
        billingUpdated: billingUpdatedCount,
        latberKasCreated: latberKasCreatedCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
