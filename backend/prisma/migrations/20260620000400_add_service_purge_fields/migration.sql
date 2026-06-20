-- Add irreversible logical deletion marker for services.
ALTER TABLE "Service"
ADD COLUMN "purged_at" TIMESTAMP(3),
ADD COLUMN "purged_by_id" TEXT;

CREATE INDEX "Service_purged_at_idx" ON "Service"("purged_at");
