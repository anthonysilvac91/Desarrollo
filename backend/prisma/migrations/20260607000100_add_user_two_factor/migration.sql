ALTER TABLE "User"
  ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "two_factor_secret" TEXT,
  ADD COLUMN "two_factor_backup_codes" JSONB;

CREATE INDEX "User_two_factor_enabled_idx" ON "User"("two_factor_enabled");
