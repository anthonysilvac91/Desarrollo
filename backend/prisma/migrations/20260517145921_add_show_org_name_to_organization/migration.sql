-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_owner_same_organization_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_asset_same_organization_fkey";

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "show_org_name" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
