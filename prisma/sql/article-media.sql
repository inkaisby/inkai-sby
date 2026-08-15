-- ArticleEntry.media: galeri foto + video YouTube (JSON array)
-- Terapkan di Postgres produksi (Supabase) sebelum/bersamaan deploy.
-- Lokal: npm run db:local:bootstrap (setelah Docker + DATABASE_URL port 5433).

ALTER TABLE "ArticleEntry"
  ADD COLUMN IF NOT EXISTS "media" JSONB;
