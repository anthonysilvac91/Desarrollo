-- AlterTable
ALTER TABLE "User" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_id" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_id" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_id" TEXT;

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_id" TEXT;

-- CreateIndex
CREATE INDEX "User_deleted_at_idx" ON "User"("deleted_at");

-- CreateIndex
CREATE INDEX "Asset_deleted_at_idx" ON "Asset"("deleted_at");

-- CreateIndex
CREATE INDEX "Service_deleted_at_idx" ON "Service"("deleted_at");

-- CreateIndex
CREATE INDEX "Owner_deleted_at_idx" ON "Owner"("deleted_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
