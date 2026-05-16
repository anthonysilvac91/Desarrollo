-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT;

-- CreateIndex
CREATE INDEX "StoredFile_entity_type_entity_id_idx" ON "StoredFile"("entity_type", "entity_id");
