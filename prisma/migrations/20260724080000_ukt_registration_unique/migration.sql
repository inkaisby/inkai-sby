-- Satu anggota = satu registrasi aktif per event (anti-bentrok daftar mandiri ↔ ranting)
CREATE UNIQUE INDEX IF NOT EXISTS "EventRegistration_eventId_memberId_key"
  ON "EventRegistration"("eventId", "memberId");
