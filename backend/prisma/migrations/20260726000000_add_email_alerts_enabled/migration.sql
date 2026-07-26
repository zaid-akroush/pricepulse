-- Adds a per-user opt-out for price-drop emails. In-app notifications are
-- unaffected by this flag and always fire; this only gates the Resend email.
ALTER TABLE "User" ADD COLUMN "emailAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
