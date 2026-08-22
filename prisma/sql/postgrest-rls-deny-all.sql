-- Hard deny PostgREST / Supabase Data API on public schema.
-- Portal + backend use Prisma via DATABASE_URL (postgres superuser) — bypasses RLS.
-- Upload uses SUPABASE_SECRET_KEY (service_role) server-side — bypasses RLS.
-- Safe to re-run. Apply to production DB (Vercel DATABASE_URL), not only inkai-db copy.
--
-- Prefer also: Supabase Dashboard → Settings → API → disable Data API if unused.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO postgres, service_role;
