/**
 * Bootstrap DB lokal: guard URL → prisma db push → generate → seed-local.
 *
 * Usage: npm run db:local:bootstrap
 */
import { config } from "dotenv";
import { execSync } from "child_process";
import { resolve } from "path";
import { assertLocalDatabase } from "./assert-local-database";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function run(cmd: string, label: string) {
  console.log(`\n→ ${label}…`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

try {
  assertLocalDatabase();
  run("npx prisma db push", "Push schema (prisma db push)");
  run("npx prisma generate", "Generate Prisma client");
  run("npx tsx scripts/seed-local.ts", "Seed data lokal");
  console.log("\nBootstrap selesai. Verifikasi:");
  console.log("  1. inkai-backend di :5001 → GET http://localhost:5001/health/db");
  console.log("  2. portal di :3000 → GET http://localhost:3000/api/auth/health");
  console.log("  3. Login seed (lihat output seed-local.ts)");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
