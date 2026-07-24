-- Admin perf / security query indexes (idempotent)
CREATE INDEX IF NOT EXISTS "Billing_registrationId_idx" ON "Billing"("registrationId");
CREATE INDEX IF NOT EXISTS "Billing_memberId_isDeleted_type_idx" ON "Billing"("memberId", "isDeleted", "type");
CREATE INDEX IF NOT EXISTS "Event_isDeleted_endDate_idx" ON "Event"("isDeleted", "endDate");
CREATE INDEX IF NOT EXISTS "Event_isDeleted_registrationCloseAt_idx" ON "Event"("isDeleted", "registrationCloseAt");
CREATE INDEX IF NOT EXISTS "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");
CREATE INDEX IF NOT EXISTS "AppreciationEntry_isActive_kind_order_idx" ON "AppreciationEntry"("isActive", "kind", "order");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
