-- Add irreversible logical deletion marker for users.
ALTER TABLE "User"
ADD COLUMN "purged_at" TIMESTAMP(3),
ADD COLUMN "purged_by_id" TEXT;

CREATE INDEX "User_purged_at_idx" ON "User"("purged_at");
