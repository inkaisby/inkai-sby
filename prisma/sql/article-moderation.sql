-- Article moderation columns (ops / production). Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ArticleEntry"
  ADD COLUMN IF NOT EXISTS "status" "ArticleStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS "authorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorMemberId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorDojoId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorName" TEXT,
  ADD COLUMN IF NOT EXISTS "authorDojoName" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;

UPDATE "ArticleEntry"
SET "status" = 'PUBLISHED'
WHERE "status" IS NULL OR "status"::text = '';

CREATE INDEX IF NOT EXISTS "ArticleEntry_status_createdAt_idx"
  ON "ArticleEntry"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ArticleEntry_authorUserId_idx"
  ON "ArticleEntry"("authorUserId");

CREATE INDEX IF NOT EXISTS "ArticleEntry_authorDojoId_status_idx"
  ON "ArticleEntry"("authorDojoId", "status");
