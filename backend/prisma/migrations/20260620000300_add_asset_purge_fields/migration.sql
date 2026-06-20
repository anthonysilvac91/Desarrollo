-- Add irreversible logical deletion marker for assets.
ALTER TABLE "Asset"
ADD COLUMN "purged_at" TIMESTAMP(3),
ADD COLUMN "purged_by_id" TEXT;

CREATE INDEX "Asset_purged_at_idx" ON "Asset"("purged_at");
