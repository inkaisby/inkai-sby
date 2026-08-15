-- ArticleReaction: reaksi emoji publik per perangkat (visitor cookie)
-- Terapkan di Postgres produksi (Supabase) sebelum/bersamaan deploy.
-- Lokal: npm run db:local:bootstrap (setelah Docker + DATABASE_URL port 5433).

CREATE TABLE IF NOT EXISTS "ArticleReaction" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArticleReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleReaction_articleId_visitorId_key"
  ON "ArticleReaction"("articleId", "visitorId");

CREATE INDEX IF NOT EXISTS "ArticleReaction_articleId_emoji_idx"
  ON "ArticleReaction"("articleId", "emoji");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ArticleReaction_articleId_fkey'
  ) THEN
    ALTER TABLE "ArticleReaction"
      ADD CONSTRAINT "ArticleReaction_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "ArticleEntry"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
