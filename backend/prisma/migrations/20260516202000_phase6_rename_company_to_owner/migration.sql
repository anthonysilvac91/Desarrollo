-- Phase 6.4: Rename Company → Owner at DB level
-- Eliminates @@map("Company") / @map("company_id") — DB now matches Prisma model names exactly

-- Step 1: Rename columns in User and Asset (before renaming the table)
ALTER TABLE "User" RENAME COLUMN "company_id" TO "owner_id";
ALTER TABLE "Asset" RENAME COLUMN "company_id" TO "owner_id";

-- Step 2: Rename Company table to Owner
ALTER TABLE "Company" RENAME TO "Owner";

-- Step 3: Rename primary key index
ALTER INDEX "Company_pkey" RENAME TO "Owner_pkey";

-- Step 4: Rename FK constraints on User and Asset (reference the renamed column)
ALTER TABLE "User" RENAME CONSTRAINT "User_company_id_fkey" TO "User_owner_id_fkey";
ALTER TABLE "Asset" RENAME CONSTRAINT "Asset_company_id_fkey" TO "Asset_owner_id_fkey";

-- Step 5: Rename FK constraints on Owner table (using new table name)
ALTER TABLE "Owner" RENAME CONSTRAINT "Company_organization_id_fkey" TO "Owner_organization_id_fkey";
ALTER TABLE "Owner" RENAME CONSTRAINT "Company_logo_file_id_fkey" TO "Owner_logo_file_id_fkey";

-- Step 6: Rename indexes on Owner table
ALTER INDEX "Company_organization_id_idx" RENAME TO "Owner_organization_id_idx";
ALTER INDEX "Company_is_active_idx" RENAME TO "Owner_is_active_idx";
ALTER INDEX "Company_organization_id_created_at_idx" RENAME TO "Owner_organization_id_created_at_idx";
ALTER INDEX "Company_logo_file_id_key" RENAME TO "Owner_logo_file_id_key";

-- Step 7: Rename indexes on User and Asset tables
ALTER INDEX "User_company_id_idx" RENAME TO "User_owner_id_idx";
ALTER INDEX "Asset_company_id_idx" RENAME TO "Asset_owner_id_idx";
ALTER INDEX "Asset_organization_id_company_id_idx" RENAME TO "Asset_organization_id_owner_id_idx";
