/**
 * Rekonsiliasi kas Latber ranting Gading: peserta PAID tanpa jurnal komisi.
 *
 * Lokal:
 *   npx tsx scripts/kas-backfill-latber-gading.ts --dry-run
 *   npx tsx scripts/kas-backfill-latber-gading.ts --apply
 *
 * Produksi:
 *   DATABASE_URL=... npx tsx scripts/kas-backfill-latber-gading.ts --allow-remote --dry-run
 *   DATABASE_URL=... npx tsx scripts/kas-backfill-latber-gading.ts --allow-remote --apply
 */
import { config } from "dotenv";
import { resolve } from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  DEFAULT_LATBER_KOMISI_RANTING,
  isLatberEventTitle,
} from "../src/lib/latber";
import { formatLatberKasKegiatan } from "../src/lib/kas-kegiatan";
import { parseYmd, ymdWib } from "../src/lib/kas";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const argSet = new Set(args);
const apply = argSet.has("--apply");
const allowRemote = argSet.has("--allow-remote");
const dojoNeedle =
  args.find((a) => a.startsWith("--dojo="))?.slice("--dojo=".length) ?? "gading";

if (allowRemote) {
  config({ path: resolve(process.cwd(), ".env"), override: true });
}

if (!allowRemote) {
  try {
    assertLocalDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const prisma = new PrismaClient();

async function insertKas(opts: {
  scopeType: "branch" | "dojo";
  scopeId: string;
  txnDate: string;
  description: string;
  kegiatan: string;
  amountIn: number;
  sourceId: string;
}): Promise<boolean> {
  try {
    await prisma.kasEntry.create({
      data: {
        scopeType: opts.scopeType,
        scopeId: opts.scopeId,
        txnDate: parseYmd(opts.txnDate),
        description: opts.description.slice(0, 500),
        kegiatan: opts.kegiatan.slice(0, 120),
        amountIn: opts.amountIn,
        amountOut: 0,
        sourceType: "latber",
        sourceId: opts.sourceId.slice(0, 180),
        sourceHref: "/admin/latber",
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

async function main() {
  const dojos = await prisma.dojo.findMany({
    where: {
      isDeleted: false,
      name: { contains: dojoNeedle, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (dojos.length === 0) {
    throw new Error(`Ranting "${dojoNeedle}" tidak ditemukan`);
  }

  const dojoIds = dojos.map((d) => d.id);
  const regs = await prisma.eventRegistration.findMany({
    where: {
      member: { dojoId: { in: dojoIds } },
      event: { isDeleted: false },
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: {
      id: true,
      member: { select: { fullName: true, nia: true, dojoId: true } },
      event: { select: { title: true } },
    },
  });

  const latberRegs = regs.filter((r) => isLatberEventTitle(r.event.title));
  const regIds = latberRegs.map((r) => r.id);
  const billings = await prisma.billing.findMany({
    where: {
      registrationId: { in: regIds },
      isDeleted: false,
      status: { in: ["PAID", "SUCCESS"] },
    },
    select: {
      id: true,
      amount: true,
      registrationId: true,
      updatedAt: true,
      payment: { select: { paidAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const billingByReg = new Map<string, (typeof billings)[number]>();
  for (const b of billings) {
    if (b.registrationId && !billingByReg.has(b.registrationId)) {
      billingByReg.set(b.registrationId, b);
    }
  }

  const paid = latberRegs.filter((r) => billingByReg.has(r.id));

  const missing: Array<{
    registrationId: string;
    billingId: string;
    name: string;
    nia: string | null;
    dojoId: string;
    periodTitle: string;
    amount: number;
    txnDate: string;
  }> = [];

  for (const row of paid) {
    const billing = billingByReg.get(row.id)!;
    const dojoId = row.member.dojoId;
    if (!dojoId) continue;
    const kas = await prisma.kasEntry.findFirst({
      where: {
        sourceType: "latber",
        sourceId: `${billing.id}:ranting`,
        scopeType: "dojo",
        scopeId: dojoId,
      },
      select: { id: true },
    });
    if (kas) continue;
    const paidAt = billing.payment?.paidAt ?? billing.updatedAt;
    missing.push({
      registrationId: row.id,
      billingId: billing.id,
      name: row.member.fullName,
      nia: row.member.nia,
      dojoId,
      periodTitle: row.event.title,
      amount: billing.amount,
      txnDate: ymdWib(paidAt),
    });
  }

  let posted = 0;
  if (apply) {
    for (const row of missing) {
      const dojo = await prisma.dojo.findFirst({
        where: { id: row.dojoId, isDeleted: false },
        select: { id: true, branchId: true },
      });
      const nia = row.nia ? ` (${row.nia})` : "";
      const desc = `${row.name}${nia}`;
      const kegiatan = formatLatberKasKegiatan(row.periodTitle);
      const fee = Math.max(0, Math.round(row.amount));
      const komisi = Math.min(fee, DEFAULT_LATBER_KOMISI_RANTING);
      const nett = Math.max(0, fee - komisi);

      if (dojo?.branchId && nett > 0) {
        const created = await insertKas({
          scopeType: "branch",
          scopeId: dojo.branchId,
          txnDate: row.txnDate,
          description: desc,
          kegiatan,
          amountIn: nett,
          sourceId: `${row.billingId}:cabang`,
        });
        if (created) posted += 1;
      }
      if (dojo?.id && komisi > 0) {
        const created = await insertKas({
          scopeType: "dojo",
          scopeId: dojo.id,
          txnDate: row.txnDate,
          description: `Komisi ranting — ${desc}`,
          kegiatan,
          amountIn: komisi,
          sourceId: `${row.billingId}:ranting`,
        });
        if (created) posted += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        dojos: dojos.map((d) => ({ id: d.id, name: d.name })),
        paidLatber: paid.length,
        missingRantingKas: missing.length,
        posted,
        missing,
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
