/**
 * Script rekonsiliasi entri kas Latber:
 * Membersihkan KasEntry otomatis (sourceType: "latber") yang berasal dari billing yatim,
 * pendaftaran dibatalkan/ditolak/dihapus, atau billing duplikat.
 *
 * Usage (lokal Docker :5433):
 *   npx tsx scripts/reconcile-latber-kas.ts --dry-run
 *   npx tsx scripts/reconcile-latber-kas.ts --apply
 *
 * Produksi (tambahkan --allow-remote):
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/reconcile-latber-kas.ts --allow-remote --dry-run
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/reconcile-latber-kas.ts --allow-remote --apply
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
  console.error(
    "Usage: npx tsx scripts/reconcile-latber-kas.ts [--dry-run|--apply] [--allow-remote]",
  );
  process.exit(1);
}

if (!allowRemote) {
  try {
    assertLocalDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "Untuk DB non-lokal (produksi), tambahkan --allow-remote.",
    );
    process.exit(1);
  }
}

const prisma = new PrismaClient();

async function main() {
  const paidLatberBillings = await prisma.billing.findMany({
    where: {
      isDeleted: false,
      status: { in: ["PAID", "SUCCESS"] },
      OR: [
        { description: { contains: "Latber", mode: "insensitive" } },
        { description: { contains: "Latihan Bersama", mode: "insensitive" } },
      ],
    },
    include: {
      registration: { select: { id: true, status: true, eventId: true } },
      member: { select: { id: true, isDeleted: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const existingLatberKasEntries = await prisma.kasEntry.findMany({
    where: { sourceType: "latber" },
    select: { id: true, sourceId: true, scopeType: true, scopeId: true, description: true },
  });

  const validSourceIds = new Set<string>();
  const seenRegIds = new Set<string>();

  for (const b of paidLatberBillings) {
    const desc = b.description ?? "";
    const isLatber =
      (/latber/i.test(desc) || /latihan bersama/i.test(desc)) &&
      !/^UKT\b/i.test(desc);
    if (!isLatber || !b.member?.id || b.member.isDeleted) continue;

    if (b.registration) {
      if (["REJECTED", "CANCELLED"].includes(b.registration.status)) {
        continue;
      }
      if (seenRegIds.has(b.registration.id)) {
        continue;
      }
      seenRegIds.add(b.registration.id);
    }

    validSourceIds.add(`${b.id}:ranting`);
    validSourceIds.add(`${b.id}:cabang`);
  }

  const staleEntries = existingLatberKasEntries.filter(
    (e) => !validSourceIds.has(e.sourceId),
  );

  console.log(`[RECONCILE LATBER KAS] Total entri kas latber otomatis: ${existingLatberKasEntries.length}`);
  console.log(`[RECONCILE LATBER KAS] Entri kas valid: ${validSourceIds.size / 2}`);
  console.log(`[RECONCILE LATBER KAS] Entri kas stale/yatim yang ditemukan: ${staleEntries.length}`);

  if (staleEntries.length > 0) {
    console.log("Contoh entri stale/yatim:", staleEntries.slice(0, 5));
    if (apply) {
      const deleted = await prisma.kasEntry.deleteMany({
        where: { id: { in: staleEntries.map((e) => e.id) } },
      });
      console.log(`[RECONCILE LATBER KAS] Selesai menghapus ${deleted.count} entri kas stale.`);
    } else {
      console.log("[RECONCILE LATBER KAS] (Dry-run mode) Tidak ada data yang diubah.");
    }
  } else {
    console.log("[RECONCILE LATBER KAS] Semua entri kas Latber sudah bersih & valid.");
  }
}

main()
  .catch((e) => {
    console.error("[RECONCILE LATBER KAS ERROR]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
