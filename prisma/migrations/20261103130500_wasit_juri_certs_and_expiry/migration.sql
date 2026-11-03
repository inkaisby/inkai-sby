-- Add certification specific documents & license validity date to WasitJuriRegistration
ALTER TABLE "WasitJuriRegistration" ADD COLUMN IF NOT EXISTS "danCertificateUrl" TEXT;
ALTER TABLE "WasitJuriRegistration" ADD COLUMN IF NOT EXISTS "licenseCertUrl" TEXT;
ALTER TABLE "WasitJuriRegistration" ADD COLUMN IF NOT EXISTS "licenseValidUntil" DATE;
