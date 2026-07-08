ALTER TABLE "User" ADD COLUMN "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User" ADD COLUMN "security_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;
