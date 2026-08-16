-- Arsip TTD digital anggota (ops / production). Safe to re-run.
-- Shared UKT / kwitansi Member.signatureUrl + signatureUpdatedAt.

ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureUpdatedAt" TIMESTAMP(3);
