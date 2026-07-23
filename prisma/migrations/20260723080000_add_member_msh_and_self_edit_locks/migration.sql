-- Migration: add_member_msh_and_self_edit_locks
-- No. MSH untuk sabuk Hitam (DAN) + kunci edit mandiri 1x (email/NIA/sabuk/MSH)

ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "mshNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Member_mshNumber_key" ON "Member" ("mshNumber") WHERE "mshNumber" IS NOT NULL;

ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "emailSelfEditedAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "niaSelfEditedAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "rankSelfEditedAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "mshSelfEditedAt" TIMESTAMP(3);
