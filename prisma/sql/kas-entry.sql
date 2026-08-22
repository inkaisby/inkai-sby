-- KasEntry + KasPeriodLock (portal inkai-sby)
-- Apply ke DB produksi app Vercel (ref ztrryuhhdoqdglajukuw), bukan inkai-db/mzmdh…
-- Supabase SQL Editor atau: npx prisma db execute --file prisma/sql/kas-entry.sql

CREATE TABLE IF NOT EXISTS "KasEntry" (
  "id" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "txnDate" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "kegiatan" TEXT NOT NULL DEFAULT '',
  "amountIn" INTEGER NOT NULL DEFAULT 0,
  "amountOut" INTEGER NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceHref" TEXT,
  "reconStatus" TEXT NOT NULL DEFAULT 'open',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KasEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KasEntry_sourceType_sourceId_scopeId_key"
  ON "KasEntry"("sourceType", "sourceId", "scopeId");

CREATE INDEX IF NOT EXISTS "KasEntry_scopeType_scopeId_txnDate_createdAt_idx"
  ON "KasEntry"("scopeType", "scopeId", "txnDate", "createdAt");

CREATE INDEX IF NOT EXISTS "KasEntry_scopeType_scopeId_kegiatan_idx"
  ON "KasEntry"("scopeType", "scopeId", "kegiatan");

CREATE TABLE IF NOT EXISTS "KasPeriodLock" (
  "id" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedById" TEXT,
  "unlockReason" TEXT,
  "unlockedAt" TIMESTAMP(3),
  CONSTRAINT "KasPeriodLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KasPeriodLock_scopeType_scopeId_yearMonth_key"
  ON "KasPeriodLock"("scopeType", "scopeId", "yearMonth");

CREATE INDEX IF NOT EXISTS "KasPeriodLock_scopeType_scopeId_idx"
  ON "KasPeriodLock"("scopeType", "scopeId");
