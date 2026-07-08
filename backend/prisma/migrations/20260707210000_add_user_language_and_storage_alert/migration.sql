ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es';

ALTER TABLE "OrganizationStorageUsage" ADD COLUMN "last_storage_alert_pct" INTEGER;
