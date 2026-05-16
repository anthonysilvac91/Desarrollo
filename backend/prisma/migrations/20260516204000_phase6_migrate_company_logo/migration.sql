-- Phase 6.6 Step 2: Migrate data and remove COMPANY_LOGO from enum

-- Migrate existing records to canonical kind value
UPDATE "StoredFile" SET kind = 'OWNER_LOGO' WHERE kind = 'COMPANY_LOGO';

-- Recreate enum without COMPANY_LOGO
ALTER TYPE "StoredFileKind" RENAME TO "StoredFileKind_old";
CREATE TYPE "StoredFileKind" AS ENUM ('ORG_LOGO', 'USER_AVATAR', 'ASSET_THUMBNAIL', 'SERVICE_ATTACHMENT', 'OWNER_LOGO');
ALTER TABLE "StoredFile" ALTER COLUMN "kind" TYPE "StoredFileKind" USING kind::text::"StoredFileKind";
DROP TYPE "StoredFileKind_old";
