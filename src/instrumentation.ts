/** Windows/some ISPs resolve Supabase pooler to IPv6 first; Prisma then reports P1001. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
  }
}

