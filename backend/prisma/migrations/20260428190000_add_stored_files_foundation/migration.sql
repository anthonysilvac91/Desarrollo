CREATE TYPE "StoredFileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "StoredFileStatus" AS ENUM ('READY', 'DELETING', 'DELETED', 'FAILED');
CREATE TYPE "StoredFileKind" AS ENUM ('ORG_LOGO', 'USER_AVATAR', 'ASSET_THUMBNAIL', 'SERVICE_ATTACHMENT', 'COMPANY_LOGO');

CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "storage_ref" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "kind" "StoredFileKind" NOT NULL,
    "visibility" "StoredFileVisibility" NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT,
    "status" "StoredFileStatus" NOT NULL DEFAULT 'READY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Organization" ADD COLUMN "logo_file_id" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar_file_id" TEXT;
ALTER TABLE "Asset" ADD COLUMN "thumbnail_file_id" TEXT;
ALTER TABLE "Company" ADD COLUMN "logo_file_id" TEXT;
ALTER TABLE "ServiceAttachment" ADD COLUMN "file_id" TEXT;

CREATE UNIQUE INDEX "StoredFile_storage_ref_key" ON "StoredFile"("storage_ref");
CREATE INDEX "StoredFile_organization_id_idx" ON "StoredFile"("organization_id");
CREATE INDEX "StoredFile_owner_type_owner_id_idx" ON "StoredFile"("owner_type", "owner_id");
CREATE INDEX "StoredFile_kind_idx" ON "StoredFile"("kind");
CREATE INDEX "StoredFile_status_idx" ON "StoredFile"("status");

CREATE UNIQUE INDEX "Organization_logo_file_id_key" ON "Organization"("logo_file_id");
CREATE UNIQUE INDEX "User_avatar_file_id_key" ON "User"("avatar_file_id");
CREATE UNIQUE INDEX "Asset_thumbnail_file_id_key" ON "Asset"("thumbnail_file_id");
CREATE UNIQUE INDEX "Company_logo_file_id_key" ON "Company"("logo_file_id");
CREATE UNIQUE INDEX "ServiceAttachment_file_id_key" ON "ServiceAttachment"("file_id");

ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_thumbnail_file_id_fkey" FOREIGN KEY ("thumbnail_file_id") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceAttachment" ADD CONSTRAINT "ServiceAttachment_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
