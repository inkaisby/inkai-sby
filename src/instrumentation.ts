import { setDefaultResultOrder } from "node:dns";

/** Windows/some ISPs resolve Supabase pooler to IPv6 first; Prisma then reports P1001. */
export async function register() {
  setDefaultResultOrder("ipv4first");
}
