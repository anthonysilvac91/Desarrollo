-- DropIndex
DROP INDEX "Service_asset_id_is_public_created_at_idx";

-- CreateIndex
CREATE INDEX "Service_asset_id_is_public_created_at_idx" ON "Service"("asset_id", "is_public", "created_at");
