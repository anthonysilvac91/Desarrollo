ALTER TABLE "User" RENAME COLUMN "customer_id" TO "company_id";

ALTER TABLE "Asset" RENAME COLUMN "customer_id" TO "company_id";

ALTER TABLE "Customer" RENAME TO "Company";

ALTER INDEX "Customer_pkey" RENAME TO "Company_pkey";
ALTER INDEX "Customer_organization_id_idx" RENAME TO "Company_organization_id_idx";
ALTER INDEX "Customer_is_active_idx" RENAME TO "Company_is_active_idx";

ALTER TABLE "User" RENAME CONSTRAINT "User_customer_id_fkey" TO "User_company_id_fkey";
ALTER TABLE "Asset" RENAME CONSTRAINT "Asset_customer_id_fkey" TO "Asset_company_id_fkey";
ALTER TABLE "Company" RENAME CONSTRAINT "Customer_organization_id_fkey" TO "Company_organization_id_fkey";
