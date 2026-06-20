-- Add irreversible logical deletion marker for owners.
ALTER TABLE "Owner"
ADD COLUMN "purged_at" TIMESTAMP(3),
ADD COLUMN "purged_by_id" TEXT;

CREATE INDEX "Owner_purged_at_idx" ON "Owner"("purged_at");
