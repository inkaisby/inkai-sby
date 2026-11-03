-- WasitJuriPeriod + WasitJuriRegistration (portal inkai-sby)
-- Apply ke DB produksi app Vercel (ref ztrryuhhdoqdglajukuw):
-- Supabase SQL Editor atau: npx prisma db execute --file prisma/sql/wasit-juri.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "WasitJuriPeriod" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "levelScope" TEXT NOT NULL DEFAULT 'Cabang',
  "theoryDate" DATE NOT NULL,
  "practicalDate" DATE NOT NULL,
  "closeDate" DATE NOT NULL,
  "location" TEXT NOT NULL,
  "quota" INTEGER NOT NULL DEFAULT 50,
  "feeNew" INTEGER NOT NULL DEFAULT 350000,
  "feeUpgrade" INTEGER NOT NULL DEFAULT 300000,
  "feeRefreshing" INTEGER NOT NULL DEFAULT 200000,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" DATE,
  "branchId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WasitJuriPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WasitJuriPeriod_isArchived_practicalDate_idx"
  ON "WasitJuriPeriod"("isArchived", "practicalDate");

CREATE INDEX IF NOT EXISTS "WasitJuriPeriod_branchId_isArchived_idx"
  ON "WasitJuriPeriod"("branchId", "isArchived");

CREATE TABLE IF NOT EXISTS "WasitJuriRegistration" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "dojoId" TEXT NOT NULL,
  "registeredByUserId" TEXT,
  "danRankSnapshot" TEXT NOT NULL DEFAULT 'DAN I',
  "mshNumberSnapshot" TEXT,
  "submissionType" TEXT NOT NULL DEFAULT 'BARU',
  "currentLicense" TEXT,
  "targetGrade" TEXT NOT NULL DEFAULT 'JURI_B',
  "discipline" TEXT NOT NULL DEFAULT 'KATA_KUMITE',
  "feeAmount" INTEGER NOT NULL DEFAULT 350000,
  "paymentState" TEXT NOT NULL DEFAULT 'BELUM_BAYAR',
  "paymentMethod" TEXT DEFAULT 'TRANSFER',
  "proofUrl" TEXT,
  "danCertificateUrl" TEXT,
  "licenseCertUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'MENUNGGU_BERKAS',
  "scoreTeoriKata" INTEGER,
  "scoreTeoriKumite" INTEGER,
  "scorePraktik" INTEGER,
  "grantedLicense" TEXT,
  "licenseValidUntil" DATE,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WasitJuriRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WasitJuriRegistration_periodId_memberId_key"
  ON "WasitJuriRegistration"("periodId", "memberId");

CREATE INDEX IF NOT EXISTS "WasitJuriRegistration_periodId_dojoId_idx"
  ON "WasitJuriRegistration"("periodId", "dojoId");

CREATE INDEX IF NOT EXISTS "WasitJuriRegistration_memberId_idx"
  ON "WasitJuriRegistration"("memberId");

CREATE INDEX IF NOT EXISTS "WasitJuriRegistration_periodId_status_idx"
  ON "WasitJuriRegistration"("periodId", "status");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WasitJuriRegistration_periodId_fkey'
  ) THEN
    ALTER TABLE "WasitJuriRegistration"
      ADD CONSTRAINT "WasitJuriRegistration_periodId_fkey"
      FOREIGN KEY ("periodId") REFERENCES "WasitJuriPeriod"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WasitJuriRegistration_memberId_fkey'
  ) THEN
    ALTER TABLE "WasitJuriRegistration"
      ADD CONSTRAINT "WasitJuriRegistration_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES "Member"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WasitJuriRegistration_dojoId_fkey'
  ) THEN
    ALTER TABLE "WasitJuriRegistration"
      ADD CONSTRAINT "WasitJuriRegistration_dojoId_fkey"
      FOREIGN KEY ("dojoId") REFERENCES "Dojo"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "WasitJuriPeriod" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WasitJuriRegistration" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "WasitJuriRegistration" ADD COLUMN IF NOT EXISTS "danCertificateUrl" TEXT;
ALTER TABLE "WasitJuriRegistration" ADD COLUMN IF NOT EXISTS "licenseCertUrl" TEXT;
ALTER TABLE "WasitJuriRegistration" ADD COLUMN IF NOT EXISTS "licenseValidUntil" DATE;

ALTER TABLE public."WasitJuriPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WasitJuriPeriod" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."WasitJuriRegistration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WasitJuriRegistration" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."WasitJuriPeriod" FROM anon, authenticated;
REVOKE ALL ON TABLE public."WasitJuriRegistration" FROM anon, authenticated;
