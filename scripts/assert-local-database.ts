/**
 * Guard: tolak prisma db push / seed / reset ke database cloud atau non-lokal.
 * Wajib host 127.0.0.1/localhost dan port 5433 (Docker compose inkai-sby).
 */
import { config } from "dotenv";
import { resolve } from "path";

// .env dulu, lalu .env.local override — target lokal wajib menang atas env process/cloud.
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const LOCAL_PORT = "5433";

function parseDatabaseUrl(raw: string | undefined, label: string): URL {
  if (!raw?.trim()) {
    throw new Error(
      `${label} belum diset. Salin blok Lokal Docker dari .env.example ke .env.local`,
    );
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`${label} tidak valid: ${raw}`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`${label} harus postgresql:// — dapat: ${url.protocol}`);
  }
  return url;
}

function assertLocalUrl(url: URL, label: string): void {
  const host = url.hostname.toLowerCase();
  const haystack = `${url.hostname}${url.pathname}${url.search}`.toLowerCase();

  if (haystack.includes("supabase.com") || haystack.includes("supabase.co")) {
    throw new Error(
      `${label} mengarah ke Supabase. Hentikan — gunakan Postgres Docker lokal (port ${LOCAL_PORT}).`,
    );
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `${label} host "${host}" bukan lokal. Hanya 127.0.0.1 / localhost / ::1 diizinkan.`,
    );
  }

  const port = url.port || "5432";
  if (port !== LOCAL_PORT) {
    throw new Error(
      `${label} port ${port} — untuk dev lokal inkai-sby wajib ${LOCAL_PORT} (docker-compose.yml).`,
    );
  }
}

export function assertLocalDatabase(): void {
  const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL, "DATABASE_URL");
  assertLocalUrl(databaseUrl, "DATABASE_URL");

  const directUrl = process.env.DIRECT_URL?.trim();
  if (directUrl) {
    assertLocalUrl(parseDatabaseUrl(directUrl, "DIRECT_URL"), "DIRECT_URL");
  }
}

if (process.argv[1]?.includes("assert-local-database")) {
  try {
    assertLocalDatabase();
    console.log("OK — DATABASE_URL lokal aman (127.0.0.1:5433, bukan cloud).");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
