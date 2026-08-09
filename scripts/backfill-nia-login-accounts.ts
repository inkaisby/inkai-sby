/**
 * Backfill: buat akun login untuk semua anggota ber-NIA tanpa User.
 *
 * Usage:
 *   npx tsx scripts/backfill-nia-login-accounts.ts --dry-run
 *   npx tsx scripts/backfill-nia-login-accounts.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { provisionMemberNiaLogin } from "../src/lib/member-nia-login";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--apply");
const apply = args.has("--apply");

if (!dryRun && !apply) {
  console.error(
    "Usage: npx tsx scripts/backfill-nia-login-accounts.ts [--dry-run|--apply]",
  );
  process.exit(1);
}

const CHUNK = 40;
const prisma = new PrismaClient();

async function main() {
  const members = await prisma.member.findMany({
    where: {
      isDeleted: false,
      nia: { not: null },
      userId: null,
    },
    select: {
      id: true,
      fullName: true,
      nia: true,
    },
    orderBy: { nia: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        total: members.length,
        sample: members.slice(0, 15).map((m) => ({
          nia: m.nia,
          fullName: m.fullName,
          id: m.id,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      `[dry-run] ${members.length} anggota akan diprovision. Jalankan dengan --apply untuk menulis.`,
    );
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ nia: string | null; fullName: string; reason: string }> =
    [];

  for (let i = 0; i < members.length; i += CHUNK) {
    const chunk = members.slice(i, i + CHUNK);
    for (const m of chunk) {
      const result = await provisionMemberNiaLogin(m.id);
      if (result.status === "created") {
        created += 1;
      } else if (result.status === "skipped") {
        skipped += 1;
      } else {
        failed += 1;
        failures.push({
          nia: m.nia,
          fullName: m.fullName,
          reason: result.reason,
        });
      }
    }
    console.log(
      `[chunk] ${Math.min(i + CHUNK, members.length)}/${members.length} created=${created} skipped=${skipped} failed=${failed}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: failed === 0,
        created,
        skipped,
        failed,
        failures: failures.slice(0, 50),
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
