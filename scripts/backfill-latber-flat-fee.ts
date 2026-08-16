/**
 * Normalisasi billing Latber periode aktif: amount/baseFeeAmount = 45000, uniqueTail = null.
 *
 * Usage (lokal Docker :5433):
 *   npx tsx scripts/backfill-latber-flat-fee.ts --dry-run
 *   npx tsx scripts/backfill-latber-flat-fee.ts --apply
 *
 * Produksi (setelah deploy kode flat fee):
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-latber-flat-fee.ts --allow-remote --dry-run
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/backfill-latber-flat-fee.ts --allow-remote --apply
 *
 * Opsional: --event-id=<uuid> untuk satu periode.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_LATBER_FEE,
  isLatberEventTitle,
  latberPeriodMetaKey,
  parseLatberPeriodMetaValue,
} from "../src/lib/latber";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has("--dry-run") || !argSet.has("--apply");
const apply = argSet.has("--apply");
const allowRemote = argSet.has("--allow-remote");
const eventIdArg = args.find((a) => a.startsWith("--event-id="))?.slice("--event-id=".length);

if (!dryRun && !apply) {
  console.error(
    "Usage: npx tsx scripts/backfill-latber-flat-fee.ts [--dry-run|--apply] [--allow-remote] [--event-id=uuid]",
  );
  process.exit(1);
}

if (!allowRemote) {
  try {
    assertLocalDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "Untuk DB non-lokal (produksi), tambahkan --allow-remote setelah deploy kode flat fee.",
    );
    process.exit(1);
  }
}

const prisma = new PrismaClient();
const TARGET = DEFAULT_LATBER_FEE;

async function main() {
  const events = await prisma.event.findMany({
    where: {
      isDeleted: false,
      ...(eventIdArg ? { id: eventIdArg } : {}),
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { startDate: "desc" },
  });

  const latberEvents = events.filter((e) => isLatberEventTitle(e.title));
  if (latberEvents.length === 0) {
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", events: 0, message: "Tidak ada event Latber" }, null, 2));
    return;
  }

  const metaKeys = latberEvents.map((e) => latberPeriodMetaKey(e.id));
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: metaKeys } },
    select: { key: true, value: true },
  });
  const metaByEventId = new Map<string, ReturnType<typeof parseLatberPeriodMetaValue>>();
  for (const row of settings) {
    const id = row.key.slice("latber-period-meta:".length);
    metaByEventId.set(id, parseLatberPeriodMetaValue(row.value));
  }

  const activeEvents = latberEvents.filter((e) => {
    const meta = metaByEventId.get(e.id);
    if (!meta) {
      // Tanpa meta lokal: anggap kandidat aktif (konsisten findActiveLatberPeriod bila archived/locked belum di-set).
      return true;
    }
    return !meta.archived && !meta.locked;
  });

  if (eventIdArg && activeEvents.length === 0) {
    console.error(`Event ${eventIdArg} tidak aktif / tidak ditemukan sebagai Latber non-arsip.`);
    process.exit(1);
  }

  const activeIds = activeEvents.map((e) => e.id);
  const regs = await prisma.eventRegistration.findMany({
    where: {
      eventId: { in: activeIds },
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: { id: true, eventId: true },
  });
  const regIds = regs.map((r) => r.id);

  const billings =
    regIds.length === 0
      ? []
      : await prisma.billing.findMany({
          where: {
            registrationId: { in: regIds },
            isDeleted: false,
            status: { notIn: ["CANCELLED"] },
            OR: [
              { amount: { not: TARGET } },
              { baseFeeAmount: { not: TARGET } },
              { uniqueTail: { not: null } },
              { baseFeeAmount: null },
            ],
          },
          select: {
            id: true,
            registrationId: true,
            amount: true,
            baseFeeAmount: true,
            uniqueTail: true,
            status: true,
          },
        });

  const byEvent = new Map<string, number>();
  for (const b of billings) {
    const reg = regs.find((r) => r.id === b.registrationId);
    if (!reg) continue;
    byEvent.set(reg.eventId, (byEvent.get(reg.eventId) ?? 0) + 1);
  }

  const preview = {
    mode: apply ? "apply" : "dry-run",
    targetFee: TARGET,
    allowRemote,
    activeEvents: activeEvents.map((e) => ({
      id: e.id,
      title: e.title,
      billingToFix: byEvent.get(e.id) ?? 0,
      archivedLocal: metaByEventId.get(e.id)?.archived ?? null,
    })),
    billingCount: billings.length,
    sample: billings.slice(0, 20).map((b) => ({
      id: b.id,
      status: b.status,
      amount: b.amount,
      baseFeeAmount: b.baseFeeAmount,
      uniqueTail: b.uniqueTail,
    })),
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!apply) {
    console.log("\nDry-run saja. Jalankan ulang dengan --apply untuk menulis.");
    return;
  }

  if (billings.length === 0) {
    console.log("Tidak ada billing yang perlu dinormalisasi.");
    return;
  }

  const result = await prisma.billing.updateMany({
    where: { id: { in: billings.map((b) => b.id) } },
    data: {
      amount: TARGET,
      baseFeeAmount: TARGET,
      uniqueTail: null,
    },
  });

  const remaining = await prisma.billing.count({
    where: {
      registrationId: { in: regIds },
      isDeleted: false,
      status: { notIn: ["CANCELLED"] },
      OR: [
        { amount: { not: TARGET } },
        { uniqueTail: { not: null } },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        updated: result.count,
        remainingNonFlatOnActive: remaining,
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
