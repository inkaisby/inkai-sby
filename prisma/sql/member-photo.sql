-- Foto profil kanonis per anggota. Safe to re-run.
-- User.photoUrl dipertahankan sebagai fallback/mirror untuk akun lama.

ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

UPDATE "Member" AS member
SET "photoUrl" = app_user."photoUrl"
FROM "User" AS app_user
WHERE app_user.id = member."userId"
  AND NULLIF(BTRIM(member."photoUrl"), '') IS NULL
  AND NULLIF(BTRIM(app_user."photoUrl"), '') IS NOT NULL;
